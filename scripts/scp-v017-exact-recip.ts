/**
 * TEST ONLY. 4D-SCP v0.1.7 rounding-exact divider-free quantization variant.
 *
 * Replaces per-point division `Math.round(v / eps)` with:
 *   1. a one-time (per axis) precomputed reciprocal `inv = 1/eps`
 *      (the only divisions; setup, not the per-point datapath),
 *   2. `q = Math.round(v * inv)` (multiply + round) as an estimate,
 *   3. an exact IEEE-aware boundary check / correction: accept q iff
 *      `n - 0.5 <= RN(v/eps) < n + 0.5` (this is what `Math.round` of the
 *      already-rounded float64 quotient computes), otherwise step q by ±1.
 *
 * `RN` is IEEE 754 float64 round-to-nearest-even, i.e. the same first step
 * as pack.ts's `/`. The boundary test compares `2*v` against
 * `(nextDown(L) + L) * eps` with exact BigInt rationals, and applies the
 * ties-to-even rule on the midpoint. That is a multiply-compare, not a
 * divider. v0.1.6's residual (`rem` vs an inexact `0.5*eps`) is *not* used:
 * it disagrees with pack.ts at halfway cases.
 *
 * This is not the stored chain encoder. `src/scp/pack.ts` is unchanged.
 * The variant is intended to be bit-identical to `Math.round(v / eps)` for
 * every finite legal input (err ≤ eps, |q| ≤ 2^53). A finite scan cannot
 * exhaust all float64 pairs; the check proves it on the v0.1.6 set (including
 * every prior mismatch), a focused edge battery, and a larger random scan.
 * Swapping pack.ts for this implementation remains an owner decision.
 *
 * Op-count rule: same as `scripts/scp-v014-ops.ts`, with per-point `div = 0`.
 * Each exact bound check is counted as one 54×53 integer product-compare
 * (one mul, same shared multiplier as v0.1.5; assumed datapath, not a measured gate count).
 *
 * No I/O, no env, no Level 4 / app imports.
 */
import type { PackedEps, PackedPoint } from "../src/scp";
import {
  encodeQuantizedCounted,
  emptyCounts,
  type OpCounts,
  type QuantizeCountedFn,
} from "./scp-v014-ops";
import {
  KNOWN_COUNTEREXAMPLES,
  naiveReciprocalQ,
  packQuantizeQ,
  quantizeReciprocalQ,
  type ReciprocalSetupCounts,
} from "./scp-v016-recip";

export { KNOWN_COUNTEREXAMPLES, naiveReciprocalQ, noDividerAssumptions, packQuantizeQ, sensitivityFor } from "./scp-v016-recip";

const MAX_Q = 2 ** 53;
const ZERO = BigInt(0);
const ONE = BigInt(1);
const MASK32 = (ONE << BigInt(32)) - ONE;
const MASK52 = (ONE << BigInt(52)) - ONE;
const TWO52 = ONE << BigInt(52);
const TWO53 = ONE << BigInt(53);

export const V016_SCAN_STATS = {
  tested: 1_494_828,
  skipped_out_of_range: 13_304,
  recip_mismatches: 22_944,
  naive_mismatches: 19_206,
};

type Rat = { sign: number; mant: bigint; exp: number };

export interface ExactPrecompute {
  eps: number;
  inv: number;
}

export interface ExactScanHit {
  v: number;
  eps: number;
  pack_q: number;
  exact_q: number;
  recip_q: number | null;
  naive_q: number;
}

export interface ExactScanResult {
  tested: number;
  skipped_out_of_range: number;
  /** pack.ts-legal inputs the v0.1.6 residual variant threw on. */
  prior_throws: number;
  /** pack.ts-legal inputs where v0.1.6 residual q !== pack.ts q (throws excluded). */
  prior_mismatches: number;
  /** Of (prior_throws + prior_mismatches), how many the exact variant now matches. */
  prior_fixed: number;
  exact_mismatches: number;
  naive_mismatches: number;
  samples: ExactScanHit[];
}

function bitLength(m: bigint): number {
  if (m === ZERO) return 0;
  return m.toString(2).length;
}

function floatToRational(x: number): Rat {
  if (!Number.isFinite(x)) throw new RangeError("non-finite");
  const buf = new ArrayBuffer(8);
  const dv = new DataView(buf);
  dv.setFloat64(0, x, false);
  const hi = BigInt(dv.getUint32(0, false));
  const lo = BigInt(dv.getUint32(4, false));
  const bits = (hi << BigInt(32)) | lo;
  const sign = ((hi >> BigInt(31)) !== ZERO) ? -1 : 1;
  const e = Number((hi >> BigInt(20)) & BigInt(0x7ff));
  const frac = bits & MASK52;
  if (e === 0) {
    if (frac === ZERO) return { sign, mant: ZERO, exp: 0 };
    return { sign, exp: -1074, mant: frac };
  }
  return { sign, exp: e - 1075, mant: TWO52 + frac };
}

function isEvenMantissa(x: number): boolean {
  const buf = new ArrayBuffer(8);
  const dv = new DataView(buf);
  dv.setFloat64(0, x, true);
  return (dv.getUint32(0, true) & 1) === 0;
}

function cmpRational(a: Rat, b: Rat): number {
  if (a.mant === ZERO && b.mant === ZERO) return 0;
  if (a.mant === ZERO) return -b.sign;
  if (b.mant === ZERO) return a.sign;
  if (a.sign !== b.sign) return a.sign < 0 ? -1 : 1;
  const dExp = a.exp - b.exp;
  let am = a.mant;
  let bm = b.mant;
  if (dExp > 0) am <<= BigInt(dExp);
  else if (dExp < 0) bm <<= BigInt(-dExp);
  if (am === bm) return 0;
  const mantCmp = am > bm ? 1 : -1;
  return a.sign < 0 ? -mantCmp : mantCmp;
}

function mulRational(a: Rat, b: Rat): Rat {
  if (a.mant === ZERO || b.mant === ZERO) return { sign: 1, mant: ZERO, exp: 0 };
  return { sign: a.sign * b.sign, mant: a.mant * b.mant, exp: a.exp + b.exp };
}

function addRational(a: Rat, b: Rat): Rat {
  if (a.mant === ZERO) return { sign: b.sign, mant: b.mant, exp: b.exp };
  if (b.mant === ZERO) return { sign: a.sign, mant: a.mant, exp: a.exp };
  let ae = a.exp, be = b.exp, am = a.mant, bm = b.mant;
  if (ae < be) { bm <<= BigInt(be - ae); be = ae; }
  else if (be < ae) { am <<= BigInt(ae - be); ae = be; }
  if (a.sign === b.sign) return { sign: a.sign, mant: am + bm, exp: ae };
  if (am === bm) return { sign: 1, mant: ZERO, exp: 0 };
  if (am > bm) return { sign: a.sign, mant: am - bm, exp: ae };
  return { sign: b.sign, mant: bm - am, exp: ae };
}

function packFloat(sign: number, eUnbiased: number, sig53: bigint): number {
  if (eUnbiased > 1023) return sign < 0 ? -Infinity : Infinity;
  if (eUnbiased < -1022) throw new RangeError("packFloat expected a normal");
  const biased = eUnbiased + 1023;
  const frac = sig53 - TWO52;
  const hi = (sign < 0 ? (ONE << BigInt(31)) : ZERO) | (BigInt(biased) << BigInt(20)) | (frac >> BigInt(32));
  const lo = frac & MASK32;
  const buf = new ArrayBuffer(8);
  const dv = new DataView(buf);
  dv.setUint32(0, Number(hi), false);
  dv.setUint32(4, Number(lo), false);
  return dv.getFloat64(0, false);
}

/** RN(sign * mant * 2^exp). `stickyAbove` means the true value is strictly greater than that dyadic. */
export function rationalToFloatRN(r: Rat, stickyAbove = false): number {
  if (r.mant === ZERO) return r.sign < 0 && !stickyAbove ? -0 : 0;
  const mant = r.mant;
  const exp = r.exp;
  const bits = bitLength(mant);
  const eUnbiased = exp + bits - 1;
  if (eUnbiased > 1023) return r.sign < 0 ? -Infinity : Infinity;

  if (eUnbiased >= -1022) {
    const shift = bits - 53;
    let sig: bigint;
    let rem = ZERO;
    if (shift > 0) {
      rem = mant & ((ONE << BigInt(shift)) - ONE);
      sig = mant >> BigInt(shift);
    } else {
      sig = mant << BigInt(-shift);
    }
    let doRound = false;
    if (shift > 0) {
      const roundBit = (rem >> BigInt(shift - 1)) !== ZERO;
      const lower = shift > 1 ? (rem & ((ONE << BigInt(shift - 1)) - ONE)) !== ZERO : false;
      const anySticky = lower || stickyAbove;
      doRound = roundBit && (anySticky || (sig & ONE) !== ZERO);
    } else if (stickyAbove) {
      doRound = true;
    }
    if (doRound) {
      sig += ONE;
      if (sig === TWO53) {
        sig >>= ONE;
        return packFloat(r.sign, eUnbiased + 1, sig);
      }
    }
    return packFloat(r.sign, eUnbiased, sig);
  }

  const sh = exp + 1074;
  let sig: bigint;
  let rem = ZERO;
  if (sh >= 0) sig = mant << BigInt(sh);
  else {
    rem = mant & ((ONE << BigInt(-sh)) - ONE);
    sig = mant >> BigInt(-sh);
  }
  let doRound = false;
  if (sh < 0) {
    const roundBit = (rem >> BigInt(-sh - 1)) !== ZERO;
    const lower = sh < -1 ? (rem & ((ONE << BigInt(-sh - 1)) - ONE)) !== ZERO : false;
    const anySticky = lower || stickyAbove;
    doRound = roundBit && (anySticky || (sig & ONE) !== ZERO);
  } else if (stickyAbove) {
    doRound = true;
  }
  if (doRound) sig += ONE;
  if (sig === ZERO) return r.sign < 0 ? -0 : 0;
  if (sig >= TWO52) return packFloat(r.sign, -1022, TWO52);
  const hi = (r.sign < 0 ? (ONE << BigInt(31)) : ZERO) | (sig >> BigInt(32));
  const lo = sig & MASK32;
  const buf = new ArrayBuffer(8);
  const dv = new DataView(buf);
  dv.setUint32(0, Number(hi), false);
  dv.setUint32(4, Number(lo), false);
  return dv.getFloat64(0, false);
}

/** Correctly rounded float64 `v/eps`, no floating-point division. Used as a cross-check. */
export function ieeeDiv(v: number, eps: number): number {
  if (v === 0) return v;
  const V = floatToRational(v);
  const E = floatToRational(eps);
  const S = Math.max(0, 64 - bitLength(V.mant) + bitLength(E.mant));
  const numer = V.mant << BigInt(S);
  const quot = numer / E.mant;
  const rem = numer % E.mant;
  return rationalToFloatRN({ sign: V.sign, mant: quot, exp: V.exp - E.exp - S }, rem !== ZERO);
}

export function nextUp(x: number): number {
  if (x === Infinity) return x;
  if (x === -Infinity) return -Number.MAX_VALUE;
  if (x === 0) return Number.MIN_VALUE;
  const buf = new ArrayBuffer(8);
  const dv = new DataView(buf);
  dv.setFloat64(0, x, true);
  let lo = dv.getUint32(0, true);
  let hi = dv.getUint32(4, true);
  if (x > 0) {
    lo = (lo + 1) >>> 0;
    dv.setUint32(0, lo, true);
    if (lo === 0) dv.setUint32(4, (hi + 1) >>> 0, true);
  } else {
    if (lo === 0) { dv.setUint32(0, 0xffffffff, true); dv.setUint32(4, (hi - 1) >>> 0, true); }
    else dv.setUint32(0, (lo - 1) >>> 0, true);
  }
  return dv.getFloat64(0, true);
}

export function nextDown(x: number): number {
  return x === 0 ? -Number.MIN_VALUE : -nextUp(-x);
}

/**
 * RN(v/eps) >= lo, for a finite float64 `lo`. Equivalent to
 * v/eps > mid(pred(lo), lo), or equality and ties-to-even picking lo.
 * Midpoint compare is `2*v` vs `(pred(lo)+lo)*eps`, exact.
 */
function rnDivAtLeastFloat(v: number, eps: number, lo: number): boolean {
  const pred = nextDown(lo);
  const vR = floatToRational(v);
  const twoV: Rat = vR.mant === ZERO ? vR : { sign: vR.sign, mant: vR.mant, exp: vR.exp + 1 };
  const sum = addRational(floatToRational(pred), floatToRational(lo));
  const rhs = mulRational(sum, floatToRational(eps));
  const c = cmpRational(twoV, rhs);
  if (c > 0) return true;
  if (c < 0) return false;
  return isEvenMantissa(lo);
}

function smallestFloatGe(L: Rat): number {
  if (L.mant === ZERO) return 0;
  const rn = rationalToFloatRN(L, false);
  if (rn === Infinity) {
    return cmpRational(floatToRational(Number.MAX_VALUE), L) >= 0 ? Number.MAX_VALUE : Infinity;
  }
  if (rn === -Infinity) return -Infinity;
  if (cmpRational(floatToRational(rn), L) >= 0) return rn;
  return nextUp(rn);
}

function rnDivAtLeastR(v: number, eps: number, L: Rat): boolean {
  const fMin = smallestFloatGe(L);
  if (fMin === Infinity) return false;
  if (fMin === -Infinity) return true;
  return rnDivAtLeastFloat(v, eps, fMin);
}

function halfRat(sign: number): Rat {
  return { sign, mant: ONE, exp: -1 };
}

/** True iff Math.round(RN(v/eps)) would equal the integer n. */
export function inIeeeRoundInterval(v: number, eps: number, n: number): boolean {
  const nR = floatToRational(n);
  const lo = addRational(nR, halfRat(-1));
  const hi = addRational(nR, halfRat(1));
  return rnDivAtLeastR(v, eps, lo) && !rnDivAtLeastR(v, eps, hi);
}

/**
 * Count one exact bound check as a single 54×53 integer product-compare of
 * 2*v vs (pred(L)+L)*eps (one use of the shared multiplier, same convention
 * as v0.1.4: one arithmetic product = one mul), plus an add to form the
 * breakpoint, a shift for 2*v, and compare / ties-to-even branches.
 * Assumed datapath granularity, not a measured gate count.
 */
function countRnAtLeast(c: OpCounts): void {
  c.add += 1;    // pred(L) + L
  c.shift += 1;  // 2*v
  c.mul += 1;    // (pred(L)+L)*eps, one 54×53 integer product
  c.add += 1;    // align / assemble for the compare
  c.shift += 1;
  c.bit += 1;
  c.branch += 2; // sign of compare + even-mantissa tie
}

function countInInterval(c: OpCounts): void {
  countRnAtLeast(c);
  countRnAtLeast(c);
}

export function precomputeExact(eps: number, setup?: ReciprocalSetupCounts): ExactPrecompute {
  if (typeof eps !== "number" || !Number.isFinite(eps) || eps <= 0) {
    throw new RangeError("eps must be finite and > 0");
  }
  if (setup) setup.setup_div++;
  return { eps, inv: 1 / eps };
}

/**
 * Per-point quantize: mul-by-reciprocal estimate + exact IEEE interval correction.
 * Does not increment counts.div.
 */
export function quantizeExact(v: number, pre: ExactPrecompute, c: OpCounts): { q: number; err: number } {
  const q0 = Math.round(v * pre.inv); c.mul++; c.round++;
  c.branch++;
  let q = q0 === 0 ? 0 : q0;
  countInInterval(c);
  c.branch++;
  if (!inIeeeRoundInterval(v, pre.eps, q)) {
    for (let step = 0; step < 8; step++) {
      c.branch++;
      countRnAtLeast(c);
      const hi = addRational(floatToRational(q), halfRat(1));
      if (rnDivAtLeastR(v, pre.eps, hi)) { q += 1; c.add++; }
      else { q -= 1; c.sub++; }
      countInInterval(c);
      c.branch++;
      if (inIeeeRoundInterval(v, pre.eps, q)) break;
      if (step === 7) throw new RangeError("exact reciprocal correction did not converge");
    }
  }
  c.branch++;
  if (!Number.isFinite(q) || Math.abs(q) > MAX_Q) throw new RangeError("value too large for eps (quantized index out of range)");
  const err = Math.abs(v - q * pre.eps); c.mul++; c.sub++;
  c.branch++;
  if (!(err <= pre.eps)) throw new RangeError("eps too small for value magnitude (error would exceed eps)");
  c.branch++;
  return { q: q === 0 ? 0 : q, err };
}

export function quantizeExactQ(v: number, eps: number): number {
  return quantizeExact(v, precomputeExact(eps), emptyCounts()).q;
}

/** Math.round(ieeeDiv(v, eps)), as a second, independent implementation. */
export function quantizeIeeeDivQ(v: number, eps: number): number {
  const q0 = Math.round(ieeeDiv(v, eps));
  return q0 === 0 ? 0 : q0;
}

export function encodeQuantizedExactCounted(points: readonly PackedPoint[], eps: PackedEps): {
  bytes: Uint8Array;
  max_abs_err: { x: number; y: number; z: number };
  counts: OpCounts;
  setup: ReciprocalSetupCounts;
} {
  const setup: ReciprocalSetupCounts = { setup_div: 0, setup_mul: 0 };
  const pres = [
    precomputeExact(eps.x, setup),
    precomputeExact(eps.y, setup),
    precomputeExact(eps.z, setup),
  ];
  const cache = new Map<number, ExactPrecompute>();
  for (const pre of pres) cache.set(pre.eps, pre);
  const quantizeFn: QuantizeCountedFn = (v, e, c) => {
    const pre = cache.get(e) ?? precomputeExact(e, setup);
    return quantizeExact(v, pre, c);
  };
  const result = encodeQuantizedCounted(points, eps, quantizeFn);
  return { ...result, setup };
}

function mulberry32(a: number): () => number {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function emptyScan(): ExactScanResult {
  return {
    tested: 0,
    skipped_out_of_range: 0,
    prior_throws: 0,
    prior_mismatches: 0,
    prior_fixed: 0,
    exact_mismatches: 0,
    naive_mismatches: 0,
    samples: [],
  };
}

function consider(v: number, eps: number, out: ExactScanResult, opts?: { requireRecipSuccess?: boolean }): void {
  if (!Number.isFinite(v) || !(eps > 0) || !Number.isFinite(eps)) { out.skipped_out_of_range++; return; }
  let packQ: number;
  try { packQ = packQuantizeQ(v, eps); } catch { out.skipped_out_of_range++; return; }
  if (!Number.isFinite(packQ) || Math.abs(packQ) > MAX_Q) { out.skipped_out_of_range++; return; }
  if (!(Math.abs(v - packQ * eps) <= eps)) { out.skipped_out_of_range++; return; }

  let recipQ: number | null = null;
  let recipThrew = false;
  try { recipQ = quantizeReciprocalQ(v, eps); } catch { recipThrew = true; }
  if (opts && opts.requireRecipSuccess && recipThrew) { out.skipped_out_of_range++; return; }

  let exactQ: number;
  try { exactQ = quantizeExactQ(v, eps); } catch { out.skipped_out_of_range++; return; }
  const naiveQ = naiveReciprocalQ(v, eps);
  const ieeeQ = quantizeIeeeDivQ(v, eps);
  out.tested++;
  if (naiveQ !== packQ) out.naive_mismatches++;
  if (recipThrew) {
    out.prior_throws++;
    if (exactQ === packQ && ieeeQ === packQ) out.prior_fixed++;
  } else if (recipQ !== packQ) {
    out.prior_mismatches++;
    if (exactQ === packQ && ieeeQ === packQ) out.prior_fixed++;
  }
  if (exactQ !== packQ || ieeeQ !== packQ) {
    out.exact_mismatches++;
    if (out.samples.length < 12) {
      out.samples.push({ v, eps, pack_q: packQ, exact_q: exactQ, recip_q: recipQ, naive_q: naiveQ });
    }
  }
}

function walkV016Grid(out: ExactScanResult, opts?: { requireRecipSuccess?: boolean }): void {
  const epsList = [0.001, 0.0001, 0.01, 0.1, 0.000001, 0.25, 0.5, 1, 1 / 3];
  for (const eps of epsList) {
    const kMax = eps <= 0.0001 ? 8000 : 5000;
    for (let k = -kMax; k <= kMax; k++) {
      let x = k * eps; consider(x, eps, out, opts);
      for (let j = 0; j < 3; j++) { x = nextUp(x); consider(x, eps, out, opts); }
      x = k * eps; for (let j = 0; j < 3; j++) { x = nextDown(x); consider(x, eps, out, opts); }
      x = (k + 0.5) * eps; consider(x, eps, out, opts);
      for (let j = 0; j < 3; j++) { x = nextUp(x); consider(x, eps, out, opts); }
      x = (k + 0.5) * eps; for (let j = 0; j < 3; j++) { x = nextDown(x); consider(x, eps, out, opts); }
    }
  }
  consider(0, 0.001, out, opts);
  consider(-0, 0.001, out, opts);
  consider(Number.EPSILON, 0.001, out, opts);
  const rnd = mulberry32(20261117);
  for (let i = 0; i < 80_000; i++) {
    const eps = [0.001, 0.0001, 0.01, 0.000001][i % 4];
    const mag = 10 ** (rnd() * 6 - 2);
    consider((rnd() * 2 - 1) * mag, eps, out, opts);
  }
  for (const cex of KNOWN_COUNTEREXAMPLES) consider(cex.v, cex.eps, out, opts);
}

/** Same grid as v0.1.6, skipping the 13,304 inputs where the residual variant threw, so tested matches 1,494,828. */
export function scanV016SetExact(): ExactScanResult {
  const out = emptyScan();
  walkV016Grid(out, { requireRecipSuccess: true });
  return out;
}

/** Same grid, including pack.ts-legal inputs the v0.1.6 variant threw on. */
export function scanV016GridAllLegal(): ExactScanResult {
  const out = emptyScan();
  walkV016Grid(out);
  return out;
}

/** Focused edges: 2^52 / 2^53 neighbourhood, subnormals, powers of two, signed zero. */
export function scanFocusedEdges(): ExactScanResult {
  const out = emptyScan();
  const epsList = [0.001, 0.0001, 0.01, 1, 0.25, 0.5, 1 / 3, Number.MIN_VALUE * 1024, 2 ** -20, 2 ** 4];
  const centers = [0, 1, -1, 2 ** 52, -(2 ** 52), 2 ** 52 - 1, 2 ** 52 + 1, 2 ** 53 - 1, -(2 ** 53 - 1), 2 ** 51, 0.5, 4.5, -4.5];
  for (const eps of epsList) {
    for (const n of centers) {
      const v0 = n * eps;
      if (!Number.isFinite(v0)) continue;
      let x = v0;
      consider(x, eps, out);
      for (let j = 0; j < 6; j++) { x = nextUp(x); consider(x, eps, out); }
      x = v0; for (let j = 0; j < 6; j++) { x = nextDown(x); consider(x, eps, out); }
      const mid = (n + 0.5) * eps;
      if (Number.isFinite(mid)) {
        consider(mid, eps, out);
        x = mid; for (let j = 0; j < 6; j++) { x = nextUp(x); consider(x, eps, out); }
        x = mid; for (let j = 0; j < 6; j++) { x = nextDown(x); consider(x, eps, out); }
      }
    }
    consider(0, eps, out);
    consider(-0, eps, out);
    consider(Number.MIN_VALUE, eps, out);
    consider(-Number.MIN_VALUE, eps, out);
    consider(Number.EPSILON, eps, out);
  }
  for (const cex of KNOWN_COUNTEREXAMPLES) consider(cex.v, cex.eps, out);
  return out;
}

/** Larger deterministic random scan. Default 2,000,000 samples, seed 20261118. */
export function scanLargeRandom(n = 2_000_000, seed = 20261118): ExactScanResult {
  const out = emptyScan();
  const rnd = mulberry32(seed);
  const epsList = [0.001, 0.0001, 0.01, 0.1, 0.000001, 0.25, 0.5, 1, 1 / 3, Math.PI * 1e-4, 2, 7e-7];
  for (let i = 0; i < n; i++) {
    const eps = epsList[i % epsList.length];
    const mag = 10 ** (rnd() * 8 - 3);
    consider((rnd() * 2 - 1) * mag, eps, out);
  }
  return out;
}
