/** Minimal little-endian byte writer/reader with zigzag varints over safe integers. Pure. */
export class ByteWriter {
  private out: number[] = [];
  private readonly scratch = new DataView(new ArrayBuffer(8));
  get length(): number { return this.out.length; }
  u8(v: number): void { this.out.push(v & 0xff); }
  u16(v: number): void { this.u8(v); this.u8(v >>> 8); }
  u32(v: number): void { this.u8(v); this.u8(v >>> 8); this.u8(v >>> 16); this.u8(v >>> 24); }
  magic(s: string): void { for (let i = 0; i < s.length; i++) this.u8(s.charCodeAt(i)); }
  f64(v: number): void {
    this.scratch.setFloat64(0, v, true);
    for (let i = 0; i < 8; i++) this.out.push(this.scratch.getUint8(i));
  }
  f32(v: number): void {
    this.scratch.setFloat32(0, v, true);
    for (let i = 0; i < 4; i++) this.out.push(this.scratch.getUint8(i));
  }
  uvarint(n: number): void {
    if (!Number.isSafeInteger(n) || n < 0) throw new RangeError("uvarint needs a non-negative safe integer");
    while (n >= 128) { this.out.push((n % 128) | 128); n = Math.floor(n / 128); }
    this.out.push(n);
  }
  svarint(n: number): void {
    if (!Number.isSafeInteger(n)) throw new RangeError("svarint needs a safe integer");
    if (Math.abs(n) > Number.MAX_SAFE_INTEGER / 2) throw new RangeError("svarint out of zigzag range");
    this.uvarint(n >= 0 ? n * 2 : -n * 2 - 1);
  }
  raw(b: Uint8Array): void { for (const x of b) this.out.push(x); }
  bytes(): Uint8Array { return Uint8Array.from(this.out); }
}

export class ByteReader {
  private i = 0;
  private readonly view: DataView;
  constructor(private readonly buf: Uint8Array) {
    this.view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  }
  get remaining(): number { return this.buf.length - this.i; }
  u8(): number {
    if (this.i >= this.buf.length) throw new RangeError("unexpected end of 4D-SCP stream");
    return this.buf[this.i++];
  }
  u16(): number { return this.u8() + this.u8() * 256; }
  u32(): number { return this.u8() + this.u8() * 256 + this.u8() * 65536 + this.u8() * 16777216; }
  magic(): string { return String.fromCharCode(this.u8(), this.u8(), this.u8(), this.u8()); }
  f64(): number {
    if (this.remaining < 8) throw new RangeError("unexpected end of 4D-SCP stream");
    const v = this.view.getFloat64(this.i, true); this.i += 8; return v;
  }
  f32(): number {
    if (this.remaining < 4) throw new RangeError("unexpected end of 4D-SCP stream");
    const v = this.view.getFloat32(this.i, true); this.i += 4; return v;
  }
  uvarint(): number {
    let n = 0, mul = 1;
    for (;;) {
      const b = this.u8();
      n += (b & 0x7f) * mul;
      if ((b & 0x80) === 0) break;
      mul *= 128;
      if (mul > 2 ** 56) throw new RangeError("uvarint too large");
    }
    if (!Number.isSafeInteger(n)) throw new RangeError("uvarint not a safe integer");
    return n;
  }
  svarint(): number {
    const u = this.uvarint();
    return u % 2 === 0 ? u / 2 : -(u + 1) / 2;
  }
  expectEnd(): void { if (this.remaining !== 0) throw new RangeError("trailing bytes in 4D-SCP stream"); }
}

/** Size of a zigzag varint without writing it (for analytic accounting). */
export function svarintSize(n: number): number {
  let u = n >= 0 ? n * 2 : -n * 2 - 1, s = 1;
  while (u >= 128) { u = Math.floor(u / 128); s++; }
  return s;
}

/** Size of an unsigned varint without writing it. */
export function uvarintSize(n: number): number {
  let u = n, s = 1;
  while (u >= 128) { u = Math.floor(u / 128); s++; }
  return s;
}
