import { createHash } from 'node:crypto';
import { ledgerRedis, readLedger } from '@/lib/ledger-commit';

/**
 * Anchor preparation for the micro-ledger. Builds a Merkle root over the txHashes of the most recent events
 * so the root could later be submitted on-chain. Nothing is submitted: `anchored` is always false.
 *
 * Algorithm `sha256-merkle-v1`: leaf = sha256("leaf:" + txHash), node = sha256("node:" + left + right) over hex
 * strings, an odd node at a level is paired with itself, and the root is `0x` plus 64 hex characters. The leaves
 * are the txHashes in ledger order (oldest first). Hidden (soft-deleted) events are included, so an admin hide
 * does not change the root; a hard purge does.
 */
export const ANCHOR_ALGORITHM = 'sha256-merkle-v1';
export const ANCHOR_NOTE = 'Root is prepared only. On-chain submission is not live; nothing has been anchored on a blockchain.';

const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const leafOf = (txHash: string) => sha(`leaf:${txHash}`);
const nodeOf = (l: string, r: string) => sha(`node:${l}${r}`);

export function merkleRootOf(txHashes: string[]): string | null {
  if (txHashes.length === 0) return null;
  let level = txHashes.map(leafOf);
  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) next.push(nodeOf(level[i], level[i + 1] ?? level[i]));
    level = next;
  }
  return '0x' + level[0];
}

export type ProofStep = { side: 'left' | 'right'; hash: string };

/** Inclusion proof for one leaf: the sibling at each level and which side it sits on. */
export function merkleProofOf(txHashes: string[], txHash: string): ProofStep[] | null {
  let idx = txHashes.indexOf(txHash);
  if (idx < 0) return null;
  let level = txHashes.map(leafOf);
  const proof: ProofStep[] = [];
  while (level.length > 1) {
    const sibIdx = idx % 2 === 0 ? idx + 1 : idx - 1;
    proof.push({ side: idx % 2 === 0 ? 'right' : 'left', hash: level[sibIdx] ?? level[idx] });
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) next.push(nodeOf(level[i], level[i + 1] ?? level[i]));
    level = next;
    idx = Math.floor(idx / 2);
  }
  return proof;
}

export interface LedgerAnchor {
  root: string | null;
  eventCount: number;
  anchored: false;
  algorithm: typeof ANCHOR_ALGORITHM;
  fromTxHash: string | null;
  toTxHash: string | null;
  store: 'upstash' | 'memory';
  generatedAt: number;
  note: string;
  proof?: { txHash: string; steps: ProofStep[] } | null;
}

/** Root over the latest `limit` events (1..500, default 100). Optionally includes an inclusion proof for `txHash`. */
export async function computeLedgerAnchor(limit = 100, txHash?: string): Promise<LedgerAnchor> {
  const n = Math.min(500, Math.max(1, Math.floor(limit) || 100));
  const snap = await readLedger(n, true);
  const hashes = snap.events.map((e) => e.txHash);
  const out: LedgerAnchor = {
    root: merkleRootOf(hashes),
    eventCount: hashes.length,
    anchored: false,
    algorithm: ANCHOR_ALGORITHM,
    fromTxHash: hashes[0] ?? null,
    toTxHash: hashes[hashes.length - 1] ?? null,
    store: snap.store,
    generatedAt: Date.now(),
    note: ANCHOR_NOTE,
  };
  if (txHash) {
    const steps = merkleProofOf(hashes, txHash);
    out.proof = steps ? { txHash, steps } : null;
  }
  return out;
}

// ---- Dry-run "submission" -------------------------------------------------------------------------------
// There is no chain connection. A dry run builds the current root, records an attempt, and returns a simulated
// tx hash and block number so the submission flow can be exercised. Nothing is sent anywhere.

export const ANCHOR_ATTEMPTS_KEY = 'ledger:anchor-attempts';
const ANCHOR_SEQ_KEY = 'ledger:anchor-seq';
const MAX_ATTEMPTS = 50;
export const DRY_RUN_NOTE =
  'DRY RUN. Nothing was submitted to any blockchain. The tx hash and block number are simulated and do not exist on any chain; anchored stays false.';

export interface AnchorAttempt {
  attemptId: string;
  status: 'dry-run';
  anchored: false;
  /** Target network name for the simulated receipt, or 'none (dry-run)' when none was requested. */
  network: string;
  root: string | null;
  eventCount: number;
  algorithm: typeof ANCHOR_ALGORITHM;
  fromTxHash: string | null;
  toTxHash: string | null;
  simulatedTxHash: string;
  simulatedBlockNumber: number;
  attemptedAt: number;
  note: string;
  /** Simulated transaction receipt for the requested network. Absent when no network was given (and on older attempts). */
  receipt?: SimulatedReceipt;
}

/** Networks a dry run can target. Gas prices are fixed illustrative numbers, NOT live market data. */
export const ANCHOR_NETWORKS: Record<string, { chainId: number; label: string; nativeSymbol: string; blockTimeSeconds: number; illustrativeGasPriceGwei: number; l2: boolean }> = {
  ethereum: { chainId: 1, label: 'Ethereum mainnet', nativeSymbol: 'ETH', blockTimeSeconds: 12, illustrativeGasPriceGwei: 15, l2: false },
  sepolia: { chainId: 11155111, label: 'Sepolia testnet', nativeSymbol: 'SepoliaETH', blockTimeSeconds: 12, illustrativeGasPriceGwei: 2, l2: false },
  polygon: { chainId: 137, label: 'Polygon PoS', nativeSymbol: 'POL', blockTimeSeconds: 2, illustrativeGasPriceGwei: 40, l2: false },
  base: { chainId: 8453, label: 'Base', nativeSymbol: 'ETH', blockTimeSeconds: 2, illustrativeGasPriceGwei: 0.05, l2: true },
  optimism: { chainId: 10, label: 'OP Mainnet', nativeSymbol: 'ETH', blockTimeSeconds: 2, illustrativeGasPriceGwei: 0.05, l2: true },
  arbitrum: { chainId: 42161, label: 'Arbitrum One', nativeSymbol: 'ETH', blockTimeSeconds: 0.25, illustrativeGasPriceGwei: 0.1, l2: true },
};
export const ANCHOR_NETWORK_NAMES = Object.keys(ANCHOR_NETWORKS);

export interface SimulatedReceipt {
  simulated: true;
  onChain: false;
  network: string;
  chainId: number;
  transactionHash: string;
  blockNumber: number;
  blockHash: string;
  status: 'simulated_success';
  from: null;
  to: null;
  gasUsed: number;
  gasUsedBreakdown: { base: number; calldata: number; storageWrite: number; overhead: number };
  effectiveGasPriceGwei: number;
  feeWei: string;
  feeNative: string;
  nativeSymbol: string;
  confirmations: 0;
  logs: [];
  estimateModel: string;
  note: string;
}

const RECEIPT_MODEL = 'anchor-gas-model-v1: 21000 base + calldata (4-byte selector + 32-byte root; 16 gas per non-zero byte, 4 per zero byte) + 22100 for one new storage slot + 3000 overhead. Illustrative, not an RPC estimate; L2 data fees are not modelled.';

/** Deterministic simulated receipt. No chain was contacted, so every field is made up from the root and the attempt. */
export function simulateAnchorReceipt(network: string, root: string | null, txHash: string, seq: number): SimulatedReceipt {
  const n = ANCHOR_NETWORKS[network];
  const rootHex = (root ?? '').replace(/^0x/, '');
  const data = Buffer.from('7f6dd6b4' + (/^[0-9a-f]{64}$/i.test(rootHex) ? rootHex : '0'.repeat(64)), 'hex'); // placeholder selector + root
  let calldata = 0;
  for (const b of data) calldata += b === 0 ? 4 : 16;
  const gasUsedBreakdown = { base: 21000, calldata, storageWrite: 22100, overhead: 3000 };
  const gasUsed = gasUsedBreakdown.base + calldata + gasUsedBreakdown.storageWrite + gasUsedBreakdown.overhead;
  const feeWei = BigInt(gasUsed) * BigInt(Math.round(n.illustrativeGasPriceGwei * 1e9));
  const WEI = BigInt('1000000000000000000');
  const whole = feeWei / WEI;
  const frac = (feeWei % WEI).toString().padStart(18, '0').replace(/0+$/, '');
  return {
    simulated: true,
    onChain: false,
    network,
    chainId: n.chainId,
    transactionHash: txHash,
    blockNumber: seq,
    blockHash: '0x' + sha(`dry-run-block:${network}:${txHash}`),
    status: 'simulated_success',
    from: null,
    to: null,
    gasUsed,
    gasUsedBreakdown,
    effectiveGasPriceGwei: n.illustrativeGasPriceGwei,
    feeWei: feeWei.toString(),
    feeNative: frac ? `${whole}.${frac}` : whole.toString(),
    nativeSymbol: n.nativeSymbol,
    confirmations: 0,
    logs: [],
    estimateModel: RECEIPT_MODEL,
    note: `SIMULATED receipt for ${n.label}. No transaction exists: the hashes and block number are made up, the gas price is a fixed illustrative number (not live), and nothing was anchored.`,
  };
}

const gm = globalThis as unknown as { __anchorAttempts?: AnchorAttempt[]; __anchorSeq?: number };

/** Records a dry-run submission of the current root. Returns null root attempts too (empty ledger), flagged by root: null. */
export async function dryRunAnchorSubmission(limit = 100, network?: string): Promise<AnchorAttempt> {
  const a = await computeLedgerAnchor(limit);
  const r = ledgerRedis();
  const seq = r ? await r.incr(ANCHOR_SEQ_KEY) : (gm.__anchorSeq = (gm.__anchorSeq ?? 0) + 1);
  const attemptedAt = Date.now();
  const simulatedTxHash = '0x' + sha(`dry-run-tx:${a.root ?? 'empty'}:${seq}:${attemptedAt}`);
  const attempt: AnchorAttempt = {
    attemptId: `anc_${seq}`,
    status: 'dry-run',
    anchored: false,
    network: network ?? 'none (dry-run)',
    root: a.root,
    eventCount: a.eventCount,
    algorithm: a.algorithm,
    fromTxHash: a.fromTxHash,
    toTxHash: a.toTxHash,
    simulatedTxHash,
    // Simulated: just the attempt sequence number, clearly not a real block height.
    simulatedBlockNumber: seq,
    attemptedAt,
    note: DRY_RUN_NOTE,
    ...(network ? { receipt: simulateAnchorReceipt(network, a.root, simulatedTxHash, seq) } : {}),
  };
  if (r) {
    await r.rpush(ANCHOR_ATTEMPTS_KEY, JSON.stringify(attempt));
    await r.ltrim(ANCHOR_ATTEMPTS_KEY, -MAX_ATTEMPTS, -1);
  } else {
    const list = (gm.__anchorAttempts ??= []);
    list.push(attempt);
    if (list.length > MAX_ATTEMPTS) list.splice(0, list.length - MAX_ATTEMPTS);
  }
  console.log(`[ledger] anchor dry-run ${attempt.attemptId}: root ${attempt.root ?? 'none'} over ${attempt.eventCount} events, simulated tx ${simulatedTxHash} (not on-chain)`);
  return attempt;
}

/** Most recent dry-run attempts, newest last. */
export async function recentAnchorAttempts(n = 10): Promise<AnchorAttempt[]> {
  const count = Math.min(MAX_ATTEMPTS, Math.max(1, Math.floor(n) || 10));
  const r = ledgerRedis();
  if (r) {
    const raw = await r.lrange<unknown>(ANCHOR_ATTEMPTS_KEY, -count, -1);
    return raw.map((x) => (typeof x === 'string' ? JSON.parse(x) : x) as AnchorAttempt);
  }
  return (gm.__anchorAttempts ?? []).slice(-count);
}
