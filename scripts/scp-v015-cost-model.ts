/**
 * 4D-SCP v0.1.5 Layer 2 analytical hardware cost model. Pure and deterministic.
 * TEST / DESIGN ONLY. Not a chip measurement, not HDL, not a fabricated-device result.
 *
 * Inputs from Layer 1 (v0.1.4): deterministic compact-codec op counts
 * (`scripts/scp-v014-ops.ts`) and algorithmic working sets (40 B encode / 64 B decode
 * vs gzip 32 KiB vs brotli lgwin-22 4 MiB).
 *
 * Every numeric constant used for area or energy is an *assumption*, either cited
 * from literature (Horowitz ISSCC 2014 45 nm energy table, and the same talk's
 * area tabulation as reproduced by Gholami et al. / MIT EEMS) or explicitly marked
 * "assumed". Model outputs are labelled estimates. Ranges (low/high) are used
 * instead of point claims, especially for gzip/brotli match-search traffic.
 *
 * Gzip/brotli are modelled as memory-dominated: window SRAM (plus an assumed
 * hasher-size range) and a range of window/hash accesses per input or output byte.
 * Compact energy is the instrumented op mix priced at the assumed per-op energies,
 * plus assumed register-file accesses. Compact area is a shared (not unrolled)
 * datapath plus flip-flop state, not the current JS heap.
 *
 * This module has no I/O, no clocks, no env, and no imports from src/app or Level 4.
 */
import {
  COMPACT_STREAMING_DECODE_STATE_BYTES,
  COMPACT_STREAMING_STATE_BYTES,
  GZIP_WINDOW_BYTES,
  BROTLI_WINDOW_BYTES,
  totalOps,
  type OpCounts,
} from "./scp-v014-ops";

export type LabelKind = "assumption" | "cited-literature" | "derived-from-v014" | "specified" | "estimate";

export interface Labeled<T> {
  value: T;
  unit: string;
  kind: LabelKind;
  source: string;
}

export interface Range {
  low: number;
  high: number;
  unit: string;
  kind: "estimate";
  label: "estimate";
  source: string;
}

export interface AssumptionListItem {
  id: string;
  value: number | string | boolean;
  unit: string;
  kind: LabelKind;
  source: string;
}

/** v0.1.4 published instrumented totals (check-scp-v014 / §7.9). Re-checked live by check-scp-v015. */
export const V014_PUBLISHED = {
  "v0.1": {
    n: 256,
    scqi_bytes: 6434,
    compact_bytes: 2551,
    encode: { add: 2075, sub: 3422, shift: 2257, mul: 768, div: 768, bit: 1952, round: 768, branch: 13555, bytes_written: 2551, bytes_read: 0 },
    decode: { add: 6615, sub: 1332, shift: 3528, mul: 774, div: 0, bit: 5778, round: 0, branch: 11391, bytes_written: 0, bytes_read: 2551 },
    encode_total: 25565,
    decode_total: 29418,
  },
  B256: {
    n: 256,
    scqi_bytes: 6434,
    compact_bytes: 1970,
    encode: { add: 2075, sub: 4068, shift: 1676, mul: 768, div: 768, bit: 790, round: 768, branch: 12393, bytes_written: 1970, bytes_read: 0 },
    decode: { add: 5776, sub: 1655, shift: 2947, mul: 774, div: 0, bit: 4616, round: 0, branch: 9648, bytes_written: 0, bytes_read: 1970 },
    encode_total: 23306,
    decode_total: 25416,
  },
  B4096: {
    n: 4096,
    scqi_bytes: 102434,
    compact_bytes: 30729,
    encode: { add: 32795, sub: 65198, shift: 26595, mul: 12288, div: 12288, bit: 12228, round: 12288, branch: 196631, bytes_written: 30729, bytes_read: 0 },
    decode: { add: 91939, sub: 26460, shift: 47066, mul: 12294, div: 0, bit: 73654, round: 0, branch: 153525, bytes_written: 0, bytes_read: 30729 },
    encode_total: 370311,
    decode_total: 404938,
  },
} as const;

export type FixtureName = keyof typeof V014_PUBLISHED;

const HOROWITZ = "Horowitz, “Computing's Energy Problem (and what we can do about it)”, ISSCC 2014 plenary, 45 nm rough energy table. Not a measurement of a 4D-SCP device.";
const HOROWITZ_AREA = "Horowitz ISSCC 2014 45 nm arithmetic-unit areas (µm²) as tabulated by Gholami et al. and the MIT EEMS “Tutorial on DNN — Co-design — Precision”. Not a 4D-SCP layout.";
const ZLIB_CHAIN = "zlib deflate.c configuration_table max_chain (level 6 = 128, level 9 = 4096). This is a cap, not a measured average access count.";

export interface CostAssumptions {
  process_node: Labeled<string>;
  energy_pj: {
    int32_add: Labeled<number>;
    int32_mul: Labeled<number>;
    fp32_add: Labeled<number>;
    fp32_mul: Labeled<number>;
    sram_8kb_64b: Labeled<number>;
    sram_32kb_64b: Labeled<number>;
    sram_1mb_64b: Labeled<number>;
    dram_64b_low: Labeled<number>;
    dram_64b_high: Labeled<number>;
    shift: Labeled<number>;
    bit: Labeled<number>;
    branch: Labeled<number>;
    round_low: Labeled<number>;
    round_high: Labeled<number>;
    div_low: Labeled<number>;
    div_high: Labeled<number>;
    mul_low: Labeled<number>;
    mul_high: Labeled<number>;
    register_access_32b_low: Labeled<number>;
    register_access_32b_high: Labeled<number>;
    byte_io_low: Labeled<number>;
    byte_io_high: Labeled<number>;
  };
  area_um2: {
    int32_add: Labeled<number>;
    int32_mul: Labeled<number>;
    fp32_add: Labeled<number>;
    fp32_mul: Labeled<number>;
    fp_div_factor_low: Labeled<number>;
    fp_div_factor_high: Labeled<number>;
    sram_per_bit_low: Labeled<number>;
    sram_per_bit_high: Labeled<number>;
    ff_per_bit_low: Labeled<number>;
    ff_per_bit_high: Labeled<number>;
    um2_per_ge: Labeled<number>;
    deflate_logic_low: Labeled<number>;
    deflate_logic_high: Labeled<number>;
    brotli_logic_low: Labeled<number>;
    brotli_logic_high: Labeled<number>;
  };
  compact: {
    encode_state_bytes: Labeled<number>;
    decode_state_bytes: Labeled<number>;
    n_int_adders: Labeled<number>;
    n_fp_adders: Labeled<number>;
    n_fp_muls: Labeled<number>;
    n_fp_divs_encode: Labeled<number>;
    n_fp_divs_decode: Labeled<number>;
    reg_accesses_per_point_low: Labeled<number>;
    reg_accesses_per_point_high: Labeled<number>;
    adder_width_factor: Labeled<number>;
  };
  gzip: {
    window_bytes: Labeled<number>;
    hash_bytes_low: Labeled<number>;
    hash_bytes_high: Labeled<number>;
    l6_accesses_low: Labeled<number>;
    l6_accesses_high: Labeled<number>;
    l9_accesses_low: Labeled<number>;
    l9_accesses_high: Labeled<number>;
    decode_accesses_low: Labeled<number>;
    decode_accesses_high: Labeled<number>;
  };
  brotli: {
    window_bytes: Labeled<number>;
    hash_bytes_low: Labeled<number>;
    hash_bytes_high: Labeled<number>;
    q5_accesses_low: Labeled<number>;
    q5_accesses_high: Labeled<number>;
    q11_accesses_low: Labeled<number>;
    q11_accesses_high: Labeled<number>;
    decode_accesses_low: Labeled<number>;
    decode_accesses_high: Labeled<number>;
    /** When true, the 4 MiB window high-energy corner uses DRAM energy. */
    four_mb_high_uses_dram: Labeled<boolean>;
  };
}

function L<T>(value: T, unit: string, kind: LabelKind, source: string): Labeled<T> {
  return { value, unit, kind, source };
}

export function defaultAssumptions(): CostAssumptions {
  return {
    process_node: L("45nm", "node", "cited-literature", HOROWITZ),
    energy_pj: {
      int32_add: L(0.1, "pJ", "cited-literature", HOROWITZ + " 32-bit integer add = 0.1 pJ."),
      int32_mul: L(3.1, "pJ", "cited-literature", HOROWITZ + " 32-bit integer multiply = 3.1 pJ (plenary slide rounds to 3 pJ)."),
      fp32_add: L(0.9, "pJ", "cited-literature", HOROWITZ + " 32-bit FP add = 0.9 pJ."),
      fp32_mul: L(3.7, "pJ", "cited-literature", HOROWITZ + " 32-bit FP multiply = 3.7 pJ (plenary slide rounds to 4 pJ)."),
      sram_8kb_64b: L(10, "pJ", "cited-literature", HOROWITZ + " Memory cache (64-bit) 8 KB = 10 pJ."),
      sram_32kb_64b: L(20, "pJ", "cited-literature", HOROWITZ + " Memory cache (64-bit) 32 KB = 20 pJ."),
      sram_1mb_64b: L(100, "pJ", "cited-literature", HOROWITZ + " Memory cache (64-bit) 1 MB = 100 pJ."),
      dram_64b_low: L(1300, "pJ", "cited-literature", HOROWITZ + " DRAM 1.3–2.6 nJ per 64-bit access."),
      dram_64b_high: L(2600, "pJ", "cited-literature", HOROWITZ + " DRAM 1.3–2.6 nJ per 64-bit access."),
      shift: L(0.1, "pJ", "assumption", "Assumed equal to 32-bit add; Horowitz table has no shift row."),
      bit: L(0.1, "pJ", "assumption", "Assumed equal to 32-bit add; Horowitz table has no bitwise row."),
      branch: L(0.1, "pJ", "assumption", "Assumed equal to 32-bit add (compare / branch)."),
      round_low: L(0.1, "pJ", "assumption", "Assumed, integer-style round ≈ add."),
      round_high: L(0.9, "pJ", "assumption", "Assumed, FP-style round ≈ FP add (Horowitz 0.9 pJ)."),
      div_low: L(3.1, "pJ", "assumption", "Assumed, integer div at least an integer mul; Horowitz table has no divider row."),
      div_high: L(14.8, "pJ", "assumption", "Assumed, ~4× FP32 mul (Horowitz 3.7 pJ); divider energy is not in the table."),
      mul_low: L(3.1, "pJ", "cited-literature", "Horowitz 32-bit integer mul = 3.1 pJ. Optimistic if quantize stays integer."),
      mul_high: L(3.7, "pJ", "cited-literature", "Horowitz 32-bit FP mul = 3.7 pJ. The software codec uses IEEE-754 JS numbers."),
      register_access_32b_low: L(0.03, "pJ", "assumption", "Assumed cheaper than an 8 KB SRAM 32-bit read (5 pJ in the National Academies reproduction of Horowitz). Not a Horowitz register-file row."),
      register_access_32b_high: L(0.5, "pJ", "assumption", "Assumed upper bound, still well below 8 KB SRAM."),
      byte_io_low: L(0.05, "pJ", "assumption", "Assumed energy to emit or consume one datapath byte (wire / register write)."),
      byte_io_high: L(0.2, "pJ", "assumption", "Assumed upper bound for one datapath byte."),
    },
    area_um2: {
      int32_add: L(137, "um^2", "cited-literature", HOROWITZ_AREA + " 32-bit integer add = 137 µm²."),
      int32_mul: L(3495, "um^2", "cited-literature", HOROWITZ_AREA + " 32-bit integer mul = 3495 µm²."),
      fp32_add: L(4184, "um^2", "cited-literature", HOROWITZ_AREA + " 32-bit FP add = 4184 µm²."),
      fp32_mul: L(7700, "um^2", "cited-literature", HOROWITZ_AREA + " 32-bit FP mul = 7700 µm²."),
      fp_div_factor_low: L(2, "x", "assumption", "Assumed divider area ≥ 2× FP32 mul; no Horowitz divider area."),
      fp_div_factor_high: L(4, "x", "assumption", "Assumed divider area ≤ 4× FP32 mul."),
      sram_per_bit_low: L(0.25, "um^2/bit", "assumption", "Assumed, order of a 45 nm high-density 6T cell. Not a foundry PDK number."),
      sram_per_bit_high: L(1.0, "um^2/bit", "assumption", "Assumed, cell plus macro / peripheral overhead."),
      ff_per_bit_low: L(4, "um^2/bit", "assumption", "Assumed flip-flop area; denser than a generous scan FF. Not measured."),
      ff_per_bit_high: L(16, "um^2/bit", "assumption", "Assumed scan FF plus placement overhead."),
      um2_per_ge: L(0.5, "um^2/GE", "assumption", "Assumed conversion only, so gate-equivalent figures are doubly estimated."),
      deflate_logic_low: L(5000, "um^2", "assumption", "Assumed gzip/deflate control + Huffman/match logic, excluding window SRAM."),
      deflate_logic_high: L(40000, "um^2", "assumption", "Assumed upper bound for gzip/deflate logic, excluding window SRAM."),
      brotli_logic_low: L(10000, "um^2", "assumption", "Assumed brotli control/hasher logic, excluding window SRAM."),
      brotli_logic_high: L(80000, "um^2", "assumption", "Assumed upper bound for brotli logic, excluding window SRAM."),
    },
    compact: {
      encode_state_bytes: L(COMPACT_STREAMING_STATE_BYTES, "B", "derived-from-v014", "v0.1.4 algorithmic streaming state: 5 × 8-byte previous-value registers."),
      decode_state_bytes: L(COMPACT_STREAMING_DECODE_STATE_BYTES, "B", "derived-from-v014", "v0.1.4 decode state: 40 B registers + 24 B eps."),
      n_int_adders: L(1, "units", "assumption", "Shared (not unrolled) integer adder/subtracter/shifter datapath."),
      n_fp_adders: L(1, "units", "assumption", "Shared FP add for reconstruction / rounding support."),
      n_fp_muls: L(1, "units", "assumption", "Shared FP/integer multiplier for q·eps (and integer muls)."),
      n_fp_divs_encode: L(1, "units", "assumption", "Shared divider for v/eps quantization on encode. Large; a later design could iterate a multiplier instead."),
      n_fp_divs_decode: L(0, "units", "assumption", "Decode reconstructs v' = q·eps and does not divide."),
      reg_accesses_per_point_low: L(10, "accesses", "assumption", "Assumed ~5 previous-value reads + writes per point."),
      reg_accesses_per_point_high: L(20, "accesses", "assumption", "Assumed upper bound including temporaries / varint accumulator."),
      adder_width_factor: L(2, "x", "assumption", "t is 64-bit; area of the integer adder is modelled as 2× the 32-bit add unit."),
    },
    gzip: {
      window_bytes: L(GZIP_WINDOW_BYTES, "B", "specified", "RFC 1951 / v0.1.4: deflate window = 32 KiB."),
      hash_bytes_low: L(0, "B", "assumption", "Lower bound: count only the 32 KiB window, no hash table."),
      hash_bytes_high: L(65536, "B", "assumption", "Assumed ~15-bit deflate hash × 2–4 B/entry (32–128 KiB); 64 KiB used as the high corner."),
      l6_accesses_low: L(4, "1/byte", "assumption", "Assumed typical-low match-search + hash accesses per input byte at level 6."),
      l6_accesses_high: L(128, "1/byte", "assumption", ZLIB_CHAIN + " Used as the high cap for level 6, not a measured average."),
      l9_accesses_low: L(8, "1/byte", "assumption", "Assumed typical-low accesses per input byte at level 9."),
      l9_accesses_high: L(4096, "1/byte", "assumption", ZLIB_CHAIN + " Used as the high cap for level 9, not a measured average."),
      decode_accesses_low: L(1, "1/byte", "assumption", "Assumed; inflate is mostly window copy / literal emit."),
      decode_accesses_high: L(4, "1/byte", "assumption", "Assumed decode upper bound (match copies + table lookups)."),
    },
    brotli: {
      window_bytes: L(BROTLI_WINDOW_BYTES, "B", "specified", "v0.1.3/v0.1.4: brotli lgwin 22 = 4 MiB window."),
      hash_bytes_low: L(0, "B", "assumption", "Lower bound: count only the 4 MiB window."),
      hash_bytes_high: L(BROTLI_WINDOW_BYTES, "B", "assumption", "Assumed hasher/scratch up to one extra window at high quality; not measured."),
      q5_accesses_low: L(8, "1/byte", "assumption", "Assumed typical-low accesses per input byte at quality 5. No cited average."),
      q5_accesses_high: L(64, "1/byte", "assumption", "Assumed quality-5 high cap. No cited average."),
      q11_accesses_low: L(16, "1/byte", "assumption", "Assumed typical-low accesses per input byte at quality 11. No cited average."),
      q11_accesses_high: L(1024, "1/byte", "assumption", "Assumed quality-11 high cap (maximum quality). No cited average."),
      decode_accesses_low: L(1, "1/byte", "assumption", "Assumed; decode is mostly window copy."),
      decode_accesses_high: L(4, "1/byte", "assumption", "Assumed decode upper bound."),
      four_mb_high_uses_dram: L(true, "", "assumption", "High-energy corner treats a 4 MiB window as off-chip DRAM (Horowitz 1.3–2.6 nJ / 64 b). The low corner keeps it on-chip (log-linear extrapolation of the 32 KB–1 MB SRAM points). This is a sensitivity lever, not a floorplan."),
    },
  };
}

export function flattenAssumptions(a: CostAssumptions): AssumptionListItem[] {
  const out: AssumptionListItem[] = [];
  const walk = (prefix: string, obj: unknown): void => {
    if (obj && typeof obj === "object" && "value" in (obj as object) && "source" in (obj as object) && "kind" in (obj as object)) {
      const lab = obj as Labeled<number | string | boolean>;
      out.push({ id: prefix, value: lab.value, unit: lab.unit, kind: lab.kind, source: lab.source });
      return;
    }
    if (obj && typeof obj === "object") {
      for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
        walk(prefix ? `${prefix}.${k}` : k, v);
      }
    }
  };
  walk("", a);
  return out;
}

function range(low: number, high: number, unit: string, source: string): Range {
  const lo = Math.min(low, high), hi = Math.max(low, high);
  return { low: lo, high: hi, unit, kind: "estimate", label: "estimate", source };
}

/** Log-linear interpolate / extrapolate Horowitz 64-bit cache access energy vs size. */
export function sram64bAccessPj(sizeBytes: number, a: CostAssumptions): Range {
  const e = a.energy_pj;
  const pts: [number, number][] = [
    [8 * 1024, e.sram_8kb_64b.value],
    [32 * 1024, e.sram_32kb_64b.value],
    [1024 * 1024, e.sram_1mb_64b.value],
  ];
  const s = Math.max(1, sizeBytes);
  const interp = (x: number): number => {
    if (x <= pts[0][0]) return pts[0][1];
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
      if (x <= x1) {
        const t = (Math.log2(x) - Math.log2(x0)) / (Math.log2(x1) - Math.log2(x0));
        return y0 + t * (y1 - y0);
      }
    }
    const [x0, y0] = pts[pts.length - 2], [x1, y1] = pts[pts.length - 1];
    const slope = (y1 - y0) / (Math.log2(x1) - Math.log2(x0));
    return y1 + slope * (Math.log2(x) - Math.log2(x1));
  };
  const onChip = interp(s);
  const high = (s > 1024 * 1024 && a.brotli.four_mb_high_uses_dram.value) ? e.dram_64b_high.value : onChip;
  const low = onChip;
  return range(low, high, "pJ/64b", s > 1024 * 1024
    ? "Low: assumed log-linear extrapolation of Horowitz 32 KB–1 MB 64-bit cache points. High: DRAM 2.6 nJ if four_mb_high_uses_dram, else the same on-chip value. Estimate, not measured."
    : "Horowitz ISSCC 2014 64-bit cache energy at the listed sizes, log-linear between points. Estimate when interpolated.");
}

export function sramEnergyPerBytePj(sizeBytes: number, a: CostAssumptions): Range {
  const r = sram64bAccessPj(sizeBytes, a);
  return range(r.low / 8, r.high / 8, "pJ/B", "Derived from 64-bit access energy / 8. Estimate.");
}

function perPointCounts(c: OpCounts, n: number): OpCounts & { total: number } {
  const d = n === 0 ? Number.POSITIVE_INFINITY : n;
  return {
    add: c.add / d, sub: c.sub / d, shift: c.shift / d, mul: c.mul / d, div: c.div / d,
    bit: c.bit / d, round: c.round / d, branch: c.branch / d,
    bytes_written: c.bytes_written / d, bytes_read: c.bytes_read / d,
    total: totalOps(c) / d,
  };
}

function compactOpEnergyPj(pp: OpCounts, a: CostAssumptions, corner: "low" | "high"): number {
  const e = a.energy_pj;
  const mul = corner === "low" ? e.mul_low.value : e.mul_high.value;
  const div = corner === "low" ? e.div_low.value : e.div_high.value;
  const round = corner === "low" ? e.round_low.value : e.round_high.value;
  const io = corner === "low" ? e.byte_io_low.value : e.byte_io_high.value;
  const reg = corner === "low" ? e.register_access_32b_low.value : e.register_access_32b_high.value;
  const regN = corner === "low" ? a.compact.reg_accesses_per_point_low.value : a.compact.reg_accesses_per_point_high.value;
  return pp.add * e.int32_add.value
    + pp.sub * e.int32_add.value
    + pp.shift * e.shift.value
    + pp.bit * e.bit.value
    + pp.branch * e.branch.value
    + pp.mul * mul
    + pp.div * div
    + pp.round * round
    + (pp.bytes_written + pp.bytes_read) * io
    + regN * reg;
}

function compactLogicAreaUm2(a: CostAssumptions, side: "encode" | "decode", corner: "low" | "high"): number {
  const ar = a.area_um2;
  const c = a.compact;
  const divs = side === "encode" ? c.n_fp_divs_encode.value : c.n_fp_divs_decode.value;
  const divFactor = corner === "low" ? ar.fp_div_factor_low.value : ar.fp_div_factor_high.value;
  const ff = corner === "low" ? ar.ff_per_bit_low.value : ar.ff_per_bit_high.value;
  const stateBytes = side === "encode" ? c.encode_state_bytes.value : c.decode_state_bytes.value;
  return c.n_int_adders.value * c.adder_width_factor.value * ar.int32_add.value
    + c.n_fp_adders.value * ar.fp32_add.value
    + c.n_fp_muls.value * ar.fp32_mul.value
    + divs * divFactor * ar.fp32_mul.value
    + stateBytes * 8 * ff;
}

function sramAreaUm2(bytes: number, a: CostAssumptions, corner: "low" | "high"): number {
  const per = corner === "low" ? a.area_um2.sram_per_bit_low.value : a.area_um2.sram_per_bit_high.value;
  return bytes * 8 * per;
}

export type CodecId =
  | "compact-encode" | "compact-decode"
  | "gzip-l6-encode" | "gzip-l6-decode" | "gzip-l9-encode" | "gzip-l9-decode"
  | "brotli-q5-encode" | "brotli-q5-decode" | "brotli-q11-encode" | "brotli-q11-decode";

export interface CodecCost {
  codec: CodecId;
  label: "estimate";
  state_bytes: number;
  state_bytes_kind: "derived-from-v014" | "specified" | "assumption";
  extra_memory_bytes: Range;
  working_set_bytes_range: Range;
  ops_per_point: Range | null;
  op_mix_per_point: (OpCounts & { total: number }) | null;
  accesses_per_point: Range | null;
  area_um2: Range;
  area_ge: Range;
  energy_pj_per_point: Range;
  notes: string;
}

export interface FixtureCost {
  fixture: string;
  n: number;
  scqi_bytes: number;
  compact_bytes: number;
  bytes_per_point_scqi: number;
  label: "estimate";
  codecs: CodecCost[];
}

function memCodec(
  id: CodecId,
  windowBytes: number,
  hashLow: number,
  hashHigh: number,
  accessLow: number,
  accessHigh: number,
  bytesPerPoint: number,
  logicLow: number,
  logicHigh: number,
  a: CostAssumptions,
  notes: string,
): CodecCost {
  const eByte = sramEnergyPerBytePj(windowBytes, a);
  const acc = range(accessLow * bytesPerPoint, accessHigh * bytesPerPoint, "accesses/point", "Assumed accesses/byte × SCQI bytes/point. Estimate.");
  const energy = range(
    acc.low * eByte.low,
    acc.high * eByte.high,
    "pJ/point",
    "Memory-dominated estimate: accesses/point × SRAM (or DRAM high-corner) energy/byte. Not measured.",
  );
  const memLow = windowBytes + hashLow;
  const memHigh = windowBytes + hashHigh;
  const area = range(
    sramAreaUm2(memLow, a, "low") + logicLow,
    sramAreaUm2(memHigh, a, "high") + logicHigh,
    "um^2",
    "Estimate: (window + assumed hasher) × assumed µm²/bit + assumed control logic. Not a layout.",
  );
  const ge = range(area.low / a.area_um2.um2_per_ge.value, area.high / a.area_um2.um2_per_ge.value, "GE", "Estimate: area / assumed µm²-per-GE. Doubly estimated.");
  return {
    codec: id,
    label: "estimate",
    state_bytes: windowBytes,
    state_bytes_kind: "specified",
    extra_memory_bytes: range(hashLow, hashHigh, "B", "Assumed hasher/scratch range, added to the window."),
    working_set_bytes_range: range(memLow, memHigh, "B", "Window plus assumed hasher."),
    ops_per_point: null,
    op_mix_per_point: null,
    accesses_per_point: acc,
    area_um2: area,
    area_ge: ge,
    energy_pj_per_point: energy,
    notes,
  };
}

function compactCodec(id: "compact-encode" | "compact-decode", counts: OpCounts, n: number, a: CostAssumptions): CodecCost {
  const side = id === "compact-encode" ? "encode" : "decode";
  const state = side === "encode" ? a.compact.encode_state_bytes.value : a.compact.decode_state_bytes.value;
  const pp = perPointCounts(counts, n);
  const eLow = compactOpEnergyPj(pp, a, "low");
  const eHigh = compactOpEnergyPj(pp, a, "high");
  const area = range(compactLogicAreaUm2(a, side, "low"), compactLogicAreaUm2(a, side, "high"), "um^2",
    "Estimate: shared (not unrolled) ALU units at Horowitz 45 nm areas plus assumed flip-flop area for streaming state. Not a layout.");
  const ge = range(area.low / a.area_um2.um2_per_ge.value, area.high / a.area_um2.um2_per_ge.value, "GE", "Estimate: area / assumed µm²-per-GE. Doubly estimated.");
  return {
    codec: id,
    label: "estimate",
    state_bytes: state,
    state_bytes_kind: "derived-from-v014",
    extra_memory_bytes: range(0, 0, "B", "No window SRAM in the algorithmic compact model."),
    working_set_bytes_range: range(state, state, "B", "v0.1.4 algorithmic streaming state."),
    ops_per_point: range(pp.total, pp.total, "ops/point", "Derived from v0.1.4 instrumented counts, header amortized over n. Deterministic."),
    op_mix_per_point: pp,
    accesses_per_point: range(a.compact.reg_accesses_per_point_low.value, a.compact.reg_accesses_per_point_high.value, "accesses/point", "Assumed register-file accesses per point."),
    area_um2: area,
    area_ge: ge,
    energy_pj_per_point: range(eLow, eHigh, "pJ/point", "Estimate: instrumented op mix × assumed/cited per-op energies + assumed register accesses. Not measured on silicon."),
    notes: "Compact datapath is shared, not spatially unrolled. JS heap of the current Writer is excluded.",
  };
}

export function evaluateFixture(
  name: string,
  n: number,
  scqiBytes: number,
  compactBytes: number,
  encode: OpCounts,
  decode: OpCounts,
  assumptions: CostAssumptions = defaultAssumptions(),
): FixtureCost {
  const a = assumptions;
  const bpp = n === 0 ? 0 : scqiBytes / n;
  const gz = a.gzip, br = a.brotli, ar = a.area_um2;
  const codecs: CodecCost[] = [
    compactCodec("compact-encode", encode, n, a),
    compactCodec("compact-decode", decode, n, a),
    memCodec("gzip-l6-encode", gz.window_bytes.value, gz.hash_bytes_low.value, gz.hash_bytes_high.value, gz.l6_accesses_low.value, gz.l6_accesses_high.value, bpp, ar.deflate_logic_low.value, ar.deflate_logic_high.value, a, "Memory-dominated gzip level 6 encode estimate."),
    memCodec("gzip-l6-decode", gz.window_bytes.value, gz.hash_bytes_low.value, gz.hash_bytes_high.value, gz.decode_accesses_low.value, gz.decode_accesses_high.value, bpp, ar.deflate_logic_low.value, ar.deflate_logic_high.value, a, "Memory-dominated gzip decode estimate. Same window as encode."),
    memCodec("gzip-l9-encode", gz.window_bytes.value, gz.hash_bytes_low.value, gz.hash_bytes_high.value, gz.l9_accesses_low.value, gz.l9_accesses_high.value, bpp, ar.deflate_logic_low.value, ar.deflate_logic_high.value, a, "Memory-dominated gzip level 9 encode estimate. High access cap is zlib max_chain."),
    memCodec("gzip-l9-decode", gz.window_bytes.value, gz.hash_bytes_low.value, gz.hash_bytes_high.value, gz.decode_accesses_low.value, gz.decode_accesses_high.value, bpp, ar.deflate_logic_low.value, ar.deflate_logic_high.value, a, "Memory-dominated gzip decode estimate; level does not change the window."),
    memCodec("brotli-q5-encode", br.window_bytes.value, br.hash_bytes_low.value, br.hash_bytes_high.value, br.q5_accesses_low.value, br.q5_accesses_high.value, bpp, ar.brotli_logic_low.value, ar.brotli_logic_high.value, a, "Memory-dominated brotli quality 5 encode estimate. Access counts are assumed."),
    memCodec("brotli-q5-decode", br.window_bytes.value, br.hash_bytes_low.value, br.hash_bytes_high.value, br.decode_accesses_low.value, br.decode_accesses_high.value, bpp, ar.brotli_logic_low.value, ar.brotli_logic_high.value, a, "Memory-dominated brotli decode estimate. Same 4 MiB window."),
    memCodec("brotli-q11-encode", br.window_bytes.value, br.hash_bytes_low.value, br.hash_bytes_high.value, br.q11_accesses_low.value, br.q11_accesses_high.value, bpp, ar.brotli_logic_low.value, ar.brotli_logic_high.value, a, "Memory-dominated brotli quality 11 encode estimate. Access counts are assumed."),
    memCodec("brotli-q11-decode", br.window_bytes.value, br.hash_bytes_low.value, br.hash_bytes_high.value, br.decode_accesses_low.value, br.decode_accesses_high.value, bpp, ar.brotli_logic_low.value, ar.brotli_logic_high.value, a, "Memory-dominated brotli decode estimate. Same 4 MiB window."),
  ];
  return { fixture: name, n, scqi_bytes: scqiBytes, compact_bytes: compactBytes, bytes_per_point_scqi: bpp, label: "estimate", codecs };
}

export function evaluatePublished(assumptions: CostAssumptions = defaultAssumptions()): FixtureCost[] {
  return (Object.keys(V014_PUBLISHED) as FixtureName[]).map((name) => {
    const f = V014_PUBLISHED[name];
    return evaluateFixture(name, f.n, f.scqi_bytes, f.compact_bytes, f.encode, f.decode, assumptions);
  });
}

export function codecOf(row: FixtureCost, id: CodecId): CodecCost {
  const c = row.codecs.find((x) => x.codec === id);
  if (!c) throw new Error(`missing codec ${id}`);
  return c;
}

/** Ratio range of `other / compact` using adverse and favourable corners. >1 means compact is cheaper. */
export function ratioRange(compact: Range, other: Range): Range {
  const adv = other.low / compact.high; // smallest other/compact (adverse to "compact wins")
  const fav = other.high / compact.low;
  return range(adv, fav, "x", "Estimate: other/compact energy or area. Low uses other_low/compact_high; high uses other_high/compact_low. >1 means compact is cheaper in that corner.");
}

export function compactWinsRobust(compact: Range, other: Range): boolean {
  return other.low > compact.high;
}

export function rangesOverlapOrFlip(compact: Range, other: Range): boolean {
  return other.low <= compact.high;
}

export interface SensitivityHit {
  parameter: string;
  default_value: number | boolean;
  flip_value: number | boolean | null;
  flips: boolean;
  compared: string;
  metric: "energy" | "area";
  note: string;
}

function cloneAssumptions(a: CostAssumptions): CostAssumptions {
  return JSON.parse(JSON.stringify(a)) as CostAssumptions;
}

/**
 * One-parameter sensitivity on B4096 encode energy/area vs gzip-l9 and brotli-q11.
 * Reports the value (if any) at which the compact *high* corner is no longer below the baseline *low* corner.
 */
export function sensitivity(assumptions: CostAssumptions = defaultAssumptions()): SensitivityHit[] {
  const hits: SensitivityHit[] = [];
  const base = evaluatePublished(assumptions).find((r) => r.fixture === "B4096")!;
  const gzipEncodeAccesses = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096];
  // adverse_direction: "lower" means smaller values threaten a compact win; "higher" means larger values do.
  const probeFlip = (
    parameter: string, metric: "energy" | "area", compared: CodecId,
    apply: (x: CostAssumptions, v: number) => void, values: number[], defaultValue: number,
    adverse: "lower" | "higher", note: string,
  ) => {
    const side: CodecId = compared.includes("decode") ? "compact-decode" : "compact-encode";
    const failing: number[] = [];
    for (const v of values) {
      const a = cloneAssumptions(assumptions);
      apply(a, v);
      const row = evaluatePublished(a).find((r) => r.fixture === "B4096")!;
      const c = codecOf(row, side);
      const o = codecOf(row, compared);
      const cr = metric === "energy" ? c.energy_pj_per_point : c.area_um2;
      const or = metric === "energy" ? o.energy_pj_per_point : o.area_um2;
      if (!compactWinsRobust(cr, or)) failing.push(v);
    }
    const defRow = base;
    const defC = codecOf(defRow, side);
    const defO = codecOf(defRow, compared);
    const defCr = metric === "energy" ? defC.energy_pj_per_point : defC.area_um2;
    const defOr = metric === "energy" ? defO.energy_pj_per_point : defO.area_um2;
    const flip = failing.length === 0 ? null : (adverse === "lower" ? Math.max(...failing) : Math.min(...failing));
    hits.push({
      parameter, default_value: defaultValue, flip_value: flip, flips: flip !== null,
      compared, metric,
      note: `${note} Default robust win (compact high < other low) is ${compactWinsRobust(defCr, defOr) ? "true" : "false"}. Closest grid value that loses robustness: ${flip === null ? "none in grid" : flip}.`,
    });
  };

  probeFlip("gzip.l9_accesses_low", "energy", "gzip-l9-encode", (a, v) => { a.gzip.l9_accesses_low.value = v; if (a.gzip.l9_accesses_high.value < v) a.gzip.l9_accesses_high.value = v; }, gzipEncodeAccesses, assumptions.gzip.l9_accesses_low.value, "lower", "Lower the gzip-l9 encode access low-bound. A robust energy win requires gzip_low > compact_high.");
  probeFlip("gzip.decode_accesses_low", "energy", "gzip-l9-decode", (a, v) => { a.gzip.decode_accesses_low.value = v; if (a.gzip.decode_accesses_high.value < v) a.gzip.decode_accesses_high.value = v; }, [0.25, 0.5, 1, 2, 4, 8], assumptions.gzip.decode_accesses_low.value, "lower", "Lower gzip decode window accesses per output byte.");
  probeFlip("energy_pj.div_high", "energy", "gzip-l9-encode", (a, v) => { a.energy_pj.div_high.value = v; }, [3.1, 14.8, 50, 100, 156, 200, 500, 1000, 5000], assumptions.energy_pj.div_high.value, "higher", "Inflate compact encode divider energy (pJ).");
  probeFlip("area_um2.sram_per_bit_low", "area", "gzip-l9-encode", (a, v) => { a.area_um2.sram_per_bit_low.value = v; }, [0.01, 0.05, 0.1, 0.15, 0.16, 0.2, 0.25, 0.5, 1], assumptions.area_um2.sram_per_bit_low.value, "lower", "Lower assumed SRAM µm²/bit (gzip area low corner).");
  probeFlip("gzip.hash_bytes_low", "area", "gzip-l9-encode", (a, v) => { a.gzip.hash_bytes_low.value = v; }, [0, 8192, 16384, 32768, 65536], assumptions.gzip.hash_bytes_low.value, "lower", "Raise the gzip hash-table low bound (0 = window only). Lower values are more adverse to a compact area win.");
  probeFlip("brotli.q11_accesses_low", "energy", "brotli-q11-encode", (a, v) => { a.brotli.q11_accesses_low.value = v; if (a.brotli.q11_accesses_high.value < v) a.brotli.q11_accesses_high.value = v; }, [0.25, 0.5, 1, 2, 4, 8, 16], assumptions.brotli.q11_accesses_low.value, "lower", "Lower brotli-q11 encode accesses per input byte.");
  probeFlip("brotli.decode_accesses_low", "energy", "brotli-q11-decode", (a, v) => { a.brotli.decode_accesses_low.value = v; if (a.brotli.decode_accesses_high.value < v) a.brotli.decode_accesses_high.value = v; }, [0.05, 0.1, 0.25, 0.5, 1, 2, 4], assumptions.brotli.decode_accesses_low.value, "lower", "Lower brotli decode accesses. On-chip 4 MiB low-energy vs compact decode.");
  probeFlip("area_um2.fp_div_factor_high", "area", "gzip-l9-encode", (a, v) => { a.area_um2.fp_div_factor_high.value = v; }, [4, 7, 8, 16, 32, 64, 128, 256, 1024], assumptions.area_um2.fp_div_factor_high.value, "higher", "Inflate compact encode divider area factor vs FP32 mul.");
  return hits;
}

export function relativeTable(row: FixtureCost): Array<Record<string, unknown>> {
  const enc = codecOf(row, "compact-encode");
  const dec = codecOf(row, "compact-decode");
  return row.codecs.map((c) => {
    const vsEncArea = ratioRange(enc.area_um2, c.area_um2);
    const vsEncE = ratioRange(enc.energy_pj_per_point, c.energy_pj_per_point);
    const vsDecE = ratioRange(dec.energy_pj_per_point, c.energy_pj_per_point);
    return {
      codec: c.codec,
      label: "estimate" as const,
      state_bytes: c.state_bytes,
      working_set_bytes_low: c.working_set_bytes_range.low,
      working_set_bytes_high: c.working_set_bytes_range.high,
      ops_per_point: c.ops_per_point ? c.ops_per_point.low : null,
      op_mix: c.op_mix_per_point,
      accesses_per_point_low: c.accesses_per_point?.low ?? null,
      accesses_per_point_high: c.accesses_per_point?.high ?? null,
      area_um2_low: c.area_um2.low,
      area_um2_high: c.area_um2.high,
      area_ge_low: c.area_ge.low,
      area_ge_high: c.area_ge.high,
      energy_pj_per_point_low: c.energy_pj_per_point.low,
      energy_pj_per_point_high: c.energy_pj_per_point.high,
      rel_area_vs_compact_enc_low: vsEncArea.low,
      rel_area_vs_compact_enc_high: vsEncArea.high,
      rel_energy_vs_compact_same_side_low: c.codec.includes("decode") ? vsDecE.low : vsEncE.low,
      rel_energy_vs_compact_same_side_high: c.codec.includes("decode") ? vsDecE.high : vsEncE.high,
      robust_area_win_for_compact: c.codec.startsWith("compact") ? null : compactWinsRobust(enc.area_um2, c.area_um2),
      robust_energy_win_for_compact: c.codec.startsWith("compact") ? null : compactWinsRobust(
        c.codec.includes("decode") ? dec.energy_pj_per_point : enc.energy_pj_per_point,
        c.energy_pj_per_point,
      ),
    };
  });
}

export function modelReport(assumptions: CostAssumptions = defaultAssumptions()): {
  label: "estimate";
  process_node: string;
  disclaimer: string;
  assumptions: AssumptionListItem[];
  fixtures: FixtureCost[];
  tables: Record<string, ReturnType<typeof relativeTable>>;
  sensitivity: SensitivityHit[];
} {
  const fixtures = evaluatePublished(assumptions);
  const tables: Record<string, ReturnType<typeof relativeTable>> = {};
  for (const f of fixtures) tables[f.fixture] = relativeTable(f);
  return {
    label: "estimate",
    process_node: assumptions.process_node.value,
    disclaimer: "All area and energy figures are parameterized estimates at an assumed 45 nm node, not measurements, not an FPGA result, and not a fabricated 4D-SCP device. Op counts and working-set sizes are from v0.1.4 (measured or specified). Per-op energies and µm²/bit are literature-style assumptions.",
    assumptions: flattenAssumptions(assumptions),
    fixtures,
    tables,
    sensitivity: sensitivity(assumptions),
  };
}

export function stableStringify(value: unknown): string {
  const ancestors: object[] = [];
  const sort = (v: unknown): unknown => {
    if (v === null || typeof v !== "object") return v;
    if (ancestors.includes(v as object)) throw new TypeError("cycle");
    ancestors.push(v as object);
    let out: unknown;
    if (Array.isArray(v)) out = v.map(sort);
    else {
      const obj: Record<string, unknown> = {};
      for (const k of Object.keys(v as Record<string, unknown>).sort()) obj[k] = sort((v as Record<string, unknown>)[k]);
      out = obj;
    }
    ancestors.pop();
    return out;
  };
  return JSON.stringify(sort(value));
}

/** Walk a report and return any energy/area-like numeric fields missing the estimate label. */
export function unlabeledEstimateFields(report: ReturnType<typeof modelReport>): string[] {
  const bad: string[] = [];
  const walk = (prefix: string, v: unknown): void => {
    if (!v || typeof v !== "object") return;
    const o = v as Record<string, unknown>;
    if ("low" in o && "high" in o && "unit" in o) {
      if (o.label !== "estimate" || o.kind !== "estimate") bad.push(prefix);
      return;
    }
    if (Array.isArray(v)) {
      v.forEach((x, i) => walk(`${prefix}[${i}]`, x));
      return;
    }
    for (const [k, val] of Object.entries(o)) walk(prefix ? `${prefix}.${k}` : k, val);
  };
  for (const f of report.fixtures) {
    for (const c of f.codecs) {
      walk(`${f.fixture}.${c.codec}.area_um2`, c.area_um2);
      walk(`${f.fixture}.${c.codec}.area_ge`, c.area_ge);
      walk(`${f.fixture}.${c.codec}.energy_pj_per_point`, c.energy_pj_per_point);
    }
  }
  if (report.label !== "estimate") bad.push("report.label");
  return bad;
}
