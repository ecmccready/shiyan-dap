/**
 * state_compressor: one surface, five strategies, one stream format (format.ts).
 *
 *   full_f64       every element of every frame as float64 (lossless; the "process everything" baseline)
 *   full_q         every element of every frame as zigzag varint q = round(v/eps) (same eps as the others)
 *   delta          frame 0 as q, then q_t − q_{t−1} for every element (the pack.ts idea per element)
 *   tensor_bound   mean + rank-k truncated SVD (float32 factors), k = smallest rank meeting eps if any
 *   tensor_energy  same, k = rank holding 99.9 % of the centred energy (not bounded; a probe)
 *   scp4d          combined: rank-k base (multidimensional) + declared relations (relational) +
 *                  event-driven residual against a temporal predictor (temporal); bounded by eps
 *
 * Op counts are analytic (documented formulas), not instrumented timings. Pure; no clocks.
 */
import { ByteWriter, svarintSize, uvarintSize } from "./bytes";
import {
  elementEps, processingOrder, quantize, quantizeBaseBlock, scp4dBase, truncateF32, writeBaseBlock, writeHeader, writeLowRank,
  writeScp4dConfig, type LowRankBlock,
} from "./format";
import { lowRankFit, type LowRankFactors } from "./linalg";
import { elementCount, validateRelations } from "./state-encoder";
import { predictorByName } from "./state-predictor";
import { TemporalStateSurface } from "./temporal-state";
import type {
  CompressOptions4D, CompressedState4D, OpCounts4D, Scp4dConfig, StateCompressor4D, StateSurface4D, StrategyId,
} from "./types";

export const SCP4D_RANKS = [0, 1, 2, 4, 8] as const;
export const SCP4D_SEARCH: readonly Scp4dConfig[] = SCP4D_RANKS.flatMap((rank) =>
  [false, true].flatMap((relations) => (["zero", "last", "linear"] as const).map((predictor) => ({ rank, relations, predictor }))));

export function zeroOps(): OpCounts4D {
  return { fp_add: 0, fp_mul: 0, fp_div: 0, round: 0, int_ops: 0, compare: 0, sqrt: 0, bytes_out: 0, bytes_in: 0, state_bytes_touched: 0 };
}

export function addOps(a: OpCounts4D, b: Partial<OpCounts4D>): OpCounts4D {
  const out = { ...a };
  for (const k of Object.keys(b) as (keyof OpCounts4D)[]) out[k] += b[k] ?? 0;
  return out;
}

function checkEps(surface: StateSurface4D, eps: readonly number[]): void {
  if (eps.length !== surface.shape.channels) throw new RangeError("need one eps per channel");
  for (const e of eps) if (!(e > 0) || !Number.isFinite(e)) throw new RangeError("eps must be finite and > 0");
}

function header(w: ByteWriter, s: StateSurface4D, strategy: StrategyId, eps: readonly number[]): void {
  writeHeader(w, { strategy, T: s.frames.length, shape: s.shape, eps: [...eps], times: [...s.times], meta: s.meta });
}

/** Smallest rank whose float32 reconstruction meets eps on every element-frame, or null. */
function smallestBoundedRank(s: StateSurface4D, fit: LowRankFactors, epsE: Float64Array): number | null {
  const T = s.frames.length, D = fit.D;
  const recon = s.frames.map(() => Float64Array.from(fit.mean));
  const ok = () => {
    for (let t = 0; t < T; t++) { const f = s.frames[t], r = recon[t]; for (let e = 0; e < D; e++) if (!(Math.abs(f[e] - r[e]) <= epsE[e])) return false; }
    return true;
  };
  if (ok()) return 0;
  for (let j = 0; j < fit.rank; j++) {
    for (let t = 0; t < T; t++) {
      const a = Math.fround(fit.A[t * fit.rank + j]), r = recon[t];
      for (let e = 0; e < D; e++) r[e] += a * Math.fround(fit.B[e * fit.rank + j]);
    }
    if (ok()) return j + 1;
  }
  return null;
}

function energyRank(fit: LowRankFactors, frac: number): number {
  let total = 0; for (const x of fit.energy) total += x;
  if (total === 0) return 0;
  let acc = 0;
  for (let k = 0; k < fit.rank; k++) { acc += fit.energy[k]; if (acc >= frac * total) return k + 1; }
  return fit.rank;
}

function lowRankEncodeWS(T: number, D: number): number {
  const n = Math.min(T, D);
  return 8 * T * D + 16 * n * n;
}

function encodeScp4d(s: StateSurface4D, eps: readonly number[], cfg: Scp4dConfig, fit: LowRankFactors | null): { bytes: Uint8Array; events: number; ops: OpCounts4D; ws: number } {
  const T = s.frames.length, D = elementCount(s.shape), C = s.shape.channels;
  const useRel = cfg.relations && s.relations.length > 0;
  const rank = fit ? Math.min(cfg.rank, fit.rank) : 0;
  const epsE = elementEps(s.shape, eps);
  const raw: LowRankBlock | null = rank > 0 && fit ? truncateF32(fit.A, fit.B, fit.rank, T, D, fit.mean, rank) : null;
  const block = raw ? quantizeBaseBlock(raw, epsE) : null;
  const w = new ByteWriter();
  header(w, s, "scp4d", eps);
  writeScp4dConfig(w, { ...cfg, rank, relations: useRel });
  if (raw) writeBaseBlock(w, raw, epsE);
  const surface = new TemporalStateSurface({
    D, eps: epsE, order: processingOrder(D, s.relations, useRel),
    predictor: predictorByName(cfg.predictor), base: scp4dBase({ ...cfg, relations: useRel }, s.relations, D, block),
  });
  let events = 0;
  const updates = [];
  for (let t = 0; t < T; t++) {
    const u = surface.append(s.frames[t], s.times[t]);
    updates.push(u);
    events += u.positions.length;
  }
  // Frame layout mode: 0 = adaptive per frame (header per frame), 1 = every frame dense, no per-frame header.
  const adaptive = new ByteWriter(), dense = new ByteWriter();
  for (const u of updates) { writeFrameEvents(adaptive, u.positions, u.q, D); writeDenseFrame(dense, u.positions, u.q, D); }
  const useDense = dense.length < adaptive.length;
  w.u8(useDense ? 1 : 0);
  w.raw(useDense ? dense.bytes() : adaptive.bytes());
  const bytes = w.bytes();
  const relTargets = useRel ? s.relations.length : 0;
  const relMacs = useRel ? s.relations.reduce((a, r) => a + r.sources.length, 0) : 0;
  const baseMacs = (D - relTargets) * rank;
  const linear = cfg.predictor === "linear" ? 1 : 0;
  let ops = addOps(zeroOps(), {
    fp_mul: T * (baseMacs + relMacs + D * linear) + events,
    fp_add: T * (baseMacs + relMacs + D * (2 + linear)) + events,
    fp_div: events, round: events, compare: T * D,
    int_ops: events * 4 + T, bytes_out: bytes.length,
    state_bytes_touched: T * D * 8 * (2 + linear) + (block ? T * (D - relTargets) * rank * 4 : 0),
  });
  if (fit && rank > 0) ops = addOps(ops, fit.ops);
  const ws = (block ? 8 * D + 4 * D * rank + 4 * rank + lowRankEncodeWS(T, D) : 0) + 8 * D * (2 + linear) + 8 * C;
  return { bytes, events, ops, ws };
}

/**
 * Per frame, the cheaper of two layouts (adaptive):
 *   sparse: uvarint(2n)   then n × (uvarint position gap, svarint q)
 *   dense:  uvarint(2n+1) then D × svarint q in processing order (0 = no event)
 */
export function writeFrameEvents(w: ByteWriter, positions: readonly number[], q: readonly number[], D: number): void {
  let sparse = 0, prev = -1;
  for (let i = 0; i < positions.length; i++) { sparse += uvarintSize(positions[i] - prev - 1) + svarintSize(q[i]); prev = positions[i]; }
  const dense = D - positions.length + q.reduce((a, x) => a + svarintSize(x), 0);
  if (dense < sparse) {
    w.uvarint(positions.length * 2 + 1);
    let k = 0;
    for (let pos = 0; pos < D; pos++) { if (k < positions.length && positions[k] === pos) w.svarint(q[k++]); else w.svarint(0); }
  } else {
    w.uvarint(positions.length * 2);
    prev = -1;
    for (let i = 0; i < positions.length; i++) { w.uvarint(positions[i] - prev - 1); prev = positions[i]; w.svarint(q[i]); }
  }
}

export function writeDenseFrame(w: ByteWriter, positions: readonly number[], q: readonly number[], D: number): void {
  let k = 0;
  for (let pos = 0; pos < D; pos++) { if (k < positions.length && positions[k] === pos) w.svarint(q[k++]); else w.svarint(0); }
}

function decodeWorkingSetScp4d(D: number, C: number, rank: number, linear: boolean): number {
  return (rank > 0 ? 8 * D + 4 * D * rank + 4 * rank : 0) + 8 * D * (2 + (linear ? 1 : 0)) + 8 * C;
}

export const stateCompressor: StateCompressor4D = {
  compress(s: StateSurface4D, strategy: StrategyId, options: CompressOptions4D): CompressedState4D {
    checkEps(s, options.eps);
    const T = s.frames.length, D = elementCount(s.shape), C = s.shape.channels;
    validateRelations(s.relations, D);
    const eps = options.eps;
    const epsE = elementEps(s.shape, eps);
    const w = new ByteWriter();
    const base = { rank: 0, events: 0, search_tried: 1, encode_batch: false } as const;

    if (strategy === "full_f64") {
      header(w, s, strategy, eps);
      for (const f of s.frames) for (let e = 0; e < D; e++) w.f64(f[e]);
      const bytes = w.bytes();
      return { ...base, strategy, bytes, bounded: true, encode_ops: addOps(zeroOps(), { bytes_out: bytes.length }),
        encode_working_set_bytes: 8, decode_working_set_bytes: 8 };
    }
    if (strategy === "full_q" || strategy === "delta") {
      header(w, s, strategy, eps);
      const prev = new Float64Array(D);
      let nonzero = 0;
      for (let t = 0; t < T; t++) {
        const f = s.frames[t];
        for (let e = 0; e < D; e++) {
          const q = quantize(f[e], epsE[e]);
          if (strategy === "full_q") w.svarint(q);
          else { const d = t === 0 ? q : q - prev[e]; if (t > 0 && d !== 0) nonzero++; w.svarint(d); prev[e] = q; }
        }
      }
      const bytes = w.bytes();
      const isDelta = strategy === "delta" ? 1 : 0;
      return {
        ...base, strategy, bytes, bounded: true, events: isDelta ? nonzero : 0,
        encode_ops: addOps(zeroOps(), { fp_div: T * D, round: T * D, fp_mul: T * D, fp_add: T * D, compare: T * D, int_ops: T * D * (2 + isDelta), bytes_out: bytes.length, state_bytes_touched: isDelta * T * D * 16 }),
        encode_working_set_bytes: isDelta ? 8 * D + 8 * C : 8 + 8 * C,
        decode_working_set_bytes: isDelta ? 8 * D + 8 * C : 8 + 8 * C,
      };
    }
    if (strategy === "tensor_bound" || strategy === "tensor_energy") {
      const fit = lowRankFit(s.frames, Math.min(T, D));
      let rank: number, bounded: boolean;
      if (strategy === "tensor_bound") {
        const k = smallestBoundedRank(s, fit, epsE);
        rank = k ?? fit.rank; bounded = k !== null;
      } else {
        rank = energyRank(fit, options.energy ?? 0.999); bounded = false;
      }
      const block = truncateF32(fit.A, fit.B, fit.rank, T, D, fit.mean, rank);
      header(w, s, strategy, eps);
      writeLowRank(w, block);
      const bytes = w.bytes();
      return {
        ...base, strategy, bytes, rank, bounded, encode_batch: true,
        encode_ops: addOps(addOps(zeroOps(), fit.ops), { fp_mul: T * D * rank, fp_add: T * D * rank, compare: T * D * (rank + 1), bytes_out: bytes.length, state_bytes_touched: T * D * 8 * (rank + 1) }),
        encode_working_set_bytes: lowRankEncodeWS(T, D),
        decode_working_set_bytes: 8 * D + 4 * D * rank + 4 * rank,
      };
    }
    // scp4d
    const maxRank = Math.min(T, D, SCP4D_RANKS[SCP4D_RANKS.length - 1]);
    const configs = options.scp4d ? [options.scp4d] : SCP4D_SEARCH.filter((c) => (c.relations ? s.relations.length > 0 : true) && c.rank <= maxRank);
    const needFit = configs.some((c) => c.rank > 0);
    const fit = needFit ? lowRankFit(s.frames, maxRank) : null;
    let best: (ReturnType<typeof encodeScp4d> & { cfg: Scp4dConfig }) | null = null;
    for (const cfg of configs) {
      const r = encodeScp4d(s, eps, cfg, fit);
      if (!best || r.bytes.length < best.bytes.length) best = { ...r, cfg: { ...cfg, rank: fit ? Math.min(cfg.rank, fit.rank) : 0, relations: cfg.relations && s.relations.length > 0 } };
    }
    if (!best) throw new RangeError("no scp4d configuration applies");
    return {
      strategy, bytes: best.bytes, rank: best.cfg.rank, scp4d: best.cfg, bounded: true, events: best.events,
      encode_ops: best.ops, encode_working_set_bytes: best.ws,
      decode_working_set_bytes: decodeWorkingSetScp4d(D, C, best.cfg.rank, best.cfg.predictor === "linear"),
      encode_batch: best.cfg.rank > 0, search_tried: configs.length,
    };
  },
};
