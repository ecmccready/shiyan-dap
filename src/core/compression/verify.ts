// 4D state compression (M1): segment and chain verification against source rows. Pure.
import { sha256Canonical } from "../reconcile";
import { extractPoints } from "./extract";
import { compressPoints, reconstruct } from "./encode";
import type { SealedSegment, SourceRow, VerifyResult } from "./types";

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** The stored hash matches the segment's canonical form and the segment decodes. */
export function verifySealed(sealed: SealedSegment): VerifyResult {
  const errors: string[] = [];
  if (!sealed || typeof sealed !== "object" || !sealed.segment) return { ok: false, errors: ["missing segment"] };
  if (sha256Canonical(sealed.segment) !== sealed.segment_sha256) errors.push("segment_sha256 does not match segment content");
  try { reconstruct(sealed.segment); } catch (e) { errors.push(`segment does not decode: ${message(e)}`); }
  return { ok: errors.length === 0, errors };
}

/**
 * Verifies a segment against exactly the source rows it claims to cover: every row must be included
 * (none excluded), and re-encoding them with the same seq and prev link must give the identical hash.
 */
export function verifySegment(sealed: SealedSegment, sources: readonly SourceRow[]): VerifyResult {
  const base = verifySealed(sealed);
  if (!sealed?.segment) return base;
  const errors = [...base.errors];
  const { segment } = sealed;
  let extracted: ReturnType<typeof extractPoints>;
  try { extracted = extractPoints(segment.tenant_id, sources); } catch (e) { return { ok: false, errors: [...errors, message(e)] }; }
  if (extracted.excluded.length) {
    errors.push(`${extracted.excluded.length} source row(s) excluded: ${extracted.excluded.map((x) => x.reason).sort().join(", ")}`);
  }
  if (extracted.points.length !== segment.count) errors.push(`source count ${extracted.points.length} != segment count ${segment.count}`);
  if (extracted.points.length > 0) {
    try {
      const rebuilt = compressPoints(segment.tenant_id, segment.seq, extracted.points, segment.prev_segment_sha256);
      if (rebuilt.segment.source_ids_root !== segment.source_ids_root) errors.push("source_ids_root does not match sources");
      if (rebuilt.segment_sha256 !== sealed.segment_sha256) errors.push("segment does not reproduce from sources");
    } catch (e) {
      errors.push(`cannot rebuild from sources: ${message(e)}`);
    }
  }
  return { ok: errors.length === 0, errors };
}

/** Walks a tenant chain from seq 0: contiguous seq, one tenant, valid hashes, and prev links that match. */
export function verifyChain(segments: readonly SealedSegment[]): VerifyResult {
  const errors: string[] = [];
  let prev: string | null = null;
  const tenant = segments[0]?.segment?.tenant_id;
  segments.forEach((s, i) => {
    const own = verifySealed(s);
    errors.push(...own.errors.map((e) => `seq ${i}: ${e}`));
    if (!s?.segment) return;
    if (s.segment.seq !== i) errors.push(`seq ${i}: expected seq ${i}, found ${s.segment.seq}`);
    if (s.segment.tenant_id !== tenant) errors.push(`seq ${i}: tenant differs from chain tenant`);
    if (s.segment.prev_segment_sha256 !== prev) errors.push(`seq ${i}: prev_segment_sha256 does not link to previous segment`);
    prev = s.segment_sha256;
  });
  return { ok: errors.length === 0, errors };
}
