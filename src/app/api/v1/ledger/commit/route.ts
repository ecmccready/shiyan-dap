import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { Redis } from '@upstash/redis';
import type { AssetDomain, LedgerEventPayload, LedgerRecordResponse } from '@/types/ledger';

export const dynamic = 'force-dynamic';

/**
 * Append-only micro-ledger. Events are stored in Upstash Redis (list `ledger:events`) when
 * UPSTASH_KV_REST_API_URL/TOKEN are set, otherwise in a per-instance in-memory list.
 * Settlement is internal and off-chain: nothing is anchored on a blockchain, and the signature
 * field is stored but not cryptographically verified yet.
 */
const KEY = 'ledger:events';
const DOMAINS: AssetDomain[] = ['MUSIC_TRACK', 'STEM', 'DIAGNOSTIC_AUDIT', 'AGENT_COMPUTE'];
const g = globalThis as unknown as { __ledgerMem?: Array<LedgerEventPayload & { txHash: string }> };

function redis(): Redis | null {
  const url = process.env.UPSTASH_KV_REST_API_URL;
  const token = process.env.UPSTASH_KV_REST_API_TOKEN;
  return url && token ? new Redis({ url, token }) : null;
}

function fail(message: string, status = 400) {
  const body: LedgerRecordResponse = { txHash: '', status: 'FAILED', settlementRail: 'INTERNAL_MICRO' };
  return NextResponse.json({ ...body, error: message }, { status });
}

function validate(p: Partial<LedgerEventPayload> | null): string | null {
  if (!p || typeof p !== 'object') return 'body must be an object';
  for (const k of ['eventId', 'assetId', 'version', 'signature'] as const) {
    if (typeof p[k] !== 'string' || !p[k]) return `missing or invalid field: ${k}`;
  }
  if (!p.domain || !DOMAINS.includes(p.domain)) return 'missing or invalid field: domain';
  if (p.previousHash !== null && typeof p.previousHash !== 'string') return 'previousHash must be a string or null';
  if (typeof p.timestamp !== 'number' || !Number.isFinite(p.timestamp)) return 'timestamp must be a number';
  const s = p.stateData;
  if (!s || typeof s.metadataHash !== 'string' || !s.metadataHash) return 'stateData.metadataHash is required';
  if (s.auditStatus && !['PENDING', 'PASSED', 'FAILED'].includes(s.auditStatus)) return 'invalid stateData.auditStatus';
  if (s.splitRule) {
    if (!Array.isArray(s.splitRule) || s.splitRule.some((r) => !r?.account || typeof r.percentage !== 'number')) {
      return 'splitRule entries need account and numeric percentage';
    }
    const total = s.splitRule.reduce((t, r) => t + r.percentage, 0);
    if (Math.abs(total - 100) > 0.001) return 'splitRule percentages must sum to 100';
  }
  return null;
}

export async function POST(req: Request) {
  let p: Partial<LedgerEventPayload> | null;
  try {
    p = (await req.json()) as Partial<LedgerEventPayload>;
  } catch {
    return fail('invalid JSON body');
  }
  const err = validate(p);
  if (err) return fail(err);
  const event = p as LedgerEventPayload;
  const txHash = '0x' + createHash('sha256').update(JSON.stringify(event)).digest('hex');
  const record = { ...event, txHash };

  let blockHeight: number;
  const r = redis();
  try {
    if (r) {
      blockHeight = await r.rpush(KEY, JSON.stringify(record));
    } else {
      const mem = (g.__ledgerMem ??= []);
      mem.push(record);
      blockHeight = mem.length;
    }
  } catch {
    return fail('ledger storage unavailable', 502);
  }
  const body: LedgerRecordResponse = { txHash, status: 'CONFIRMED', settlementRail: 'INTERNAL_MICRO', blockHeight };
  return NextResponse.json(body, { headers: { 'x-ledger-store': r ? 'upstash' : 'memory', 'x-ledger-anchor': 'off-chain' } });
}

/** Read-only: total committed events and the latest few (default 5, max 50). */
export async function GET(req: Request) {
  const limit = Math.min(50, Math.max(1, Number(new URL(req.url).searchParams.get('limit')) || 5));
  const r = redis();
  try {
    if (r) {
      const count = await r.llen(KEY);
      const raw = count ? await r.lrange<unknown>(KEY, Math.max(0, count - limit), -1) : [];
      const events = raw.map((x) => (typeof x === 'string' ? JSON.parse(x) : x));
      return NextResponse.json({ store: 'upstash', anchor: 'off-chain', count, events });
    }
    const mem = g.__ledgerMem ?? [];
    return NextResponse.json({ store: 'memory', anchor: 'off-chain', count: mem.length, events: mem.slice(-limit) });
  } catch {
    return fail('ledger storage unavailable', 502);
  }
}
