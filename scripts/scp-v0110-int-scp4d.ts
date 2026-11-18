/**
 * TEST ONLY. 4D-SCP v0.1.10 — bit-accurate, integer-only, hash-free golden model of the combined
 * scp4d path (low-rank base + declared relations + event-driven temporal residual), plus integer
 * models of the full_q and delta baselines under the same op/energy accounting.
 *
 * This is the reference an FPGA/RTL datapath would be verified against
 * (fixtures/scp/golden-vectors-scp4d.json). It is NOT wired into the app: nothing outside
 * scripts/ imports it, and src/scp (pack.ts, the v0.1.9 subsystem) is unchanged.
 *
 * Datapath contract
 *   Ingest (shared front-end, identical for every strategy): each float64 value v is quantized to
 *   an integer code x = round(v / g) with the v0.1.8 integer-only RN quantizer
 *   (scripts/scp-v018-integer-model.ts, bit-exact with pack.ts's Math.round(v/eps)). For scp4d-int
 *   the grid is g = eps / 2^G (exact: a power-of-two scaling of eps); for full_q/delta it is eps.
 *   Hot path (encode and decode): integer add/sub, arithmetic shift, compare, and integer multiply
 *   (relation weights, low-rank factors) only. No floating point, no division other than the
 *   power-of-two arithmetic shift, no hashing. Every intermediate is asserted to be a safe integer
 *   and recorded in a width census (registers below).
 *   Output: integer codes c[t][e]; v' = c · g is a back-end conversion the consumer may skip.
 *
 * Error bound (proof, per element-frame). |v − x·g| ≤ g/2 (RN quantizer). The decoded code c
 * satisfies |x − c| ≤ k = 2^G − 1 (hold: no event iff |x − pred| ≤ k; event: q = floor((r + 2^(G−1)) / 2^G),
 * c = pred + q·2^G, so |x − c| = |r − q·2^G| ≤ 2^(G−1) ≤ k). Hence
 * |v − c·g| ≤ g/2 + k·g = eps·(1 − 2^−(G+1)) < eps. The bound does not depend on the base or
 * predictor, so base precision (relation weights, factor bits) only affects size, never fidelity.
 *
 * Setup (host side, once per stream, NOT the per-element datapath; may use floats):
 *   relation weights W = round(w · g_src/g_tgt · 2^FW), bias B = round(bias/g_tgt · 2^FW);
 *   low-rank factors fitted on the integer codes (float SVD, v0.1.9 linalg), then quantized to
 *   int16 B_q per column and int16 A_q with a common shift F; mean codes rounded to integers.
 *   The audit hash chain (optional, off-datapath) lives in the check script, not here.
 *
 * Pure: no I/O, no env, no clocks, no randomness, no Level 4 / app imports, no node:crypto.
 */
import { lowRankFit } from "../src/scp/subsystem";
import type { FrameMeta, GridShape, Relation4D } from "../src/scp/subsystem";
import { frontEndFloat, quantizeInteger, precomputeIntegerRecip, type IntegerPrecompute } from "./scp-v018-integer-model";
import { emptyCounts, totalOps, type OpCounts } from "./scp-v014-ops";

export const S4DI_MAGIC = "S4DI";
export const S4DI_VERSION = 1;
export const S4DS_MAGIC = "S4DS";
export const DEFAULT_G = 8;
export const WEIGHT_FRAC_BITS = 16;
export const FACTOR_BITS = 16;
export const FACTOR_MAX = 2 ** (FACTOR_BITS - 1) - 1;
export const MAX_F = 30;
/** Largest element count per frame (u16 × 4 shape fields bound D; gaps and heads are < 2·D + 2). */
export const D_MAX_GAP = 2 ** 32;
export const INT_RANKS = [0, 1, 2, 4, 8] as const;
export const PREDICTORS = ["zero", "last", "linear"] as const;
export type IntPredictor = (typeof PREDICTORS)[number];

/** Declared hardware register widths (signed bits). The census must stay within these. */
export const DECLARED_WIDTHS = {
  code: 32,          // x, c, pred, r, h1, h2, base, mean code
  q: 32,             // event residual code (eps units)
  weight: 18,        // relation weight W (|w·g_s/g_t| ≤ 2 → ≤ 2^17)
  rel_product: 48,   // W · Δc
  rel_acc: 48,       // Σ W·c + bias (per relation target)
  factor: FACTOR_BITS, // A_q, B_q
  lr_product: 32,    // A_q · B_q
  lr_acc: 40,        // Σ_j A_q·B_q (+ rounding)
  varint: 53,        // zigzag value in the payload varint unit (bounded by the code / q bound)
  header_varint: 54, // header varints (epoch-ms times, steps, factors): guarded by the safe-integer check
} as const;
export type RegName = keyof typeof DECLARED_WIDTHS;

export interface IntConfig { rank: number; relations: boolean; predictor: IntPredictor; G: number }

/** Instrumented operation counts (per stream). Energy mapping lives in the check script. */
export interface IntOps {
  add: number;        // add / sub / negate
  shift: number;      // arithmetic or logical shift by a constant
  bit: number;        // and / or / xor
  cmp: number;        // compare / branch
  mul: number;        // integer multiply (≤ 32×32 here; widths in the census)
  bytes_in: number;   // stream bytes consumed
  bytes_out: number;  // stream bytes produced
  state_read: number; // bytes read from per-element state memory (H1, H2, C, ACC, mean, B rows, event buffer)
  state_write: number;
}
export const zeroIntOps = (): IntOps => ({ add: 0, shift: 0, bit: 0, cmp: 0, mul: 0, bytes_in: 0, bytes_out: 0, state_read: 0, state_write: 0 });
export const intOpsTotal = (o: IntOps): number => o.add + o.shift + o.bit + o.cmp + o.mul;

export type Census = Record<RegName, number>;
export const emptyIntCensus = (): Census => Object.fromEntries(Object.keys(DECLARED_WIDTHS).map((k) => [k, 0])) as Census;
/** Signed two's-complement width needed for |v| ≤ m. */
export function signedBits(m: number): number { let b = 1; while (2 ** (b - 1) <= m) b++; return b; }

const P2: number[] = Array.from({ length: 54 }, (_, i) => 2 ** i);

// <datapath> -------------------------------------------------------------------------------------
// Everything between the datapath markers is the hot path. It uses only integer-valued Numbers:
// + − · on safe integers, compare, and asr()/shl(), which are exact power-of-two shifts.
// scripts/check-scp-v0110.ts statically rejects float / hash tokens inside this region.

/** Arithmetic shift right by n (floor), exact for safe integers. */
export function asr(x: number, n: number): number { return n === 0 ? x : Math.floor(x / P2[n]); }
/** Shift left by n, exact for safe integers. */
export function shl(x: number, n: number): number { return x * P2[n]; }

function reg(c: Census, name: RegName, v: number): number {
  if (!Number.isSafeInteger(v)) throw new RangeError(`register ${name} left the integer domain`);
  const m = v < 0 ? -v : v;
  if (m > c[name]) c[name] = m;
  return v;
}

/** Instrumented varint writer: per byte 1 shift + 1 bit + 1 cmp + 1 byte out; zigzag adds 1 shift + 1 bit. */
export class IntWriter {
  readonly out: number[] = [];
  vreg: RegName = "header_varint";
  constructor(private readonly o: IntOps, private readonly c: Census) {}
  get length(): number { return this.out.length; }
  u8(v: number): void { this.out.push(v & 0xff); this.o.bytes_out++; }
  u16(v: number): void { this.u8(v & 0xff); this.u8((v >>> 8) & 0xff); }
  u32(v: number): void { this.u8(v & 0xff); this.u8((v >>> 8) & 0xff); this.u8((v >>> 16) & 0xff); this.u8((v >>> 24) & 0xff); }
  magic(s: string): void { for (let i = 0; i < s.length; i++) this.u8(s.charCodeAt(i)); }
  bits64(b: bigint): void { for (let i = 0; i < 8; i++) this.u8(Number((b >> BigInt(8 * i)) & BigInt(0xff))); }
  uvarint(n: number): void {
    reg(this.c, this.vreg, n);
    if (n < 0) throw new RangeError("uvarint needs n ≥ 0");
    for (;;) {
      this.o.shift++; this.o.bit++; this.o.cmp++;
      if (n < 128) { this.u8(n); return; }
      this.u8((n % 128) | 128);
      n = asr(n, 7);
    }
  }
  svarint(n: number): void {
    reg(this.c, this.vreg, n);
    this.o.shift++; this.o.bit++;
    this.uvarint(n >= 0 ? shl(n, 1) : shl(-n, 1) - 1);
  }
  bytes(): Uint8Array { return Uint8Array.from(this.out); }
}

export class IntReader {
  private i = 0;
  constructor(private readonly buf: Uint8Array, private readonly o: IntOps) {}
  get remaining(): number { return this.buf.length - this.i; }
  u8(): number { if (this.i >= this.buf.length) throw new RangeError("unexpected end of S4DI or S4DS stream"); this.o.bytes_in++; return this.buf[this.i++]; }
  u16(): number { return this.u8() + shl(this.u8(), 8); }
  u32(): number { return this.u8() + shl(this.u8(), 8) + shl(this.u8(), 16) + shl(this.u8(), 24); }
  magic(): string { return String.fromCharCode(this.u8(), this.u8(), this.u8(), this.u8()); }
  bits64(): bigint { let b = BigInt(0); for (let i = 0; i < 8; i++) b |= BigInt(this.u8()) << BigInt(8 * i); return b; }
  uvarint(): number {
    let n = 0, s = 0;
    for (;;) {
      const b = this.u8();
      this.o.shift++; this.o.bit++; this.o.cmp++;
      n += shl(b & 0x7f, s);
      if ((b & 0x80) === 0) break;
      s += 7;
      if (s > 49) throw new RangeError("uvarint too large");
    }
    if (!Number.isSafeInteger(n)) throw new RangeError("uvarint not a safe integer");
    return n;
  }
  svarint(): number { const u = this.uvarint(); this.o.shift++; this.o.bit++; return u % 2 === 0 ? asr(u, 1) : -asr(u + 1, 1); }
  expectEnd(): void { if (this.remaining !== 0) throw new RangeError("trailing bytes in stream"); }
}

export interface FrameEvents { positions: number[]; q: number[]; dense: boolean }

/** Fixed-point schema for one relation target (setup output; integers only). */
export interface IntRelation { target: number; sources: number[]; W: number[]; bias: number }
/** Fixed-point low-rank base (setup output; integers only). */
export interface IntBase { rank: number; F: number; mean: number[]; A: number[]; B: number[] }

interface Plan {
  D: number; T: number; cfg: IntConfig; order: Int32Array;
  targetIdx: Int32Array;          // element → relation index or −1
  rels: IntRelation[];
  fanout: { ti: number; W: number }[][]; // source element → (relation index, weight)
  isSource: Uint8Array;
  base: IntBase | null;
}

function makePlan(D: number, T: number, cfg: IntConfig, rels: IntRelation[], base: IntBase | null): Plan {
  const useRel = cfg.relations && rels.length > 0;
  const targetIdx = new Int32Array(D).fill(-1);
  const fanout: { ti: number; W: number }[][] = Array.from({ length: D }, () => []);
  const isSource = new Uint8Array(D);
  const active = useRel ? rels : [];
  active.forEach((r, i) => { targetIdx[r.target] = i; r.sources.forEach((s, j) => { fanout[s].push({ ti: i, W: r.W[j] }); isSource[s] = 1; }); });
  const order = new Int32Array(D);
  let k = 0;
  for (let e = 0; e < D; e++) if (targetIdx[e] < 0) order[k++] = e;
  for (let e = 0; e < D; e++) if (targetIdx[e] >= 0) order[k++] = e;
  return { D, T, cfg: { ...cfg, relations: useRel }, order, targetIdx, rels: active, fanout, isSource, base: cfg.rank > 0 ? base : null };
}

/** Per-stream datapath state. Memories: H1, H2 (linear), C (when C ≠ H1), ACC (relation targets). */
class Datapath {
  readonly H1: Float64Array; readonly H2: Float64Array; readonly C: Float64Array; readonly ACC: Float64Array;
  seen = 0;
  /** Elements whose decoded code is not a separate memory word: rank 0, "last", non-target ⇒ c ≡ h1. */
  private readonly cIsH1: boolean;
  readonly k: number; readonly halfG: number; readonly halfFW: number; readonly halfF: number;
  constructor(readonly p: Plan, readonly o: IntOps, readonly c: Census) {
    const D = p.D;
    this.H1 = new Float64Array(D); this.H2 = new Float64Array(D); this.C = new Float64Array(D);
    this.ACC = new Float64Array(p.rels.length);
    p.rels.forEach((r, i) => { this.ACC[i] = reg(c, "rel_acc", r.bias); });
    this.cIsH1 = p.base === null && p.cfg.predictor === "last";
    this.k = P2[p.cfg.G] - 1; this.halfG = p.cfg.G > 0 ? P2[p.cfg.G - 1] : 0;
    this.halfFW = P2[WEIGHT_FRAC_BITS - 1];
    this.halfF = p.base && p.base.F > 0 ? P2[p.base.F - 1] : 0;
  }

  /** base(e, t): relation rule for targets, low-rank (or 0) elsewhere. Returns [base, hasBase]. */
  private base(e: number, t: number): number {
    const { o, c, p } = this;
    const ti = p.targetIdx[e];
    if (ti >= 0) {
      o.state_read += 8; o.add++; o.shift++;
      return reg(c, "code", asr(reg(c, "rel_acc", this.ACC[ti] + this.halfFW), WEIGHT_FRAC_BITS));
    }
    const b = p.base;
    if (!b) return 0;
    let s = 0;
    for (let j = 0; j < b.rank; j++) {
      s = reg(c, "lr_acc", s + reg(c, "lr_product", b.A[t * b.rank + j] * b.B[e * b.rank + j]));
      o.mul++; o.add++;
    }
    o.state_read += 4 + 2 * b.rank; o.add += 2; o.shift++;
    return reg(c, "code", b.mean[e] + asr(reg(c, "lr_acc", s + this.halfF), b.F));
  }

  /** Verification hook (not counted): incremental ACC must equal a full recompute Σ W·c + bias. */
  verifyAccumulators(frame: Float64Array): void {
    this.p.rels.forEach((r, i) => {
      let s = r.bias;
      for (let j = 0; j < r.sources.length; j++) s += r.W[j] * frame[r.sources[j]];
      if (s !== this.ACC[i]) throw new RangeError(`incremental accumulator ${i} diverged from full recompute`);
    });
  }

  private hasBase(e: number): boolean { return this.p.targetIdx[e] >= 0 || this.p.base !== null; }

  /** Prediction for element e at frame t. Reads H1/H2 as the predictor needs. */
  predict(e: number, t: number): { b: number; pred: number; h1: number } {
    const { o, c, p } = this;
    const b = this.base(e, t);
    let hold = 0, h1 = 0;
    if (p.cfg.predictor !== "zero") { h1 = this.H1[e]; o.state_read += 4; }
    if (p.cfg.predictor === "last") hold = h1;
    else if (p.cfg.predictor === "linear") {
      const h2 = this.H2[e]; o.state_read += 4;
      if (this.seen >= 2) { hold = reg(c, "code", shl(h1, 1) - h2); o.shift++; o.add++; } else hold = h1;
    }
    let pred = hold;
    if (this.hasBase(e) && p.cfg.predictor !== "zero") { pred = reg(c, "code", b + hold); o.add++; }
    else if (this.hasBase(e)) pred = b;
    return { b, pred: reg(c, "code", pred), h1 };
  }

  /** Commit the decoded code for e (event or hold) and propagate Δc through relations. */
  commit(e: number, b: number, h1: number, cNew: number, event: boolean): void {
    const { o, c, p } = this;
    if (p.cfg.predictor === "last") {
      if (event) { this.H1[e] = reg(c, "code", this.hasBase(e) ? cNew - b : cNew); if (this.hasBase(e)) o.add++; o.state_write += 4; }
    } else if (p.cfg.predictor === "linear") {
      this.H2[e] = h1; this.H1[e] = reg(c, "code", this.hasBase(e) ? cNew - b : cNew); if (this.hasBase(e)) o.add++;
      o.state_write += 8;
    }
    if (p.isSource[e]) {
      let cOld: number;
      if (this.cIsH1 && p.targetIdx[e] < 0) cOld = h1;
      else { cOld = this.C[e]; o.state_read += 4; }
      const d = reg(c, "code", cNew - cOld); o.add++; o.cmp++;
      if (d !== 0) {
        if (!(this.cIsH1 && p.targetIdx[e] < 0)) { this.C[e] = cNew; o.state_write += 4; }
        for (const f of p.fanout[e]) {
          this.ACC[f.ti] = reg(c, "rel_acc", this.ACC[f.ti] + reg(c, "rel_product", f.W * d));
          o.mul++; o.add++; o.state_read += 8; o.state_write += 8;
        }
      }
    }
  }
}

/**
 * Encode integer codes x[t][e] (grid g = eps/2^G), streaming, one frame at a time.
 * Stream layout byte (static rule, decided from the shape before any data): 1 = every frame dense
 * with no per-frame head when D ≤ ALL_DENSE_MAX_D (tiny frames, where a head byte per frame is
 * a large overhead); otherwise 0 = adaptive: per-frame uvarint head (2n | 2n+1), then the cheaper
 * of sparse (gap, q) pairs or dense (D × q, 0 = no event). The event buffer holds one frame.
 */
export const ALL_DENSE_MAX_D = 8;
function encodeFrames(w: IntWriter, x: readonly Float64Array[], p: Plan, o: IntOps, c: Census, decoded: Float64Array[], eventsOut: FrameEvents[]): number {
  const dp = new Datapath(p, o, c);
  const G = p.cfg.G;
  const allDense = p.D <= ALL_DENSE_MAX_D;
  w.u8(allDense ? 1 : 0);
  let events = 0;
  for (let t = 0; t < p.T; t++) {
    const xt = x[t], out = new Float64Array(p.D);
    const pos: number[] = [], qs: number[] = [];
    let sparseSize = 0, denseSize = 0, prev = -1;
    for (let i = 0; i < p.D; i++) {
      const e = p.order[i];
      const { b, pred, h1 } = dp.predict(e, t);
      const r = reg(c, "code", reg(c, "code", xt[e]) - pred); o.add++;
      o.cmp += 2;
      let cNew = pred, ev = false;
      if (r > dp.k || r < -dp.k) {
        const q = reg(c, "q", asr(r + dp.halfG, G)); o.add++; o.shift++;
        cNew = reg(c, "code", pred + shl(q, G)); o.add++; o.shift++;
        ev = true; pos.push(i); qs.push(q); o.state_write += 8;
        if (!allDense) {
          // layout sizing: uvarint size of the gap (2 cmp), svarint size of q (2 cmp), 3 adds
          sparseSize += uvarintLen(i - prev - 1) + svarintLen(q); denseSize += svarintLen(q) - 1; prev = i;
          o.cmp += 4; o.add += 3;
        }
      }
      dp.commit(e, b, h1, cNew, ev);
      out[e] = cNew;
    }
    dp.seen++;
    let dense = true;
    if (!allDense) {
      denseSize += p.D; o.add++; o.cmp++;
      dense = denseSize < sparseSize;
      w.uvarint(2 * pos.length + (dense ? 1 : 0));
    }
    if (dense) {
      let k = 0;
      for (let i = 0; i < p.D; i++) { o.cmp++; if (k < pos.length && pos[k] === i) { w.svarint(qs[k++]); o.state_read += 8; } else w.svarint(0); }
    } else {
      let pv = -1;
      for (let k = 0; k < pos.length; k++) { w.uvarint(pos[k] - pv - 1); o.add++; pv = pos[k]; w.svarint(qs[k]); o.state_read += 8; }
    }
    events += pos.length;
    decoded.push(out);
    eventsOut.push({ positions: pos, q: qs, dense });
  }
  return events;
}

function decodeFrames(r: IntReader, p: Plan, o: IntOps, c: Census, verifyAcc: boolean): { frames: Float64Array[]; events: number; perFrame: FrameEvents[] } {
  const dp = new Datapath(p, o, c);
  const G = p.cfg.G;
  const frames: Float64Array[] = [], perFrame: FrameEvents[] = [];
  let events = 0;
  const allDense = r.u8() === 1;
  for (let t = 0; t < p.T; t++) {
    let n = -1, dense = true;
    if (!allDense) { const head = r.uvarint(); n = asr(head, 1); dense = head % 2 === 1; o.shift++; o.bit++; }
    const out = new Float64Array(p.D);
    const pos: number[] = [], qs: number[] = [];
    let next = -1, left = n;
    if (!dense && left > 0) { next = r.uvarint(); o.add++; left--; }
    for (let i = 0; i < p.D; i++) {
      const e = p.order[i];
      const { b, pred, h1 } = dp.predict(e, t);
      let q = 0;
      o.cmp++;
      if (dense) q = r.svarint();
      else if (i === next) {
        q = r.svarint();
        if (q === 0) throw new RangeError("sparse event with q = 0");
        if (left > 0) { next = i + 1 + r.uvarint(); o.add += 2; left--; } else next = -1;
      }
      let cNew = pred;
      const ev = q !== 0;
      if (ev) { reg(c, "q", q); cNew = reg(c, "code", pred + shl(q, G)); o.add++; o.shift++; pos.push(i); qs.push(q); }
      dp.commit(e, b, h1, cNew, ev);
      out[e] = cNew;
    }
    if (n >= 0 && pos.length !== n) throw new RangeError("frame event count mismatch");
    if (verifyAcc) dp.verifyAccumulators(out);
    n = pos.length;
    dp.seen++;
    events += n;
    frames.push(out);
    perFrame.push({ positions: pos, q: qs, dense });
  }
  return { frames, events, perFrame };
}

/** Integer full_q / delta payloads (byte-identical to the v0.1.9 subsystem S4DS payloads). */
function encodeBaselinePayload(w: IntWriter, x: readonly Float64Array[], delta: boolean, o: IntOps, c: Census): void {
  const D = x[0].length;
  const prev = new Float64Array(D);
  for (let t = 0; t < x.length; t++) for (let e = 0; e < D; e++) {
    const q = reg(c, "code", x[t][e]);
    if (!delta) { w.svarint(q); continue; }
    const d = reg(c, "code", t === 0 ? q : q - prev[e]); o.state_read += 4; o.add++; o.cmp++;
    if (q !== prev[e]) { prev[e] = q; o.state_write += 4; }
    w.svarint(d);
  }
}

function decodeBaselinePayload(r: IntReader, T: number, D: number, delta: boolean, o: IntOps, c: Census): Float64Array[] {
  const prev = new Float64Array(D), frames: Float64Array[] = [];
  for (let t = 0; t < T; t++) {
    const f = new Float64Array(D);
    for (let e = 0; e < D; e++) {
      const v = r.svarint();
      if (!delta) { f[e] = reg(c, "code", v); continue; }
      const q = reg(c, "code", prev[e] + v); o.state_read += 4; o.add++; o.cmp++;
      if (v !== 0) { prev[e] = q; o.state_write += 4; }
      f[e] = q;
    }
    frames.push(f);
  }
  return frames;
}

/**
 * Event-driven decode with a resident state surface (rank 0 + "last" hold: the relations + event
 * path). A non-target code changes only on its own event (c ≡ h1); a relation target only when an
 * event hits it or one of its sources (Δc of a source = q·2^G). Work per frame ∝ events + fanout
 * updates + dirty targets, not D. Memories: H1 (= surface for non-targets), ACC and S_T (surface
 * for targets), a dirty bitmap and a dirty list. Produces exactly the codes of decodeFrames.
 */
function decodeFramesEventDriven(r: IntReader, p: Plan, o: IntOps, c: Census, frames: Float64Array[], perFrame: FrameEvents[]): void {
  if (p.base !== null || p.cfg.predictor !== "last") throw new RangeError("event-driven decode needs rank 0 and the last-value hold");
  const D = p.D, G = p.cfg.G, nT = p.rels.length;
  const H1 = new Float64Array(D), ACC = new Float64Array(nT), ST = new Float64Array(nT);
  const dirtyBit = new Uint8Array(nT), dirtyList: number[] = [];
  const halfFW = P2[WEIGHT_FRAC_BITS - 1];
  p.rels.forEach((rl, i) => {
    ACC[i] = reg(c, "rel_acc", rl.bias);
    ST[i] = reg(c, "code", asr(reg(c, "rel_acc", ACC[i] + halfFW), WEIGHT_FRAC_BITS)); o.add++; o.shift++; o.state_read += 8; o.state_write += 4;
  });
  const mark = (ti: number) => {
    o.cmp++; o.bit++; o.state_read++;
    if (dirtyBit[ti] === 0) { dirtyBit[ti] = 1; dirtyList.push(ti); o.bit++; o.state_write += 3; }
  };
  const allDense = r.u8() === 1;
  for (let t = 0; t < p.T; t++) {
    let n = -1, dense = true;
    if (!allDense) { const head = r.uvarint(); n = asr(head, 1); dense = head % 2 === 1; o.shift++; o.bit++; }
    const pos: number[] = [], qs: number[] = [];
    const apply = (i: number, q: number) => {
      const e = p.order[i];
      reg(c, "q", q);
      const dq = shl(q, G); o.shift++;
      H1[e] = reg(c, "code", H1[e] + dq); o.add++; o.state_read += 4; o.state_write += 4;
      const ti = p.targetIdx[e];
      if (ti >= 0) mark(ti);
      else for (const f of p.fanout[e]) {
        ACC[f.ti] = reg(c, "rel_acc", ACC[f.ti] + reg(c, "rel_product", f.W * dq));
        o.mul++; o.add++; o.state_read += 8; o.state_write += 8;
        mark(f.ti);
      }
      pos.push(i); qs.push(q);
    };
    if (dense) {
      for (let i = 0; i < D; i++) { const q = r.svarint(); o.cmp++; if (q !== 0) apply(i, q); }
    } else if (n > 0) {
      let i = r.uvarint(); o.add++;
      for (let k = 0; k < n; k++) {
        const q = r.svarint();
        if (q === 0) throw new RangeError("sparse event with q = 0");
        apply(i, q);
        if (k + 1 < n) { i = i + 1 + r.uvarint(); o.add += 2; }
      }
    }
    if (n >= 0 && pos.length !== n) throw new RangeError("frame event count mismatch");
    for (const ti of dirtyList) {
      const tg = p.rels[ti].target;
      ST[ti] = reg(c, "code", asr(reg(c, "rel_acc", ACC[ti] + halfFW), WEIGHT_FRAC_BITS) + H1[tg]);
      o.add += 2; o.shift++; o.bit++; o.state_read += 2 + 8 + 4; o.state_write += 4 + 1;
      dirtyBit[ti] = 0;
    }
    dirtyList.length = 0;
    // verification copy of the surface (not part of the datapath; not counted)
    const out = Float64Array.from(H1);
    p.rels.forEach((rl, i) => { out[rl.target] = ST[i]; });
    frames.push(out);
    perFrame.push({ positions: pos, q: qs, dense });
  }
}
// </datapath> ------------------------------------------------------------------------------------

function svarintLen(n: number): number { return uvarintLen(n >= 0 ? 2 * n : -2 * n - 1); }
function uvarintLen(n: number): number { let s = 1; while (n >= 128) { n = Math.floor(n / 128); s++; } return s; }

// ---------- Setup (host side; not the per-element datapath) ----------

export interface IntStreamInput {
  shape: GridShape;
  /** Integer epoch-ms times, one per frame. */
  times: readonly number[];
  meta?: FrameMeta;
  eps: readonly number[];
  relations: readonly Relation4D[];
}

/** Ingest: integer codes x = round(v / g) with the v0.1.8 integer RN quantizer, g = eps[c] / 2^G. */
export function ingestCodes(frames: readonly Float64Array[], channels: number, eps: readonly number[], G: number, ops?: OpCounts): Float64Array[] {
  const pre: IntegerPrecompute[] = eps.map((e) => precomputeIntegerRecip(frontEndFloat(e / P2[G])));
  const c = ops ?? emptyCounts();
  return frames.map((f) => {
    const out = new Float64Array(f.length);
    for (let e = 0; e < f.length; e++) {
      const q = quantizeInteger(frontEndFloat(f[e]), pre[e % channels], c).q;
      const n = Number(q);
      if (!Number.isSafeInteger(n)) throw new RangeError("ingest code out of safe range");
      out[e] = n === 0 ? 0 : n;
    }
    return out;
  });
}

/** Per-value ingest op counts of the v0.1.8 integer RN quantizer (constant per value). */
export function ingestOpsPerValue(): { counts: OpCounts; total: number } {
  const c = emptyCounts();
  const pre = precomputeIntegerRecip(frontEndFloat(0.01));
  quantizeInteger(frontEndFloat(0.123456), pre, c);
  return { counts: c, total: totalOps(c) };
}

export function fixRelations(relations: readonly Relation4D[], shape: GridShape, eps: readonly number[], G: number): IntRelation[] {
  const C = shape.channels;
  const g = (e: number) => eps[e % C] / P2[G];
  return relations.map((r) => {
    const gt = g(r.target);
    const W = r.sources.map((s, i) => Math.round((r.weights[i] * g(s) / gt) * P2[WEIGHT_FRAC_BITS]));
    const bias = Math.round(((r.bias ?? 0) / gt) * P2[WEIGHT_FRAC_BITS]);
    for (const x of W) if (!Number.isSafeInteger(x) || signedBits(Math.abs(x)) > DECLARED_WIDTHS.weight) throw new RangeError("relation weight exceeds declared width");
    return { target: r.target, sources: [...r.sources], W, bias };
  });
}

/** Fit (float, host side) on integer codes and quantize factors to int16 with a common shift F. */
export function fitIntBase(x: readonly Float64Array[], rank: number): IntBase | null {
  if (rank === 0) return null;
  const T = x.length, D = x[0].length;
  const fit = lowRankFit(x, Math.min(rank, T, D));
  const k = Math.min(rank, fit.rank);
  if (k === 0) return null;
  const mean = Array.from(fit.mean, (m) => Math.round(m) + 0);
  const B: number[] = new Array(D * k).fill(0), Ascaled: number[] = new Array(T * k).fill(0);
  for (let j = 0; j < k; j++) {
    let mx = 0; for (let e = 0; e < D; e++) mx = Math.max(mx, Math.abs(fit.B[e * fit.rank + j]));
    const sB = mx > 0 ? mx / FACTOR_MAX : 1;
    for (let e = 0; e < D; e++) B[e * k + j] = Math.round(fit.B[e * fit.rank + j] / sB) + 0;
    for (let t = 0; t < T; t++) Ascaled[t * k + j] = fit.A[t * fit.rank + j] * sB;
  }
  let amax = 0; for (const a of Ascaled) amax = Math.max(amax, Math.abs(a));
  let F = 0;
  while (F < MAX_F && Math.round(amax * P2[F + 1]) <= FACTOR_MAX) F++;
  const A = Ascaled.map((a) => Math.round(a * P2[F]) + 0);
  return { rank: k, F, mean, A, B };
}

export interface IntEncodeResult {
  bytes: Uint8Array;
  cfg: IntConfig;
  codes: Float64Array[];      // ingest codes x (grid g)
  decoded: Float64Array[];    // encoder-side reconstructed codes c
  events: number;
  perFrame: FrameEvents[];
  ops: IntOps;                // hot-path encode ops (ingest excluded; see ingestOpsPerValue)
  census: Census;
  base: IntBase | null;
  rels: IntRelation[];
  stateBytes: { H1: number; H2: number; C: number; ACC: number; mean: number; Bq: number; Aq: number; event_buffer: number };
  header_bytes: number;
  header_ops: IntOps;
  plan: PlanSummary;
}

/** Static facts of a plan used by the op-count formulas (scripts/check-scp-v0110.ts). */
export interface PlanSummary {
  D: number; T: number; targets: number[]; sources: number[]; fanout: number[]; order: number[];
  hasBase: boolean[]; cIsH1Source: boolean[]; fanoutTargets: number[][];
}
function planSummary(p: Plan): PlanSummary {
  const D = p.D;
  const hasBase = Array.from({ length: D }, (_, e) => p.targetIdx[e] >= 0 || p.base !== null);
  const cIsH1 = p.base === null && p.cfg.predictor === "last";
  return {
    D, T: p.T, order: Array.from(p.order),
    targets: Array.from({ length: D }, (_, e) => e).filter((e) => p.targetIdx[e] >= 0),
    sources: Array.from({ length: D }, (_, e) => e).filter((e) => p.isSource[e] === 1),
    fanout: Array.from({ length: D }, (_, e) => p.fanout[e].length),
    hasBase, cIsH1Source: Array.from({ length: D }, (_, e) => p.isSource[e] === 1 && cIsH1 && p.targetIdx[e] < 0),
    fanoutTargets: Array.from({ length: D }, (_, e) => p.fanout[e].map((f) => p.rels[f.ti].target)),
  };
}

function writeTimesMeta(w: IntWriter, times: readonly number[], meta?: FrameMeta): void {
  w.svarint(times[0]);
  for (let i = 1; i < times.length; i++) w.svarint(times[i] - times[i - 1]);
  w.u8(meta ? 1 : 0);
  if (meta) {
    w.svarint(meta.steps[0]);
    for (let i = 1; i < times.length; i++) w.svarint(meta.steps[i] - meta.steps[i - 1]);
    for (const v of meta.verdicts) w.u8(["PASS", "FAIL", "INCONCLUSIVE"].indexOf(v));
  }
}

function readTimesMeta(r: IntReader, T: number): { times: number[]; meta?: FrameMeta } {
  const times = [r.svarint()];
  for (let i = 1; i < T; i++) times.push(times[i - 1] + r.svarint());
  let meta: FrameMeta | undefined;
  if (r.u8() === 1) {
    const steps = [r.svarint()];
    for (let i = 1; i < T; i++) steps.push(steps[i - 1] + r.svarint());
    const verdicts = Array.from({ length: T }, () => {
      const v = (["PASS", "FAIL", "INCONCLUSIVE"] as const)[r.u8()];
      if (!v) throw new RangeError("bad verdict byte");
      return v;
    });
    meta = { steps, verdicts };
  }
  return { times, meta };
}

function stateBytesOf(p: Plan, cfg: IntConfig): IntEncodeResult["stateBytes"] {
  const D = p.D, srcNotH1 = p.base !== null || cfg.predictor !== "last";
  let cWords = 0; for (let e = 0; e < D; e++) if (p.isSource[e] && (srcNotH1 || p.targetIdx[e] >= 0)) cWords++;
  return {
    H1: cfg.predictor === "zero" ? 0 : 4 * D, H2: cfg.predictor === "linear" ? 4 * D : 0, C: 4 * cWords, ACC: 8 * p.rels.length,
    mean: p.base ? 4 * D : 0, Bq: p.base ? 2 * D * p.base.rank : 0, Aq: p.base ? 2 * p.T * p.base.rank : 0, event_buffer: 8 * D, // one frame
  };
}

/** Encode one configuration. `codes` are the ingest codes for this G (pass to avoid re-ingesting). */
export function encodeIntScp4d(input: IntStreamInput, codes: readonly Float64Array[], cfg: IntConfig, baseFit?: IntBase | null): IntEncodeResult {
  const T = codes.length, D = codes[0].length;
  const o = zeroIntOps(), c = emptyIntCensus();
  const rels = fixRelations(input.relations, input.shape, input.eps, cfg.G);
  const base = cfg.rank > 0 ? (baseFit !== undefined ? baseFit : fitIntBase(codes, cfg.rank)) : null;
  const effCfg: IntConfig = { ...cfg, rank: base ? base.rank : 0, relations: cfg.relations && rels.length > 0 };
  const p = makePlan(D, T, effCfg, rels, base);
  const w = new IntWriter(o, c);
  w.magic(S4DI_MAGIC); w.u8(S4DI_VERSION); w.u32(T);
  w.u16(input.shape.nx); w.u16(input.shape.ny); w.u16(input.shape.nz); w.u16(input.shape.channels);
  for (const e of input.eps) w.bits64(frontEndFloat(e).bits);
  w.u8(effCfg.G);
  writeTimesMeta(w, input.times, input.meta);
  w.u8(effCfg.rank); w.u8(effCfg.relations ? 1 : 0); w.u8(PREDICTORS.indexOf(effCfg.predictor)); w.u8(WEIGHT_FRAC_BITS);
  if (base) {
    w.u8(base.F);
    for (const m of base.mean) { reg(c, "code", m); w.svarint(m); }
    for (const a of base.A) { reg(c, "factor", a); w.svarint(a); }
    for (let j = 0; j < base.rank; j++) for (let e = 0; e < D; e++) { const b = base.B[e * base.rank + j]; reg(c, "factor", b); w.svarint(b); }
  }
  const header_bytes = w.length;
  const header_ops = { ...o };
  w.vreg = "varint";
  const decoded: Float64Array[] = [], perFrame: FrameEvents[] = [];
  const events = encodeFrames(w, codes, p, o, c, decoded, perFrame);
  for (const r of rels) for (const x of r.W) reg(c, "weight", x);
  return { bytes: w.bytes(), cfg: effCfg, codes: [...codes], decoded, events, perFrame, ops: o, header_ops, census: c, base, rels, stateBytes: stateBytesOf(p, effCfg), header_bytes, plan: planSummary(p) };
}

export interface IntDecodeResult {
  cfg: IntConfig; shape: GridShape; eps: number[]; times: number[]; meta?: FrameMeta;
  codes: Float64Array[]; events: number; perFrame: FrameEvents[];
  ops: IntOps; header_ops: IntOps; census: Census; header_bytes: number; plan: PlanSummary;
}

/** Decode an S4DI stream from bytes plus the declared relation schema (out of band, like v0.1.9). */
export function decodeIntScp4d(bytes: Uint8Array, relations: readonly Relation4D[], opts: { verifyAccumulators?: boolean } = {}): IntDecodeResult {
  const o = zeroIntOps(), c = emptyIntCensus();
  const r = new IntReader(bytes, o);
  if (r.magic() !== S4DI_MAGIC) throw new RangeError("not an S4DI stream");
  if (r.u8() !== S4DI_VERSION) throw new RangeError("unsupported S4DI version");
  const T = r.u32();
  const shape = { nx: r.u16(), ny: r.u16(), nz: r.u16(), channels: r.u16() };
  const epsBits = Array.from({ length: shape.channels }, () => r.bits64());
  const eps = epsBits.map((b) => new DataView(new BigUint64Array([b]).buffer).getFloat64(0, true)); // back-end only (relation setup)
  const G = r.u8();
  const { times, meta } = readTimesMeta(r, T);
  const rank = r.u8(), relFlag = r.u8() === 1, predictor = PREDICTORS[r.u8()], FW = r.u8();
  if (!predictor) throw new RangeError("unknown predictor");
  if (FW !== WEIGHT_FRAC_BITS) throw new RangeError("unsupported weight fraction bits");
  const D = shape.nx * shape.ny * shape.nz * shape.channels;
  let base: IntBase | null = null;
  if (rank > 0) {
    const F = r.u8();
    const mean = Array.from({ length: D }, () => reg(c, "code", r.svarint()));
    const A = Array.from({ length: T * rank }, () => reg(c, "factor", r.svarint()));
    const B = new Array(D * rank).fill(0);
    for (let j = 0; j < rank; j++) for (let e = 0; e < D; e++) B[e * rank + j] = reg(c, "factor", r.svarint());
    base = { rank, F, mean, A, B };
  }
  if (relFlag && relations.length === 0) throw new RangeError("stream uses relations but no relation schema was supplied");
  const rels = relFlag ? fixRelations(relations, shape, eps, G) : [];
  const cfg: IntConfig = { rank, relations: relFlag, predictor, G };
  const p = makePlan(D, T, cfg, rels, base);
  const header_bytes = bytes.length - r.remaining;
  const header_ops = { ...o };
  const dec = decodeFrames(r, p, o, c, opts.verifyAccumulators === true);
  r.expectEnd();
  return { cfg, shape, eps, times, meta, codes: dec.frames, events: dec.events, perFrame: dec.perFrame, ops: o, header_ops, census: c, header_bytes, plan: planSummary(p) };
}

/** Event-driven decode (resident surface) of an S4DI stream made with rank 0 and the last-value hold. */
export function decodeIntScp4dEventDriven(bytes: Uint8Array, relations: readonly Relation4D[]): IntDecodeResult & { working_set_bytes: number } {
  const o = zeroIntOps(), c = emptyIntCensus();
  const r = new IntReader(bytes, o);
  if (r.magic() !== S4DI_MAGIC || r.u8() !== S4DI_VERSION) throw new RangeError("not an S4DI v1 stream");
  const T = r.u32();
  const shape = { nx: r.u16(), ny: r.u16(), nz: r.u16(), channels: r.u16() };
  const epsBits = Array.from({ length: shape.channels }, () => r.bits64());
  const eps = epsBits.map((b) => new DataView(new BigUint64Array([b]).buffer).getFloat64(0, true));
  const G = r.u8();
  const { times, meta } = readTimesMeta(r, T);
  const rank = r.u8(), relFlag = r.u8() === 1, predictor = PREDICTORS[r.u8()], FW = r.u8();
  if (rank !== 0 || predictor !== "last" || FW !== WEIGHT_FRAC_BITS) throw new RangeError("event-driven decode needs rank 0, last-value hold, FW 16");
  const D = shape.nx * shape.ny * shape.nz * shape.channels;
  const rels = relFlag ? fixRelations(relations, shape, eps, G) : [];
  const cfg: IntConfig = { rank, relations: relFlag, predictor, G };
  const p = makePlan(D, T, cfg, rels, null);
  const header_bytes = bytes.length - r.remaining;
  const header_ops = { ...o };
  const frames: Float64Array[] = [], perFrame: FrameEvents[] = [];
  decodeFramesEventDriven(r, p, o, c, frames, perFrame);
  r.expectEnd();
  const nT = p.rels.length;
  return { cfg, shape, eps, times, meta, codes: frames, events: perFrame.reduce((a, f) => a + f.positions.length, 0), perFrame, ops: o, header_ops, census: c, header_bytes, plan: planSummary(p),
    working_set_bytes: 4 * D + 8 * nT + 4 * nT + Math.ceil(nT / 8) + 2 * nT };
}

/** Integer full_q / delta: S4DS v1 streams, byte-identical to the v0.1.9 subsystem's. */
export function encodeIntBaseline(input: IntStreamInput, codes: readonly Float64Array[], strategy: "full_q" | "delta"): { bytes: Uint8Array; ops: IntOps; header_ops: IntOps; census: Census; header_bytes: number } {
  const o = zeroIntOps(), c = emptyIntCensus();
  const w = new IntWriter(o, c);
  w.magic(S4DS_MAGIC); w.u8(1); w.u8(strategy === "full_q" ? 1 : 2); w.u32(codes.length);
  w.u16(input.shape.nx); w.u16(input.shape.ny); w.u16(input.shape.nz); w.u16(input.shape.channels);
  for (const e of input.eps) w.bits64(frontEndFloat(e).bits);
  writeTimesMeta(w, input.times, input.meta);
  const header_bytes = w.length;
  const header_ops = { ...o };
  w.vreg = "varint";
  encodeBaselinePayload(w, codes, strategy === "delta", o, c);
  return { bytes: w.bytes(), ops: o, header_ops, census: c, header_bytes };
}

export function decodeIntBaseline(bytes: Uint8Array): { strategy: "full_q" | "delta"; codes: Float64Array[]; ops: IntOps; header_ops: IntOps; census: Census; header_bytes: number } {
  const o = zeroIntOps(), c = emptyIntCensus();
  const r = new IntReader(bytes, o);
  if (r.magic() !== S4DS_MAGIC || r.u8() !== 1) throw new RangeError("not an S4DS v1 stream");
  const s = r.u8();
  if (s !== 1 && s !== 2) throw new RangeError("not a full_q / delta stream");
  const T = r.u32();
  const shape = { nx: r.u16(), ny: r.u16(), nz: r.u16(), channels: r.u16() };
  for (let i = 0; i < shape.channels; i++) r.bits64();
  readTimesMeta(r, T);
  const header_bytes = bytes.length - r.remaining;
  const header_ops = { ...o };
  const D = shape.nx * shape.ny * shape.nz * shape.channels;
  const codes = decodeBaselinePayload(r, T, D, s === 2, o, c);
  r.expectEnd();
  return { strategy: s === 1 ? "full_q" : "delta", codes, ops: o, header_ops, census: c, header_bytes };
}

/** Encoder-side configuration search (smallest stream), like v0.1.9. One float fit per stream (host side). */
export function searchIntScp4d(input: IntStreamInput, codes: readonly Float64Array[], G: number, ranks: readonly number[] = INT_RANKS): { best: IntEncodeResult; tried: { cfg: IntConfig; bytes: number; events: number }[] } {
  const T = codes.length, D = codes[0].length;
  const maxRank = Math.min(T, D, Math.max(...ranks));
  const fits = new Map<number, IntBase | null>();
  for (const k of ranks) if (k > 0 && k <= maxRank) fits.set(k, fitIntBase(codes, k));
  const tried: { cfg: IntConfig; bytes: number; events: number }[] = [];
  let best: IntEncodeResult | null = null;
  for (const rank of ranks) {
    if (rank > maxRank) continue;
    for (const relations of [false, true]) {
      if (relations && input.relations.length === 0) continue;
      for (const predictor of PREDICTORS) {
        const cfg: IntConfig = { rank, relations, predictor, G };
        const res = encodeIntScp4d(input, codes, cfg, rank > 0 ? fits.get(rank) ?? null : null);
        tried.push({ cfg: res.cfg, bytes: res.bytes.length, events: res.events });
        if (!best || res.bytes.length < best.bytes.length) best = res;
      }
    }
  }
  if (!best) throw new RangeError("no configuration applies");
  return { best, tried };
}

/** Analytic register bounds (overflow proof) from the stream's own setup values and max |x|. */
export function analyticBounds(cfg: IntConfig, xMax: number, rels: readonly IntRelation[], base: IntBase | null): Record<RegName, number> {
  const Cmax = xMax + P2[cfg.G];
  let relB = 0, accMax = 0, prodMax = 0, wMax = 0;
  for (const r of rels) {
    const sw = r.W.reduce((a, w) => a + Math.abs(w), 0);
    accMax = Math.max(accMax, sw * Cmax + Math.abs(r.bias));
    relB = Math.max(relB, Math.ceil((sw * Cmax + Math.abs(r.bias)) / P2[WEIGHT_FRAC_BITS]) + 1);
    for (const w of r.W) { wMax = Math.max(wMax, Math.abs(w)); prodMax = Math.max(prodMax, Math.abs(w) * 2 * Cmax); }
  }
  let lrB = 0, lrAcc = 0, lrProd = 0, fMax = 0;
  if (base) {
    const bmax = Array.from({ length: base.rank }, (_, j) => { let m = 0; for (let e = 0; e < base.B.length / base.rank; e++) m = Math.max(m, Math.abs(base.B[e * base.rank + j])); return m; });
    const T = base.A.length / base.rank;
    for (let t = 0; t < T; t++) {
      let s = 0;
      for (let j = 0; j < base.rank; j++) { const p = Math.abs(base.A[t * base.rank + j]) * bmax[j]; s += p; lrProd = Math.max(lrProd, p); }
      lrAcc = Math.max(lrAcc, s + (base.F > 0 ? P2[base.F - 1] : 0));
    }
    for (const v of [...base.A, ...base.B]) fMax = Math.max(fMax, Math.abs(v));
    const mMax = base.mean.reduce((a, m) => Math.max(a, Math.abs(m)), 0);
    lrB = mMax + Math.ceil(lrAcc / P2[base.F]) + 1;
  }
  const Bmax = Math.max(relB, lrB);
  const Hmax = Cmax + Bmax;
  const Pmax = Bmax + (cfg.predictor === "linear" ? 3 : 1) * Hmax;
  const Rmax = xMax + Pmax;
  const code = Math.max(Cmax, Hmax, Pmax, Rmax, Bmax, xMax);
  const q = Math.ceil(Rmax / P2[cfg.G]) + 1;
  return {
    code, q, weight: wMax, rel_product: prodMax, rel_acc: Math.max(accMax + P2[WEIGHT_FRAC_BITS - 1], 0),
    factor: fMax, lr_product: lrProd, lr_acc: lrAcc, varint: Math.max(2 * code + 1, 2 * q + 1, 2 * D_MAX_GAP + 1),
    header_varint: Number.MAX_SAFE_INTEGER,
  };
}
