/**
 * TEST ONLY. Exact cycle model of scp4d_ede (event-driven) and scp4d_fsd (full scan).
 * Pure. The decision bit is decideThreshold from the software agent: code > threshold.
 * Temporal-only is the default. Relations mode also marks the declared fan-out.
 *
 * Dirty, decision and code are synchronous block RAMs. A read address registered
 * on one clock is sampled on the next and used on the clock after that. There is
 * no same-cycle write-through. Decision values match the previous compare; the
 * cycle counts are the block-RAM schedule below.
 *
 * scp4d_ede, one clock per state:
 *   CLEAR: D cycles, zeroing code, decision and dirty.
 *   each accepted token: 1 cycle.
 *   each in-range event: +1 sample clock and +1 use clock (read dirty, write the
 *   code, enqueue if the cell was clean).
 *   relations mode, per fan slot: 1 address clock. A valid in-range slot adds a
 *   sample clock and a use clock. An out-of-range target errors on the address clock.
 *   each queued element: 1 address + 1 sample + 1 use clock.
 *   each frame end: 1 EOF clock (the empty-queue case is that clock alone).
 *   The last frame's EOF clock also raises `done`.
 * scp4d_fsd has no queue and no fan. Each frame scans 0..D-1 with a sample clock
 * and a use clock per element, then 1 EOF clock. The eof token's accept clock is
 * the address clock for element 0.
 * `cycles` is the number of clocks from reset release through the cycle that raises `done`.
 */
import { decideThreshold } from "../src/scp/subsystem";

export const EDE_FAN = 4;
export const EDE_DECLARED_CODE_BITS = 32;
export const EDE_ANALYTIC_CODE_BITS = 16;

export interface Tok {
  elem: number;
  code: number;
  event: boolean;
  eof: boolean;
  last: boolean;
}

export interface FanSlot { tgt: number; valid: boolean }
export interface Change { frame: number; elem: number; decision: 0 | 1 }

export interface EdeRun {
  changes: Change[];
  cycles: number;
  evals: number;
  err: number;
}

/** Continuing decision state. Frames are applied one at a time by stepEde / stepFsd. */
export interface EdeState {
  codes: number[];
  decs: (0 | 1)[];
  dirty: boolean[];
  queue: number[];
  frame: number;
  cycles: number;
  evals: number;
}

export function freshEde(D: number): EdeState {
  return {
    codes: new Array<number>(D).fill(0),
    decs: new Array<0 | 1>(D).fill(0),
    dirty: new Array<boolean>(D).fill(false),
    queue: [],
    frame: 0,
    cycles: D,
    evals: 0,
  };
}

function push(queue: number[], dirty: boolean[], elem: number): void {
  if (!dirty[elem]) { dirty[elem] = true; queue.push(elem); }
}

/** Event-driven decision engine. `fan[src]` has EDE_FAN slots. */
export function stepEde(
  state: EdeState,
  D: number,
  threshold: number,
  relations: boolean,
  fan: readonly (readonly FanSlot[])[],
  tokens: readonly Tok[],
): EdeRun {
  const changes: Change[] = [];
  const beforeC = state.cycles;
  const beforeE = state.evals;
  const fail = (code: number): EdeRun => ({ changes, cycles: state.cycles - beforeC, evals: state.evals - beforeE, err: code });
  for (const tok of tokens) {
    state.cycles += 1;
    if (tok.event) {
      if (tok.elem >= D || tok.elem < 0) return fail(1);
      state.cycles += 2;
      state.codes[tok.elem] = tok.code;
      push(state.queue, state.dirty, tok.elem);
      if (relations) {
        const slots = fan[tok.elem] ?? [];
        for (let s = 0; s < EDE_FAN; s++) {
          state.cycles += 1;
          const slot = slots[s];
          if (slot && slot.valid) {
            if (slot.tgt < 0 || slot.tgt >= D) return fail(2);
            state.cycles += 2;
            push(state.queue, state.dirty, slot.tgt);
          }
        }
      }
    }
    if (tok.eof) {
      if (state.queue.length === 0) state.cycles += 1;
      else {
        while (state.queue.length) {
          const e = state.queue.shift()!;
          state.cycles += 3;
          state.evals += 1;
          const nd = decideThreshold(state.codes[e], threshold) as 0 | 1;
          if (nd !== state.decs[e]) changes.push({ frame: state.frame, elem: e, decision: nd });
          state.decs[e] = nd;
          state.dirty[e] = false;
        }
        state.cycles += 1;
      }
      state.frame += 1;
    }
  }
  return { changes, cycles: state.cycles - beforeC, evals: state.evals - beforeE, err: 0 };
}

export function runEde(
  D: number,
  threshold: number,
  relations: boolean,
  fan: readonly (readonly FanSlot[])[],
  tokens: readonly Tok[],
): EdeRun {
  if (D < 1) throw new RangeError("D");
  const state = freshEde(D);
  const step = stepEde(state, D, threshold, relations, fan, tokens);
  return { changes: step.changes, cycles: state.cycles, evals: state.evals, err: step.err };
}

/** Full-scan baseline. Same ingest and the same decision. Scan 0..D-1 every frame. */
export function stepFsd(state: EdeState, D: number, threshold: number, tokens: readonly Tok[]): EdeRun {
  const changes: Change[] = [];
  const beforeC = state.cycles;
  const beforeE = state.evals;
  for (const tok of tokens) {
    state.cycles += 1;
    if (tok.event) {
      if (tok.elem >= D || tok.elem < 0) return { changes, cycles: state.cycles - beforeC, evals: state.evals - beforeE, err: 1 };
      state.codes[tok.elem] = tok.code;
    }
    if (tok.eof) {
      for (let e = 0; e < D; e++) {
        state.cycles += 2;
        state.evals += 1;
        const nd = decideThreshold(state.codes[e], threshold) as 0 | 1;
        if (nd !== state.decs[e]) changes.push({ frame: state.frame, elem: e, decision: nd });
        state.decs[e] = nd;
        state.dirty[e] = false;
      }
      state.queue.length = 0;
      state.cycles += 1;
      state.frame += 1;
    }
  }
  return { changes, cycles: state.cycles - beforeC, evals: state.evals - beforeE, err: 0 };
}

export function runFsd(D: number, threshold: number, tokens: readonly Tok[]): EdeRun {
  if (D < 1) throw new RangeError("D");
  const state = freshEde(D);
  const step = stepFsd(state, D, threshold, tokens);
  return { changes: step.changes, cycles: state.cycles, evals: state.evals, err: step.err };
}

export function changeKey(c: Change): string {
  return `${c.frame}:${c.elem}:${c.decision}`;
}

/** Same decision-change set, ignoring order. */
export function sameChangeSet(a: readonly Change[], b: readonly Change[]): boolean {
  const ka = a.map(changeKey).sort();
  const kb = b.map(changeKey).sort();
  return ka.length === kb.length && ka.every((k, i) => k === kb[i]);
}

export function codeBits(n: number): number {
  const a = Math.abs(n);
  if (a === 0) return 1;
  return Math.floor(Math.log2(a)) + 1 + 1;
}
