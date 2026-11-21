/**
 * TEST ONLY. Exact cycle model of scp4d_ede (event-driven) and scp4d_fsd (full scan).
 * Pure. The decision bit is decideThreshold from the software agent: code > threshold.
 * Temporal-only is the default. Relations mode spends FAN cycles per event marking
 * the declared fan-out and then evaluates those targets too.
 *
 * Cycle schedule (the RTL's states, one cycle each):
 *   CLEAR: D cycles, zeroing code, decision and dirty.
 *   each accepted token: 1 INGEST cycle.
 *   each event with relations mode: FAN mark cycles.
 *   each queued element: 1 EVAL cycle.
 *   each frame end: 1 EOF cycle. The last frame's EOF cycle also raises `done`.
 * Full scan has no queue and no fan cycles. Its EVAL is D cycles per frame, in element order.
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

function push(queue: number[], dirty: boolean[], elem: number): void {
  if (!dirty[elem]) { dirty[elem] = true; queue.push(elem); }
}

/** Event-driven decision engine. `fan[src]` has EDE_FAN slots. */
export function runEde(
  D: number,
  threshold: number,
  relations: boolean,
  fan: readonly (readonly FanSlot[])[],
  tokens: readonly Tok[],
): EdeRun {
  if (D < 1) throw new RangeError("D");
  const codes = new Array<number>(D).fill(0);
  const decs = new Array<0 | 1>(D).fill(0);
  const dirty = new Array<boolean>(D).fill(false);
  const queue: number[] = [];
  const changes: Change[] = [];
  let cycles = D;
  let evals = 0;
  let frame = 0;
  const err = 0;
  const fail = (code: number): EdeRun => ({ changes, cycles, evals, err: code });
  for (const tok of tokens) {
    cycles += 1;
    if (tok.event) {
      if (tok.elem >= D || tok.elem < 0) return fail(1);
      codes[tok.elem] = tok.code;
      push(queue, dirty, tok.elem);
      if (relations) {
        const slots = fan[tok.elem] ?? [];
        for (let s = 0; s < EDE_FAN; s++) {
          cycles += 1;
          const slot = slots[s];
          if (slot && slot.valid) {
            if (slot.tgt < 0 || slot.tgt >= D) return fail(2);
            push(queue, dirty, slot.tgt);
          }
        }
      }
    }
    if (tok.eof) {
      while (queue.length) {
        const e = queue.shift()!;
        cycles += 1;
        evals += 1;
        const nd = decideThreshold(codes[e], threshold) as 0 | 1;
        if (nd !== decs[e]) changes.push({ frame, elem: e, decision: nd });
        decs[e] = nd;
        dirty[e] = false;
      }
      cycles += 1;
      frame += 1;
    }
  }
  return { changes, cycles, evals, err };
}

/** Full-scan baseline. Same ingest and the same decision. Scan 0..D-1 every frame. */
export function runFsd(D: number, threshold: number, tokens: readonly Tok[]): EdeRun {
  if (D < 1) throw new RangeError("D");
  const codes = new Array<number>(D).fill(0);
  const decs = new Array<0 | 1>(D).fill(0);
  const changes: Change[] = [];
  let cycles = D;
  let evals = 0;
  let frame = 0;
  for (const tok of tokens) {
    cycles += 1;
    if (tok.event) {
      if (tok.elem >= D || tok.elem < 0) return { changes, cycles, evals, err: 1 };
      codes[tok.elem] = tok.code;
    }
    if (tok.eof) {
      for (let e = 0; e < D; e++) {
        cycles += 1;
        evals += 1;
        const nd = decideThreshold(codes[e], threshold) as 0 | 1;
        if (nd !== decs[e]) changes.push({ frame, elem: e, decision: nd });
        decs[e] = nd;
      }
      cycles += 1;
      frame += 1;
    }
  }
  return { changes, cycles, evals, err: 0 };
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
