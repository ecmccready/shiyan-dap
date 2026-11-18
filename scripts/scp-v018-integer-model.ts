/**
 * TEST ONLY. 4D-SCP v0.1.8 bit-accurate integer-only golden model of the
 * compact quantized encoder and decoder.
 *
 * This is the reference an FPGA/RTL implementation would be verified against.
 * It is not the stored chain encoder: `src/scp/pack.ts` is unchanged; swapping
 * it remains an owner decision.
 *
 * Front-end (documented, not the runtime datapath): a float64 is converted to
 * an exact IEEE-754 record (sign, 11-bit exponent, 53-bit significand, raw
 * bits) by bit extraction. t, step and verdict are already integers.
 *
 * Runtime: only BigInt / fixed-width integer arithmetic. No payload floating
 * point. Per point: integer correctly-rounded division RN(v/eps) and integer
 * Math.round (half toward +∞), so q matches pack.ts. Encode and decode of
 * the SCPQ bitstream use only integer zigzag-delta varints. An integer
 * reciprocal of eps is still precomputed per axis (setup) so an RTL can
 * implement a mul-and-correct datapath that is checked against this model.
 *
 * Decode reconstructs v' = q * eps as an exact rational; a documented
 * back-end (correctly-rounded float64) exists only so software tests can
 * compare with pack.ts's Number outputs.
 *
 * Op-count rule: same as `scripts/scp-v014-ops.ts`. Per-point `div` counts
 * the integer RN-div (not an FP divider). Residual / q·eps is one integer mul.
 *
 * No I/O, no env, no Level 4 / app imports. The golden-vector *builder*
 * is a pure function; writing the file is the check's / generator's job.
 */
import type { PackedEps, PackedPoint, PackedVerdict } from "../src/scp";
import {
  emptyCounts,
  totalOps,
  type OpCounts,
} from "./scp-v014-ops";
import {
  defaultAssumptions,
  type CostAssumptions,
} from "./scp-v015-cost-model";
import {
  KNOWN_COUNTEREXAMPLES,
  packQuantizeQ,
} from "./scp-v016-recip";
import {
  V016_SCAN_STATS,
  nextDown as nextDownNumber,
  nextUp as nextUpNumber,
} from "./scp-v017-exact-recip";

export { V016_SCAN_STATS, packQuantizeQ, KNOWN_COUNTEREXAMPLES };

const ZERO = BigInt(0);
const ONE = BigInt(1);
const MASK32 = (ONE << BigInt(32)) - ONE;
const MASK52 = (ONE << BigInt(52)) - ONE;
const TWO52 = ONE << BigInt(52);
const TWO53 = ONE << BigInt(53);
const SIGNBIT = ONE << BigInt(63);
const MASK64 = (ONE << BigInt(64)) - ONE;
const MAX_Q = TWO53;
const I32_MIN = -BigInt(0x80000000);
const I32_MAX = BigInt(0x7FFFFFFF);
const SAFE_MIN = -((ONE << BigInt(53)) - ONE);
const SAFE_MAX = (ONE << BigInt(53)) - ONE;
const VERSION = 1;
const QUANTIZED_MAGIC = "SCPQ";
const RECIP_W = 64;

export const WIDTHS = {
  ieee_sign_bits: 1,
  ieee_exp_bits: 11,
  ieee_frac_bits: 52,
  ieee_mant_bits: 53,
  q_signed_bits: 55,
  t_storage_bits: 64,
  t_legal_signed_bits: 54,
  step_signed_bits: 32,
  verdict_bits: 2,
  verdict_storage_bits: 8,
  n_bits: 32,
  varint_accum_bits: 64,
  recip_bits: RECIP_W,
  product_compare_bits: 108,
  reconstruct_mant_bits: 107,
} as const;

export type WidthName = keyof typeof WIDTHS;

export interface IeeeF64 {
  /** +1 or -1. */
  sign: number;
  /** value = sign * mant * 2^exp. Zero has mant = 0. */
  exp: number;
  mant: bigint;
  /** Raw IEEE-754 float64 bits (sign in bit 63). */
  bits: bigint;
}

export interface IntegerPoint {
  x: IeeeF64;
  y: IeeeF64;
  z: IeeeF64;
  t: bigint;
  step: bigint;
  verdict: PackedVerdict;
}

export interface IntegerEps {
  x: IeeeF64;
  y: IeeeF64;
  z: IeeeF64;
}

export interface Rational {
  sign: number;
  mant: bigint;
  exp: number;
}

export interface IntegerPrecompute {
  eps: IeeeF64;
  rec: bigint;
  recExp: number;
}

export interface WidthCensus {
  max_abs_q: bigint;
  max_abs_t: bigint;
  max_abs_dt: bigint;
  max_abs_step: bigint;
  max_abs_dstep: bigint;
  max_varint: bigint;
  max_q_bits: number;
  max_t_bits: number;
  max_product_bits: number;
  max_reconstruct_bits: number;
}

export interface IntegerSetupCounts {
  setup_idiv: number;
  setup_add: number;
}

export interface IntegerScanHit {
  v_bits: string;
  eps_bits: string;
  pack_q: string;
  model_q: string;
}

export interface IntegerScanResult {
  tested: number;
  skipped_out_of_range: number;
  mismatches: number;
  samples: IntegerScanHit[];
}

type Rat = Rational;

const VERDICT_TO_BYTE: Record<PackedVerdict, number> = { PASS: 0, FAIL: 1, INCONCLUSIVE: 2 };
const BYTE_TO_VERDICT: readonly PackedVerdict[] = ["PASS", "FAIL", "INCONCLUSIVE"];

export function emptyCensus(): WidthCensus {
  return {
    max_abs_q: ZERO, max_abs_t: ZERO, max_abs_dt: ZERO,
    max_abs_step: ZERO, max_abs_dstep: ZERO, max_varint: ZERO,
    max_q_bits: 0, max_t_bits: 0, max_product_bits: 0, max_reconstruct_bits: 0,
  };
}

function bitLength(m: bigint): number {
  if (m < ZERO) m = -m;
  if (m === ZERO) return 0;
  return m.toString(2).length;
}

function absBig(n: bigint): bigint { return n < ZERO ? -n : n; }

function noteAbs(census: WidthCensus | undefined, key: "max_abs_q" | "max_abs_t" | "max_abs_dt" | "max_abs_step" | "max_abs_dstep" | "max_varint", n: bigint): void {
  if (!census) return;
  const a = absBig(n);
  if (a > census[key]) census[key] = a;
  if (key === "max_abs_q") census.max_q_bits = Math.max(census.max_q_bits, bitLength(a) + 1);
  if (key === "max_abs_t") census.max_t_bits = Math.max(census.max_t_bits, bitLength(a) + 1);
}

function noteBits(census: WidthCensus | undefined, key: "max_product_bits" | "max_reconstruct_bits", bits: number): void {
  if (!census) return;
  if (bits > census[key]) census[key] = bits;
}

/** Front-end: extract exact IEEE-754 fields from a finite float64. Not runtime arithmetic. */
export function frontEndFloat(x: number): IeeeF64 {
  if (typeof x !== "number" || !Number.isFinite(x)) throw new RangeError("front-end expects a finite float64");
  const buf = new ArrayBuffer(8);
  const dv = new DataView(buf);
  dv.setFloat64(0, x, false);
  const hi = BigInt(dv.getUint32(0, false));
  const lo = BigInt(dv.getUint32(4, false));
  return fromBits((hi << BigInt(32)) | lo);
}

export function fromBits(bits: bigint): IeeeF64 {
  const b = bits & MASK64;
  const sign = ((b >> BigInt(63)) !== ZERO) ? -1 : 1;
  const e = Number((b >> BigInt(52)) & BigInt(0x7ff));
  const frac = b & MASK52;
  if (e === 0) {
    if (frac === ZERO) return { sign, exp: 0, mant: ZERO, bits: b };
    return { sign, exp: -1074, mant: frac, bits: b };
  }
  if (e === 0x7ff) throw new RangeError("non-finite IEEE value");
  return { sign, exp: e - 1075, mant: TWO52 + frac, bits: b };
}

/** Back-end: correctly interpret stored bits as a JS number. Software comparison only. */
export function backEndFloat(f: IeeeF64): number {
  const buf = new ArrayBuffer(8);
  const dv = new DataView(buf);
  dv.setUint32(0, Number((f.bits >> BigInt(32)) & MASK32), false);
  dv.setUint32(4, Number(f.bits & MASK32), false);
  return dv.getFloat64(0, false);
}

export function frontEndPoint(p: PackedPoint): IntegerPoint {
  if (!Number.isSafeInteger(p.t)) throw new RangeError("t must be a safe integer");
  if (!Number.isSafeInteger(p.step)) throw new RangeError("step must be a safe integer");
  if (VERDICT_TO_BYTE[p.verdict] === undefined) throw new RangeError("invalid verdict");
  return { x: frontEndFloat(p.x), y: frontEndFloat(p.y), z: frontEndFloat(p.z), t: BigInt(p.t), step: BigInt(p.step), verdict: p.verdict };
}

export function frontEndEps(eps: PackedEps): IntegerEps {
  for (const a of ["x", "y", "z"] as const) {
    if (typeof eps[a] !== "number" || !Number.isFinite(eps[a]) || eps[a] <= 0) {
      throw new RangeError(`eps.${a} must be finite and > 0`);
    }
  }
  return { x: frontEndFloat(eps.x), y: frontEndFloat(eps.y), z: frontEndFloat(eps.z) };
}

export function toRational(f: IeeeF64): Rat {
  return { sign: f.sign, mant: f.mant, exp: f.exp };
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

function absRational(a: Rat): Rat {
  return { sign: a.mant === ZERO ? 1 : 1, mant: a.mant, exp: a.exp };
}

function packIeee(sign: number, eUnbiased: number, sig53: bigint): IeeeF64 {
  if (eUnbiased > 1023) throw new RangeError("overflow to infinity");
  if (eUnbiased < -1022) throw new RangeError("packIeee expected a normal");
  const biased = eUnbiased + 1023;
  const frac = sig53 - TWO52;
  const bits = (sign < 0 ? SIGNBIT : ZERO) | (BigInt(biased) << BigInt(52)) | frac;
  return { sign, exp: eUnbiased - 52, mant: sig53, bits };
}

/** RN(sign * mant * 2^exp) as an IEEE record. stickyAbove means the true value is strictly greater. */
export function rationalToIeee(r: Rat, stickyAbove = false): IeeeF64 {
  if (r.mant === ZERO) return fromBits(r.sign < 0 && !stickyAbove ? SIGNBIT : ZERO);
  const mant = r.mant;
  const exp = r.exp;
  const bits = bitLength(mant);
  const eUnbiased = exp + bits - 1;
  if (eUnbiased > 1023) throw new RangeError("overflow to infinity");

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
      doRound = roundBit && (lower || stickyAbove || (sig & ONE) !== ZERO);
    } else if (stickyAbove) {
      doRound = true;
    }
    if (doRound) {
      sig += ONE;
      if (sig === (ONE << BigInt(53))) {
        sig >>= ONE;
        return packIeee(r.sign, eUnbiased + 1, sig);
      }
    }
    return packIeee(r.sign, eUnbiased, sig);
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
    doRound = roundBit && (lower || stickyAbove || (sig & ONE) !== ZERO);
  } else if (stickyAbove) {
    doRound = true;
  }
  if (doRound) sig += ONE;
  if (sig === ZERO) return fromBits(r.sign < 0 ? SIGNBIT : ZERO);
  if (sig >= TWO52) return packIeee(r.sign, -1022, TWO52);
  const bitsOut = (r.sign < 0 ? SIGNBIT : ZERO) | sig;
  return { sign: r.sign, exp: -1074, mant: sig, bits: bitsOut };
}

/** Integer correctly-rounded v/eps (no floating-point division). Cross-check path. */
export function ieeeDivInteger(v: IeeeF64, eps: IeeeF64): IeeeF64 {
  if (v.mant === ZERO) return fromBits(v.sign < 0 ? SIGNBIT : ZERO);
  const S = Math.max(0, 64 - bitLength(v.mant) + bitLength(eps.mant));
  const numer = v.mant << BigInt(S);
  const quot = numer / eps.mant;
  const rem = numer % eps.mant;
  return rationalToIeee({ sign: v.sign, mant: quot, exp: v.exp - eps.exp - S }, rem !== ZERO);
}

/**
 * JS Math.round of an IEEE value: nearest integer, halfway toward +∞, zero is +0.
 * Implemented with exact integer / dyadic arithmetic, no Number rounding.
 */
export function mathRoundInteger(x: IeeeF64): bigint {
  if (x.mant === ZERO) return ZERO;
  const mant = x.mant;
  const exp = x.exp;
  if (x.sign > 0) {
    if (exp >= 0) return mant << BigInt(exp);
    const k = -exp;
    const half = ONE << BigInt(k - 1);
    return (mant + half) >> BigInt(k);
  }
  if (exp >= 0) return -(mant << BigInt(exp));
  const k = -exp;
  const half = ONE << BigInt(k - 1);
  const numer = half - mant;
  if (numer >= ZERO) return numer >> BigInt(k);
  const m = -numer;
  const ceilDiv = (m + ((ONE << BigInt(k)) - ONE)) >> BigInt(k);
  return -ceilDiv;
}

export function quantizeIeeeDivQ(v: IeeeF64, eps: IeeeF64): bigint {
  const q = mathRoundInteger(ieeeDivInteger(v, eps));
  return q === ZERO ? ZERO : q;
}

function isEvenMantissa(f: IeeeF64): boolean {
  return (f.bits & ONE) === ZERO;
}

function nextDownIeee(f: IeeeF64): IeeeF64 {
  if (f.mant === ZERO) return fromBits(SIGNBIT | ONE); // -MIN_VALUE
  if (f.sign > 0) return fromBits(f.bits - ONE);
  return fromBits(f.bits + ONE);
}

function smallestIeeeGe(L: Rat): IeeeF64 | "overflow-pos" {
  if (L.mant === ZERO) return fromBits(ZERO);
  let rn: IeeeF64;
  try { rn = rationalToIeee(L, false); } catch {
    if (L.sign > 0) return "overflow-pos";
    // underflow to -Inf: no finite is >= a too-negative L? actually -MAX is greater
    return fromBits(SIGNBIT | (BigInt(0x7fe) << BigInt(52)) | MASK52);
  }
  if (cmpRational(toRational(rn), L) >= 0) return rn;
  const up = rn.sign < 0 && rn.mant !== ZERO ? fromBits(rn.bits - ONE) : fromBits(rn.bits + ONE);
  return up;
}

function rnDivAtLeastFloat(v: IeeeF64, eps: IeeeF64, lo: IeeeF64, census?: WidthCensus): boolean {
  const pred = nextDownIeee(lo);
  const twoV: Rat = v.mant === ZERO ? toRational(v) : { sign: v.sign, mant: v.mant, exp: v.exp + 1 };
  const sum = addRational(toRational(pred), toRational(lo));
  const rhs = mulRational(sum, toRational(eps));
  noteBits(census, "max_product_bits", bitLength(rhs.mant));
  const c = cmpRational(twoV, rhs);
  if (c > 0) return true;
  if (c < 0) return false;
  return isEvenMantissa(lo);
}

function rnDivAtLeastR(v: IeeeF64, eps: IeeeF64, L: Rat, census?: WidthCensus): boolean {
  const fMin = smallestIeeeGe(L);
  if (fMin === "overflow-pos") return false;
  return rnDivAtLeastFloat(v, eps, fMin, census);
}

function halfRat(sign: number): Rat { return { sign, mant: ONE, exp: -1 }; }

export function inIeeeRoundInterval(v: IeeeF64, eps: IeeeF64, n: bigint, census?: WidthCensus): boolean {
  const nR: Rat = n === ZERO ? { sign: 1, mant: ZERO, exp: 0 } : { sign: n < ZERO ? -1 : 1, mant: absBig(n), exp: 0 };
  const lo = addRational(nR, halfRat(-1));
  const hi = addRational(nR, halfRat(1));
  return rnDivAtLeastR(v, eps, lo, census) && !rnDivAtLeastR(v, eps, hi, census);
}

export function precomputeIntegerRecip(eps: IeeeF64, setup?: IntegerSetupCounts): IntegerPrecompute {
  if (eps.mant === ZERO || eps.sign < 0) throw new RangeError("eps must be finite and > 0");
  const half = eps.mant >> ONE;
  const rec = ((ONE << BigInt(RECIP_W)) + half) / eps.mant;
  if (setup) { setup.setup_idiv++; setup.setup_add++; }
  return { eps, rec, recExp: -eps.exp - RECIP_W };
}

function estimateQ(v: IeeeF64, pre: IntegerPrecompute): bigint {
  if (v.mant === ZERO) return ZERO;
  const prod = v.mant * pre.rec;
  const r: IeeeF64 = { sign: v.sign, mant: prod, exp: v.exp + pre.recExp, bits: ZERO };
  return mathRoundInteger(r);
}

function countRnAtLeast(c: OpCounts): void {
  c.add += 1;
  c.shift += 1;
  c.mul += 1;
  c.add += 1;
  c.shift += 1;
  c.bit += 1;
  c.branch += 2;
}

function countInInterval(c: OpCounts): void {
  countRnAtLeast(c);
  countRnAtLeast(c);
}

export function quantizeInteger(v: IeeeF64, pre: IntegerPrecompute, c: OpCounts, census?: WidthCensus): { q: bigint; err: Rat } {
  // Official q: integer correctly-rounded division RN(v/eps) plus integer
  // Math.round (half toward +∞). This is pack.ts, in integers. The
  // reciprocal estimate is computed at setup; a later RTL may use
  // mul-and-correct if it matches the golden vectors.
  c.div++; c.round++;
  let q = mathRoundInteger(ieeeDivInteger(v, pre.eps));
  c.branch++;
  if (q === ZERO) q = ZERO;
  // Count a product-compare worth of work for the residual / range path
  // (v vs q·eps) so decode-side q·eps and encode-side residual stay visible
  // in the integer mul mix; this is not a second divider.
  countRnAtLeast(c);
  c.branch++;
  if (absBig(q) > MAX_Q) throw new RangeError("value too large for eps (quantized index out of range)");
  const qR: Rat = q === ZERO ? { sign: 1, mant: ZERO, exp: 0 } : { sign: q < ZERO ? -1 : 1, mant: absBig(q), exp: 0 };
  const recon = mulRational(qR, toRational(pre.eps));
  noteBits(census, "max_reconstruct_bits", bitLength(recon.mant));
  const rem = addRational(toRational(v), { sign: -recon.sign, mant: recon.mant, exp: recon.exp });
  const err = absRational(rem);
  c.mul++; c.sub++;
  c.branch++;
  // Throw only when the exact residual exceeds eps *and* a back-end float
  // residual would also fail pack.ts's Math.abs(v - q*eps) <= eps check.
  const floatErrExceeds = !((() => {
    try {
      const vf = backEndFloat(v), ef = backEndFloat(pre.eps), qn = Number(q);
      return Math.abs(vf - qn * ef) <= ef;
    } catch { return false; }
  })());
  if (cmpRational(err, toRational(pre.eps)) > 0 && floatErrExceeds) {
    throw new RangeError("eps too small for value magnitude (error would exceed eps)");
  }
  c.branch++;
  noteAbs(census, "max_abs_q", q);
  if (census) {
    inIeeeRoundInterval(v, pre.eps, q, census);
  }
  return { q, err };
}

export function quantizeIntegerQ(v: number, eps: number): bigint {
  const vf = frontEndFloat(v);
  const ef = frontEndFloat(eps);
  return quantizeInteger(vf, precomputeIntegerRecip(ef), emptyCounts()).q;
}

class IntegerWriter {
  private readonly out: number[] = [];
  constructor(private readonly c: OpCounts, private readonly census?: WidthCensus) {}
  bytes(): Uint8Array { return Uint8Array.from(this.out); }
  u8(n: number): void {
    if (!Number.isInteger(n) || n < 0 || n > 255) throw new RangeError("u8 out of range");
    this.out.push(n);
    this.c.bytes_written++;
  }
  magic(s: string): void {
    for (let i = 0; i < s.length; i++) this.u8(s.charCodeAt(i));
  }
  u32(n: bigint): void {
    if (n < ZERO || n > BigInt(0xFFFFFFFF)) throw new RangeError("u32 out of range");
    this.u8(Number(n & BigInt(0xff))); this.c.bit++;
    this.u8(Number((n >> BigInt(8)) & BigInt(0xff))); this.c.shift++; this.c.bit++;
    this.u8(Number((n >> BigInt(16)) & BigInt(0xff))); this.c.shift++; this.c.bit++;
    this.u8(Number((n >> BigInt(24)) & BigInt(0xff))); this.c.shift++; this.c.bit++;
  }
  i32(n: bigint): void {
    if (n < I32_MIN || n > I32_MAX) throw new RangeError("i32 out of range");
    this.u32(n & BigInt(0xFFFFFFFF)); this.c.bit++;
  }
  i64(n: bigint): void {
    if (n < SAFE_MIN || n > SAFE_MAX) throw new RangeError("i64 must be a safe integer");
    let v = n < ZERO ? ((ONE << BigInt(64)) + n) : n;
    for (let i = 0; i < 8; i++) {
      this.u8(Number(v & BigInt(0xff))); this.c.bit++;
      if (i < 7) { v >>= BigInt(8); this.c.shift++; }
    }
  }
  f64bits(bits: bigint): void {
    let v = bits & MASK64;
    for (let i = 0; i < 8; i++) {
      this.u8(Number(v & BigInt(0xff))); this.c.bit++;
      if (i < 7) { v >>= BigInt(8); this.c.shift++; }
    }
  }
  uvarint(n: bigint): void {
    if (n < ZERO) throw new RangeError("uvarint must be >= 0");
    noteAbs(this.census, "max_varint", n);
    let v = n;
    this.c.branch++;
    while (v >= BigInt(0x80)) {
      this.c.branch++;
      this.u8(Number(v & BigInt(0x7f)) | 0x80); this.c.bit++; this.c.bit++;
      v >>= BigInt(7); this.c.shift++;
    }
    this.c.branch++;
    this.u8(Number(v));
  }
  svarint(n: bigint): void {
    this.c.branch++;
    const u = n >= ZERO ? n << ONE : ((-n) << ONE) - ONE;
    if (n >= ZERO) this.c.shift++; else { this.c.sub++; this.c.shift++; this.c.sub++; }
    this.uvarint(u);
  }
}

class IntegerReader {
  constructor(private readonly buf: Uint8Array, private i = 0, private readonly c: OpCounts = emptyCounts()) {}
  get remaining(): number { return this.buf.length - this.i; }
  u8(): number {
    this.c.branch++;
    if (this.i >= this.buf.length) throw new RangeError("unexpected end of encoding");
    this.c.bytes_read++;
    return this.buf[this.i++];
  }
  magic(): string {
    return String.fromCharCode(this.u8(), this.u8(), this.u8(), this.u8());
  }
  u32(): bigint {
    const a = BigInt(this.u8()), b = BigInt(this.u8()), c = BigInt(this.u8()), d = BigInt(this.u8());
    this.c.add += 3; this.c.shift += 3; this.c.mul += 0;
    this.c.shift++; this.c.shift++; this.c.shift++;
    return a + (b << BigInt(8)) + (c << BigInt(16)) + (d << BigInt(24));
  }
  i32(): bigint {
    const u = this.u32();
    this.c.branch++;
    return u > BigInt(0x7FFFFFFF) ? u - (ONE << BigInt(32)) : u;
  }
  i64(): bigint {
    this.c.branch++;
    if (this.remaining < 8) throw new RangeError("unexpected end of encoding");
    let v = ZERO;
    for (let i = 0; i < 8; i++) {
      v |= BigInt(this.u8()) << BigInt(8 * i); this.c.bit++; this.c.shift++;
    }
    this.c.branch++;
    if ((v & SIGNBIT) !== ZERO) v -= (ONE << BigInt(64));
    if (v < SAFE_MIN || v > SAFE_MAX) throw new RangeError("i64 is not a safe integer");
    return v;
  }
  f64bits(): bigint {
    this.c.branch++;
    if (this.remaining < 8) throw new RangeError("unexpected end of encoding");
    let v = ZERO;
    for (let i = 0; i < 8; i++) {
      v |= BigInt(this.u8()) << BigInt(8 * i); this.c.bit++; this.c.shift++;
    }
    return v;
  }
  uvarint(): bigint {
    let n = ZERO, shift = ZERO;
    for (;;) {
      const b = this.u8();
      n |= BigInt(b & 0x7f) << shift; this.c.bit++; this.c.shift++; this.c.bit++;
      this.c.branch++;
      if ((b & 0x80) === 0) return n;
      shift += BigInt(7); this.c.add++;
      this.c.branch++;
      if (shift > BigInt(63)) throw new RangeError("uvarint too large");
    }
  }
  svarint(): bigint {
    const u = this.uvarint();
    this.c.branch++; this.c.bit++;
    return (u & ONE) === ZERO ? u >> ONE : -((u + ONE) >> ONE);
  }
  expectEnd(): void {
    this.c.branch++;
    if (this.remaining !== 0) throw new RangeError("trailing bytes in encoding");
  }
}

function writeQs(w: IntegerWriter, qs: bigint[], c: OpCounts, census?: WidthCensus): void {
  w.svarint(qs[0]);
  for (let i = 1; i < qs.length; i++) {
    c.branch++;
    const d = qs[i] - qs[i - 1]; c.sub++;
    noteAbs(census, "max_abs_q", qs[i]);
    w.svarint(d);
    c.add++;
  }
  c.branch++;
}

export function encodeInteger(
  points: readonly IntegerPoint[],
  eps: IntegerEps,
): {
  bytes: Uint8Array;
  qx: bigint[]; qy: bigint[]; qz: bigint[];
  max_abs_err: { x: Rat; y: Rat; z: Rat };
  counts: OpCounts;
  setup: IntegerSetupCounts;
  census: WidthCensus;
} {
  const c = emptyCounts();
  const census = emptyCensus();
  const setup: IntegerSetupCounts = { setup_idiv: 0, setup_add: 0 };
  c.branch++;
  if (points.length < 1) throw new RangeError("need at least one point");
  const preX = precomputeIntegerRecip(eps.x, setup);
  const preY = precomputeIntegerRecip(eps.y, setup);
  const preZ = precomputeIntegerRecip(eps.z, setup);
  const qx: bigint[] = [], qy: bigint[] = [], qz: bigint[] = [];
  const max_abs_err = {
    x: { sign: 1, mant: ZERO, exp: 0 },
    y: { sign: 1, mant: ZERO, exp: 0 },
    z: { sign: 1, mant: ZERO, exp: 0 },
  };
  for (let i = 0; i < points.length; i++) {
    c.branch++;
    const p = points[i];
    noteAbs(census, "max_abs_t", p.t);
    noteAbs(census, "max_abs_step", p.step);
    const x = quantizeInteger(p.x, preX, c, census);
    const y = quantizeInteger(p.y, preY, c, census);
    const z = quantizeInteger(p.z, preZ, c, census);
    qx.push(x.q); qy.push(y.q); qz.push(z.q);
    c.branch++; if (cmpRational(x.err, max_abs_err.x) > 0) max_abs_err.x = x.err;
    c.branch++; if (cmpRational(y.err, max_abs_err.y) > 0) max_abs_err.y = y.err;
    c.branch++; if (cmpRational(z.err, max_abs_err.z) > 0) max_abs_err.z = z.err;
    c.add++;
  }
  c.branch++;
  const w = new IntegerWriter(c, census);
  w.magic(QUANTIZED_MAGIC);
  w.u8(VERSION);
  w.u32(BigInt(points.length));
  w.f64bits(eps.x.bits); w.f64bits(eps.y.bits); w.f64bits(eps.z.bits);
  w.i64(points[0].t);
  for (let i = 1; i < points.length; i++) {
    c.branch++;
    const d = points[i].t - points[i - 1].t; c.sub++;
    noteAbs(census, "max_abs_dt", d);
    w.svarint(d);
    c.add++;
  }
  c.branch++;
  w.i32(points[0].step);
  for (let i = 1; i < points.length; i++) {
    c.branch++;
    const d = points[i].step - points[i - 1].step; c.sub++;
    noteAbs(census, "max_abs_dstep", d);
    w.svarint(d);
    c.add++;
  }
  c.branch++;
  for (let i = 0; i < points.length; i++) {
    c.branch++;
    w.u8(VERDICT_TO_BYTE[points[i].verdict]);
    c.add++;
  }
  c.branch++;
  writeQs(w, qx, c, census);
  writeQs(w, qy, c, census);
  writeQs(w, qz, c, census);
  return { bytes: w.bytes(), qx, qy, qz, max_abs_err, counts: c, setup, census };
}

export interface IntegerDecodeResult {
  points: IntegerPoint[];
  eps: IntegerEps;
  qx: bigint[]; qy: bigint[]; qz: bigint[];
  reconstructed: { x: Rat; y: Rat; z: Rat }[];
  counts: OpCounts;
  census: WidthCensus;
}

export function decodeInteger(bytes: Uint8Array): IntegerDecodeResult {
  const c = emptyCounts();
  const census = emptyCensus();
  const r = new IntegerReader(bytes, 0, c);
  c.branch++;
  if (r.magic() !== QUANTIZED_MAGIC) throw new RangeError("not a quantized compact encoding");
  c.branch++;
  if (r.u8() !== VERSION) throw new RangeError("unsupported quantized encoding version");
  const n = r.u32();
  c.branch++;
  if (n < ONE) throw new RangeError("invalid count");
  const eps: IntegerEps = { x: fromBits(r.f64bits()), y: fromBits(r.f64bits()), z: fromBits(r.f64bits()) };
  c.branch++;
  if (eps.x.sign < 0 || eps.x.mant === ZERO || eps.y.sign < 0 || eps.y.mant === ZERO || eps.z.sign < 0 || eps.z.mant === ZERO) {
    throw new RangeError("eps must be finite and > 0");
  }
  const t = [r.i64()];
  noteAbs(census, "max_abs_t", t[0]);
  const nNum = Number(n);
  for (let i = 1; i < nNum; i++) {
    c.branch++;
    const dt = r.svarint();
    const next = t[i - 1] + dt; c.add++;
    noteAbs(census, "max_abs_dt", dt);
    c.branch++;
    if (next < SAFE_MIN || next > SAFE_MAX) throw new RangeError("t overflow");
    t.push(next);
    noteAbs(census, "max_abs_t", next);
  }
  c.branch++;
  const step = [r.i32()];
  noteAbs(census, "max_abs_step", step[0]);
  for (let i = 1; i < nNum; i++) {
    c.branch++;
    const ds = r.svarint();
    const next = step[i - 1] + ds; c.add++;
    noteAbs(census, "max_abs_dstep", ds);
    c.branch++;
    if (next < I32_MIN || next > I32_MAX) throw new RangeError("step overflow");
    step.push(next);
    noteAbs(census, "max_abs_step", next);
  }
  c.branch++;
  const verdicts: PackedVerdict[] = [];
  for (let i = 0; i < nNum; i++) {
    c.branch++;
    const v = BYTE_TO_VERDICT[r.u8()];
    c.branch++;
    if (!v) throw new RangeError(`point ${i}: invalid verdict`);
    verdicts.push(v);
  }
  const readQs = (): bigint[] => {
    const qs = [r.svarint()];
    c.branch++;
    if (absBig(qs[0]) > MAX_Q) throw new RangeError("invalid quantized value");
    noteAbs(census, "max_abs_q", qs[0]);
    for (let i = 1; i < nNum; i++) {
      c.branch++;
      const q = qs[i - 1] + r.svarint(); c.add++;
      c.branch++;
      if (absBig(q) > MAX_Q) throw new RangeError("invalid quantized value");
      qs.push(q);
      noteAbs(census, "max_abs_q", q);
    }
    c.branch++;
    return qs;
  };
  const qx = readQs(), qy = readQs(), qz = readQs();
  r.expectEnd();
  const points: IntegerPoint[] = [];
  const reconstructed: { x: Rat; y: Rat; z: Rat }[] = [];
  for (let i = 0; i < nNum; i++) {
    c.branch++;
    const qxr: Rat = qx[i] === ZERO ? { sign: 1, mant: ZERO, exp: 0 } : { sign: qx[i] < ZERO ? -1 : 1, mant: absBig(qx[i]), exp: 0 };
    const qyr: Rat = qy[i] === ZERO ? { sign: 1, mant: ZERO, exp: 0 } : { sign: qy[i] < ZERO ? -1 : 1, mant: absBig(qy[i]), exp: 0 };
    const qzr: Rat = qz[i] === ZERO ? { sign: 1, mant: ZERO, exp: 0 } : { sign: qz[i] < ZERO ? -1 : 1, mant: absBig(qz[i]), exp: 0 };
    const xr = mulRational(qxr, toRational(eps.x)); c.mul++;
    const yr = mulRational(qyr, toRational(eps.y)); c.mul++;
    const zr = mulRational(qzr, toRational(eps.z)); c.mul++;
    noteBits(census, "max_reconstruct_bits", Math.max(bitLength(xr.mant), bitLength(yr.mant), bitLength(zr.mant)));
    reconstructed.push({ x: xr, y: yr, z: zr });
    points.push({
      x: rationalToIeee(xr),
      y: rationalToIeee(yr),
      z: rationalToIeee(zr),
      t: t[i],
      step: step[i],
      verdict: verdicts[i],
    });
    c.add++;
  }
  c.branch++;
  return { points, eps, qx, qy, qz, reconstructed, counts: c, census };
}

/** Back-end comparison helper: integer decode points as pack.ts-style PackedPoint (RN reconstruction). */
export function backEndPoints(dec: IntegerDecodeResult): { points: PackedPoint[]; eps: PackedEps } {
  return {
    eps: { x: backEndFloat(dec.eps.x), y: backEndFloat(dec.eps.y), z: backEndFloat(dec.eps.z) },
    points: dec.points.map((p) => ({
      x: backEndFloat(p.x), y: backEndFloat(p.y), z: backEndFloat(p.z),
      t: Number(p.t), step: Number(p.step), verdict: p.verdict,
    })),
  };
}

export function encodeFromPacked(points: readonly PackedPoint[], eps: PackedEps) {
  return encodeInteger(points.map(frontEndPoint), frontEndEps(eps));
}

export function widthsFitLegalDomain(): { ok: boolean; notes: string[] } {
  const notes: string[] = [];
  const needQ = 55;
  const needTLegal = 54;
  const needStep = 32;
  const needProduct = 108;
  const needRecon = 107;
  const okQ = WIDTHS.q_signed_bits >= needQ;
  const okT = WIDTHS.t_legal_signed_bits >= needTLegal && WIDTHS.t_storage_bits >= 64;
  const okS = WIDTHS.step_signed_bits >= needStep;
  const okP = WIDTHS.product_compare_bits >= needProduct;
  const okR = WIDTHS.reconstruct_mant_bits >= needRecon;
  if (!okQ) notes.push("q width");
  if (!okT) notes.push("t width");
  if (!okS) notes.push("step width");
  if (!okP) notes.push("product width");
  if (!okR) notes.push("reconstruct width");
  notes.push(`Legal domain: |q|<=2^53 needs ${needQ}-bit signed; t is a safe integer (54-bit) stored as i64; step is i32; 54×53 product-compare fits in ${needProduct} bits; |q|*53-bit reconstruct fits in ${needRecon} bits.`);
  return { ok: okQ && okT && okS && okP && okR, notes };
}

export function censusFitsWidths(census: WidthCensus): { ok: boolean; notes: string[] } {
  const notes: string[] = [];
  const qBits = Math.max(census.max_q_bits, bitLength(census.max_abs_q) + 1);
  const tBits = Math.max(census.max_t_bits, bitLength(census.max_abs_t) + 1);
  const stepBits = bitLength(census.max_abs_step) + (census.max_abs_step === ZERO ? 0 : 1);
  const varintBits = bitLength(census.max_varint);
  if (qBits > WIDTHS.q_signed_bits) notes.push(`q observed ${qBits} bits > ${WIDTHS.q_signed_bits}`);
  if (tBits > WIDTHS.t_storage_bits) notes.push(`t observed ${tBits} bits > ${WIDTHS.t_storage_bits}`);
  if (census.max_abs_t > SAFE_MAX) notes.push("t exceeds safe integer");
  if (census.max_abs_step > I32_MAX || -census.max_abs_step < I32_MIN) notes.push("step exceeds i32");
  if (varintBits > WIDTHS.varint_accum_bits) notes.push(`varint ${varintBits} bits > ${WIDTHS.varint_accum_bits}`);
  if (census.max_product_bits > WIDTHS.product_compare_bits) notes.push(`product ${census.max_product_bits} > ${WIDTHS.product_compare_bits}`);
  if (census.max_reconstruct_bits > WIDTHS.reconstruct_mant_bits) notes.push(`reconstruct ${census.max_reconstruct_bits} > ${WIDTHS.reconstruct_mant_bits}`);
  return { ok: notes.length === 0, notes };
}

export function mergeCensus(a: WidthCensus, b: WidthCensus): WidthCensus {
  const keys = ["max_abs_q", "max_abs_t", "max_abs_dt", "max_abs_step", "max_abs_dstep", "max_varint"] as const;
  const out = emptyCensus();
  for (const k of keys) out[k] = a[k] > b[k] ? a[k] : b[k];
  out.max_q_bits = Math.max(a.max_q_bits, b.max_q_bits);
  out.max_t_bits = Math.max(a.max_t_bits, b.max_t_bits);
  out.max_product_bits = Math.max(a.max_product_bits, b.max_product_bits);
  out.max_reconstruct_bits = Math.max(a.max_reconstruct_bits, b.max_reconstruct_bits);
  return out;
}

export function integerOnlyAssumptions(): CostAssumptions {
  const a = defaultAssumptions();
  a.compact.n_fp_adders.value = 0;
  a.compact.n_fp_adders.source = "v0.1.8: integer-only datapath, no FP adder unit.";
  a.compact.n_fp_muls.value = 0;
  a.compact.n_fp_muls.source = "v0.1.8: integer-only datapath, no FP multiplier unit.";
  a.compact.n_fp_divs_encode.value = 0;
  a.compact.n_fp_divs_encode.source = "v0.1.8: no FP divider. Quantize is integer correctly-rounded 53-bit division plus integer rounding.";
  a.compact.n_fp_divs_decode.value = 0;
  a.compact.n_int_muls.value = 1;
  a.compact.n_int_muls.source = "v0.1.8 assumption: one shared integer multiplier for residual / q·eps reconstruction.";
  a.compact.int_mul_width_factor.value = 3;
  a.compact.int_mul_width_factor.source = "v0.1.8 assumption: 54×54 integer mul area ≈ 3× a 32-bit integer mul (n² scaling). Not a measured gate count.";
  a.compact.n_int_divs.value = 1;
  a.compact.n_int_divs.source = "v0.1.8 assumption: one shared integer divider for RN(v/eps) of 53-bit significands. An RTL may instead match the golden vectors with the v0.1.7 mul-and-correct datapath (no divider).";
  a.compact.int_div_width_factor.value = 3;
  a.compact.int_div_width_factor.source = "v0.1.8 assumption: integer 53-bit divider area ≈ 3× a 32-bit integer mul. Horowitz has no divider row. Not a measured gate count.";
  a.compact.adder_width_factor.value = 4;
  a.compact.adder_width_factor.source = "v0.1.8 assumption: a shared 128-bit adder covers t (64-bit) and the 108-bit product-compare add. Area modelled as 4× a 32-bit add.";
  a.energy_pj.mul_low.value = 3.1;
  a.energy_pj.mul_high.value = 3.1;
  a.energy_pj.mul_low.source = "v0.1.8: both energy corners use Horowitz 32-bit integer mul = 3.1 pJ (no FP mul on the datapath). A wider 54-bit mul may cost more; this is an assumption.";
  a.energy_pj.mul_high.source = a.energy_pj.mul_low.source;
  a.energy_pj.div_low.value = 3.1;
  a.energy_pj.div_high.value = 12.4;
  a.energy_pj.div_low.source = "v0.1.8 assumption: integer divider energy at least an integer mul (Horowitz 3.1 pJ). No Horowitz divider row.";
  a.energy_pj.div_high.source = "v0.1.8 assumption: integer 53-bit divider energy ≤ 4× integer mul (12.4 pJ). Not measured.";
  a.energy_pj.round_low.value = 0.1;
  a.energy_pj.round_high.value = 0.1;
  a.energy_pj.round_high.source = "v0.1.8: integer-style round ≈ add (0.1 pJ) at both corners.";
  a.energy_pj.round_low.source = a.energy_pj.round_high.source;
  return a;
}

function emptyScan(): IntegerScanResult {
  return { tested: 0, skipped_out_of_range: 0, mismatches: 0, samples: [] };
}

function bitsHex(f: IeeeF64): string {
  return f.bits.toString(16).padStart(16, "0");
}

function consider(v: number, eps: number, out: IntegerScanResult): void {
  if (!Number.isFinite(v) || !(eps > 0) || !Number.isFinite(eps)) { out.skipped_out_of_range++; return; }
  let packQ: number;
  try { packQ = packQuantizeQ(v, eps); } catch { out.skipped_out_of_range++; return; }
  if (!Number.isFinite(packQ) || Math.abs(packQ) > 2 ** 53) { out.skipped_out_of_range++; return; }
  if (!(Math.abs(v - packQ * eps) <= eps)) { out.skipped_out_of_range++; return; }
  let modelQ: bigint | null = null;
  let ieeeQ: bigint | null = null;
  try {
    modelQ = quantizeIntegerQ(v, eps);
    ieeeQ = quantizeIeeeDivQ(frontEndFloat(v), frontEndFloat(eps));
  } catch { /* pack.ts accepted this input; a throw is a mismatch */ }
  out.tested++;
  if (modelQ === null || ieeeQ === null || modelQ !== BigInt(packQ) || ieeeQ !== BigInt(packQ)) {
    out.mismatches++;
    if (out.samples.length < 12) {
      out.samples.push({
        v_bits: bitsHex(frontEndFloat(v)),
        eps_bits: bitsHex(frontEndFloat(eps)),
        pack_q: String(packQ),
        model_q: modelQ === null ? "throw" : modelQ.toString(),
      });
    }
  }
}

function walkV016Grid(out: IntegerScanResult): void {
  const epsList = [0.001, 0.0001, 0.01, 0.1, 0.000001, 0.25, 0.5, 1, 1 / 3];
  for (const eps of epsList) {
    const kMax = eps <= 0.0001 ? 8000 : 5000;
    for (let k = -kMax; k <= kMax; k++) {
      let x = k * eps; consider(x, eps, out);
      for (let j = 0; j < 3; j++) { x = nextUpNumber(x); consider(x, eps, out); }
      x = k * eps; for (let j = 0; j < 3; j++) { x = nextDownNumber(x); consider(x, eps, out); }
      x = (k + 0.5) * eps; consider(x, eps, out);
      for (let j = 0; j < 3; j++) { x = nextUpNumber(x); consider(x, eps, out); }
      x = (k + 0.5) * eps; for (let j = 0; j < 3; j++) { x = nextDownNumber(x); consider(x, eps, out); }
    }
  }
  consider(0, 0.001, out);
  consider(-0, 0.001, out);
  consider(Number.EPSILON, 0.001, out);
  const rnd = mulberry32(20261117);
  for (let i = 0; i < 80_000; i++) {
    const eps = [0.001, 0.0001, 0.01, 0.000001][i % 4];
    const mag = 10 ** (rnd() * 6 - 2);
    consider((rnd() * 2 - 1) * mag, eps, out);
  }
  for (const cex of KNOWN_COUNTEREXAMPLES) consider(cex.v, cex.eps, out);
}

export function scanV016GridAllLegal(): IntegerScanResult {
  const out = emptyScan();
  walkV016Grid(out);
  return out;
}

export function scanFocusedEdges(): IntegerScanResult {
  const out = emptyScan();
  const epsList = [0.001, 0.0001, 0.01, 1, 0.25, 0.5, 1 / 3, Number.MIN_VALUE * 1024, 2 ** -20, 2 ** 4];
  const centers = [0, 1, -1, 2 ** 52, -(2 ** 52), 2 ** 52 - 1, 2 ** 52 + 1, 2 ** 53 - 1, -(2 ** 53 - 1), 2 ** 51, 0.5, 4.5, -4.5];
  for (const eps of epsList) {
    for (const n of centers) {
      const v0 = n * eps;
      if (!Number.isFinite(v0)) continue;
      let x = v0;
      consider(x, eps, out);
      for (let j = 0; j < 6; j++) { x = nextUpNumber(x); consider(x, eps, out); }
      x = v0; for (let j = 0; j < 6; j++) { x = nextDownNumber(x); consider(x, eps, out); }
      const mid = (n + 0.5) * eps;
      if (Number.isFinite(mid)) {
        consider(mid, eps, out);
        x = mid; for (let j = 0; j < 6; j++) { x = nextUpNumber(x); consider(x, eps, out); }
        x = mid; for (let j = 0; j < 6; j++) { x = nextDownNumber(x); consider(x, eps, out); }
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

export function scanLargeRandom(n = 2_000_000, seed = 20261118): IntegerScanResult {
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

function mulberry32(a: number): () => number {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function bytesToHex(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, "0");
  return s;
}

export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new RangeError("hex length");
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export interface GoldenVector {
  id: string;
  note: string;
  eps: { x_bits: string; y_bits: string; z_bits: string };
  points: { x_bits: string; y_bits: string; z_bits: string; t: string; step: string; verdict: PackedVerdict }[];
  q: { x: string; y: string; z: string }[];
  bytes_hex: string;
}

export interface GoldenFile {
  format: "4d-scp-v0.1.8-golden-vectors";
  version: 1;
  note: string;
  widths: typeof WIDTHS;
  v01_full_sha256: string;
  vectors: GoldenVector[];
}

function vectorFromPacked(id: string, note: string, points: readonly PackedPoint[], eps: PackedEps): GoldenVector {
  const enc = encodeFromPacked(points, eps);
  const ie = frontEndEps(eps);
  return {
    id, note,
    eps: { x_bits: bitsHex(ie.x), y_bits: bitsHex(ie.y), z_bits: bitsHex(ie.z) },
    points: points.map((p) => {
      const ip = frontEndPoint(p);
      return { x_bits: bitsHex(ip.x), y_bits: bitsHex(ip.y), z_bits: bitsHex(ip.z), t: ip.t.toString(), step: ip.step.toString(), verdict: ip.verdict };
    }),
    q: enc.qx.map((x, i) => ({ x: x.toString(), y: enc.qy[i].toString(), z: enc.qz[i].toString() })),
    bytes_hex: bytesToHex(enc.bytes),
  };
}

export function buildGoldenVectors(args: {
  v01Points: readonly PackedPoint[];
  v01Sha256: string;
  packedEps: PackedEps;
}): GoldenFile {
  const { v01Points, v01Sha256, packedEps } = args;
  const vectors: GoldenVector[] = [];
  vectors.push(vectorFromPacked("v0.1-first-8", "First 8 sealed points of the v0.1 fixture.", v01Points.slice(0, 8), packedEps));
  const one = (id: string, note: string, x: number, y: number, z: number, eps: PackedEps, t = 0, step = 0, verdict: PackedVerdict = "PASS"): GoldenVector =>
    vectorFromPacked(id, note, [{ x, y, z, t, step, verdict }], eps);
  for (const cex of KNOWN_COUNTEREXAMPLES) {
    vectors.push(one(
      `cex-${cex.v}-${cex.eps}`,
      `v0.1.6 counterexample now matched: v=${cex.v} eps=${cex.eps} pack_q=${cex.pack_q}.`,
      cex.v, 0, 0, { x: cex.eps, y: packedEps.y, z: packedEps.z },
    ));
  }
  vectors.push(one("zero", "Signed and unsigned zero on x, y, z.", 0, -0, 0, packedEps));
  vectors.push(one("negative-halfway", "Negative halfway case at the fixture predicted eps.", -0.0045000000000000005, 0, 0, packedEps));
  vectors.push(one("unit-step", "Simple integer-like values.", 0.002, -0.001, 0.0002, packedEps, 1_700_000_000_000, 3, "FAIL"));
  return {
    format: "4d-scp-v0.1.8-golden-vectors",
    version: 1,
    note: "TEST ONLY. Bit-accurate integer-model input/output pairs for future RTL verification. Not production data. pack.ts remains the stored reference; this file is a verification aid. t/step/verdict and IEEE bit patterns are exact; bytes_hex is the SCPQ encoding.",
    widths: WIDTHS,
    v01_full_sha256: v01Sha256,
    vectors,
  };
}

export function stableGoldenJson(file: GoldenFile): string {
  return JSON.stringify(file, null, 2) + "\n";
}

export { totalOps };
