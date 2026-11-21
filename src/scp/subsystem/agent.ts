/**
 * One decide() used two ways.
 * full_scan re-evaluates every cell every frame.
 * event_driven re-evaluates frame 0 in full, then only cells whose value changed
 * or that a declared relation reaches from a dirty cell.
 * Navigation (greedy on c2) runs on every step in both modes: it is the agent's own move.
 */
import { emptyOps, finishMeter, type AgentMeter } from "./op-meter";
import type { DecisionTask4D, GridShape, Relation4D } from "./types";

export type AgentMode = "full_scan" | "event_driven";

export const THRESHOLD = 0.5;
export const THRESHOLD_CHANNEL = 3;
export const NAV_CHANNEL = 2;

/** The one decision function. Shared by the scan, the task and the integer model (same comparison). */
export function decideThreshold(value: number, threshold: number): 0 | 1 {
  return value > threshold ? 1 : 0;
}

export function cellCount(shape: GridShape): number {
  return shape.nx * shape.ny * shape.nz;
}

export function splitCell(shape: GridShape, cell: number): { x: number; y: number; z: number } {
  const xy = shape.nx * shape.ny;
  const z = Math.floor(cell / xy);
  const rem = cell % xy;
  return { x: rem % shape.nx, y: Math.floor(rem / shape.nx), z };
}

function cellChanged(prev: Float64Array, curr: Float64Array, cell: number, channels: number): boolean {
  const base = cell * channels;
  for (let c = 0; c < channels; c++) if (!Object.is(prev[base + c], curr[base + c])) return true;
  return false;
}

/** Cells the agent re-evaluates at this frame. Sorted ascending. */
export function evaluationCells(
  mode: AgentMode,
  frameIndex: number,
  prev: Float64Array | null,
  curr: Float64Array,
  shape: GridShape,
  relations: readonly Relation4D[],
  useRelations: boolean,
): number[] {
  const n = cellCount(shape);
  if (mode === "full_scan" || frameIndex === 0 || prev === null) {
    const all = new Array<number>(n);
    for (let i = 0; i < n; i++) all[i] = i;
    return all;
  }
  const dirty = new Set<number>();
  for (let i = 0; i < n; i++) if (cellChanged(prev, curr, i, shape.channels)) dirty.add(i);
  if (useRelations) {
    const ch = shape.channels;
    for (const rel of relations) {
      let hit = false;
      for (const src of rel.sources) {
        if (dirty.has(Math.floor(src / ch))) { hit = true; break; }
      }
      if (hit) dirty.add(Math.floor(rel.target / ch));
    }
  }
  return [...dirty].sort((a, b) => a - b);
}

const DIRS: readonly (readonly [number, number])[] = [[0, -1], [1, 0], [0, 1], [-1, 0]];

export interface NavStep {
  move: number;
  next: number;
  reads: number;
  compares: number;
}

/** Greedy step toward a strictly smaller c2. Ties break to the lowest direction index. Stay is move -1. */
export function navigate(frame: Float64Array, shape: GridShape, cell: number): NavStep {
  const here = splitCell(shape, cell);
  const ch = shape.channels;
  const hereD = frame[(cell * ch) + NAV_CHANNEL];
  let best = cell;
  let bestD = hereD;
  let move = -1;
  let reads = 0;
  let compares = 0;
  for (let d = 0; d < DIRS.length; d++) {
    const x = here.x + DIRS[d][0];
    const y = here.y + DIRS[d][1];
    if (x < 0 || y < 0 || x >= shape.nx || y >= shape.ny) continue;
    const nxt = (here.z * shape.ny + y) * shape.nx + x;
    const dist = frame[(nxt * ch) + NAV_CHANNEL];
    reads++;
    compares++;
    if (dist < bestD) { bestD = dist; best = nxt; move = d; }
  }
  return { move, next: best, reads, compares };
}

export function thresholdTask(eps: number): DecisionTask4D {
  return {
    name: `sensor(c3>${THRESHOLD})`,
    decide(frame, _t, surface) {
      const n = cellCount(surface.shape);
      const ch = surface.shape.channels;
      const out = new Array<number>(n);
      for (let i = 0; i < n; i++) out[i] = decideThreshold(frame[i * ch + THRESHOLD_CHANNEL], THRESHOLD);
      return out;
    },
    margins(frame, _t, surface) {
      const n = cellCount(surface.shape);
      const ch = surface.shape.channels;
      const out = new Array<number>(n);
      for (let i = 0; i < n; i++) out[i] = Math.abs(frame[i * ch + THRESHOLD_CHANNEL] - THRESHOLD);
      return out;
    },
    marginNeeded: eps,
  };
}

export interface AgentTrace {
  mode: AgentMode;
  use_relations: boolean;
  /** Per frame, one threshold decision per cell (carried forward when the cell was not re-evaluated). */
  decisions: number[][];
  nav_pos: number[];
  reached_goal: boolean;
  steps_to_goal: number | null;
  cells_evaluated: number;
  /** Evaluated cells over frames t ≥ 1, divided by cells × (T−1). */
  dirty_fraction: number;
  meter: AgentMeter;
}

export function runAgent(
  frames: readonly Float64Array[],
  shape: GridShape,
  relations: readonly Relation4D[],
  mode: AgentMode,
  useRelations: boolean,
): AgentTrace {
  if (frames.length < 1) throw new RangeError("agent needs a frame");
  const n = cellCount(shape);
  const ch = shape.channels;
  const decisions: number[][] = [];
  const navPos: number[] = [];
  let held = new Array<number>(n).fill(0);
  let pos = n - 1;
  let stepsToGoal: number | null = pos === 0 ? 0 : null;
  let cellsEvaluated = 0;
  let dirtyLater = 0;
  let navReads = 0;
  let navCompares = 0;
  const instrumented = emptyOps();
  for (let t = 0; t < frames.length; t++) {
    const cells = evaluationCells(mode, t, t === 0 ? null : frames[t - 1], frames[t], shape, relations, useRelations);
    const next = held.slice();
    for (const cell of cells) {
      next[cell] = decideThreshold(frames[t][cell * ch + THRESHOLD_CHANNEL], THRESHOLD);
      instrumented.compare++;
      instrumented.state_bytes_touched += 8;
      instrumented.bytes_out++;
    }
    cellsEvaluated += cells.length;
    if (t > 0) dirtyLater += cells.length;
    held = next;
    decisions.push(next);
    const step = navigate(frames[t], shape, pos);
    navReads += step.reads;
    navCompares += step.compares;
    instrumented.compare += step.compares;
    instrumented.state_bytes_touched += 8 * step.reads;
    if (t < frames.length - 1) {
      pos = step.next;
      if (pos === 0 && stepsToGoal === null) stepsToGoal = t + 1;
    }
    navPos.push(pos);
  }
  const later = Math.max(1, frames.length - 1) * n;
  return {
    mode,
    use_relations: useRelations,
    decisions,
    nav_pos: navPos,
    reached_goal: navPos[navPos.length - 1] === 0 || stepsToGoal !== null,
    steps_to_goal: stepsToGoal,
    cells_evaluated: cellsEvaluated,
    dirty_fraction: dirtyLater / later,
    meter: finishMeter(instrumented, cellsEvaluated, navReads, navCompares),
  };
}
