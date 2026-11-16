// 4D state compression (M3): per-segment context from the anchors database. Pure.
// Inputs are rows already read (read-only) from shiyan_anchor.recovery_records and shiyan_anchor.reference_anchors.
// Only hashes, counts and ids are kept; numeric recovery fields are not read at all.
import { createHash } from "node:crypto";
import {
  STATE_CONTEXT_VERSION, type RecoveryStatusCode, type SegmentContext, type SourceRow, type StatePoint,
} from "./types";

const SHA256 = /^[0-9a-f]{64}$/;
const COMMIT = /^[0-9a-f]{40}$/;
const REFERENCE_ID = /^ref-[0-9a-f]{32}$/;
const STATUSES: readonly string[] = ["PROMOTED", "DRIFT_EXCEEDED", "REJECTED"];

/** One reference_anchors row as the reader supplies it (created_at as ISO). */
export interface AnchorRow {
  reference_id: string;
  commit_sha: string;
  snapshot_sha256: string;
  envelope_sha256: string;
  created_at: string;
}
/** One recovery_records row as the reader supplies it (created_at as ISO). */
export interface RecoveryRow {
  run_id: string | null;
  status: string;
  record_sha256: string;
  created_at: string;
}

export interface AnchorSource {
  references: readonly AnchorRow[];
  recoveries: readonly RecoveryRow[];
}

interface CleanAnchor { reference_id: string; commit_sha: string; snapshot_sha256: string; envelope_sha256: string; at: number }
interface CleanRecovery { run_id: string; status: RecoveryStatusCode; record_sha256: string; at: number }

export interface PreparedAnchors {
  references: CleanAnchor[];
  recoveries: CleanRecovery[];
  /** Rows that failed validation; skipped, never repaired. */
  invalid_references: number;
  invalid_recoveries: number;
  /** Recovery rows with no run_id: they cannot be linked to a run. */
  unlinked_recoveries: number;
}

const isoMs = (v: unknown) => (typeof v === "string" ? Date.parse(v) : Number.NaN);

/** Validates and orders anchor-DB rows. Deterministic regardless of input order. */
export function prepareAnchors(source: AnchorSource): PreparedAnchors {
  const references: CleanAnchor[] = [];
  const recoveries: CleanRecovery[] = [];
  let invalid_references = 0, invalid_recoveries = 0, unlinked_recoveries = 0;
  for (const r of source.references ?? []) {
    const at = isoMs(r?.created_at);
    if (!r || !REFERENCE_ID.test(String(r.reference_id)) || !COMMIT.test(String(r.commit_sha)) || !SHA256.test(String(r.snapshot_sha256))
      || !SHA256.test(String(r.envelope_sha256)) || !Number.isSafeInteger(at)) { invalid_references += 1; continue; }
    references.push({ reference_id: r.reference_id, commit_sha: r.commit_sha, snapshot_sha256: r.snapshot_sha256, envelope_sha256: r.envelope_sha256, at });
  }
  for (const r of source.recoveries ?? []) {
    const at = isoMs(r?.created_at);
    if (!r || !STATUSES.includes(r.status) || !SHA256.test(String(r.record_sha256)) || !Number.isSafeInteger(at)
      || (r.run_id !== null && (typeof r.run_id !== "string" || r.run_id.length < 1 || r.run_id.length > 200))) { invalid_recoveries += 1; continue; }
    if (r.run_id === null) { unlinked_recoveries += 1; continue; }
    recoveries.push({ run_id: r.run_id, status: r.status as RecoveryStatusCode, record_sha256: r.record_sha256, at });
  }
  references.sort((a, b) => a.at - b.at || (a.reference_id < b.reference_id ? -1 : a.reference_id > b.reference_id ? 1 : 0));
  recoveries.sort((a, b) => (a.record_sha256 < b.record_sha256 ? -1 : a.record_sha256 > b.record_sha256 ? 1 : 0));
  return { references, recoveries, invalid_references, invalid_recoveries, unlinked_recoveries };
}

/** provenance.run_id per experience_id, from the stored record JSON (rows were already validated by extract). */
export function runIdsFrom(rows: readonly SourceRow[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const r of rows) {
    if (typeof r?.experience_id !== "string" || typeof r.record_json !== "string" || out.has(r.experience_id)) continue;
    try {
      const run = (JSON.parse(r.record_json) as { provenance?: { run_id?: unknown } })?.provenance?.run_id;
      if (typeof run === "string") out.set(r.experience_id, run);
    } catch { /* excluded rows never reach a segment */ }
  }
  return out;
}

const leaf = (sha: string) => createHash("sha256").update("\u0002").update(sha).digest("hex");
const node = (l: string, r: string) => createHash("sha256").update("\u0003").update(l).update(r).digest("hex");
/** Domain-separated Merkle root over sorted record hashes (odd node promoted). */
export function recoveryRoot(sortedShas: readonly string[]): string | null {
  if (sortedShas.length === 0) return null;
  let level = sortedShas.map(leaf);
  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) next.push(i + 1 < level.length ? node(level[i], level[i + 1]) : level[i]);
    level = next;
  }
  return level[0];
}

/** Context for one window: anchor-DB rows created at or before as_of only. */
export function segmentContext(points: readonly StatePoint[], runIds: ReadonlyMap<string, string>, anchors: PreparedAnchors, asOf: number): SegmentContext {
  if (!Number.isSafeInteger(asOf)) throw new RangeError("context as_of must be an integer epoch-ms value");
  const runs = new Set<string>();
  for (const p of points) { const r = runIds.get(p.experience_id); if (r !== undefined) runs.add(r); }
  const linked = anchors.recoveries.filter((r) => r.at <= asOf && runs.has(r.run_id));
  const by_status: Partial<Record<RecoveryStatusCode, number>> = {};
  for (const r of linked) by_status[r.status] = (by_status[r.status] ?? 0) + 1;
  let ref: CleanAnchor | undefined;
  for (const a of anchors.references) if (a.at <= asOf) ref = a;
  return {
    version: STATE_CONTEXT_VERSION,
    as_of: asOf,
    recovery: { count: linked.length, by_status, records_root: recoveryRoot(linked.map((r) => r.record_sha256)) },
    reference: ref
      ? { status: "present", reference_id: ref.reference_id, commit_sha: ref.commit_sha, snapshot_sha256: ref.snapshot_sha256, envelope_sha256: ref.envelope_sha256 }
      : { status: "none" },
  };
}
