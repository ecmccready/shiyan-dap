/**
 * Anchoring path for tensor commitments (DIRECTIONAL; nothing is submitted).
 *
 * Builds a deterministic anchor payload for one run from its ledger entries
 * that carry a tensor commitment, and a Merkle root over those leaves. The
 * root is what a chain adapter would anchor. Only NullAnchorAdapter ships: it
 * never contacts a chain and always returns { anchored: false }.
 *
 * Encoding (all hashes SHA-256 via the sync sha256Hex in tensor.ts):
 *   canonical(x) = JSON with object keys sorted recursively, no whitespace.
 *   leaf_i  = H(0x00 || utf8(canonical({iter, status, tensor_commitment, tensor_distance})))
 *   node    = H(0x01 || left || right)               (32-byte raw digests)
 *   Odd node at a level is promoted unchanged to the next level.
 *   Leaves are ordered by iteration ascending. No leaves → root null.
 *   tensor_distance is fixed to 6 decimals (number) before encoding.
 *   root is written "sha256:<64 hex>".
 * The 0x00 / 0x01 prefixes separate leaves from nodes (as in RFC 6962).
 */
import type { ExperienceEntry } from "./experience-client";
import { toLedgerEntry, type LedgerStatus } from "./ledger";
import { sha256Hex } from "./tensor";

export const ANCHOR_VERSION = "aethel-anchor/1";

export type AnchorLeaf = {
  iter: number;
  tensor_commitment: string;
  tensor_distance: number;
  status: LedgerStatus;
};

export type AnchorPayload = {
  version: typeof ANCHOR_VERSION;
  run_id: string;
  leaf_encoding: string;
  node_encoding: string;
  iterations: AnchorLeaf[];
};

export function canonicalJson(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(canonicalJson).join(",") + "]";
  const o = v as Record<string, unknown>;
  return (
    "{" +
    Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => JSON.stringify(k) + ":" + canonicalJson(o[k]))
      .join(",") +
    "}"
  );
}

const enc = new TextEncoder();

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

export function leafHash(leaf: AnchorLeaf): string {
  return sha256Hex(concat(Uint8Array.of(0x00), enc.encode(canonicalJson(leaf))));
}

export function nodeHash(leftHex: string, rightHex: string): string {
  return sha256Hex(concat(Uint8Array.of(0x01), hexToBytes(leftHex), hexToBytes(rightHex)));
}

/** Merkle root over leaf hashes (hex). Returns "sha256:<hex>" or null when empty. */
export function merkleRoot(leafHashes: string[]): string | null {
  if (leafHashes.length === 0) return null;
  let level = leafHashes;
  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2)
      next.push(i + 1 < level.length ? nodeHash(level[i], level[i + 1]) : level[i]);
    level = next;
  }
  return "sha256:" + level[0];
}

export function anchorLeaves(entries: ExperienceEntry[], run_id: string): AnchorLeaf[] {
  return entries
    .filter((x) => x.run_id === run_id && typeof x.tensor_commitment === "string")
    .sort((a, b) => a.iteration - b.iteration)
    .map((x) => {
      const l = toLedgerEntry(x);
      return {
        iter: x.iteration,
        tensor_commitment: x.tensor_commitment as string,
        tensor_distance: Number((l.tensor_distance ?? NaN).toFixed(6)),
        status: l.status,
      };
    });
}

export function buildAnchorPayload(entries: ExperienceEntry[], run_id: string): {
  payload: AnchorPayload;
  canonical: string;
  leaves: string[];
  root: string | null;
} {
  const iterations = anchorLeaves(entries, run_id);
  const payload: AnchorPayload = {
    version: ANCHOR_VERSION,
    run_id,
    leaf_encoding: "sha256(0x00 || canonical_json({iter,status,tensor_commitment,tensor_distance}))",
    node_encoding: "sha256(0x01 || left || right); odd node promoted",
    iterations,
  };
  const leaves = iterations.map(leafHash);
  return { payload, canonical: canonicalJson(payload), leaves, root: merkleRoot(leaves) };
}

export type AnchorResult =
  | { anchored: true; chain: string; txId: string }
  | { anchored: false; chain: string | null; reason: string };

/** Interface a real chain adapter would implement. None is configured. */
export interface AnchorAdapter {
  chain: string | null;
  submit(root: string): Promise<AnchorResult>;
}

/** Dry run: never contacts a chain. */
export class NullAnchorAdapter implements AnchorAdapter {
  chain = null;
  async submit(): Promise<AnchorResult> {
    return { anchored: false, chain: null, reason: "no chain configured" };
  }
}
