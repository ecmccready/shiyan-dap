// 4D state compression (M5): pure helpers for a tenant's persisted chain head and its independent anchors.
// No I/O, no clock, no env. Shared by the read-only export reader (export-reader.ts) and the anchor writer
// (anchor-store.ts), so both compare a stored chain and its anchors in exactly the same way.

/** Tenant-scoped SELECT on the storage DB (shiyan.state_segments, migration 004). Hash/count/time columns only. */
export const CHAIN_HEADS_SQL = "SELECT tenant_id, seq, segment_sha256, prev_segment_sha256, point_count, window_closed_at, loss_mode, context_sha256 "
  + "FROM shiyan.state_segments WHERE tenant_id = $1 ORDER BY seq";
/** Tenant-scoped SELECT on the anchors DB (shiyan_anchor.state_chain_anchors, migration 005). */
export const STATE_ANCHORS_SQL = "SELECT tenant_id, seq, chain_head, segment_count, anchored_at "
  + "FROM shiyan_anchor.state_chain_anchors WHERE tenant_id = $1 ORDER BY seq";

const SHA256 = /^[0-9a-f]{64}$/;
const int = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && /^-?\d+$/.test(v) ? Number(v) : Number.NaN);
const iso = (v: unknown): string | null => {
  const t = v instanceof Date ? v.getTime() : typeof v === "string" ? Date.parse(v) : Number.NaN;
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
};

export interface ChainHeadRow {
  seq: number;
  segment_sha256: string;
  prev_segment_sha256: string | null;
  point_count: number;
  window_closed_at: string;
  loss_mode: "lossless" | "bounded";
  context: boolean;
}

export interface StateAnchorRow {
  seq: number;
  chain_head: string;
  segment_count: number;
  anchored_at: string;
}

export type Parsed<T> = { ok: true; rows: T[] } | { ok: false; reason: "foreign_row" | "malformed" | "broken_chain" };

/** Parses the stored chain's head columns. Foreign rows, bad shapes, gaps or broken links are refused, never repaired. */
export function parseChainHeads(raw: readonly unknown[], tenant: string): Parsed<ChainHeadRow> {
  const rows: ChainHeadRow[] = [];
  for (const x of raw) {
    const r = (typeof x === "object" && x !== null ? x : {}) as Record<string, unknown>;
    if (r.tenant_id !== tenant) return { ok: false, reason: "foreign_row" };
    const seq = int(r.seq), count = int(r.point_count), closed = iso(r.window_closed_at);
    const prev = r.prev_segment_sha256 ?? null;
    if (!Number.isSafeInteger(seq) || !Number.isSafeInteger(count) || count < 1 || closed === null
      || typeof r.segment_sha256 !== "string" || !SHA256.test(r.segment_sha256)
      || (prev !== null && (typeof prev !== "string" || !SHA256.test(prev)))
      || (r.loss_mode !== "lossless" && r.loss_mode !== "bounded")
      || (r.context_sha256 != null && (typeof r.context_sha256 !== "string" || !SHA256.test(r.context_sha256)))) {
      return { ok: false, reason: "malformed" };
    }
    rows.push({ seq, segment_sha256: r.segment_sha256, prev_segment_sha256: prev as string | null, point_count: count, window_closed_at: closed, loss_mode: r.loss_mode, context: r.context_sha256 != null });
  }
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].seq !== i || rows[i].prev_segment_sha256 !== (i === 0 ? null : rows[i - 1].segment_sha256)) return { ok: false, reason: "broken_chain" };
  }
  return { ok: true, rows };
}

/** Parses anchor rows. A foreign or malformed row is refused. */
export function parseStateAnchors(raw: readonly unknown[], tenant: string): Parsed<StateAnchorRow> {
  const rows: StateAnchorRow[] = [];
  for (const x of raw) {
    const r = (typeof x === "object" && x !== null ? x : {}) as Record<string, unknown>;
    if (r.tenant_id !== tenant) return { ok: false, reason: "foreign_row" };
    const seq = int(r.seq), count = int(r.segment_count), at = iso(r.anchored_at);
    if (!Number.isSafeInteger(seq) || seq < 0 || !Number.isSafeInteger(count) || typeof r.chain_head !== "string" || !SHA256.test(r.chain_head) || at === null) {
      return { ok: false, reason: "malformed" };
    }
    rows.push({ seq, chain_head: r.chain_head, segment_count: count, anchored_at: at });
  }
  rows.sort((a, b) => a.seq - b.seq);
  return { ok: true, rows };
}

export interface AnchorComparison {
  status: "anchored" | "unanchored" | "mismatch";
  /** One line per disagreeing anchor (seq and short reason; hashes only). */
  mismatches: string[];
  latest: StateAnchorRow | null;
  /** True when the latest anchor is the stored chain's current head. */
  covers_head: boolean;
}

/**
 * Every anchor must name exactly the stored segment at its seq: chain_head = segment_sha256[seq] and
 * segment_count = seq + 1. Stored hashes are given in seq order (index = seq).
 */
export function compareAnchors(storedHashes: readonly string[], anchors: readonly StateAnchorRow[]): AnchorComparison {
  const mismatches: string[] = [];
  for (const a of anchors) {
    if (a.seq >= storedHashes.length) mismatches.push(`anchor seq ${a.seq}: no stored segment at that seq`);
    else if (storedHashes[a.seq] !== a.chain_head) mismatches.push(`anchor seq ${a.seq}: chain_head ${a.chain_head} != stored ${storedHashes[a.seq]}`);
    else if (a.segment_count !== a.seq + 1) mismatches.push(`anchor seq ${a.seq}: segment_count ${a.segment_count} != ${a.seq + 1}`);
  }
  const latest = anchors.length ? anchors[anchors.length - 1] : null;
  return {
    status: mismatches.length ? "mismatch" : latest ? "anchored" : "unanchored",
    mismatches,
    latest,
    covers_head: !mismatches.length && latest !== null && latest.seq === storedHashes.length - 1,
  };
}
