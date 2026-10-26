import { createHash, randomUUID } from 'node:crypto';
import { Redis } from '@upstash/redis';
import type { AssetDomain, LedgerEventPayload, LedgerRecordResponse } from '@/types/ledger';
import { signLedger, verifyLedgerSignature } from '@/lib/ledger-signing';

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
 * Signatures (see ledger-signing.ts): a client-supplied signature must be a valid HMAC or the commit is
 * rejected (400). A missing or 'unsigned' signature is accepted but stored with signatureStatus
 * 'unverified' (chosen over rejecting so existing callers keep working, and never reported as verified).
 * Server-originated commits (scan and tool-execute routes) are signed by the server: 'verified'.
 * Settlement: an optional settlementRail (default INTERNAL_MICRO) and a splitRule summing to 100 create a
 * settlement intent stored on the event. INTERNAL_MICRO is marked SETTLED_INTERNAL; STRIPE and X_MONEY are
 * QUEUED (logged and pushed to `ledger:settlement-queue`); no payment provider is called.
 * Soft delete: asset ids in the Redis set `ledger:hidden-assets` are hidden from reads; the event list
 * itself stays append-only.
 */
export const LEDGER_KEY = 'ledger:events';
export const LEDGER_HEADS = 'ledger:heads';
export const LEDGER_HIDDEN = 'ledger:hidden-assets';
export const LEDGER_SETTLEMENT_QUEUE = 'ledger:settlement-queue';
export type SettlementRail = LedgerRecordResponse['settlementRail'];
const RAILS: SettlementRail[] = ['INTERNAL_MICRO', 'STRIPE', 'X_MONEY'];
export interface SettlementIntent {
  rail: SettlementRail;
  status: 'SETTLED_INTERNAL' | 'QUEUED';
  splits: NonNullable<LedgerEventPayload['stateData']['splitRule']>;
  createdAt: number;
  note: string;
}
export interface CommitOptions {
  /** Sign the event on the server (for server-originated commits). */
  serverSign?: boolean;
  settlementRail?: string;
}
const DOMAINS: AssetDomain[] = ['MUSIC_TRACK', 'STEM', 'DIAGNOSTIC_AUDIT', 'AGENT_COMPUTE'];
const g = globalThis as unknown as {
  __ledgerMem?: Array<LedgerEventPayload & { txHash: string }>;
  __ledgerHeads?: Map<string, string>;
  __ledgerHidden?: Set<string>;
};

export function ledgerRedis(): Redis | null {
  const url = process.env.UPSTASH_KV_REST_API_URL;
  const token = process.env.UPSTASH_KV_REST_API_TOKEN;
  return url && token ? new Redis({ url, token }) : null;
}

export type CommitResult =
  | {
      ok: true;
      response: LedgerRecordResponse & { previousHash: string | null; signatureStatus: 'verified' | 'unverified'; settlement: SettlementIntent | null };
      store: 'upstash' | 'memory';
    }
  | { ok: false; status: number; error: string };

export function validateLedgerPayload(p: Partial<LedgerEventPayload> | null): string | null {
  if (!p || typeof p !== 'object') return 'body must be an object';
  if (typeof p.assetId !== 'string' || !p.assetId) return 'missing or invalid field: assetId';
  for (const k of ['eventId', 'version', 'signature'] as const) {
    if (p[k] !== undefined && (typeof p[k] !== 'string' || !p[k])) return `invalid field: ${k}`;
  }
  // Format check only: non-empty string, at most 1024 chars. The signature is NOT cryptographically verified.
  if (typeof p.signature === 'string' && p.signature.length > 1024) return 'signature too long (max 1024 chars)';
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

export async function commitLedgerEvent(p: Partial<LedgerEventPayload>, opts: CommitOptions = {}): Promise<CommitResult> {
  const err = validateLedgerPayload(p);
  if (err) return { ok: false, status: 400, error: err };
  if (opts.settlementRail !== undefined && !RAILS.includes(opts.settlementRail as SettlementRail)) {
    return { ok: false, status: 400, error: `settlementRail must be one of ${RAILS.join(', ')}` };
  }
  const rail = (opts.settlementRail as SettlementRail | undefined) ?? 'INTERNAL_MICRO';
  const timestamp = p.timestamp ?? Date.now();
  const sigParts = { assetId: p.assetId as string, domain: p.domain as string, timestamp, metadataHash: p.stateData!.metadataHash };
  let signature: string;
  let signatureStatus: 'verified' | 'unverified';
  if (opts.serverSign) {
    signature = signLedger(sigParts);
    signatureStatus = 'verified';
  } else if (p.signature && p.signature !== 'unsigned') {
    if (p.timestamp === undefined) return { ok: false, status: 400, error: 'a signed event must include timestamp' };
    if (!verifyLedgerSignature(sigParts, p.signature)) return { ok: false, status: 400, error: 'invalid signature' };
    signature = p.signature;
    signatureStatus = 'verified';
  } else {
    signature = 'unsigned';
    signatureStatus = 'unverified';
  }
  const splits = p.stateData!.splitRule;
  const settlement: SettlementIntent | null = splits?.length
    ? {
        rail,
        status: rail === 'INTERNAL_MICRO' ? 'SETTLED_INTERNAL' : 'QUEUED',
        splits,
        createdAt: Date.now(),
        note:
          rail === 'INTERNAL_MICRO'
            ? 'settled internally on the micro-ledger; no external payment'
            : `settlement queued for ${rail}; no payment provider is called yet`,
      }
    : null;
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
      signature,
      timestamp,
      previousHash,
    };
    const txHash = '0x' + createHash('sha256').update(JSON.stringify(event)).digest('hex');
    const record = { ...event, txHash, signatureStatus, ...(settlement ? { settlement } : {}) };
    let blockHeight: number;
    if (r) {
      blockHeight = await r.rpush(LEDGER_KEY, JSON.stringify(record));
      await r.hset(LEDGER_HEADS, { [assetId]: txHash });
      if (settlement && settlement.status === 'QUEUED') {
        await r.rpush(LEDGER_SETTLEMENT_QUEUE, JSON.stringify({ txHash, assetId, rail, splits, queuedAt: settlement.createdAt }));
      }
    } else {
      const mem = (g.__ledgerMem ??= []);
      mem.push(record);
      blockHeight = mem.length;
      (g.__ledgerHeads ??= new Map()).set(assetId, txHash);
    }
    if (settlement?.status === 'QUEUED') console.log(`[ledger] settlement queued: ${rail} tx ${txHash} asset ${assetId}`);
    return {
      ok: true,
      store: r ? 'upstash' : 'memory',
      response: { txHash, status: 'CONFIRMED', settlementRail: rail, blockHeight, previousHash, signatureStatus, settlement },
    };
  } catch {
    return { ok: false, status: 502, error: 'ledger storage unavailable' };
  } finally {
    if (r && locked) await r.del(lockKey).catch(() => undefined);
  }
}

export async function hiddenAssets(): Promise<Set<string>> {
  const r = ledgerRedis();
  if (r) return new Set((await r.smembers(LEDGER_HIDDEN)) as string[]);
  return g.__ledgerHidden ?? new Set();
}

/** Soft delete (hide) or restore every event of an asset. Events are never removed from storage. */
export async function setAssetHidden(assetId: string, hidden: boolean): Promise<void> {
  const r = ledgerRedis();
  if (r) {
    if (hidden) await r.sadd(LEDGER_HIDDEN, assetId);
    else await r.srem(LEDGER_HIDDEN, assetId);
    return;
  }
  const set = (g.__ledgerHidden ??= new Set());
  if (hidden) set.add(assetId);
  else set.delete(assetId);
}

/**
 * Reads the ledger. Hidden assets are excluded unless includeHidden. With no hidden assets this is a
 * cheap LLEN + tail read; otherwise it scans the whole list to filter (fine at this scale).
 */
export async function readLedger(limit: number, includeHidden = false) {
  const r = ledgerRedis();
  const hidden = includeHidden ? new Set<string>() : await hiddenAssets();
  const hiddenAssetCount = includeHidden ? undefined : hidden.size;
  type Rec = LedgerEventPayload & { txHash: string };
  const mark = (e: Rec, all: Set<string>) => (all.has(e.assetId) ? { ...e, hidden: true } : e);
  if (r) {
    const count = await r.llen(LEDGER_KEY);
    if (includeHidden) {
      const all = await hiddenAssets();
      const raw = count ? await r.lrange<unknown>(LEDGER_KEY, Math.max(0, count - limit), -1) : [];
      const events = raw.map((x) => mark((typeof x === 'string' ? JSON.parse(x) : x) as Rec, all));
      return { store: 'upstash' as const, anchor: 'off-chain' as const, count, events, hiddenAssetCount: all.size };
    }
    if (hidden.size === 0) {
      const raw = count ? await r.lrange<unknown>(LEDGER_KEY, Math.max(0, count - limit), -1) : [];
      const events = raw.map((x) => (typeof x === 'string' ? JSON.parse(x) : x)) as Rec[];
      return { store: 'upstash' as const, anchor: 'off-chain' as const, count, events, hiddenAssetCount };
    }
    const rawAll = count ? await r.lrange<unknown>(LEDGER_KEY, 0, -1) : [];
    const visible = rawAll.map((x) => (typeof x === 'string' ? JSON.parse(x) : x) as Rec).filter((e) => !hidden.has(e.assetId));
    return { store: 'upstash' as const, anchor: 'off-chain' as const, count: visible.length, events: visible.slice(-limit), hiddenAssetCount };
  }
  const mem = (g.__ledgerMem ?? []) as Rec[];
  if (includeHidden) {
    const all = await hiddenAssets();
    return { store: 'memory' as const, anchor: 'off-chain' as const, count: mem.length, events: mem.slice(-limit).map((e) => mark(e, all)), hiddenAssetCount: all.size };
  }
  const visible = mem.filter((e) => !hidden.has(e.assetId));
  return { store: 'memory' as const, anchor: 'off-chain' as const, count: visible.length, events: visible.slice(-limit), hiddenAssetCount };
}
