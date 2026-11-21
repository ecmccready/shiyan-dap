/**
 * Pure scoring for the v0.1.19 ECP5 benchmark. No I/O.
 * Throughput is only defined when both the cycle count and the post-route Fmax
 * were produced by a run. This module does not invent either input.
 *
 * values/s = (element_frames / cycles) * fmax_MHz * 1e6
 *   element_frames, cycles: simulation of the design on one committed stream
 *   fmax_MHz: minimum achieved clock in a nextpnr --report
 */

export const THROUGHPUT_FORMULA =
  "values/s = (element_frames / cycles) * fmax_MHz * 1e6; element_frames and cycles are from the design's committed simulation report on the named stream; fmax_MHz is the minimum achieved clock in that seed's nextpnr report";

export function valuesPerCycle(elementFrames: number, cycles: number): number {
  if (!Number.isInteger(elementFrames) || elementFrames <= 0) throw new Error("element_frames is not a positive measured integer");
  if (!Number.isInteger(cycles) || cycles <= 0) throw new Error("cycles is not a positive measured integer");
  return elementFrames / cycles;
}

export function throughputValuesPerSec(elementFrames: number, cycles: number, fmaxMhz: number): number {
  if (!(fmaxMhz > 0) || !Number.isFinite(fmaxMhz)) throw new Error("fmax_MHz is not a positive measured number");
  return valuesPerCycle(elementFrames, cycles) * fmaxMhz * 1e6;
}

/** Middle value. Odd counts only (the benchmark uses five seeds). */
export function median(values: readonly number[]): number {
  if (values.length === 0) throw new Error("median of an empty measured set");
  if (values.length % 2 === 0) throw new Error("median helper expects an odd count so it does not average two seeds");
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[(sorted.length - 1) >> 1];
}

export type ScoreRow = {
  id: string;
  fmax_mhz: number;
  throughput_values_per_s: number;
  values_per_s_per_lut: number;
};

/**
 * A row is on the Pareto set when no other row is >= on clock, throughput and
 * values/s per LUT, and strictly greater on at least one. Efficiency for this
 * test is values/s per LUT. Per-FF and per-BRAM ratios are reported beside it
 * and are not a fourth silent objective.
 */
export function paretoIds(rows: readonly ScoreRow[]): string[] {
  const dominated = new Set<string>();
  for (const a of rows) {
    for (const b of rows) {
      if (a.id === b.id) continue;
      const ge = a.fmax_mhz >= b.fmax_mhz
        && a.throughput_values_per_s >= b.throughput_values_per_s
        && a.values_per_s_per_lut >= b.values_per_s_per_lut;
      const gt = a.fmax_mhz > b.fmax_mhz
        || a.throughput_values_per_s > b.throughput_values_per_s
        || a.values_per_s_per_lut > b.values_per_s_per_lut;
      if (ge && gt) dominated.add(b.id);
    }
  }
  return rows.map((r) => r.id).filter((id) => !dominated.has(id)).sort();
}

export function round6(x: number): number {
  return Number(x.toPrecision(6));
}
