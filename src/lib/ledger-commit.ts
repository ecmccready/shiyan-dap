import { createHash, randomUUID } from 'node:crypto';
import { Redis } from '@upstash/redis';
import type { AssetDomain, LedgerEventPayload, LedgerRecordResponse } from '@/types/ledger';

/**
 * Append-only micro-ledger (server only). Events go to Upstash Redis (list `ledger:events`) when
 * UPSTASH_KV_REST_API_URL/TOKEN are set, otherwise to a per-instance in-memory list.
 * Each event is chained: previousHash is set server-side to the txHash of the latest event for the
 * same assetId (null for the first), overriding any client value. The per-asset head lives in the
 * hash `ledger:heads`. Redis commits for one asset are serialized with a short SET NX lock
 * (`ledger:lock:<assetId>`, 10s expiry, ~2.5s of retries); if the lock cannot be taken the commit
 * fails with 503 rather than forking the chain. Memory mode has no await between read and write.
 * Missing eventId, version, signature and timestamp are filled in so partial callers still work.
 * Settlement is internal and off-chain: nothing is anchored on a blockchain.
 * TODO: verify `signature` (proof of origin). It is stored but not checked yet.
 */
export const LEDGER_KEY = 'ledger:events';
export const LEDGER_HEADS = 'ledger:heads';
const DOMAINS: AssetDomain[] = ['MUSIC_TRACK', 'STEM', 'DIAGNOSTIC_AUDIT', 'AGENT_COMPUTE'];
const g = globalThis as unknown as {
  __ledgerMem?: Array<LedgerEventPayload & { txHash: string }>;
  __ledgerHeads?: Map<string, string>;
};

export function ledgerRedis(): Redis | null {
  const url = process.env.UPSTASH_KV_REST_API_URL;
  const token = process.env.UPSTASH_KV_REST_API_TOKEN;
  return url && token ? new Redis({ url, token }) : null;
}

export type CommitResult =
  | { ok: true; response: LedgerRecordResponse & { previousHash: string | null }; store: 'upstash' | 'memory' }
  | { ok: false; status: number; error: string };

export function validateLedgerPayload(p: Partial<LedgerEventPayload> | null): string | null {
  if (!p || typeof p !== 'object') return 'body must be an object';
  if (typeof p.assetId !== 'string' || !p.assetId) return 'missing or invalid field: assetId';
  for (const k of ['eventId', 'version', 'signature'] as const) {
    if (p[k] !== undefined && (typeof p[k] !== 'string' || !p[k])) return `invalid field: ${k}`;
  }
  if (!p.domain || !DOMAINS.includes(p.domain)) return 'missing or invalid field: domain';
  if (p.timestamp !== undefined && (typeof p.timestamp !== 'number' || !Number.isFinite(p.timestamp))) return 'timestamp must be a number';
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function commitLedgerEvent(p: Partial<LedgerEventPayload>): Promise<CommitResult> {
  const err = validateLedgerPayload(p);
  if (err) return { ok: false, status: 400, error: err };
  const r = ledgerRedis();
  const assetId = p.assetId as string;
  const lockKey = `ledger:lock:${assetId}`;
  let locked = false;
  try {
    if (r) {
      for (let i = 0; i < 50 && !locked; i++) {
        locked = (await r.set(lockKey, '1', { nx: true, ex: 10 })) === 'OK';
        if (!locked) await sleep(50);
      }
      if (!locked) return { ok: false, status: 503, error: 'ledger busy for this asset, retry' };
    }
    const previousHash = r
      ? ((await r.hget<string>(LEDGER_HEADS, assetId)) ?? null)
      : ((g.__ledgerHeads ??= new Map()).get(assetId) ?? null);
    const event: LedgerEventPayload = {
      ...(p as LedgerEventPayload),
      eventId: p.eventId ?? `evt_${randomUUID()}`,
      version: p.version ?? '1',
      signature: p.signature ?? 'unsigned',
      timestamp: p.timestamp ?? Date.now(),
      previousHash,
    };
    const txHash = '0x' + createHash('sha256').update(JSON.stringify(event)).digest('hex');
    const record = { ...event, txHash };
    let blockHeight: number;
    if (r) {
      blockHeight = await r.rpush(LEDGER_KEY, JSON.stringify(record));
      await r.hset(LEDGER_HEADS, { [assetId]: txHash });
    } else {
      const mem = (g.__ledgerMem ??= []);
      mem.push(record);
      blockHeight = mem.length;
      (g.__ledgerHeads ??= new Map()).set(assetId, txHash);
    }
    return {
      ok: true,
      store: r ? 'upstash' : 'memory',
      response: { txHash, status: 'CONFIRMED', settlementRail: 'INTERNAL_MICRO', blockHeight, previousHash },
    };
  } catch {
    return { ok: false, status: 502, error: 'ledger storage unavailable' };
  } finally {
    if (r && locked) await r.del(lockKey).catch(() => undefined);
  }
}

export async function readLedger(limit: number) {
  const r = ledgerRedis();
  if (r) {
    const count = await r.llen(LEDGER_KEY);
    const raw = count ? await r.lrange<unknown>(LEDGER_KEY, Math.max(0, count - limit), -1) : [];
    const events = raw.map((x) => (typeof x === 'string' ? JSON.parse(x) : x));
    return { store: 'upstash' as const, anchor: 'off-chain' as const, count, events };
  }
  const mem = g.__ledgerMem ?? [];
  return { store: 'memory' as const, anchor: 'off-chain' as const, count: mem.length, events: mem.slice(-limit) };
}
