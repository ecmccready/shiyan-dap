/**
 * temporal_state: an append-only, event-driven state surface.
 *
 * Each appended frame is compared against a prediction (base + predicted held residual).
 * Only elements whose prediction misses by more than eps become events; every other element
 * keeps the predicted value. Because encoder and decoder run the same arithmetic on the same
 * reconstructed history (closed loop), |v − v'| ≤ eps holds for every element of every frame,
 * and downstream compute only needs to look at the events.
 *
 * Append-only: updates are frozen once appended and a SHA-256 head chains them, so a replayed
 * log is verifiable. Pure apart from node:crypto hashing; no I/O, no env, no clocks.
 */
import { createHash } from "node:crypto";
import { ByteWriter } from "./bytes";
import type { StatePredictor } from "./types";

/** base(e, current, frameIndex): the multidimensional/relational part of the prediction. */
export type BaseFn = (e: number, current: Float64Array, frameIndex: number) => number;

export interface EventUpdate {
  readonly frameIndex: number;
  readonly t: number;
  /** Positions in the processing order (strictly increasing). */
  readonly positions: readonly number[];
  /** Quantized residual codes, one per position: v' = prediction + q · eps. */
  readonly q: readonly number[];
}

export interface TemporalStateOptions {
  D: number;
  /** Per-element tolerance (length D). */
  eps: Float64Array;
  /** Processing order (a permutation of 0..D-1); relation targets must come after their sources. */
  order: Int32Array;
  predictor: StatePredictor;
  base?: BaseFn;
}

export class TemporalStateSurface {
  private readonly D: number;
  private readonly eps: Float64Array;
  private readonly order: Int32Array;
  private readonly predictor: StatePredictor;
  private readonly base: BaseFn;
  private readonly h1: Float64Array;
  private readonly h2: Float64Array;
  private readonly current: Float64Array;
  private readonly log: EventUpdate[] = [];
  private head: string | null = null;
  private seen = 0;

  constructor(o: TemporalStateOptions) {
    if (o.eps.length !== o.D || o.order.length !== o.D) throw new RangeError("eps and order must have length D");
    for (const e of o.eps) if (!(e > 0) || !Number.isFinite(e)) throw new RangeError("eps must be finite and > 0");
    this.D = o.D; this.eps = o.eps; this.order = o.order; this.predictor = o.predictor;
    this.base = o.base ?? (() => 0);
    this.h1 = new Float64Array(o.D); this.h2 = new Float64Array(o.D); this.current = new Float64Array(o.D);
  }

  get length(): number { return this.log.length; }
  get head_sha256(): string | null { return this.head; }
  get updates(): readonly EventUpdate[] { return this.log; }
  /** A copy of the current reconstructed state (callers cannot mutate the surface). */
  snapshot(): Float64Array { return Float64Array.from(this.current); }

  private prediction(e: number, frameIndex: number): { base: number; pred: number } {
    const base = this.base(e, this.current, frameIndex);
    return { base, pred: base + this.predictor.predict(this.h1[e], this.h2[e], this.seen) };
  }

  private commit(e: number, base: number, value: number): void {
    this.h2[e] = this.h1[e];
    this.h1[e] = value - base;
    this.current[e] = value;
  }

  private seal(update: EventUpdate): EventUpdate {
    const frozen: EventUpdate = Object.freeze({ ...update, positions: Object.freeze([...update.positions]), q: Object.freeze([...update.q]) });
    const w = new ByteWriter();
    w.uvarint(frozen.frameIndex); w.svarint(frozen.t); w.uvarint(frozen.positions.length);
    for (let i = 0; i < frozen.positions.length; i++) { w.uvarint(frozen.positions[i]); w.svarint(frozen.q[i]); }
    this.head = createHash("sha256").update(this.head ?? "4d-scp-temporal-v1").update(w.bytes()).digest("hex");
    this.log.push(frozen);
    this.seen++;
    return frozen;
  }

  /** Encoder side: append a raw frame, emit events only where the prediction misses by > eps. */
  append(frame: Float64Array, t: number): EventUpdate {
    if (frame.length !== this.D) throw new RangeError("frame length must be D");
    const frameIndex = this.log.length;
    const positions: number[] = [], q: number[] = [];
    for (let pos = 0; pos < this.D; pos++) {
      const e = this.order[pos];
      const { base, pred } = this.prediction(e, frameIndex);
      const r = frame[e] - pred;
      let value = pred;
      if (Math.abs(r) > this.eps[e]) {
        const code = Math.round(r / this.eps[e]);
        if (!Number.isSafeInteger(code)) throw new RangeError("residual too large for eps");
        value = pred + code * this.eps[e];
        positions.push(pos); q.push(code);
      }
      if (!(Math.abs(frame[e] - value) <= this.eps[e])) throw new RangeError(`bound violated at element ${e} (eps too small for magnitude)`);
      this.commit(e, base, value);
    }
    return this.seal({ frameIndex, t, positions, q });
  }

  /** Decoder side: apply an update produced by append() and return a copy of the new state. */
  apply(update: EventUpdate): Float64Array {
    if (update.frameIndex !== this.log.length) throw new RangeError("updates must be applied in order (append-only)");
    let k = 0;
    for (let pos = 0; pos < this.D; pos++) {
      const e = this.order[pos];
      const { base, pred } = this.prediction(e, update.frameIndex);
      let value = pred;
      if (k < update.positions.length && update.positions[k] === pos) { value = pred + update.q[k] * this.eps[e]; k++; }
      this.commit(e, base, value);
    }
    if (k !== update.positions.length) throw new RangeError("update positions out of order or out of range");
    this.seal(update);
    return this.snapshot();
  }
}
