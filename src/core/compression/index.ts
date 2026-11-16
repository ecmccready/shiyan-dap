// 4D state compression (M1-M3): narrow public interface. Pure, in-memory, no I/O, not wired into any route.
// Does not import MetamorphicEngine, metamorphic-runtime, deterministic-proof, self-engine or src/lib/level4.
import { extractPoints, summarizeExclusions } from "./extract";
import { compressPoints } from "./encode";
import { verifyChain } from "./verify";
import { DEFAULT_SEGMENT_SIZE, type CompressOptions, type SealedSegment, type SourceRow, type TenantCompression, type VerifyResult } from "./types";

export * from "./types";
export { extractPoint, extractPoints, comparePoints, summarizeExclusions } from "./extract";
export { encodeFloats, decodeFloats, sourceIdsRoot, sealSegment, compressPoints, reconstruct } from "./encode";
export { verifySealed, verifySegment, verifyChain, verifyReconstruction } from "./verify";
// M3: window sealing, opt-in bounded-loss, optional anchors context. Pure; I/O stays in source.ts.
export { checkEps, type SegmentOptions } from "./encode";
export { DEFAULT_CUTOFF_MS, DEFAULT_GRACE_MS, arrivalsFrom, checkSealingOptions, planWindows, type CloseReason, type SealingOptions, type SealedWindow, type WindowPlan } from "./window";
export { prepareAnchors, recoveryRoot, runIdsFrom, segmentContext, type AnchorRow, type AnchorSource, type PreparedAnchors, type RecoveryRow } from "./context";
export { buildTenantChain, verifyTenantChain, type ChainChecks, type ChainOptions, type TenantChain } from "./chain";

/** Compresses one tenant's rows into a chain of closed, lossless segments. Same rows (any order) => same output. */
export function compressTenant(tenant: string, rows: readonly SourceRow[], options: CompressOptions = {}): TenantCompression {
  const size = options.segmentSize ?? DEFAULT_SEGMENT_SIZE;
  if (!Number.isSafeInteger(size) || size < 1) throw new RangeError("segmentSize must be a positive integer");
  const { points, excluded } = extractPoints(tenant, rows);
  const segments: SealedSegment[] = [];
  let prev: string | null = null;
  let i = 0;
  for (; i + size <= points.length || (options.sealPartial === true && i < points.length); i += size) {
    const sealed = compressPoints(tenant, segments.length, points.slice(i, i + size), prev);
    segments.push(sealed);
    prev = sealed.segment_sha256;
  }
  return { tenant_id: tenant, segments, excluded: summarizeExclusions(excluded), pending: Math.max(0, points.length - i), head_sha256: prev };
}

/** Recomputes the tenant's chain from rows and checks each supplied segment matches it, plus chain integrity. */
export function verifyTenant(tenant: string, segments: readonly SealedSegment[], rows: readonly SourceRow[], options: CompressOptions = {}): VerifyResult {
  const chain = verifyChain(segments);
  const errors = [...chain.errors];
  let expected: TenantCompression;
  try { expected = compressTenant(tenant, rows, options); } catch (e) { return { ok: false, errors: [...errors, e instanceof Error ? e.message : String(e)] }; }
  if (segments.length !== expected.segments.length) errors.push(`segment count ${segments.length} != recomputed ${expected.segments.length}`);
  segments.forEach((s, i) => {
    if (s?.segment?.tenant_id !== tenant) errors.push(`seq ${i}: tenant is not ${tenant}`);
    const want = expected.segments[i];
    if (want && s?.segment_sha256 !== want.segment_sha256) errors.push(`seq ${i}: does not reproduce from tenant rows`);
  });
  return { ok: errors.length === 0, errors };
}
