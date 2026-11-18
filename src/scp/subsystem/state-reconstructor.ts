/**
 * state_reconstructor: decodes any S4DS stream from bytes (plus the declared relation schema) and
 * reports fidelity with error bounds. Pure; no clocks.
 */
import { ByteReader } from "./bytes";
import { elementEps, lowRankValue, processingOrder, readBaseBlock, readHeader, readLowRank, readScp4dConfig, scp4dBase } from "./format";
import { predictorByName } from "./state-predictor";
import { addOps, zeroOps } from "./state-compressor";
import { TemporalStateSurface } from "./temporal-state";
import type { FidelityReport4D, ReconstructedState4D, Relation4D, StateReconstructor4D } from "./types";

export const stateReconstructor: StateReconstructor4D = {
  reconstruct(bytes: Uint8Array, relations: readonly Relation4D[]): ReconstructedState4D {
    const r = new ByteReader(bytes);
    const h = readHeader(r);
    const { T, shape } = h;
    const D = shape.nx * shape.ny * shape.nz * shape.channels;
    const epsE = elementEps(shape, h.eps);
    const frames: Float64Array[] = [];
    let ops = zeroOps();
    if (h.strategy === "full_f64") {
      for (let t = 0; t < T; t++) { const f = new Float64Array(D); for (let e = 0; e < D; e++) f[e] = r.f64(); frames.push(f); }
      ops = addOps(ops, { bytes_in: bytes.length });
    } else if (h.strategy === "full_q" || h.strategy === "delta") {
      const q = new Float64Array(D);
      for (let t = 0; t < T; t++) {
        const f = new Float64Array(D);
        for (let e = 0; e < D; e++) {
          const v = r.svarint();
          q[e] = h.strategy === "delta" && t > 0 ? q[e] + v : v;
          f[e] = q[e] * epsE[e];
        }
        frames.push(f);
      }
      const isDelta = h.strategy === "delta" ? 1 : 0;
      ops = addOps(ops, { fp_mul: T * D, int_ops: T * D * (2 + isDelta), bytes_in: bytes.length, state_bytes_touched: isDelta * T * D * 16 });
    } else if (h.strategy === "tensor_bound" || h.strategy === "tensor_energy") {
      const b = readLowRank(r, T, D);
      for (let t = 0; t < T; t++) { const f = new Float64Array(D); for (let e = 0; e < D; e++) f[e] = lowRankValue(b, t, e); frames.push(f); }
      ops = addOps(ops, { fp_mul: T * D * b.rank, fp_add: T * D * b.rank, bytes_in: bytes.length, state_bytes_touched: T * D * b.rank * 4 });
    } else {
      const cfg = readScp4dConfig(r);
      const block = cfg.rank > 0 ? readBaseBlock(r, T, epsE) : null;
      if (cfg.relations && relations.length === 0) throw new RangeError("stream uses relations but no relation schema was supplied");
      const surface = new TemporalStateSurface({
        D, eps: epsE, order: processingOrder(D, relations, cfg.relations),
        predictor: predictorByName(cfg.predictor), base: scp4dBase(cfg, relations, D, block),
      });
      let events = 0;
      const allDense = r.u8() === 1;
      for (let t = 0; t < T; t++) {
        const head = allDense ? 1 : r.uvarint();
        const n = Math.floor(head / 2);
        const positions: number[] = [], q: number[] = [];
        if (head % 2 === 1) {
          for (let pos = 0; pos < D; pos++) { const v = r.svarint(); if (v !== 0) { positions.push(pos); q.push(v); } }
          if (!allDense && positions.length !== n) throw new RangeError("dense frame event count mismatch");
        } else {
          let prev = -1;
          for (let i = 0; i < n; i++) { prev = prev + 1 + r.uvarint(); positions.push(prev); q.push(r.svarint()); }
        }
        events += n;
        frames.push(surface.apply({ frameIndex: t, t: h.times[t], positions, q }));
      }
      const relTargets = cfg.relations ? relations.length : 0;
      const relMacs = cfg.relations ? relations.reduce((a, x) => a + x.sources.length, 0) : 0;
      const linear = cfg.predictor === "linear" ? 1 : 0;
      const baseMacs = (D - relTargets) * cfg.rank;
      ops = addOps(ops, {
        fp_mul: T * (baseMacs + relMacs + D * linear) + events, fp_add: T * (baseMacs + relMacs + D * (1 + linear)) + events,
        int_ops: events * 4 + T, bytes_in: bytes.length,
        state_bytes_touched: T * D * 8 * (2 + linear) + (block ? T * (D - relTargets) * cfg.rank * 4 : 0),
      });
    }
    r.expectEnd();
    return { frames, times: h.times, meta: h.meta, decode_ops: ops };
  },
};

/** Per-channel max abs error, RMSE, fraction within eps, and whether every element met its bound. */
export function fidelity(original: readonly Float64Array[], recon: readonly Float64Array[], channels: number, eps: readonly number[]): FidelityReport4D {
  if (original.length !== recon.length) throw new RangeError("frame count mismatch");
  const max = new Array(channels).fill(0), sq = new Array(channels).fill(0), n = new Array(channels).fill(0);
  let within = 0, total = 0;
  for (let t = 0; t < original.length; t++) {
    const a = original[t], b = recon[t];
    if (a.length !== b.length) throw new RangeError("element count mismatch");
    for (let e = 0; e < a.length; e++) {
      const c = e % channels, d = Math.abs(a[e] - b[e]);
      if (d > max[c]) max[c] = d;
      sq[c] += d * d; n[c]++; total++;
      if (d <= eps[c]) within++;
    }
  }
  return {
    max_abs_err: max,
    rmse: sq.map((s, c) => (n[c] ? Math.sqrt(s / n[c]) : 0)),
    within_eps: total ? within / total : 1,
    bound_ok: max.every((m, c) => m <= eps[c]),
  };
}
