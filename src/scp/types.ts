/**
 * 4D-SCP interfaces plus a pure v0.1 mapping helper. No I/O, no env, no engine runtime calls.
 * See docs/design/4d-scp-architecture.md. This package is unwired: app routes and
 * Level 4 must not import it (enforced by scripts/check-scp-boundary.ts).
 *
 * 4D-SCP builds on src/core/compression (M1–M5). These types describe the wrapper
 * and the measurement record; they do not replace StateVector, TenantCompression,
 * or src/lib/level4/measured.ts Measurement.
 *
 * Accepted v0.1 axis mapping (owner, 2026-11-17): x = predicted, y = observed,
 * z = phi, t = proof_timestamp (ms). Literal spatial axes are out of scope until
 * a later encoder is defined. src/scp may use type-only imports from the
 * compression engine's public surface; runtime engine calls stay in scripts/tests.
 */

import type { StateVector } from "../core/compression";

/** One 4-axis frame. Encoders must document their x/y/z/t mapping; missing axes are not silently zeroed. */
export interface ScpFrame {
  x: number;
  y: number;
  z: number;
  /** Epoch milliseconds. */
  t: number;
  /** Optional identity of the source point; never required to invent one. */
  experience_id?: string;
  content_sha256?: string;
}

/** Accepted v0.1 mapping: X=predicted, Y=observed, Z=phi, T=t. Pure; does not call the engine. */
export function frameFromStateVector(
  p: Pick<StateVector, "predicted" | "observed" | "phi" | "t"> & {
    experience_id?: string;
    content_sha256?: string;
  },
): ScpFrame {
  const frame: ScpFrame = { x: p.predicted, y: p.observed, z: p.phi, t: p.t };
  if (p.experience_id !== undefined) frame.experience_id = p.experience_id;
  if (p.content_sha256 !== undefined) frame.content_sha256 = p.content_sha256;
  return frame;
}

export interface ScpEncodeOptions {
  /** Documented axis mapping, e.g. "predicted,observed,phi,t". */
  mapping?: string;
}

export interface StateEncoder<TIn = unknown> {
  encode(input: TIn, options?: ScpEncodeOptions): ScpFrame[] | Promise<ScpFrame[]>;
}

/** Sealed prefix plus pending window. Mirrors the engine's chain; does not invent a second hash. */
export interface TemporalState {
  tenant_id?: string;
  /** Number of sealed segments in the prefix. */
  sealed: number;
  pending: number;
  head_sha256: string | null;
}

export interface CompressOptions {
  loss?: "lossless" | "bounded";
}

export interface StateCompressor {
  compress(frames: readonly ScpFrame[], options?: CompressOptions): TemporalState | Promise<TemporalState>;
}

export interface StateDecoder {
  decode(state: TemporalState): ScpFrame[] | Promise<ScpFrame[]>;
}

export interface FidelityReport {
  ok: boolean;
  mode: "lossless" | "bounded";
  /** Per-axis max |v − v'| when measured. */
  max_abs_err?: { x?: number; y?: number; z?: number };
  /** Optional tensor-scope-style distance (pattern only; not a Level 4 import). */
  distance?: number;
  epsilon?: number;
}

export interface FidelityVerifier {
  verify(original: readonly ScpFrame[], reconstructed: readonly ScpFrame[]): FidelityReport | Promise<FidelityReport>;
}

/** Reserved; v0.1 may leave this unimplemented. Cadence already exists in scripts/sync-state-chains.ts. */
export interface StateScheduler {
  schedule(state: TemporalState): void | Promise<void>;
}

/**
 * Compatible with src/lib/level4/measured.ts Measurement { e0, e, delta_e }
 * (those three fields are optional here so a fixture without a plant score can omit them).
 * SCP-specific metrics are additive.
 */
export interface ScpMeasurement {
  e0?: number;
  e?: number;
  /** e0 − e when both are present (higher is better), same meaning as measured.ts. */
  delta_e?: number;
  compression_ratio?: number;
  raw_bytes?: number;
  compressed_bytes?: number;
  fidelity?: FidelityReport;
  /** Collected only in a test or CLI harness, never by reading a clock inside src/scp. */
  latency_ms?: { p50: number; p95: number; samples: number };
  retained_task_performance?: { score: number; n: number; agreement?: number };
  determinism?: { ok: boolean; head_sha256?: string | null };
}

export interface ScpProcessor {
  encoder: StateEncoder;
  compressor: StateCompressor;
  decoder: StateDecoder;
  fidelity: FidelityVerifier;
  scheduler?: StateScheduler;
}
