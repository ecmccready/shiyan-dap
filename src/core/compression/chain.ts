// 4D state compression (M3): one tenant's chain with window sealing, optional bounded-loss and optional context.
// Pure: rows and anchor rows are supplied by the caller; as_of is supplied by the caller.
import { compressPoints, checkEps } from "./encode";
import { extractPoints, summarizeExclusions } from "./extract";
import { verifyChain, verifyReconstruction, verifySegment } from "./verify";
import { segmentContext, prepareAnchors, runIdsFrom, type AnchorSource, type PreparedAnchors } from "./context";
import { arrivalsFrom, checkSealingOptions, planWindows, type CloseReason, type SealingOptions } from "./window";
import type { ExclusionSummary, LossOption, SealedSegment, SourceRow, StatePoint, VerifyResult } from "./types";

export interface ChainOptions extends SealingOptions {
  /** Default lossless. */
  loss?: LossOption;
  /** When given, every segment embeds a SegmentContext (covered by its hash). Omit for no context. */
  anchors?: AnchorSource;
}

export interface TenantChain {
  tenant_id: string;
  segments: SealedSegment[];
  /** Per segment: why its window closed and the points it covers (canonical order); not hashed. */
  windows: { closed_by: CloseReason; opened_at: number; closed_at: number; points: StatePoint[] }[];
  excluded: ExclusionSummary;
  included: number;
  pending: number;
  late: number;
  arrival_fallback: number;
  head_sha256: string | null;
  anchors: Omit<PreparedAnchors, "references" | "recoveries"> & { references: number; recoveries: number } | null;
}

export function buildTenantChain(tenant: string, rows: readonly SourceRow[], options: ChainOptions): TenantChain {
  const sealing = checkSealingOptions(options);
  if (options.loss?.mode === "bounded") checkEps(options.loss.eps);
  const { points, excluded } = extractPoints(tenant, rows);
  const plan = planWindows(points, arrivalsFrom(rows), sealing);
  const prepared = options.anchors ? prepareAnchors(options.anchors) : null;
  const runIds = prepared ? runIdsFrom(rows) : null;
  const segments: SealedSegment[] = [];
  let prev: string | null = null;
  for (const w of plan.sealed) {
    const context = prepared && runIds ? segmentContext(w.points, runIds, prepared, w.closed_at) : undefined;
    const sealed = compressPoints(tenant, segments.length, w.points, prev, { loss: options.loss, context });
    segments.push(sealed);
    prev = sealed.segment_sha256;
  }
  return {
    tenant_id: tenant,
    segments,
    windows: plan.sealed.map((w) => ({ closed_by: w.closed_by, opened_at: w.opened_at, closed_at: w.closed_at, points: w.points })),
    excluded: summarizeExclusions(excluded),
    included: points.length,
    pending: plan.pending,
    late: plan.late,
    arrival_fallback: plan.arrival_fallback,
    head_sha256: prev,
    anchors: prepared ? {
      references: prepared.references.length, recoveries: prepared.recoveries.length,
      invalid_references: prepared.invalid_references, invalid_recoveries: prepared.invalid_recoveries,
      unlinked_recoveries: prepared.unlinked_recoveries,
    } : null,
  };
}

export interface ChainChecks {
  chain: VerifyResult;
  recompute: VerifyResult;
  sources: VerifyResult;
  reconstruction: VerifyResult;
  context: VerifyResult;
}

/**
 * Verifies supplied segments against the tenant's rows and the same options: chain integrity, exact
 * recomputation (incl. sealing and context), each segment against exactly the rows it covers, and the
 * decoded state (bit-exact for lossless, within eps for bounded). Context: present iff anchors were given.
 */
export function verifyTenantChain(tenant: string, segments: readonly SealedSegment[], rows: readonly SourceRow[], options: ChainOptions): ChainChecks {
  const errs = () => [] as string[];
  const chain = verifyChain(segments);
  const recompute = errs(), sources = errs(), reconstruction = errs(), context = errs();
  let expected: TenantChain;
  try { expected = buildTenantChain(tenant, rows, options); } catch (e) {
    const m = [e instanceof Error ? e.message : String(e)];
    return { chain, recompute: { ok: false, errors: m }, sources: { ok: false, errors: m }, reconstruction: { ok: false, errors: m }, context: { ok: false, errors: m } };
  }
  if (segments.length !== expected.segments.length) recompute.push(`segment count ${segments.length} != recomputed ${expected.segments.length}`);
  const rowById = new Map<string, SourceRow>();
  const want = new Map<string, string>();
  for (const w of expected.windows) for (const p of w.points) want.set(p.experience_id, p.content_sha256);
  for (const r of rows) if (r && want.get(r.experience_id) === r.content_sha256 && !rowById.has(r.experience_id)) rowById.set(r.experience_id, r);
  segments.forEach((s, i) => {
    const w = expected.windows[i];
    if (s?.segment?.tenant_id !== tenant) recompute.push(`seq ${i}: tenant is not ${tenant}`);
    if (!w) return;
    if (s?.segment_sha256 !== expected.segments[i].segment_sha256) recompute.push(`seq ${i}: does not reproduce from tenant rows`);
    const covered = w.points.map((p) => rowById.get(p.experience_id));
    if (covered.some((r) => r === undefined)) sources.push(`seq ${i}: source rows missing`);
    else sources.push(...verifySegment(s, covered as SourceRow[]).errors.map((e) => `seq ${i}: ${e}`));
    reconstruction.push(...verifyReconstruction(s, w.points).errors.map((e) => `seq ${i}: ${e}`));
    const has = s?.segment?.context !== undefined;
    if (has !== (options.anchors !== undefined)) context.push(`seq ${i}: context ${has ? "present but no anchors source given" : "missing"}`);
    else if (has && s.segment.context?.as_of !== w.closed_at) context.push(`seq ${i}: context as_of is not the window seal time`);
  });
  const r = (e: string[]) => ({ ok: e.length === 0, errors: e });
  return { chain, recompute: r(recompute), sources: r(sources), reconstruction: r(reconstruction), context: r(context) };
}
