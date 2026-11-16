// 4D state compression (M3): window sealing. Pure and deterministic; the caller supplies as_of (no clock here).
//
// Rule (resolves design open question 4):
//   1. Arrival order. Each included point has an arrival time: the row's created_at (DB insert time) when
//      present and valid, otherwise its proof_timestamp. Points are walked in (arrival, t, experience_id) order.
//   2. A window opens at its first point's arrival. It closes "full" at size points, or "cutoff" when the next
//      point arrives at or after opened_at + cutoff_ms (or, for the last window, when as_of reaches that time).
//   3. A closed window is sealed (final) only once as_of >= its close time + grace_ms. The close time is the
//      last point's arrival for "full" and opened_at + cutoff_ms for "cutoff". Grace covers inserts that were
//      timestamped before a boundary but committed after it. The first non-final window and everything after
//      it stay pending, so the sealed chain is always a prefix.
//   4. Inside a window, points are encoded in M1 canonical order (t, experience_id), so dt stays non-negative.
//   5. A late record (t earlier than the newest t of an already-sealed window) lands in the window open at its
//      arrival, i.e. the next open window. Sealed windows are decided by arrival, so they never reopen.
import { comparePoints } from "./extract";
import { DEFAULT_SEGMENT_SIZE, type SourceRow, type StatePoint } from "./types";

export const DEFAULT_CUTOFF_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_GRACE_MS = 10 * 60 * 1000;

export interface SealingOptions {
  /** Points per window; default 256. */
  segmentSize?: number;
  /** Time cutoff per window in ms; default 24 h. Infinity = seal on size only. */
  cutoffMs?: number;
  /** Settle time after a window closes before it counts as sealed; default 10 min. */
  graceMs?: number;
  /** Evaluation time (epoch ms). Required: the core never reads a clock. */
  asOfMs: number;
}

export type CloseReason = "full" | "cutoff";

export interface SealedWindow {
  /** Points in M1 canonical order. */
  points: StatePoint[];
  opened_at: number;
  closed_at: number;
  closed_by: CloseReason;
}

export interface WindowPlan {
  sealed: SealedWindow[];
  /** Included points not yet in a sealed window. */
  pending: number;
  /** Points whose t is earlier than the newest t of a preceding sealed window. */
  late: number;
  /** Points with no valid created_at, so arrival fell back to proof_timestamp. */
  arrival_fallback: number;
}

export function checkSealingOptions(o: SealingOptions): Required<SealingOptions> {
  const segmentSize = o.segmentSize ?? DEFAULT_SEGMENT_SIZE;
  const cutoffMs = o.cutoffMs ?? DEFAULT_CUTOFF_MS;
  const graceMs = o.graceMs ?? DEFAULT_GRACE_MS;
  if (!Number.isSafeInteger(segmentSize) || segmentSize < 1) throw new RangeError("segmentSize must be a positive integer");
  if (!(cutoffMs === Infinity || (Number.isSafeInteger(cutoffMs) && cutoffMs > 0))) throw new RangeError("cutoffMs must be a positive integer or Infinity");
  if (!Number.isSafeInteger(graceMs) || graceMs < 0) throw new RangeError("graceMs must be a non-negative integer");
  if (!Number.isSafeInteger(o.asOfMs)) throw new RangeError("asOfMs must be an integer epoch-ms value");
  return { segmentSize, cutoffMs, graceMs, asOfMs: o.asOfMs };
}

/** Arrival per experience_id from the rows' created_at (first valid value per id). */
export function arrivalsFrom(rows: readonly SourceRow[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of rows) {
    if (typeof r?.experience_id !== "string" || typeof r.created_at !== "string" || out.has(r.experience_id)) continue;
    const ms = Date.parse(r.created_at);
    if (Number.isSafeInteger(ms)) out.set(r.experience_id, ms);
  }
  return out;
}

export function planWindows(points: readonly StatePoint[], arrivals: ReadonlyMap<string, number>, options: SealingOptions): WindowPlan {
  const { segmentSize, cutoffMs, graceMs, asOfMs } = checkSealingOptions(options);
  let arrival_fallback = 0;
  const walk = points.map((p) => {
    const a = arrivals.get(p.experience_id);
    if (a === undefined) arrival_fallback += 1;
    return { p, arrival: a ?? p.t };
  });
  walk.sort((x, y) => (x.arrival !== y.arrival ? (x.arrival < y.arrival ? -1 : 1) : comparePoints(x.p, y.p)));

  type Open = { points: StatePoint[]; opened_at: number; last_arrival: number };
  const closed: (Open & { closed_by: CloseReason; closed_at: number })[] = [];
  let open: Open | null = null;
  const close = (w: Open, by: CloseReason) =>
    closed.push({ ...w, closed_by: by, closed_at: by === "full" ? w.last_arrival : w.opened_at + cutoffMs });
  for (const { p, arrival } of walk) {
    if (open && arrival >= open.opened_at + cutoffMs) { close(open, "cutoff"); open = null; }
    if (!open) open = { points: [], opened_at: arrival, last_arrival: arrival };
    open.points.push(p);
    open.last_arrival = arrival;
    if (open.points.length === segmentSize) { close(open, "full"); open = null; }
  }
  if (open && asOfMs >= open.opened_at + cutoffMs) { close(open, "cutoff"); open = null; }

  const sealed: SealedWindow[] = [];
  for (const w of closed) {
    if (!(asOfMs >= w.closed_at + graceMs)) break;
    sealed.push({ points: [...w.points].sort(comparePoints), opened_at: w.opened_at, closed_at: w.closed_at, closed_by: w.closed_by });
  }
  let late = 0;
  let newest = -Infinity;
  for (const w of sealed) {
    for (const p of w.points) if (p.t < newest) late += 1;
    for (const p of w.points) if (p.t > newest) newest = p.t;
  }
  const inSealed = sealed.reduce((n, w) => n + w.points.length, 0);
  return { sealed, pending: points.length - inSealed, late, arrival_fallback };
}
