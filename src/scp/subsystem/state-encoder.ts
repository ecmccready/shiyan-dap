/**
 * state_encoder: environment → 4D state surface S(x, y, z, t). Pure; no I/O, no clocks.
 *
 * Two encoders:
 *  - gridEncoder: a gridded environment (cells × channels × time) plus declared relations.
 *  - encodeFramesAsSurface: the accepted v0.1 frame mapping (x = predicted, y = observed, z = Φ,
 *    t = t) as a 1×1×1 grid with 3 channels, carrying step and verdict as lossless side data.
 * Neither invents data: every value comes from the caller's input.
 */
import type { PackedPoint } from "../pack";
import type { ScpFrame } from "../types";
import type { GridShape, Relation4D, StateEncoder4D, StateSurface4D } from "./types";

export function elementCount(shape: GridShape): number {
  return shape.nx * shape.ny * shape.nz * shape.channels;
}

/** Flat index of (x, y, z, channel). Channel is fastest-varying so one cell's state is contiguous. */
export function elementIndex(shape: GridShape, x: number, y: number, z: number, c: number): number {
  return ((z * shape.ny + y) * shape.nx + x) * shape.channels + c;
}

export interface GridEnvironment {
  shape: GridShape;
  channelNames: readonly string[];
  times: readonly number[];
  /** values[t][elementIndex] */
  values: readonly (readonly number[] | Float64Array)[];
  relations?: readonly Relation4D[];
  label: string;
}

function checkShape(shape: GridShape): void {
  for (const k of ["nx", "ny", "nz", "channels"] as const) {
    if (!Number.isSafeInteger(shape[k]) || shape[k] < 1 || shape[k] > 65535) throw new RangeError(`shape.${k} must be an integer in 1..65535`);
  }
}

function checkTimes(times: readonly number[]): void {
  for (let i = 0; i < times.length; i++) {
    if (!Number.isSafeInteger(times[i])) throw new RangeError(`times[${i}] must be a safe integer (epoch ms)`);
    if (i > 0 && times[i] < times[i - 1]) throw new RangeError("times must be non-decreasing");
  }
}

export function validateRelations(relations: readonly Relation4D[], D: number): void {
  const targets = new Set<number>();
  for (const r of relations) {
    if (!Number.isSafeInteger(r.target) || r.target < 0 || r.target >= D) throw new RangeError("relation target out of range");
    if (targets.has(r.target)) throw new RangeError(`element ${r.target} is the target of two relations`);
    targets.add(r.target);
    if (r.sources.length !== r.weights.length || r.sources.length === 0) throw new RangeError("relation needs matching sources and weights");
  }
  for (const r of relations) {
    for (const s of r.sources) {
      if (!Number.isSafeInteger(s) || s < 0 || s >= D) throw new RangeError("relation source out of range");
      if (targets.has(s)) throw new RangeError("a relation source may not itself be a relation target (one level only)");
    }
  }
}

export const gridEncoder: StateEncoder4D<GridEnvironment> = {
  encode(env: GridEnvironment): StateSurface4D {
    checkShape(env.shape);
    checkTimes(env.times);
    const D = elementCount(env.shape);
    if (env.channelNames.length !== env.shape.channels) throw new RangeError("channelNames length must equal shape.channels");
    if (env.values.length !== env.times.length || env.values.length < 1) throw new RangeError("need one value row per time, at least one");
    const frames = env.values.map((row, t) => {
      if (row.length !== D) throw new RangeError(`frame ${t} has ${row.length} values, expected ${D}`);
      const f = Float64Array.from(row);
      for (let e = 0; e < D; e++) if (!Number.isFinite(f[e])) throw new RangeError(`frame ${t} element ${e} is not finite`);
      return f;
    });
    const relations = env.relations ?? [];
    validateRelations(relations, D);
    return { shape: { ...env.shape }, channelNames: [...env.channelNames], times: [...env.times], frames, relations, label: env.label };
  },
};

export const FRAME_CHANNELS = ["x=predicted", "y=observed", "z=phi"] as const;

/** v0.1 accepted mapping. Each point becomes one frame of a 1×1×1×3 surface. */
export function encodeFramesAsSurface(
  points: readonly PackedPoint[],
  label: string,
  options: { relateObservedToPredicted?: boolean } = {},
): StateSurface4D {
  if (points.length < 1) throw new RangeError("need at least one point");
  const times = points.map((p) => p.t);
  checkTimes(times);
  const frames = points.map((p) => {
    const f = Float64Array.of(p.x, p.y, p.z);
    for (const v of f) if (!Number.isFinite(v)) throw new RangeError("non-finite axis value");
    return f;
  });
  const relations: Relation4D[] = options.relateObservedToPredicted
    ? [{ target: 1, sources: [0], weights: [1], kind: "observed≈predicted" }]
    : [];
  return {
    shape: { nx: 1, ny: 1, nz: 1, channels: 3 },
    channelNames: [...FRAME_CHANNELS],
    times,
    frames,
    relations,
    meta: { steps: points.map((p) => p.step), verdicts: points.map((p) => p.verdict) },
    label,
  };
}

/** Adapter from the existing ScpFrame type. ScpFrame has no step/verdict, so no meta is invented. */
export function encodeScpFrames(frames: readonly ScpFrame[], label: string): StateSurface4D {
  if (frames.length < 1) throw new RangeError("need at least one frame");
  const times = frames.map((f) => f.t);
  checkTimes(times);
  return {
    shape: { nx: 1, ny: 1, nz: 1, channels: 3 },
    channelNames: [...FRAME_CHANNELS],
    times,
    frames: frames.map((f) => Float64Array.of(f.x, f.y, f.z)),
    relations: [],
    label,
  };
}
