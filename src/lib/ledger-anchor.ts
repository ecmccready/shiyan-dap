import { createHash } from 'node:crypto';
import { readLedger } from '@/lib/ledger-commit';

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
