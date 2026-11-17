/** TEST ONLY. Instrumented copy of the v0.1.1 quantized compact codec for deterministic op counts.
 *
 * This module is a measurement instrument. It is not the stored chain format and is not used
 * for timing (timings call `encodeQuantized` / `decodeQuantized` in `src/scp/pack.ts`).
 * The instrumented encode must produce byte-identical output to `encodeQuantized`.
 *
 * Method (documented so the counts are auditable):
 *   Every explicit arithmetic or control-flow step in this copy increments a counter.
 *   - add / sub / shift / mul / div: one increment per `+`, `-`, `<<`/`>>`/`>>>`, `*`, `/`
 *     on number or bigint (including `+=` and `>>=`).
 *   - bit: one increment per `&` or `|`.
 *   - round: one increment per `Math.round`.
 *   - branch: one increment per evaluated condition (`if`, `?:`, `while` / `for` test,
 *     including loop-exit tests). Not only taken branches.
 *   - bytes_written / bytes_read: one increment per output or input byte.
 *   JavaScript engine internals, DataView, allocations, and array indexing are not counted.
 *   Header writes are included in the totals; per-point figures amortize totals over n.
 *
 * Algorithmic streaming state (hardware-relevant, not the JS heap):
 *   The codec is five independent zigzag-delta varint streams (t, step, qx, qy, qz).
 *   Each stream needs only the previous value. Five 8-byte registers = 40 bytes.
 *   Decode also holds three float64 eps values (24 bytes). A few cursors / the current
 *   varint accumulator are O(1) additional words. This is the figure to compare with a
 *   gzip 32 KiB window and a brotli lgwin-22 4 MiB window.
 *   The current JS implementation additionally materializes O(n) quantized arrays and a
 *   growing `number[]` output buffer; that is an implementation artifact, not a lower
 *   bound on a streaming implementation. Node zlib also uses hasher/scratch beyond the
 *   advertised window; those are not measured here.
 */
import type { PackedEps, PackedPoint, PackedVerdict } from "../src/scp";

export type OpCounts = {
  add: number;
  sub: number;
  shift: number;
  mul: number;
  div: number;
  bit: number;
  round: number;
  branch: number;
  bytes_written: number;
  bytes_read: number;
};

export const COMPACT_PREV_REGISTERS = 5;
export const COMPACT_REGISTER_WIDTH_BYTES = 8;
/** Five previous-value registers (t, step, qx, qy, qz), 8 bytes each. */
export const COMPACT_STREAMING_STATE_BYTES = COMPACT_PREV_REGISTERS * COMPACT_REGISTER_WIDTH_BYTES;
export const COMPACT_DECODE_EPS_BYTES = 3 * 8;
export const COMPACT_STREAMING_DECODE_STATE_BYTES = COMPACT_STREAMING_STATE_BYTES + COMPACT_DECODE_EPS_BYTES;
export const GZIP_WINDOW_BYTES = 32 * 1024;
export const BROTLI_LGWIN = 22;
export const BROTLI_WINDOW_BYTES = 2 ** BROTLI_LGWIN;

const VERSION = 1;
const QUANTIZED_MAGIC = "SCPQ";
const VERDICT_TO_BYTE: Record<PackedVerdict, number> = { PASS: 0, FAIL: 1, INCONCLUSIVE: 2 };
const BYTE_TO_VERDICT: readonly PackedVerdict[] = ["PASS", "FAIL", "INCONCLUSIVE"];
const MAX_Q = 2 ** 53;
const ZERO = BigInt(0);
const ONE = BigInt(1);
const MASK7 = BigInt(0x7f);
const LIMB = BigInt(0x80);
const SHIFT7 = BigInt(7);
const SHIFT63 = BigInt(63);

export function emptyCounts(): OpCounts {
  return { add: 0, sub: 0, shift: 0, mul: 0, div: 0, bit: 0, round: 0, branch: 0, bytes_written: 0, bytes_read: 0 };
}

export function totalOps(c: OpCounts): number {
  return c.add + c.sub + c.shift + c.mul + c.div + c.bit + c.round + c.branch;
}

export function perPoint(c: OpCounts, n: number): OpCounts & { total: number } {
  const d = n === 0 ? Number.POSITIVE_INFINITY : n;
  return {
    add: c.add / d, sub: c.sub / d, shift: c.shift / d, mul: c.mul / d, div: c.div / d,
    bit: c.bit / d, round: c.round / d, branch: c.branch / d,
    bytes_written: c.bytes_written / d, bytes_read: c.bytes_read / d,
    total: totalOps(c) / d,
  };
}

export function countsEqual(a: OpCounts, b: OpCounts): boolean {
  return (Object.keys(a) as (keyof OpCounts)[]).every((k) => a[k] === b[k]);
}

function textBytes(s: string): Uint8Array {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c > 0x7f) throw new RangeError("magic must be ASCII");
    out[i] = c;
  }
  return out;
}

class CountingWriter {
  private readonly out: number[] = [];
  constructor(readonly c: OpCounts) {}
  bytes(): Uint8Array { return Uint8Array.from(this.out); }
  u8(n: number): void {
    this.c.branch++;
    if (!Number.isInteger(n) || n < 0 || n > 255) throw new RangeError("u8 out of range");
    this.out.push(n);
    this.c.bytes_written++;
  }
  magic(s: string): void { for (const b of textBytes(s)) this.u8(b); }
  u32(n: number): void {
    this.c.branch++;
    if (!Number.isSafeInteger(n) || n < 0 || n > 0xFFFFFFFF) throw new RangeError("u32 out of range");
    this.u8(n & 0xff); this.c.bit++;
    this.u8((n >>> 8) & 0xff); this.c.shift++; this.c.bit++;
    this.u8((n >>> 16) & 0xff); this.c.shift++; this.c.bit++;
    this.u8((n >>> 24) & 0xff); this.c.shift++; this.c.bit++;
  }
  i32(n: number): void {
    this.c.branch++;
    if (!Number.isSafeInteger(n) || n < -0x80000000 || n > 0x7FFFFFFF) throw new RangeError("i32 out of range");
    this.u32(n >>> 0); this.c.shift++;
  }
  i64(n: number): void {
    this.c.branch++;
    if (!Number.isSafeInteger(n)) throw new RangeError("i64 must be a safe integer");
    const v = BigInt(n);
    const view = new DataView(new ArrayBuffer(8));
    view.setBigInt64(0, v, true);
    for (let i = 0; i < 8; i++) {
      this.c.branch++;
      this.u8(view.getUint8(i));
      this.c.add++;
    }
    this.c.branch++; // for-test exit
  }
  f64(n: number): void {
    this.c.branch++;
    if (!Number.isFinite(n)) throw new RangeError("f64 must be finite");
    const view = new DataView(new ArrayBuffer(8));
    view.setFloat64(0, n, true);
    for (let i = 0; i < 8; i++) {
      this.c.branch++;
      this.u8(view.getUint8(i));
      this.c.add++;
    }
    this.c.branch++;
  }
  uvarint(n: bigint): void {
    this.c.branch++;
    if (n < ZERO) throw new RangeError("uvarint must be >= 0");
    let v = n;
    for (;;) {
      this.c.branch++;
      if (v < LIMB) break;
      this.u8(Number(v & MASK7) | 0x80); this.c.bit++; this.c.bit++;
      v >>= SHIFT7; this.c.shift++;
    }
    this.u8(Number(v));
  }
  svarint(n: bigint): void {
    this.c.branch++;
    if (n >= ZERO) {
      this.uvarint(n << ONE); this.c.shift++;
    } else {
      this.uvarint(((-n) << ONE) - ONE); this.c.sub++; this.c.shift++; this.c.sub++;
    }
  }
}

class CountingReader {
  constructor(private readonly buf: Uint8Array, readonly c: OpCounts, private i = 0) {}
  get remaining(): number { this.c.sub++; return this.buf.length - this.i; }
  u8(): number {
    this.c.branch++;
    if (this.i >= this.buf.length) throw new RangeError("unexpected end of encoding");
    const b = this.buf[this.i];
    this.i++; this.c.add++;
    this.c.bytes_read++;
    return b;
  }
  magic(): string {
    const a = this.u8(), b = this.u8(), c = this.u8(), d = this.u8();
    return String.fromCharCode(a, b, c, d);
  }
  u32(): number {
    const a = this.u8(), b = this.u8(), c = this.u8(), d = this.u8();
    this.c.mul++; this.c.add++;
    this.c.mul++; this.c.add++;
    this.c.mul++; this.c.add++;
    return a + b * 256 + c * 65536 + d * 16777216;
  }
  i32(): number {
    const u = this.u32();
    this.c.branch++;
    if (u > 0x7FFFFFFF) { this.c.sub++; return u - 0x100000000; }
    return u;
  }
  i64(): number {
    this.c.branch++;
    if (this.remaining < 8) throw new RangeError("unexpected end of encoding");
    const view = new DataView(this.buf.buffer, this.buf.byteOffset + this.i, 8);
    this.i += 8; this.c.add++;
    this.c.bytes_read += 8;
    const v = view.getBigInt64(0, true);
    this.c.branch++;
    if (v < BigInt(Number.MIN_SAFE_INTEGER) || v > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new RangeError("i64 is not a safe integer");
    }
    return Number(v);
  }
  f64(): number {
    this.c.branch++;
    if (this.remaining < 8) throw new RangeError("unexpected end of encoding");
    const view = new DataView(this.buf.buffer, this.buf.byteOffset + this.i, 8);
    this.i += 8; this.c.add++;
    this.c.bytes_read += 8;
    const n = view.getFloat64(0, true);
    this.c.branch++;
    if (!Number.isFinite(n)) throw new RangeError("decoded f64 is not finite");
    return n;
  }
  uvarint(): bigint {
    let n = ZERO, shift = ZERO;
    for (;;) {
      const b = this.u8();
      n |= BigInt(b & 0x7f) << shift; this.c.bit++; this.c.bit++; this.c.shift++;
      this.c.branch++;
      if ((b & 0x80) === 0) return n;
      shift += SHIFT7; this.c.add++;
      this.c.branch++;
      if (shift > SHIFT63) throw new RangeError("uvarint too large");
    }
  }
  svarint(): bigint {
    const u = this.uvarint();
    this.c.bit++; this.c.branch++;
    if ((u & ONE) === ZERO) {
      this.c.shift++;
      return u >> ONE;
    }
    this.c.add++; this.c.shift++; this.c.sub++;
    return -((u + ONE) >> ONE);
  }
  expectEnd(): void {
    this.c.branch++;
    if (this.remaining !== 0) throw new RangeError("trailing bytes in encoding");
  }
}

function checkPoint(p: PackedPoint, i: number, c: OpCounts): void {
  c.branch++;
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z)) {
    throw new RangeError(`point ${i}: x, y, z must be finite`);
  }
  c.branch++;
  if (!Number.isSafeInteger(p.t)) throw new RangeError(`point ${i}: t must be a safe integer`);
  c.branch++;
  if (!Number.isSafeInteger(p.step)) throw new RangeError(`point ${i}: step must be a safe integer`);
  c.branch++;
  if (VERDICT_TO_BYTE[p.verdict] === undefined) throw new RangeError(`point ${i}: invalid verdict`);
}

function checkEps(eps: PackedEps, c: OpCounts): void {
  for (const a of ["x", "y", "z"] as const) {
    c.branch++;
    c.branch++;
    if (typeof eps[a] !== "number" || !Number.isFinite(eps[a]) || eps[a] <= 0) {
      throw new RangeError(`eps.${a} must be finite and > 0`);
    }
  }
  c.branch++; // for-test exit
}

function quantize(v: number, eps: number, c: OpCounts): { q: number; err: number } {
  const q0 = Math.round(v / eps); c.div++; c.round++;
  c.branch++;
  const q = q0 === 0 ? 0 : q0;
  c.branch++;
  if (!Number.isFinite(q) || Math.abs(q) > MAX_Q) throw new RangeError("value too large for eps (quantized index out of range)");
  const err = Math.abs(v - q * eps); c.mul++; c.sub++;
  c.branch++;
  if (!(err <= eps)) throw new RangeError("eps too small for value magnitude (error would exceed eps)");
  return { q, err };
}

export function encodeQuantizedCounted(points: readonly PackedPoint[], eps: PackedEps): { bytes: Uint8Array; max_abs_err: { x: number; y: number; z: number }; counts: OpCounts } {
  const c = emptyCounts();
  c.branch++;
  if (points.length < 1) throw new RangeError("need at least one point");
  checkEps(eps, c);
  for (let i = 0; i < points.length; i++) {
    c.branch++;
    checkPoint(points[i], i, c);
    c.add++;
  }
  c.branch++;
  const max_abs_err = { x: 0, y: 0, z: 0 };
  const qx: number[] = [], qy: number[] = [], qz: number[] = [];
  for (let i = 0; i < points.length; i++) {
    c.branch++;
    const p = points[i];
    const x = quantize(p.x, eps.x, c), y = quantize(p.y, eps.y, c), z = quantize(p.z, eps.z, c);
    qx.push(x.q); qy.push(y.q); qz.push(z.q);
    c.branch++; if (x.err > max_abs_err.x) max_abs_err.x = x.err;
    c.branch++; if (y.err > max_abs_err.y) max_abs_err.y = y.err;
    c.branch++; if (z.err > max_abs_err.z) max_abs_err.z = z.err;
    c.add++;
  }
  c.branch++;
  const w = new CountingWriter(c);
  w.magic(QUANTIZED_MAGIC);
  w.u8(VERSION);
  w.u32(points.length);
  w.f64(eps.x); w.f64(eps.y); w.f64(eps.z);
  w.i64(points[0].t);
  for (let i = 1; i < points.length; i++) {
    c.branch++;
    w.svarint(BigInt(points[i].t - points[i - 1].t)); c.sub++; c.sub++;
    c.add++;
  }
  c.branch++;
  w.i32(points[0].step);
  for (let i = 1; i < points.length; i++) {
    c.branch++;
    w.svarint(BigInt(points[i].step - points[i - 1].step)); c.sub++; c.sub++;
    c.add++;
  }
  c.branch++;
  for (let i = 0; i < points.length; i++) {
    c.branch++;
    w.u8(VERDICT_TO_BYTE[points[i].verdict]);
    c.add++;
  }
  c.branch++;
  const writeQs = (qs: number[]) => {
    w.svarint(BigInt(qs[0]));
    for (let i = 1; i < qs.length; i++) {
      c.branch++;
      w.svarint(BigInt(qs[i] - qs[i - 1])); c.sub++; c.sub++;
      c.add++;
    }
    c.branch++;
  };
  writeQs(qx); writeQs(qy); writeQs(qz);
  return { bytes: w.bytes(), max_abs_err, counts: c };
}

export function decodeQuantizedCounted(bytes: Uint8Array): { points: PackedPoint[]; eps: PackedEps; counts: OpCounts } {
  const c = emptyCounts();
  const r = new CountingReader(bytes, c);
  c.branch++;
  if (r.magic() !== QUANTIZED_MAGIC) throw new RangeError("not a quantized compact encoding");
  c.branch++;
  if (r.u8() !== VERSION) throw new RangeError("unsupported quantized encoding version");
  const n = r.u32();
  c.branch++;
  if (!Number.isSafeInteger(n) || n < 1) throw new RangeError("invalid count");
  const eps: PackedEps = { x: r.f64(), y: r.f64(), z: r.f64() };
  checkEps(eps, c);
  const t = [r.i64()];
  for (let i = 1; i < n; i++) {
    c.branch++;
    const dt = r.svarint();
    const next = BigInt(t[i - 1]) + dt; c.sub++; c.add++;
    c.branch++;
    if (next < BigInt(Number.MIN_SAFE_INTEGER) || next > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new RangeError("t overflow");
    }
    t.push(Number(next));
    c.add++;
  }
  c.branch++;
  const step = [r.i32()];
  for (let i = 1; i < n; i++) {
    c.branch++;
    const ds = r.svarint();
    const next = BigInt(step[i - 1]) + ds; c.sub++; c.add++;
    c.branch++;
    if (next < BigInt(-0x80000000) || next > BigInt(0x7FFFFFFF)) throw new RangeError("step overflow");
    step.push(Number(next));
    c.add++;
  }
  c.branch++;
  const verdicts: PackedVerdict[] = [];
  for (let i = 0; i < n; i++) {
    c.branch++;
    const v = BYTE_TO_VERDICT[r.u8()];
    c.branch++;
    if (!v) throw new RangeError(`point ${i}: invalid verdict`);
    verdicts.push(v);
    c.add++;
  }
  c.branch++;
  const readQs = (): number[] => {
    const qs = [Number(r.svarint())];
    c.branch++;
    if (!Number.isSafeInteger(qs[0]) || Math.abs(qs[0]) > MAX_Q) throw new RangeError("invalid quantized value");
    for (let i = 1; i < n; i++) {
      c.branch++;
      const q = qs[i - 1] + Number(r.svarint()); c.sub++; c.add++;
      c.branch++;
      if (!Number.isSafeInteger(q) || Math.abs(q) > MAX_Q) throw new RangeError("invalid quantized value");
      qs.push(q);
      c.add++;
    }
    c.branch++;
    return qs;
  };
  const qx = readQs(), qy = readQs(), qz = readQs();
  r.expectEnd();
  const points: PackedPoint[] = [];
  for (let i = 0; i < n; i++) {
    c.branch++;
    const p: PackedPoint = {
      x: qx[i] * eps.x, y: qy[i] * eps.y, z: qz[i] * eps.z,
      t: t[i], step: step[i], verdict: verdicts[i],
    };
    c.mul++; c.mul++; c.mul++;
    checkPoint(p, i, c);
    points.push(p);
    c.add++;
  }
  c.branch++;
  return { points, eps, counts: c };
}
