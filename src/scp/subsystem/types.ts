/**
 * 4D-SCP subsystem — explicit typed interfaces (v0.1.9).
 *
 * S(x, y, z, t): a state surface over a spatial grid (x, y, z), with per-cell state channels,
 * declared stable relations between elements, and a time axis. Pure types; no I/O, no env,
 * no clocks. Unwired: app routes and Level 4 must not import src/scp
 * (enforced by scripts/check-scp-boundary.ts and scripts/check-scp-v019-bench.ts).
 *
 * The four axes the owner asked for map onto this structure as:
 *   spatial    → (x, y, z) grid cell
 *   state      → channels per cell (values in channels[c])
 *   relational → Relation4D: an element that a stable rule derives from other elements
 *   time       → frame index plus integer epoch-ms timestamp
 *
 * The accepted v0.1 frame mapping (x = predicted, y = observed, z = Φ, t = t) is represented
 * as a 1×1×1 grid with 3 channels per time step (see encodeFramesAsSurface).
 */
import type { PackedVerdict } from "../pack";

export interface GridShape {
  nx: number;
  ny: number;
  nz: number;
  channels: number;
}

/** A stable relationship: element `target` ≈ bias + Σ weights[i] · element sources[i] (same frame). */
export interface Relation4D {
  target: number;
  sources: readonly number[];
  weights: readonly number[];
  bias?: number;
  /** Human-readable rule name, e.g. "neighbor-mean(c0)→c1". */
  kind: string;
}

/** Optional per-frame side data carried losslessly (the v0.1 frames have step + verdict). */
export interface FrameMeta {
  steps: readonly number[];
  verdicts: readonly PackedVerdict[];
}

/** The 4D state surface. frames[t][elementIndex(shape, x, y, z, c)] is the value. */
export interface StateSurface4D {
  shape: GridShape;
  channelNames: readonly string[];
  /** Integer epoch milliseconds, non-decreasing, one per frame. */
  times: readonly number[];
  frames: readonly Float64Array[];
  /** Declared stable relations (schema; agreed out of band, not stored in the stream). */
  relations: readonly Relation4D[];
  meta?: FrameMeta;
  /** Free-text provenance label, e.g. "TEST-ONLY synthetic". */
  label: string;
}

/** Per-channel absolute error tolerance. Every bounded strategy guarantees |v − v'| ≤ eps[c]. */
export type ChannelEps = readonly number[];

export type StrategyId =
  | "full_f64"        // conventional full state, raw float64 every frame (lossless reference)
  | "full_q"          // conventional full state, quantized at eps every frame (fair same-eps baseline)
  | "delta"           // delta-based: frame-to-frame differences of quantized codes
  | "tensor_bound"    // tensor compression: low-rank (truncated SVD) with the smallest rank meeting eps
  | "tensor_energy"   // tensor compression: low-rank at 99.9 % energy (NOT bounded; a probe)
  | "scp4d";          // combined temporal + multidimensional: low-rank base + relations + event-driven residual

/** Encoder-side configuration of the combined (4D-SCP) path. Stored in the stream header. */
export interface Scp4dConfig {
  /** Rank of the low-rank (multidimensional) base. 0 = no base. */
  rank: number;
  /** Use declared relations as the base for relation targets. */
  relations: boolean;
  /** Temporal predictor for the held residual ("zero" = base only, no temporal hold). */
  predictor: "zero" | "last" | "linear";
}

export interface CompressOptions4D {
  eps: ChannelEps;
  /** For scp4d: explicit config; when omitted the compressor searches SCP4D_SEARCH and keeps the smallest. */
  scp4d?: Scp4dConfig;
  /** For tensor_energy: energy fraction to keep (default 0.999). */
  energy?: number;
}

/** Deterministic, analytic operation counts (see compression-bench.ts for the energy mapping). */
export interface OpCounts4D {
  fp_add: number;
  fp_mul: number;
  fp_div: number;
  round: number;
  int_ops: number;
  compare: number;
  sqrt: number;
  bytes_out: number;
  bytes_in: number;
  /** Bytes of algorithmic state read+written (registers / buffers), not payload. */
  state_bytes_touched: number;
}

export interface CompressedState4D {
  strategy: StrategyId;
  bytes: Uint8Array;
  /** Rank used by tensor_* / scp4d (0 otherwise). */
  rank: number;
  scp4d?: Scp4dConfig;
  /** Whether the strategy guarantees |v − v'| ≤ eps per channel (tensor_* only if the check passed). */
  bounded: boolean;
  /** Events emitted by the temporal stage (scp4d), or nonzero deltas (delta). */
  events: number;
  encode_ops: OpCounts4D;
  /** Algorithmic encode working set in bytes (state that must be held to encode). */
  encode_working_set_bytes: number;
  /** Algorithmic decode working set in bytes. */
  decode_working_set_bytes: number;
  /** True if encode needs the whole T×D window in memory (batch), false if streaming. */
  encode_batch: boolean;
  /** Configurations tried by the encoder search (1 when not searched). */
  search_tried: number;
}

export interface ReconstructedState4D {
  frames: Float64Array[];
  times: number[];
  meta?: FrameMeta;
  decode_ops: OpCounts4D;
}

export interface StateEncoder4D<TIn> {
  encode(input: TIn): StateSurface4D;
}

export interface StateCompressor4D {
  compress(surface: StateSurface4D, strategy: StrategyId, options: CompressOptions4D): CompressedState4D;
}

export interface StateReconstructor4D {
  /** Decodes from bytes only, plus the declared schema (shape-independent relations). */
  reconstruct(bytes: Uint8Array, relations: readonly Relation4D[]): ReconstructedState4D;
}

/** Predicts the next held value of one element from its two previous held values. */
export interface StatePredictor {
  readonly name: Scp4dConfig["predictor"];
  predict(prev1: number, prev2: number, framesSeen: number): number;
}

export interface FidelityReport4D {
  max_abs_err: number[];
  rmse: number[];
  /** Fraction of element-frames with |v − v'| ≤ eps[c]. */
  within_eps: number;
  bound_ok: boolean;
}

/** A deterministic decision an agent makes from one frame; returns one discrete decision per slot. */
export interface DecisionTask4D {
  name: string;
  decide(frame: Float64Array, frameIndex: number, surface: Pick<StateSurface4D, "shape" | "meta">): number[];
  /**
   * Optional margin: per decision slot, the distance (in value units) of the deciding quantity to the
   * decision boundary. A bounded strategy with max error ≤ eps must agree wherever margin > marginNeeded.
   */
  margins?(frame: Float64Array, frameIndex: number, surface: Pick<StateSurface4D, "shape" | "meta">): number[];
  /** Margin above which a bounded reconstruction is guaranteed to agree (e.g. eps or 2·eps). */
  marginNeeded?: number;
}

export interface DecisionAgreement {
  task: string;
  slots: number;
  agree: number;
  agreement: number;
  safe_slots: number;
  safe_disagree: number;
}
