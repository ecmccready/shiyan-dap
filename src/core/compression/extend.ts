// 4D state compression (M4): extend a persisted chain from its stored head. Pure: the caller supplies the stored
// segments (already parsed), the tenant's rows, the anchors (optional) and as_of. No I/O, no clock.
//
// Rule: points already covered by stored segments (by their stored source ids) are fixed. Only uncovered points
// are windowed, with effective arrival = max(arrival, stored head's closed_at). So a record that committed late
// (arrival earlier than an already-stored window) goes into the next open window and never alters a stored one.
// Every stored segment must reproduce exactly from its own source rows, or nothing is appended.
import { sha256Canonical } from "../reconcile";
import { compressPoints, checkEps } from "./encode";
import { comparePoints, extractPoints, summarizeExclusions } from "./extract";
import { verifyChain, verifyReconstruction, verifySegment } from "./verify";
import { prepareAnchors, runIdsFrom, segmentContext, type AnchorSource } from "./context";
import { arrivalsFrom, checkSealingOptions, planWindows, type CloseReason, type PendingWindow } from "./window";
import type { ChainOptions } from "./chain";
import type { ExclusionSummary, LossOption, SealedSegment, SourceRow, StatePoint, VerifyResult } from "./types";

/** Sealing parameters a chain was built with. cutoffMs = Infinity means "size only". */
export interface ChainParams {
  segmentSize: number;
  cutoffMs: number;
  graceMs: number;
}

/** One persisted segment, already parsed from its row. */
export interface StoredSegment {
  sealed: SealedSegment;
  /** experience_ids covered, in segment point order. */
  source_ids: string[];
  opened_at: number;
  closed_at: number;
  closed_by: CloseReason;
  params: ChainParams;
  /** sha256Canonical(segment.context) or null. */
  context_sha256: string | null;
}

export interface StoredChecks {
  chain: VerifyResult;
  sources: VerifyResult;
  reconstruction: VerifyResult;
  /** Row metadata (context hash, params) consistent with the segment; with anchors, context re-derived. */
  context: VerifyResult;
}

const ok = (errors: string[]): VerifyResult => ({ ok: errors.length === 0, errors });

/**
 * Verifies stored segments against the tenant's rows: chain integrity, each segment rebuilt from exactly its
 * stored source rows (same hash), the decoded state (exact or within eps), and context consistency.
 */
export function verifyStoredChain(tenant: string, stored: readonly StoredSegment[], rows: readonly SourceRow[], anchors?: AnchorSource): StoredChecks & { covered: Set<string> } {
  const segs = stored.map((s) => s.sealed);
  const chainErrors = [...verifyChain(segs).errors];
  stored.forEach((s, i) => {
    if (s.sealed?.segment?.tenant_id !== tenant) chainErrors.push(`seq ${i}: tenant is not ${tenant}`);
    if (i > 0 && s.opened_at < stored[i - 1].closed_at) chainErrors.push(`seq ${i}: window opens before the previous window closed`);
  });
  const { points } = extractPoints(tenant, rows);
  const pointById = new Map(points.map((p) => [p.experience_id, p]));
  const rowById = new Map<string, SourceRow>();
  for (const r of rows) {
    const p = r ? pointById.get(r.experience_id) : undefined;
    if (p && p.content_sha256 === r.content_sha256 && !rowById.has(r.experience_id)) rowById.set(r.experience_id, r);
  }
  const prepared = anchors ? prepareAnchors(anchors) : null;
  const runIds = prepared ? runIdsFrom(rows) : null;
  const sources: string[] = [], reconstruction: string[] = [], context: string[] = [];
  const covered = new Set<string>();
  stored.forEach((s, i) => {
    const seg = s.sealed?.segment;
    if (!seg) return;
    const ids = s.source_ids;
    if (!Array.isArray(ids) || ids.length !== seg.count) { sources.push(`seq ${i}: stored source id count does not match segment count`); return; }
    for (const id of ids) {
      if (covered.has(id)) sources.push(`seq ${i}: source id appears in an earlier stored segment`);
      covered.add(id);
    }
    const pts = ids.map((id) => pointById.get(id));
    if (pts.some((p) => p === undefined)) { sources.push(`seq ${i}: a stored source row is missing or no longer valid`); return; }
    const ordered = pts as StatePoint[];
    for (let k = 1; k < ordered.length; k++) if (comparePoints(ordered[k - 1], ordered[k]) >= 0) sources.push(`seq ${i}: stored source ids are not in canonical order`);
    sources.push(...verifySegment(s.sealed, ids.map((id) => rowById.get(id) as SourceRow)).errors.map((e) => `seq ${i}: ${e}`));
    reconstruction.push(...verifyReconstruction(s.sealed, ordered).errors.map((e) => `seq ${i}: ${e}`));
    const want = seg.context === undefined ? null : sha256Canonical(seg.context);
    if (s.context_sha256 !== want) context.push(`seq ${i}: context_sha256 column does not match the segment`);
    if (seg.context !== undefined && seg.context.as_of !== s.closed_at) context.push(`seq ${i}: context as_of is not the stored seal time`);
    if (prepared && runIds) {
      if (seg.context === undefined) context.push(`seq ${i}: anchors given but the stored segment has no context`);
      else if (sha256Canonical(segmentContext(ordered, runIds, prepared, s.closed_at)) !== want) context.push(`seq ${i}: context does not re-derive from the anchors database`);
    }
    if (i > 0 && JSON.stringify(s.params) !== JSON.stringify(stored[0].params)) chainErrors.push(`seq ${i}: sealing parameters differ within the chain`);
  });
  return { chain: ok(chainErrors), sources: ok(sources), reconstruction: ok(reconstruction), context: ok(context), covered };
}

export interface Extension {
  /** Problems that forbid appending (stored chain does not verify, or options differ from it). */
  refused: string[];
  stored: StoredChecks;
  appended: SealedSegment[];
  windows: { closed_by: CloseReason; opened_at: number; closed_at: number; points: StatePoint[] }[];
  excluded: ExclusionSummary;
  included: number;
  /** Included points not in any stored or newly sealed segment. */
  pending: number;
  /** The next window that will seal among uncovered points, or null when pending is 0. */
  pending_window: PendingWindow | null;
  /** New sealed points whose t is earlier than the newest t already sealed (stored or new). */
  late: number;
  head_sha256: string | null;
  params: ChainParams;
}

const sameLoss = (a: LossOption, seg: SealedSegment) => {
  const l = seg.segment.loss;
  if (a.mode === "lossless") return l.mode === "lossless";
  return l.mode === "bounded" && l.eps.predicted === a.eps.predicted && l.eps.observed === a.eps.observed && l.eps.phi === a.eps.phi;
};

/** Computes the segments to append after the stored head. Appends nothing if anything is refused. */
export function extendTenantChain(tenant: string, rows: readonly SourceRow[], stored: readonly StoredSegment[], options: ChainOptions): Extension {
  const sealing = checkSealingOptions(options);
  const loss: LossOption = options.loss ?? { mode: "lossless" };
  if (loss.mode === "bounded") checkEps(loss.eps);
  const params: ChainParams = { segmentSize: sealing.segmentSize, cutoffMs: sealing.cutoffMs, graceMs: sealing.graceMs };
  const checks = verifyStoredChain(tenant, stored, rows, options.anchors);
  const { covered, ...storedChecks } = checks;
  const refused: string[] = [];
  for (const [name, r] of Object.entries(storedChecks)) if (!r.ok) refused.push(`stored ${name}: ${r.errors.length} error(s)`);
  stored.forEach((s, i) => {
    if (s.params.segmentSize !== params.segmentSize || s.params.cutoffMs !== params.cutoffMs || s.params.graceMs !== params.graceMs) {
      refused.push(`seq ${i}: stored sealing parameters differ from the requested ones`);
    }
    if (s.sealed?.segment && !sameLoss(loss, s.sealed)) refused.push(`seq ${i}: stored loss mode/eps differs from the requested one`);
    if (s.sealed?.segment && (s.sealed.segment.context !== undefined) !== (options.anchors !== undefined)) {
      refused.push(`seq ${i}: stored context presence differs (use --anchor-file exactly when the stored chain has context)`);
    }
  });

  const { points, excluded } = extractPoints(tenant, rows);
  const base = {
    stored: storedChecks, excluded: summarizeExclusions(excluded), included: points.length, params,
  };
  const storedHead = stored.length ? stored[stored.length - 1] : null;
  if (refused.length) {
    return { ...base, refused, appended: [], windows: [], pending: points.length - covered.size, pending_window: null, late: 0, head_sha256: storedHead?.sealed.segment_sha256 ?? null };
  }
  const fresh = points.filter((p) => !covered.has(p.experience_id));
  const floor = storedHead ? storedHead.closed_at : -Infinity;
  const raw = arrivalsFrom(rows);
  const effective = new Map<string, number>();
  for (const p of fresh) effective.set(p.experience_id, Math.max(raw.get(p.experience_id) ?? p.t, floor));
  const plan = planWindows(fresh, effective, sealing);

  const prepared = options.anchors ? prepareAnchors(options.anchors) : null;
  const runIds = prepared ? runIdsFrom(rows) : null;
  const appended: SealedSegment[] = [];
  let prev = storedHead ? storedHead.sealed.segment_sha256 : null;
  let newest = -Infinity;
  const tById = new Map(points.map((p) => [p.experience_id, p.t]));
  for (const s of stored) for (const id of s.source_ids) { const t = tById.get(id); if (t !== undefined && t > newest) newest = t; }
  let late = 0;
  for (const w of plan.sealed) {
    for (const p of w.points) if (p.t < newest) late += 1;
    for (const p of w.points) if (p.t > newest) newest = p.t;
    const context = prepared && runIds ? segmentContext(w.points, runIds, prepared, w.closed_at) : undefined;
    const sealed = compressPoints(tenant, stored.length + appended.length, w.points, prev, { loss, context });
    appended.push(sealed);
    prev = sealed.segment_sha256;
  }
  return {
    ...base, refused, appended,
    windows: plan.sealed.map((w) => ({ closed_by: w.closed_by, opened_at: w.opened_at, closed_at: w.closed_at, points: w.points })),
    pending: plan.pending, pending_window: plan.pending_window, late, head_sha256: prev,
  };
}
