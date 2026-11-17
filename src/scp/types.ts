/**
 * 4D-SCP interfaces only. No runtime behaviour, no I/O, no env.
 * See docs/design/4d-scp-architecture.md. This package is unwired: app routes and
 * Level 4 must not import it (enforced by scripts/check-scp-boundary.ts).
 *
 * 4D-SCP builds on src/core/compression (M1–M5). These types describe the wrapper
 * and the measurement record; they do not replace StateVector, TenantCompression,
 * or src/lib/level4/measured.ts Measurement. Default v0.1 axis mapping (proposed):
 * x = predicted, y = observed, z = phi, t = proof_timestamp (ms).
 */

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
