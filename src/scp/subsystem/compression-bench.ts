/**
 * compression_bench: pure measurement helpers for comparing strategies on one surface.
 * Timing is deliberately absent (no clocks in src/scp); the harness script measures latency.
 * Energy figures are model estimates from caller-supplied per-op energies, never measurements.
 */
import { stateCompressor } from "./state-compressor";
import { fidelity, stateReconstructor } from "./state-reconstructor";
import type {
  CompressOptions4D, CompressedState4D, DecisionAgreement, DecisionTask4D, FidelityReport4D, OpCounts4D,
  ReconstructedState4D, StateSurface4D, StrategyId,
} from "./types";

export const BENCH_STRATEGIES: readonly StrategyId[] = ["full_f64", "full_q", "delta", "tensor_bound", "tensor_energy", "scp4d"];

/** Per-op energy table (pJ). Ranges are [low, high]. The caller labels the source (e.g. v0.1.5 45 nm assumptions). */
export interface EnergyTable {
  fp_add: number;
  fp_mul: number;
  fp_div: [number, number];
  round: [number, number];
  int_op: number;
  compare: number;
  /** Bytes moved across the datapath boundary (in or out). */
  byte_io: [number, number];
  /** Energy per byte of algorithmic state touched, as a function of the working-set size. */
  state_byte: (workingSetBytes: number) => [number, number];
}

export interface EnergyEstimate {
  low_pj: number;
  high_pj: number;
  label: "estimate";
}

export function estimateEnergy(ops: OpCounts4D, workingSetBytes: number, table: EnergyTable): EnergyEstimate {
  const fixed = ops.fp_add * table.fp_add + ops.fp_mul * table.fp_mul + ops.int_ops * table.int_op + ops.compare * table.compare;
  const io = ops.bytes_out + ops.bytes_in;
  const [sl, sh] = table.state_byte(workingSetBytes);
  const low = fixed + (ops.fp_div + ops.sqrt) * table.fp_div[0] + ops.round * table.round[0] + io * table.byte_io[0] + ops.state_bytes_touched * sl;
  const high = fixed + (ops.fp_div + ops.sqrt) * table.fp_div[1] + ops.round * table.round[1] + io * table.byte_io[1] + ops.state_bytes_touched * sh;
  return { low_pj: low, high_pj: high, label: "estimate" };
}

export function decisionAgreement(task: DecisionTask4D, surface: StateSurface4D, recon: readonly Float64Array[]): DecisionAgreement {
  let slots = 0, agree = 0, safeSlots = 0, safeDisagree = 0;
  for (let t = 0; t < surface.frames.length; t++) {
    const a = task.decide(surface.frames[t], t, surface);
    const b = task.decide(recon[t], t, surface);
    if (a.length !== b.length) throw new RangeError(`${task.name}: decision length changed`);
    const m = task.margins ? task.margins(surface.frames[t], t, surface) : null;
    for (let i = 0; i < a.length; i++) {
      slots++;
      const same = a[i] === b[i];
      if (same) agree++;
      if (m && task.marginNeeded !== undefined && m[i] > task.marginNeeded) { safeSlots++; if (!same) safeDisagree++; }
    }
  }
  return { task: task.name, slots, agree, agreement: slots ? agree / slots : 1, safe_slots: safeSlots, safe_disagree: safeDisagree };
}

/** Fraction of element-frames (t ≥ 1) whose reconstructed value changed: what downstream must recompute. */
export function dirtyFraction(recon: readonly Float64Array[]): number {
  if (recon.length < 2) return 1;
  let dirty = 0, total = 0;
  for (let t = 1; t < recon.length; t++) {
    const a = recon[t - 1], b = recon[t];
    for (let e = 0; e < b.length; e++) { total++; if (!Object.is(a[e], b[e])) dirty++; }
  }
  return total ? dirty / total : 0;
}

export interface BenchRow {
  strategy: StrategyId;
  bytes: number;
  ratio_vs_full_f64: number;
  ratio_vs_full_q: number;
  bits_per_element_frame: number;
  rank: number;
  scp4d?: CompressedState4D["scp4d"];
  bounded_claim: boolean;
  fidelity: FidelityReport4D;
  decisions: DecisionAgreement[];
  /** Mean decision agreement over all tasks (each task weighted equally). */
  decision_agreement: number;
  events: number;
  dirty_fraction: number;
  encode_ops: OpCounts4D;
  decode_ops: OpCounts4D;
  encode_working_set_bytes: number;
  decode_working_set_bytes: number;
  encode_batch: boolean;
  search_tried: number;
  sha256_prefix?: string;
}

export interface BenchRun {
  row: BenchRow;
  compressed: CompressedState4D;
  reconstructed: ReconstructedState4D;
}

/** Compress, reconstruct from bytes, and measure one strategy. Deterministic. */
export function benchStrategy(surface: StateSurface4D, strategy: StrategyId, options: CompressOptions4D, tasks: readonly DecisionTask4D[], ref: { full_f64: number; full_q: number }): BenchRun {
  const compressed = stateCompressor.compress(surface, strategy, options);
  const reconstructed = stateReconstructor.reconstruct(compressed.bytes, surface.relations);
  if (reconstructed.times.some((t, i) => t !== surface.times[i])) throw new RangeError("times did not round-trip");
  if (surface.meta) {
    const m = reconstructed.meta;
    if (!m || m.steps.some((s, i) => s !== surface.meta!.steps[i]) || m.verdicts.some((v, i) => v !== surface.meta!.verdicts[i])) throw new RangeError("meta did not round-trip");
  }
  const fid = fidelity(surface.frames, reconstructed.frames, surface.shape.channels, options.eps);
  const decisions = tasks.map((task) => decisionAgreement(task, surface, reconstructed.frames));
  const T = surface.frames.length, D = surface.frames[0].length;
  const bytes = compressed.bytes.length;
  return {
    compressed, reconstructed,
    row: {
      strategy, bytes,
      ratio_vs_full_f64: ref.full_f64 / bytes,
      ratio_vs_full_q: ref.full_q / bytes,
      bits_per_element_frame: (bytes * 8) / (T * D),
      rank: compressed.rank, scp4d: compressed.scp4d,
      bounded_claim: compressed.bounded,
      fidelity: fid, decisions,
      decision_agreement: decisions.length ? decisions.reduce((s, d) => s + d.agreement, 0) / decisions.length : 1,
      events: compressed.events,
      dirty_fraction: dirtyFraction(reconstructed.frames),
      encode_ops: compressed.encode_ops, decode_ops: reconstructed.decode_ops,
      encode_working_set_bytes: compressed.encode_working_set_bytes,
      decode_working_set_bytes: compressed.decode_working_set_bytes,
      encode_batch: compressed.encode_batch, search_tried: compressed.search_tried,
    },
  };
}

/** Run every strategy on one surface. Reference sizes come from full_f64 and full_q of the same surface. */
export function benchSurface(surface: StateSurface4D, options: CompressOptions4D, tasks: readonly DecisionTask4D[], strategies: readonly StrategyId[] = BENCH_STRATEGIES): BenchRun[] {
  const f64 = stateCompressor.compress(surface, "full_f64", options).bytes.length;
  const fq = stateCompressor.compress(surface, "full_q", options).bytes.length;
  return strategies.map((s) => benchStrategy(surface, s, options, tasks, { full_f64: f64, full_q: fq }));
}
