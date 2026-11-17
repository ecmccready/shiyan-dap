/**
 * Measured encodings for 4D-SCP v0.1.1. Pure, deterministic, no I/O, no env, no clocks.
 *
 * These helpers are a measurement variant only. They are NOT the stored chain format:
 * sealed segments, `segment_sha256`, and `src/core/compression` behaviour are unchanged.
 * Runtime engine imports stay out of this file (type-only imports from the public surface
 * are allowed elsewhere in src/scp; this module needs none).
 *
 * Layouts (little-endian):
 *   Binary baseline v1 ("SCPB"): fixed-width float64 x,y,z + int64 t + int32 step + verdict byte.
 *   Quantized compact v1 ("SCPQ"): integer quantization at per-axis eps, zigzag-delta varint
 *   for t/step/q, plus a verdict byte per point. Reconstructs v' = q * eps.
 *   Fair lossy baselines v1, same q = round(v/eps), v' = q * eps, same eps:
 *     "SCQI" fixed-width int32/int64 codes (width chosen per payload, stored in the header)
 *     "SCQF" float64 of the already-rounded v' values (same layout as SCPB plus stored eps)
 */
export type PackedVerdict = "PASS" | "FAIL" | "INCONCLUSIVE";

export interface PackedPoint {
  x: number;
  y: number;
  z: number;
  /** Integer epoch milliseconds. */
  t: number;
  /** Integer step index. */
  step: number;
  verdict: PackedVerdict;
}

export interface PackedEps {
  x: number;
  y: number;
  z: number;
}

export interface QuantizedEncodeResult {
  bytes: Uint8Array;
  max_abs_err: { x: number; y: number; z: number };
}

const BINARY_MAGIC = "SCPB";
const QUANTIZED_MAGIC = "SCPQ";
const QUANTIZED_INT_MAGIC = "SCQI";
const QUANTIZED_FLOAT_MAGIC = "SCQF";
const VERSION = 1;
const INT32_MIN = -0x80000000;
const INT32_MAX = 0x7FFFFFFF;
const VERDICT_TO_BYTE: Record<PackedVerdict, number> = { PASS: 0, FAIL: 1, INCONCLUSIVE: 2 };
const BYTE_TO_VERDICT: readonly PackedVerdict[] = ["PASS", "FAIL", "INCONCLUSIVE"];
const MAX_Q = 2 ** 53;

function textBytes(s: string): Uint8Array {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c > 0x7f) throw new RangeError("magic must be ASCII");
    out[i] = c;
  }
  return out;
}

function magicOf(bytes: Uint8Array): string {
  if (bytes.length < 4) return "";
  return String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
}

function checkPoint(p: PackedPoint, i: number): void {
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z)) {
    throw new RangeError(`point ${i}: x, y, z must be finite`);
  }
  if (!Number.isSafeInteger(p.t)) throw new RangeError(`point ${i}: t must be a safe integer`);
  if (!Number.isSafeInteger(p.step)) throw new RangeError(`point ${i}: step must be a safe integer`);
  if (VERDICT_TO_BYTE[p.verdict] === undefined) throw new RangeError(`point ${i}: invalid verdict`);
}

function checkEps(eps: PackedEps): void {
  for (const a of ["x", "y", "z"] as const) {
    if (typeof eps[a] !== "number" || !Number.isFinite(eps[a]) || eps[a] <= 0) {
      throw new RangeError(`eps.${a} must be finite and > 0`);
    }
  }
}

function quantize(v: number, eps: number): { q: number; err: number } {
  const q0 = Math.round(v / eps);
  const q = q0 === 0 ? 0 : q0;
  if (!Number.isFinite(q) || Math.abs(q) > MAX_Q) throw new RangeError("value too large for eps (quantized index out of range)");
  const err = Math.abs(v - q * eps);
  if (!(err <= eps)) throw new RangeError("eps too small for value magnitude (error would exceed eps)");
  return { q, err };
}

function collectQuantized(
  points: readonly PackedPoint[],
  eps: PackedEps,
): { qx: number[]; qy: number[]; qz: number[]; max_abs_err: { x: number; y: number; z: number } } {
  checkEps(eps);
  points.forEach(checkPoint);
  const max_abs_err = { x: 0, y: 0, z: 0 };
  const qx: number[] = [], qy: number[] = [], qz: number[] = [];
  for (const p of points) {
    const x = quantize(p.x, eps.x), y = quantize(p.y, eps.y), z = quantize(p.z, eps.z);
    qx.push(x.q); qy.push(y.q); qz.push(z.q);
    if (x.err > max_abs_err.x) max_abs_err.x = x.err;
    if (y.err > max_abs_err.y) max_abs_err.y = y.err;
    if (z.err > max_abs_err.z) max_abs_err.z = z.err;
  }
  return { qx, qy, qz, max_abs_err };
}

function fitsI32(qs: readonly number[]): boolean {
  return qs.every((q) => Number.isSafeInteger(q) && q >= INT32_MIN && q <= INT32_MAX);
}

class Writer {
  private readonly out: number[] = [];
  bytes(): Uint8Array { return Uint8Array.from(this.out); }
  u8(n: number): void {
    if (!Number.isInteger(n) || n < 0 || n > 255) throw new RangeError("u8 out of range");
    this.out.push(n);
  }
  magic(s: string): void { for (const b of textBytes(s)) this.out.push(b); }
  u32(n: number): void {
    if (!Number.isSafeInteger(n) || n < 0 || n > 0xFFFFFFFF) throw new RangeError("u32 out of range");
    this.out.push(n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff);
  }
  i32(n: number): void {
    if (!Number.isSafeInteger(n) || n < -0x80000000 || n > 0x7FFFFFFF) throw new RangeError("i32 out of range");
    this.u32(n >>> 0);
  }
  i64(n: number): void {
    if (!Number.isSafeInteger(n)) throw new RangeError("i64 must be a safe integer");
    const v = BigInt(n);
    const view = new DataView(new ArrayBuffer(8));
    view.setBigInt64(0, v, true);
    for (let i = 0; i < 8; i++) this.out.push(view.getUint8(i));
  }
  f64(n: number): void {
    if (!Number.isFinite(n)) throw new RangeError("f64 must be finite");
    const view = new DataView(new ArrayBuffer(8));
    view.setFloat64(0, n, true);
    for (let i = 0; i < 8; i++) this.out.push(view.getUint8(i));
  }
  uvarint(n: bigint): void {
    if (n < BigInt(0)) throw new RangeError("uvarint must be >= 0");
    let v = n;
    while (v >= BigInt(0x80)) {
      this.out.push(Number(v & BigInt(0x7f)) | 0x80);
      v >>= BigInt(7);
    }
    this.out.push(Number(v));
  }
  svarint(n: bigint): void {
    this.uvarint(n >= BigInt(0) ? n << BigInt(1) : ((-n) << BigInt(1)) - BigInt(1));
  }
}

class Reader {
  constructor(private readonly buf: Uint8Array, private i = 0) {}
  get offset(): number { return this.i; }
  get remaining(): number { return this.buf.length - this.i; }
  u8(): number {
    if (this.i >= this.buf.length) throw new RangeError("unexpected end of encoding");
    return this.buf[this.i++];
  }
  magic(): string {
    const a = this.u8(), b = this.u8(), c = this.u8(), d = this.u8();
    return String.fromCharCode(a, b, c, d);
  }
  u32(): number {
    const a = this.u8(), b = this.u8(), c = this.u8(), d = this.u8();
    return a + b * 256 + c * 65536 + d * 16777216;
  }
  i32(): number {
    const u = this.u32();
    return u > 0x7FFFFFFF ? u - 0x100000000 : u;
  }
  i64(): number {
    if (this.remaining < 8) throw new RangeError("unexpected end of encoding");
    const view = new DataView(this.buf.buffer, this.buf.byteOffset + this.i, 8);
    this.i += 8;
    const v = view.getBigInt64(0, true);
    if (v < BigInt(Number.MIN_SAFE_INTEGER) || v > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new RangeError("i64 is not a safe integer");
    }
    return Number(v);
  }
  f64(): number {
    if (this.remaining < 8) throw new RangeError("unexpected end of encoding");
    const view = new DataView(this.buf.buffer, this.buf.byteOffset + this.i, 8);
    this.i += 8;
    const n = view.getFloat64(0, true);
    if (!Number.isFinite(n)) throw new RangeError("decoded f64 is not finite");
    return n;
  }
  uvarint(): bigint {
    let n = BigInt(0), shift = BigInt(0);
    for (;;) {
      const b = this.u8();
      n |= BigInt(b & 0x7f) << shift;
      if ((b & 0x80) === 0) return n;
      shift += BigInt(7);
      if (shift > BigInt(63)) throw new RangeError("uvarint too large");
    }
  }
  svarint(): bigint {
    const u = this.uvarint();
    return (u & BigInt(1)) === BigInt(0) ? u >> BigInt(1) : -((u + BigInt(1)) >> BigInt(1));
  }
  expectEnd(): void {
    if (this.remaining !== 0) throw new RangeError("trailing bytes in encoding");
  }
}

/**
 * Fixed-width lossless packing of the 4D points (plus step and verdict).
 * Used as a general-purpose size baseline, not as a stored chain.
 */
export function encodeBinaryBaseline(points: readonly PackedPoint[]): Uint8Array {
  if (points.length < 1) throw new RangeError("need at least one point");
  const w = new Writer();
  w.magic(BINARY_MAGIC);
  w.u8(VERSION);
  w.u32(points.length);
  points.forEach((p, i) => {
    checkPoint(p, i);
    w.f64(p.x); w.f64(p.y); w.f64(p.z);
    w.i64(p.t); w.i32(p.step); w.u8(VERDICT_TO_BYTE[p.verdict]);
  });
  return w.bytes();
}

export function decodeBinaryBaseline(bytes: Uint8Array): PackedPoint[] {
  const r = new Reader(bytes);
  if (r.magic() !== BINARY_MAGIC) throw new RangeError("not a binary baseline encoding");
  if (r.u8() !== VERSION) throw new RangeError("unsupported binary baseline version");
  const n = r.u32();
  if (!Number.isSafeInteger(n) || n < 1) throw new RangeError("invalid count");
  const points: PackedPoint[] = [];
  for (let i = 0; i < n; i++) {
    const x = r.f64(), y = r.f64(), z = r.f64(), t = r.i64(), step = r.i32();
    const v = BYTE_TO_VERDICT[r.u8()];
    if (!v) throw new RangeError(`point ${i}: invalid verdict`);
    const p: PackedPoint = { x, y, z, t, step, verdict: v };
    checkPoint(p, i);
    points.push(p);
  }
  r.expectEnd();
  return points;
}

/**
 * Bounded compact encoding: q = round(v / eps), v' = q * eps, then zigzag-delta varints.
 * Measurement only; does not alter stored segment bytes or hashes.
 */
export function encodeQuantized(points: readonly PackedPoint[], eps: PackedEps): QuantizedEncodeResult {
  if (points.length < 1) throw new RangeError("need at least one point");
  checkEps(eps);
  points.forEach(checkPoint);
  const max_abs_err = { x: 0, y: 0, z: 0 };
  const qx: number[] = [], qy: number[] = [], qz: number[] = [];
  for (const p of points) {
    const x = quantize(p.x, eps.x), y = quantize(p.y, eps.y), z = quantize(p.z, eps.z);
    qx.push(x.q); qy.push(y.q); qz.push(z.q);
    if (x.err > max_abs_err.x) max_abs_err.x = x.err;
    if (y.err > max_abs_err.y) max_abs_err.y = y.err;
    if (z.err > max_abs_err.z) max_abs_err.z = z.err;
  }
  const w = new Writer();
  w.magic(QUANTIZED_MAGIC);
  w.u8(VERSION);
  w.u32(points.length);
  w.f64(eps.x); w.f64(eps.y); w.f64(eps.z);
  w.i64(points[0].t);
  for (let i = 1; i < points.length; i++) w.svarint(BigInt(points[i].t - points[i - 1].t));
  w.i32(points[0].step);
  for (let i = 1; i < points.length; i++) w.svarint(BigInt(points[i].step - points[i - 1].step));
  for (const p of points) w.u8(VERDICT_TO_BYTE[p.verdict]);
  const writeQs = (qs: number[]) => {
    w.svarint(BigInt(qs[0]));
    for (let i = 1; i < qs.length; i++) w.svarint(BigInt(qs[i] - qs[i - 1]));
  };
  writeQs(qx); writeQs(qy); writeQs(qz);
  return { bytes: w.bytes(), max_abs_err };
}

export function decodeQuantized(bytes: Uint8Array): { points: PackedPoint[]; eps: PackedEps } {
  const r = new Reader(bytes);
  if (r.magic() !== QUANTIZED_MAGIC) throw new RangeError("not a quantized compact encoding");
  if (r.u8() !== VERSION) throw new RangeError("unsupported quantized encoding version");
  const n = r.u32();
  if (!Number.isSafeInteger(n) || n < 1) throw new RangeError("invalid count");
  const eps: PackedEps = { x: r.f64(), y: r.f64(), z: r.f64() };
  checkEps(eps);
  const t = [r.i64()];
  for (let i = 1; i < n; i++) {
    const dt = r.svarint();
    const next = BigInt(t[i - 1]) + dt;
    if (next < BigInt(Number.MIN_SAFE_INTEGER) || next > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new RangeError("t overflow");
    }
    t.push(Number(next));
  }
  const step = [r.i32()];
  for (let i = 1; i < n; i++) {
    const ds = r.svarint();
    const next = BigInt(step[i - 1]) + ds;
    if (next < BigInt(-0x80000000) || next > BigInt(0x7FFFFFFF)) throw new RangeError("step overflow");
    step.push(Number(next));
  }
  const verdicts: PackedVerdict[] = [];
  for (let i = 0; i < n; i++) {
    const v = BYTE_TO_VERDICT[r.u8()];
    if (!v) throw new RangeError(`point ${i}: invalid verdict`);
    verdicts.push(v);
  }
  const readQs = (): number[] => {
    const qs = [Number(r.svarint())];
    if (!Number.isSafeInteger(qs[0]) || Math.abs(qs[0]) > MAX_Q) throw new RangeError("invalid quantized value");
    for (let i = 1; i < n; i++) {
      const q = qs[i - 1] + Number(r.svarint());
      if (!Number.isSafeInteger(q) || Math.abs(q) > MAX_Q) throw new RangeError("invalid quantized value");
      qs.push(q);
    }
    return qs;
  };
  const qx = readQs(), qy = readQs(), qz = readQs();
  r.expectEnd();
  const points: PackedPoint[] = [];
  for (let i = 0; i < n; i++) {
    const p: PackedPoint = {
      x: qx[i] * eps.x,
      y: qy[i] * eps.y,
      z: qz[i] * eps.z,
      t: t[i],
      step: step[i],
      verdict: verdicts[i],
    };
    checkPoint(p, i);
    points.push(p);
  }
  return { points, eps };
}


export interface QuantizedIntBaselineResult extends QuantizedEncodeResult {
  /** 4 if every code fits in a two's-complement int32; otherwise 8 (int64). */
  width: 4 | 8;
}

/**
 * Fair lossy baseline (a): the same q = round(v/eps) as the compact encoding, packed as
 * fixed-width little-endian int32 or int64 codes (no delta, no varint). Measurement only.
 */
export function encodeQuantizedIntBaseline(points: readonly PackedPoint[], eps: PackedEps): QuantizedIntBaselineResult {
  if (points.length < 1) throw new RangeError("need at least one point");
  const { qx, qy, qz, max_abs_err } = collectQuantized(points, eps);
  const width: 4 | 8 = fitsI32(qx) && fitsI32(qy) && fitsI32(qz) ? 4 : 8;
  const w = new Writer();
  w.magic(QUANTIZED_INT_MAGIC);
  w.u8(VERSION);
  w.u32(points.length);
  w.u8(width);
  w.f64(eps.x); w.f64(eps.y); w.f64(eps.z);
  const writeQ = (q: number) => { if (width === 4) w.i32(q); else w.i64(q); };
  points.forEach((p, i) => {
    writeQ(qx[i]); writeQ(qy[i]); writeQ(qz[i]);
    w.i64(p.t); w.i32(p.step); w.u8(VERDICT_TO_BYTE[p.verdict]);
  });
  return { bytes: w.bytes(), max_abs_err, width };
}

export function decodeQuantizedIntBaseline(bytes: Uint8Array): { points: PackedPoint[]; eps: PackedEps; width: 4 | 8 } {
  const r = new Reader(bytes);
  if (r.magic() !== QUANTIZED_INT_MAGIC) throw new RangeError("not a quantized int baseline encoding");
  if (r.u8() !== VERSION) throw new RangeError("unsupported quantized int baseline version");
  const n = r.u32();
  if (!Number.isSafeInteger(n) || n < 1) throw new RangeError("invalid count");
  const widthRaw = r.u8();
  if (widthRaw !== 4 && widthRaw !== 8) throw new RangeError("invalid code width");
  const width = widthRaw as 4 | 8;
  const eps: PackedEps = { x: r.f64(), y: r.f64(), z: r.f64() };
  checkEps(eps);
  const readQ = () => width === 4 ? r.i32() : r.i64();
  const points: PackedPoint[] = [];
  for (let i = 0; i < n; i++) {
    const qx = readQ(), qy = readQ(), qz = readQ();
    if (!Number.isSafeInteger(qx) || !Number.isSafeInteger(qy) || !Number.isSafeInteger(qz)) {
      throw new RangeError(`point ${i}: invalid quantized code`);
    }
    if (Math.abs(qx) > MAX_Q || Math.abs(qy) > MAX_Q || Math.abs(qz) > MAX_Q) {
      throw new RangeError(`point ${i}: quantized code out of range`);
    }
    const t = r.i64(), step = r.i32();
    const verdict = BYTE_TO_VERDICT[r.u8()];
    if (!verdict) throw new RangeError(`point ${i}: invalid verdict`);
    const packed: PackedPoint = { x: qx * eps.x, y: qy * eps.y, z: qz * eps.z, t, step, verdict };
    checkPoint(packed, i);
    points.push(packed);
  }
  r.expectEnd();
  return { points, eps, width };
}

/**
 * Fair lossy baseline (a): same rounded values v' = q * eps, stored as float64 (plus t/step/verdict).
 * Shows that quantization alone does not shrink a float64 packing. Measurement only.
 */
export function encodeQuantizedFloatBaseline(points: readonly PackedPoint[], eps: PackedEps): QuantizedEncodeResult {
  if (points.length < 1) throw new RangeError("need at least one point");
  const { qx, qy, qz, max_abs_err } = collectQuantized(points, eps);
  const w = new Writer();
  w.magic(QUANTIZED_FLOAT_MAGIC);
  w.u8(VERSION);
  w.u32(points.length);
  w.f64(eps.x); w.f64(eps.y); w.f64(eps.z);
  points.forEach((p, i) => {
    w.f64(qx[i] * eps.x); w.f64(qy[i] * eps.y); w.f64(qz[i] * eps.z);
    w.i64(p.t); w.i32(p.step); w.u8(VERDICT_TO_BYTE[p.verdict]);
  });
  return { bytes: w.bytes(), max_abs_err };
}

export function decodeQuantizedFloatBaseline(bytes: Uint8Array): { points: PackedPoint[]; eps: PackedEps } {
  const r = new Reader(bytes);
  if (r.magic() !== QUANTIZED_FLOAT_MAGIC) throw new RangeError("not a quantized float baseline encoding");
  if (r.u8() !== VERSION) throw new RangeError("unsupported quantized float baseline version");
  const n = r.u32();
  if (!Number.isSafeInteger(n) || n < 1) throw new RangeError("invalid count");
  const eps: PackedEps = { x: r.f64(), y: r.f64(), z: r.f64() };
  checkEps(eps);
  const points: PackedPoint[] = [];
  for (let i = 0; i < n; i++) {
    const x = r.f64(), y = r.f64(), z = r.f64(), t = r.i64(), step = r.i32();
    const verdict = BYTE_TO_VERDICT[r.u8()];
    if (!verdict) throw new RangeError(`point ${i}: invalid verdict`);
    const packed: PackedPoint = { x, y, z, t, step, verdict };
    checkPoint(packed, i);
    points.push(packed);
  }
  r.expectEnd();
  return { points, eps };
}

export function isBinaryBaseline(bytes: Uint8Array): boolean {
  return magicOf(bytes) === BINARY_MAGIC;
}

export function isQuantizedEncoding(bytes: Uint8Array): boolean {
  return magicOf(bytes) === QUANTIZED_MAGIC;
}

export function isQuantizedIntBaseline(bytes: Uint8Array): boolean {
  return magicOf(bytes) === QUANTIZED_INT_MAGIC;
}

export function isQuantizedFloatBaseline(bytes: Uint8Array): boolean {
  return magicOf(bytes) === QUANTIZED_FLOAT_MAGIC;
}
