/**
 * Maps an already-produced compression-engine result onto StateSurface4D.
 * Type-only imports of the engine's public surface (decision 4). The script
 * that calls compressPoints / buildTenantChain / verifyTenantChain lives
 * outside src/scp. This module does not run the engine.
 */
import type { SealedSegment, StateVector } from "../../core/compression";
import type { PackedPoint } from "../pack";
import { encodeFramesAsSurface } from "../subsystem/state-encoder";
import type { StateSurface4D } from "../subsystem/types";

export interface EngineProofView {
  /** Reconstructed or sealed points from the engine. One vector per time step. */
  vectors: readonly StateVector[];
  head_sha256: string | null;
  verify_ok: boolean;
  loss: "lossless" | "bounded";
  label: string;
}

export interface SegmentProofMeta {
  seq: number;
  count: number;
  segment_sha256: string;
  loss_mode: "lossless" | "bounded";
}

/** Header fields of sealed segments. Does not read payload bytes. */
export function segmentMeta(segments: readonly Pick<SealedSegment, "segment" | "segment_sha256">[]): SegmentProofMeta[] {
  return segments.map((s) => ({
    seq: s.segment.seq,
    count: s.segment.count,
    segment_sha256: s.segment_sha256,
    loss_mode: s.segment.loss.mode,
  }));
}

/**
 * Accepted v0.1 mapping: x = predicted, y = observed, z = Φ, t = t,
 * as a 1×1×1 surface with step and verdict carried losslessly.
 */
export function surfaceFromEngineVectors(view: EngineProofView): StateSurface4D {
  if (!view.verify_ok) throw new RangeError("refusing to adapt an engine chain that did not verify");
  if (view.vectors.length < 1) throw new RangeError("engine returned no vectors");
  const points: PackedPoint[] = view.vectors.map((v) => ({
    x: v.predicted,
    y: v.observed,
    z: v.phi,
    t: v.t,
    step: v.step,
    verdict: v.verdict,
  }));
  const surface = encodeFramesAsSurface(points, view.label);
  surface.label = `${view.label}; loss=${view.loss}; head=${view.head_sha256 ?? "none"}`;
  return surface;
}
