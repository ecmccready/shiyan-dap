import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Redis } from '@upstash/redis';
import { LEDGER_AUDIT_STATUSES, type AssetDomain, type LedgerEventPayload, type LedgerRecordResponse } from '@/types/ledger';
import { signLedger, verifyLedgerSignature } from '@/lib/ledger-signing';
import { applySiwePolicy, withNonceResult, withNonceSource, parseSiweMessage, SIWE_NONCE_TTL_SECONDS, type SiweParse } from '@/lib/ledger-siwe';
import { verifyWalletSignature } from '@/lib/ledger-wallet';
import { plannedTransfersOf, resolveSettlement, TRANSFERS_FUTURE_WORK, type PlannedTransfer, type SettlementIntent, type SettlementRail } from '@/lib/ledger-settlement';

/**
 * wallet_siwe_verified / wallet_siwe_partial are the combined statuses for a wallet commit that includes a siweMessage:
 * the EIP-191 check AND the SIWE structure/policy checks AND a server-issued nonce must all pass for _verified.
 * eip1271_unsupported marks a contract wallet (contractWallet: true): nothing is verified.
 */
export type SignatureStatus = 'verified' | 'unverified' | 'wallet_verified' | 'wallet_unverified' | 'wallet_siwe_verified' | 'wallet_siwe_partial' | 'eip1271_unsupported';
export type SignatureType = 'hmac' | 'wallet';

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
 * QUEUED with a reason (logged and pushed to `ledger:settlement-queue`). STRIPE creates a real, unconfirmed
 * PaymentIntent when the key and guards allow it (see ledger-settlement.ts).
 * Soft delete: asset ids in the Redis set `ledger:hidden-assets` are hidden from reads; the event list
 * itself stays append-only.
 */
export const LEDGER_KEY = 'ledger:events';
export const LEDGER_HEADS = 'ledger:heads';
export const LEDGER_HIDDEN = 'ledger:hidden-assets';
export const LEDGER_SETTLEMENT_QUEUE = 'ledger:settlement-queue';
const RAILS: SettlementRail[] = ['INTERNAL_MICRO', 'STRIPE', 'X_MONEY'];
export interface CommitOptions {
  /** Sign the event on the server (for server-originated commits). */
  serverSign?: boolean;
  settlementRail?: string;
  /** Total to settle, in cents (needed for a real Stripe call). */
  settlementAmountCents?: number;
  settlementCurrency?: string;
  /** 'hmac' (default) or 'wallet' (EIP-191 personal_sign, basic check). */
  signatureType?: string;
  /** Wallet only: the address that claims to have signed. */
  walletAddress?: string;
  /** Wallet only: optional signed text; must contain the canonical string. */
  walletMessage?: string;
  /** Wallet only: optional SIWE-style (EIP-4361) text; it is the signed message and is parsed into `siwe`. */
  siweMessage?: string;
  /** Wallet only: domains a SIWE message's domain must match (the route passes configured domains or the request host). */
  siweExpectedDomains?: string[];
  /** Wallet only: the signer is a contract wallet (EIP-1271). Not supported: stored as eip1271_unsupported, nothing is verified. */
  contractWallet?: boolean;
  /** AGENT_COMPUTE: self-reported FLOP or cost estimate. Always stored as estimated, never metered. */
  usageEstimate?: unknown;
}

export interface UsageEstimate {
  estimated: true;
  metered: false;
  flops?: number;
  costUsd?: number;
  basis?: string;
  note: string;
}

/** Accepts only finite non-negative numbers and a short basis string; forces estimated:true and metered:false. */
export function sanitizeUsageEstimate(x: unknown): UsageEstimate | undefined {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return undefined;
  const o = x as Record<string, unknown>;
  const num = (v: unknown, max: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max ? v : undefined);
  const flops = num(o.flops, 1e30);
  const costUsd = num(o.costUsd, 1e9);
  if (flops === undefined && costUsd === undefined) return undefined;
  return {
    estimated: true,
    metered: false,
    ...(flops !== undefined ? { flops } : {}),
    ...(costUsd !== undefined ? { costUsd } : {}),
    ...(typeof o.basis === 'string' ? { basis: o.basis.slice(0, 80) } : {}),
    note: 'self-reported estimate, not metered',
  };
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
      response: LedgerRecordResponse & { previousHash: string | null; signatureStatus: SignatureStatus; signatureType: SignatureType; signatureReason: string | null; eip191Status: 'wallet_verified' | 'wallet_unverified' | null; contractWallet: boolean; walletAddress: string | null; siwe: SiweParse | null; usageEstimate: UsageEstimate | null; settlementRef: string | null; plannedTransfers: PlannedTransfer[] | null; settlementNote: string | null; settlement: SettlementIntent | null };
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
  if (s.auditStatus !== undefined && !LEDGER_AUDIT_STATUSES.includes(s.auditStatus)) return 'invalid stateData.auditStatus';
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
  if (opts.signatureType !== undefined && opts.signatureType !== 'hmac' && opts.signatureType !== 'wallet') {
    return { ok: false, status: 400, error: "signatureType must be 'hmac' or 'wallet'" };
  }
  const signatureType: SignatureType = opts.signatureType === 'wallet' ? 'wallet' : 'hmac';
  let signature: string;
  let signatureStatus: SignatureStatus;
  let signatureReason: string | undefined;
  let walletAddress: string | undefined;
  let eip191Status: 'wallet_verified' | 'wallet_unverified' | undefined;
  let siwe: SiweParse | undefined;
  if (opts.serverSign) {
    signature = signLedger(sigParts);
    signatureStatus = 'verified';
  } else if (signatureType === 'wallet') {
    if (!p.signature || p.signature === 'unsigned') return { ok: false, status: 400, error: 'signatureType wallet requires a signature' };
    signature = p.signature;
    if (opts.contractWallet === true) {
      // TODO(EIP-1271): a contract wallet's signature is valid if isValidSignature(hash, sig) on the wallet contract returns
      // 0x1626ba7e, which needs an RPC provider (eth_call on the claimed address and chain). Not implemented, so nothing is
      // claimed: no EOA recovery, no nonce consumed, status eip1271_unsupported. The SIWE text, if any, is only parsed.
      signatureStatus = 'eip1271_unsupported';
      signatureReason = 'eip1271_unsupported (contract wallet signatures are not verified; TODO: eth_call isValidSignature on the wallet contract)';
      walletAddress = typeof opts.walletAddress === 'string' && /^0x[0-9a-fA-F]{40}$/.test(opts.walletAddress) ? opts.walletAddress : undefined;
      if (opts.siweMessage !== undefined) {
        siwe = applySiwePolicy(parseSiweMessage(opts.siweMessage, { claimedAddress: opts.walletAddress }), { expectedDomains: opts.siweExpectedDomains ?? [] });
      }
    } else {
    // Basic EIP-191 personal_sign check (no EIP-1271 contract wallets, no full SIWE crypto). Never rejects: a
    // failed or unsupported check is stored as wallet_unverified with the reason.
    const w = verifyWalletSignature({ ...sigParts, timestamp: p.timestamp }, p.signature, { walletAddress: opts.walletAddress, walletMessage: opts.walletMessage, siweMessage: opts.siweMessage });
    siwe = w.siwe;
    if (siwe) {
      siwe = applySiwePolicy(siwe, { expectedDomains: opts.siweExpectedDomains ?? [] });
      // Replay guard and server-issued nonce: only a message whose signature verified touches nonce state, so a bad
      // signature cannot burn someone else's nonce. Both fail open ('unchecked') if the store is unavailable.
      const f = siwe.fields;
      if (w.ok && siwe.parsed && f?.nonce && /^[A-Za-z0-9]{8,}$/.test(f.nonce)) {
        siwe = withNonceResult(siwe, await claimSiweNonce(f.address, f.nonce));
        siwe = withNonceSource(siwe, await consumeIssuedNonce(f.nonce), process.env.SIWE_REQUIRE_ISSUED_NONCE === '1');
      }
    }
    eip191Status = w.ok ? 'wallet_verified' : 'wallet_unverified';
    if (w.ok) {
      signatureStatus = 'wallet_verified';
      walletAddress = w.address;
    } else {
      signatureStatus = 'wallet_unverified';
      signatureReason = w.reason;
      walletAddress = w.address;
    }
    // Combined status: with a siweMessage, wallet_siwe_verified needs the EIP-191 check, a valid structure and policy
    // result, and a nonce this server issued. Anything short of that is wallet_siwe_partial with the reasons listed.
    // A failed EIP-191 check stays wallet_unverified. Without a siweMessage nothing changes.
    if (siwe && w.ok) {
      const gaps = [...siwe.issues];
      if (siwe.policy && siwe.policy.nonceSource !== 'server_issued') gaps.push(`nonce_${siwe.policy.nonceSource === 'not_issued' ? 'not_server_issued' : 'unchecked'}`);
      if (!siwe.parsed) gaps.push('siwe_not_parsed');
      if (gaps.length === 0) {
        signatureStatus = 'wallet_siwe_verified';
      } else {
        signatureStatus = 'wallet_siwe_partial';
        signatureReason = [...new Set(gaps)].join('; ');
      }
    }
    }
  } else if (p.signature && p.signature !== 'unsigned') {
    if (p.timestamp === undefined) return { ok: false, status: 400, error: 'a signed event must include timestamp' };
    if (!verifyLedgerSignature(sigParts, p.signature)) return { ok: false, status: 400, error: 'invalid signature' };
    signature = p.signature;
    signatureStatus = 'verified';
  } else {
    signature = 'unsigned';
    signatureStatus = 'unverified';
  }
  const usageEstimate = sanitizeUsageEstimate(opts.usageEstimate);
  const splits = p.stateData!.splitRule;
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
    const settlement: SettlementIntent | null = splits?.length
      ? await resolveSettlement({
          rail,
          splits,
          txHash,
          assetId,
          signatureVerified: signatureStatus === 'verified',
          amountCents: opts.settlementAmountCents,
          currency: opts.settlementCurrency,
        })
      : null;
    const planned_transfers = plannedTransfersOf(settlement);
    const record = { ...event, txHash, signatureStatus, signatureType, ...(signatureReason ? { signatureReason } : {}), ...(eip191Status && siwe ? { eip191Status } : {}), ...(opts.contractWallet === true && signatureType === 'wallet' ? { contractWallet: true } : {}), ...(walletAddress ? { walletAddress } : {}), ...(siwe ? { siwe } : {}), ...(usageEstimate ? { usageEstimate } : {}), ...(settlement ? { settlement } : {}), ...(planned_transfers ? { planned_transfers } : {}) };
    let blockHeight: number;
    if (r) {
      blockHeight = await r.rpush(LEDGER_KEY, JSON.stringify(record));
      await r.hset(LEDGER_HEADS, { [assetId]: txHash });
      if (settlement && settlement.status === 'QUEUED') {
        await r.rpush(LEDGER_SETTLEMENT_QUEUE, JSON.stringify({ txHash, assetId, rail, splits, reason: settlement.reason, amountCents: settlement.amountCents, queuedAt: settlement.createdAt }));
      }
    } else {
      const mem = (g.__ledgerMem ??= []);
      mem.push(record);
      blockHeight = mem.length;
      (g.__ledgerHeads ??= new Map()).set(assetId, txHash);
    }
    if (settlement?.status === 'QUEUED') console.log(`[ledger] settlement queued: ${rail} reason=${settlement.reason} tx ${txHash} asset ${assetId}`);
    if (settlement?.status === 'CREATED') console.log(`[ledger] settlement created: ${rail} ${settlement.providerId} tx ${txHash} asset ${assetId}`);
    return {
      ok: true,
      store: r ? 'upstash' : 'memory',
      response: { txHash, status: 'CONFIRMED', settlementRail: rail, blockHeight, previousHash, signatureStatus, signatureType, signatureReason: signatureReason ?? null, eip191Status: eip191Status && siwe ? eip191Status : null, contractWallet: opts.contractWallet === true && signatureType === 'wallet', walletAddress: walletAddress ?? null, siwe: siwe ?? null, usageEstimate: usageEstimate ?? null, plannedTransfers: planned_transfers ?? null, settlementNote: planned_transfers ? TRANSFERS_FUTURE_WORK : null, settlementRef: settlement ? (settlement.providerId ?? settlement.reason ?? settlement.status) : null, settlement },
    };
  } catch {
    return { ok: false, status: 502, error: 'ledger storage unavailable' };
  } finally {
    if (r && locked) await r.del(lockKey).catch(() => undefined);
  }
}

const ISSUED_PREFIX = 'ledger:siwe-issued:';
/** How long a server-issued nonce can be used. Matches the SIWE issuedAt max age. */
export const SIWE_ISSUED_NONCE_TTL_SECONDS = 600;

/** Issues a server nonce (24 hex chars) and stores it with a short TTL: Redis when configured, else per-instance memory. */
export async function issueSiweNonce(): Promise<{ nonce: string; ttlSeconds: number; store: 'upstash' | 'memory' }> {
  const nonce = randomBytes(12).toString('hex');
  const r = ledgerRedis();
  if (r) {
    await r.set(`${ISSUED_PREFIX}${nonce}`, '1', { ex: SIWE_ISSUED_NONCE_TTL_SECONDS });
    return { nonce, ttlSeconds: SIWE_ISSUED_NONCE_TTL_SECONDS, store: 'upstash' };
  }
  const m = ((globalThis as unknown as { __siweIssued?: Map<string, number> }).__siweIssued ??= new Map());
  const now = Date.now();
  for (const [k, exp] of m) if (exp < now) m.delete(k);
  m.set(nonce, now + SIWE_ISSUED_NONCE_TTL_SECONDS * 1000);
  return { nonce, ttlSeconds: SIWE_ISSUED_NONCE_TTL_SECONDS, store: 'memory' };
}

/** Consumes a server-issued nonce (single use). 'server_issued' if it existed, 'not_issued' if unknown, expired or used, 'unchecked' on a store error. */
export async function consumeIssuedNonce(nonce: string): Promise<'server_issued' | 'not_issued' | 'unchecked'> {
  const r = ledgerRedis();
  try {
    if (r) return (await r.del(`${ISSUED_PREFIX}${nonce}`)) === 1 ? 'server_issued' : 'not_issued';
  } catch {
    return 'unchecked';
  }
  const m = (globalThis as unknown as { __siweIssued?: Map<string, number> }).__siweIssued;
  const exp = m?.get(nonce);
  if (!m || exp === undefined) return 'not_issued';
  m.delete(nonce);
  return exp >= Date.now() ? 'server_issued' : 'not_issued';
}

/** Claims `address:nonce` for the replay window. 'fresh' on first use, 'replayed' if already claimed. Redis SET NX, else memory. */
export async function claimSiweNonce(address: string, nonce: string): Promise<'fresh' | 'replayed' | 'unchecked'> {
  const id = `${address.toLowerCase()}:${nonce}`;
  const r = ledgerRedis();
  try {
    if (r) {
      return (await r.set(`ledger:siwe-nonce:${id}`, '1', { nx: true, ex: SIWE_NONCE_TTL_SECONDS })) === 'OK' ? 'fresh' : 'replayed';
    }
  } catch {
    return 'unchecked';
  }
  const m = ((globalThis as unknown as { __siweNonces?: Map<string, number> }).__siweNonces ??= new Map());
  const now = Date.now();
  for (const [k, exp] of m) if (exp < now) m.delete(k);
  if (m.has(id)) return 'replayed';
  m.set(id, now + SIWE_NONCE_TTL_SECONDS * 1000);
  return 'fresh';
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

/**
 * Hard purge: permanently removes every stored event and queued settlement of an asset, and its chain head
 * and hidden flag. Irreversible. Uses a client with automatic JSON parsing off so list members are removed by
 * their exact stored string. Does not touch anything already created at an external provider (e.g. Stripe).
 */
export async function purgeAsset(assetId: string): Promise<{ removedEvents: number; removedQueue: number }> {
  const url = process.env.UPSTASH_KV_REST_API_URL;
  const token = process.env.UPSTASH_KV_REST_API_TOKEN;
  if (url && token) {
    const raw = new Redis({ url, token, automaticDeserialization: false });
    const sweep = async (key: string) => {
      const all = (await raw.lrange(key, 0, -1)) as string[];
      let removed = 0;
      for (const item of all) {
        let a: unknown;
        try {
          a = (JSON.parse(item) as { assetId?: string }).assetId;
        } catch {
          continue;
        }
        if (a === assetId) removed += (await raw.lrem(key, 1, item)) as number;
      }
      return removed;
    };
    const removedEvents = await sweep(LEDGER_KEY);
    const removedQueue = await sweep(LEDGER_SETTLEMENT_QUEUE);
    await raw.hdel(LEDGER_HEADS, assetId);
    await raw.srem(LEDGER_HIDDEN, assetId);
    return { removedEvents, removedQueue };
  }
  const before = (g.__ledgerMem ?? []).length;
  g.__ledgerMem = (g.__ledgerMem ?? []).filter((e) => e.assetId !== assetId);
  g.__ledgerHeads?.delete(assetId);
  g.__ledgerHidden?.delete(assetId);
  return { removedEvents: before - g.__ledgerMem.length, removedQueue: 0 };
}

/** Cheap summary for the status endpoint: total stored events (hidden included) and the latest txHash. */
export async function ledgerSummary(): Promise<{ store: 'upstash' | 'memory'; count: number; latestTxHash: string | null }> {
  const r = ledgerRedis();
  if (r) {
    const count = await r.llen(LEDGER_KEY);
    const last = count > 0 ? ((await r.lindex(LEDGER_KEY, -1)) as { txHash?: string } | null) : null;
    return { store: 'upstash', count, latestTxHash: last?.txHash ?? null };
  }
  const mem = g.__ledgerMem ?? [];
  return { store: 'memory', count: mem.length, latestTxHash: mem.length ? mem[mem.length - 1].txHash : null };
}
