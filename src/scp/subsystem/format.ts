/**
 * Stream format "S4DS" v1 shared by state_compressor and state_reconstructor. Little-endian.
 *   magic "S4DS" | u8 version | u8 strategy | u32 T | u16 nx ny nz channels | f64 eps[channels]
 *   | svarint t0, svarint Δt… | u8 hasMeta [| svarint step0, svarint Δstep… | u8 verdict…]
 *   | strategy payload (see state-compressor.ts)
 * Relations are schema, agreed out of band like a codebook; they are not in the stream.
 */
import type { PackedVerdict } from "../pack";
import { ByteReader, ByteWriter } from "./bytes";
import type { FrameMeta, GridShape, Relation4D, Scp4dConfig, StrategyId } from "./types";

export const MAGIC = "S4DS";
export const VERSION = 1;
export const STRATEGIES: readonly StrategyId[] = ["full_f64", "full_q", "delta", "tensor_bound", "tensor_energy", "scp4d"];
const VERDICTS: readonly PackedVerdict[] = ["PASS", "FAIL", "INCONCLUSIVE"];

export interface Header {
  strategy: StrategyId;
  T: number;
  shape: GridShape;
  eps: number[];
  times: number[];
  meta?: FrameMeta;
}

export function writeHeader(w: ByteWriter, h: Header): void {
  w.magic(MAGIC); w.u8(VERSION); w.u8(STRATEGIES.indexOf(h.strategy)); w.u32(h.T);
  w.u16(h.shape.nx); w.u16(h.shape.ny); w.u16(h.shape.nz); w.u16(h.shape.channels);
  for (const e of h.eps) w.f64(e);
  w.svarint(h.times[0]);
  for (let i = 1; i < h.T; i++) w.svarint(h.times[i] - h.times[i - 1]);
  w.u8(h.meta ? 1 : 0);
  if (h.meta) {
    w.svarint(h.meta.steps[0]);
    for (let i = 1; i < h.T; i++) w.svarint(h.meta.steps[i] - h.meta.steps[i - 1]);
    for (const v of h.meta.verdicts) w.u8(VERDICTS.indexOf(v));
  }
}

export function readHeader(r: ByteReader): Header {
  if (r.magic() !== MAGIC) throw new RangeError("not a 4D-SCP S4DS stream");
  if (r.u8() !== VERSION) throw new RangeError("unsupported S4DS version");
  const strategy = STRATEGIES[r.u8()];
  if (!strategy) throw new RangeError("unknown strategy");
  const T = r.u32();
  const shape = { nx: r.u16(), ny: r.u16(), nz: r.u16(), channels: r.u16() };
  const eps = Array.from({ length: shape.channels }, () => r.f64());
  const times = [r.svarint()];
  for (let i = 1; i < T; i++) times.push(times[i - 1] + r.svarint());
  let meta: FrameMeta | undefined;
  if (r.u8() === 1) {
    const steps = [r.svarint()];
    for (let i = 1; i < T; i++) steps.push(steps[i - 1] + r.svarint());
    const verdicts = Array.from({ length: T }, () => {
      const v = VERDICTS[r.u8()];
      if (!v) throw new RangeError("bad verdict byte");
      return v;
    });
    meta = { steps, verdicts };
  }
  return { strategy, T, shape, eps, times, meta };
}

export function elementEps(shape: GridShape, eps: readonly number[]): Float64Array {
  const D = shape.nx * shape.ny * shape.nz * shape.channels;
  const out = new Float64Array(D);
  for (let e = 0; e < D; e++) out[e] = eps[e % shape.channels];
  return out;
}

/** Same quantizer as src/scp/pack.ts (q = round(v/eps), −0 normalised, error ≤ eps checked). */
export function quantize(v: number, eps: number): number {
  const q0 = Math.round(v / eps);
  const q = q0 === 0 ? 0 : q0;
  if (!Number.isSafeInteger(q)) throw new RangeError("value too large for eps");
  if (!(Math.abs(v - q * eps) <= eps)) throw new RangeError("eps too small for value magnitude");
  return q;
}

/** Low-rank block: u16 rank | f64 mean[D] | f32 A[T×rank] | f32 B[D×rank]. Values are f32-rounded. */
export interface LowRankBlock { rank: number; mean: Float64Array; A: Float64Array; B: Float64Array }

export function writeLowRank(w: ByteWriter, b: LowRankBlock): void {
  w.u16(b.rank);
  for (const m of b.mean) w.f64(m);
  for (const a of b.A) w.f32(a);
  for (const x of b.B) w.f32(x);
}

export function readLowRank(r: ByteReader, T: number, D: number): LowRankBlock {
  const rank = r.u16();
  const mean = new Float64Array(D); for (let e = 0; e < D; e++) mean[e] = r.f64();
  const A = new Float64Array(T * rank); for (let i = 0; i < A.length; i++) A[i] = r.f32();
  const B = new Float64Array(D * rank); for (let i = 0; i < B.length; i++) B[i] = r.f32();
  return { rank, mean, A, B };
}

/** Truncate full factors to `rank` columns, rounding to float32 exactly as the stream stores them. */
export function truncateF32(fullA: Float64Array, fullB: Float64Array, fullRank: number, T: number, D: number, mean: Float64Array, rank: number): LowRankBlock {
  const A = new Float64Array(T * rank), B = new Float64Array(D * rank);
  for (let t = 0; t < T; t++) for (let j = 0; j < rank; j++) A[t * rank + j] = Math.fround(fullA[t * fullRank + j]);
  for (let e = 0; e < D; e++) for (let j = 0; j < rank; j++) B[e * rank + j] = Math.fround(fullB[e * fullRank + j]);
  return { rank, mean: Float64Array.from(mean), A, B };
}

/** v' = mean[e] + Σ_j A[t,j]·B[e,j], summed in j order (encoder and decoder identical). */
export function lowRankValue(b: LowRankBlock, t: number, e: number): number {
  let s = b.mean[e];
  for (let j = 0; j < b.rank; j++) s += b.A[t * b.rank + j] * b.B[e * b.rank + j];
  return s;
}

export function writeScp4dConfig(w: ByteWriter, c: Scp4dConfig): void {
  w.u16(c.rank); w.u8(c.relations ? 1 : 0); w.u8(PREDICTORS.indexOf(c.predictor));
}

export function readScp4dConfig(r: ByteReader): Scp4dConfig {
  const rank = r.u16(), relations = r.u8() === 1, predictor = PREDICTORS[r.u8()];
  if (!predictor) throw new RangeError("unknown predictor");
  return { rank, relations, predictor };
}

const PREDICTORS: readonly Scp4dConfig["predictor"][] = ["zero", "last", "linear"];

/**
 * Compact low-rank base for scp4d: the base is only a predictor inside a closed loop, so its precision
 * does not affect the eps bound. Layout: u16 rank | svarint round(mean[e]/eps[e]) per element |
 * f32 A[T×rank] | per column j: f32 scale_j, then i16-range svarint round(B[e,j]/scale_j) per element.
 */
export function quantizeBaseBlock(b: LowRankBlock, epsE: Float64Array): LowRankBlock {
  const D = b.mean.length, k = b.rank;
  const mean = new Float64Array(D);
  for (let e = 0; e < D; e++) mean[e] = Math.round(b.mean[e] / epsE[e]) * epsE[e];
  const B = new Float64Array(b.B.length);
  for (let j = 0; j < k; j++) {
    let mx = 0;
    for (let e = 0; e < D; e++) mx = Math.max(mx, Math.abs(b.B[e * k + j]));
    const scale = Math.fround(mx > 0 ? mx / 32767 : 1);
    for (let e = 0; e < D; e++) B[e * k + j] = Math.round(b.B[e * k + j] / scale) * scale;
  }
  return { rank: k, mean, A: Float64Array.from(b.A), B };
}

export function writeBaseBlock(w: ByteWriter, b: LowRankBlock, epsE: Float64Array): void {
  const D = b.mean.length, k = b.rank;
  w.u16(k);
  for (let e = 0; e < D; e++) w.svarint(Math.round(b.mean[e] / epsE[e]));
  for (const a of b.A) w.f32(a);
  for (let j = 0; j < k; j++) {
    let mx = 0;
    for (let e = 0; e < D; e++) mx = Math.max(mx, Math.abs(b.B[e * k + j]));
    const scale = Math.fround(mx > 0 ? mx / 32767 : 1);
    w.f32(scale);
    for (let e = 0; e < D; e++) w.svarint(Math.round(b.B[e * k + j] / scale));
  }
}

export function readBaseBlock(r: ByteReader, T: number, epsE: Float64Array): LowRankBlock {
  const D = epsE.length;
  const k = r.u16();
  const mean = new Float64Array(D);
  for (let e = 0; e < D; e++) mean[e] = r.svarint() * epsE[e];
  const A = new Float64Array(T * k); for (let i = 0; i < A.length; i++) A[i] = r.f32();
  const B = new Float64Array(D * k);
  for (let j = 0; j < k; j++) { const scale = r.f32(); for (let e = 0; e < D; e++) B[e * k + j] = r.svarint() * scale; }
  return { rank: k, mean, A, B };
}

/** Processing order: non-targets ascending, then relation targets ascending (when relations are used). */
export function processingOrder(D: number, relations: readonly Relation4D[], useRelations: boolean): Int32Array {
  const order = new Int32Array(D);
  if (!useRelations || relations.length === 0) { for (let e = 0; e < D; e++) order[e] = e; return order; }
  const isTarget = new Uint8Array(D);
  for (const r of relations) isTarget[r.target] = 1;
  let i = 0;
  for (let e = 0; e < D; e++) if (!isTarget[e]) order[i++] = e;
  for (let e = 0; e < D; e++) if (isTarget[e]) order[i++] = e;
  return order;
}

/** Base function for the combined path: relation rule for targets, low-rank (or 0) elsewhere. */
export function scp4dBase(cfg: Scp4dConfig, relations: readonly Relation4D[], D: number, block: LowRankBlock | null) {
  const rel: (Relation4D | undefined)[] = new Array(D);
  if (cfg.relations) for (const r of relations) rel[r.target] = r;
  return (e: number, current: Float64Array, frameIndex: number): number => {
    const r = rel[e];
    if (r) {
      let s = r.bias ?? 0;
      for (let i = 0; i < r.sources.length; i++) s += r.weights[i] * current[r.sources[i]];
      return s;
    }
    return block && block.rank > 0 ? lowRankValue(block, frameIndex, e) : 0;
  };
}
