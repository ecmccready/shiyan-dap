/**
 * TEST ONLY. 4D-SCP v0.1.6 divider-free quantization variant.
 *
 * Replaces per-point division `Math.round(v / eps)` with:
 *   1. a one-time (per axis) precomputed reciprocal `inv = 1/eps` and `half = 0.5*eps`
 *      (the only divisions; they are setup, not the per-point datapath),
 *   2. `q = Math.round(v * inv)` (multiply + round),
 *   3. a residual correction: rem = v - q*eps, adjust q by ±1 while rem is outside
 *      [-half, half). This is the standard multiply-plus-correct step.
 *
 * This is not the stored chain encoder. `src/scp/pack.ts` is unchanged, because
 * the variant is *not* byte-identical to `Math.round(v / eps)` for every legal
 * input: float64 `v/eps` already rounds before `Math.round`, and a more
 * accurate (or slightly different) reciprocal path disagrees at halfway cases.
 * Documented counterexamples are in KNOWN_COUNTEREXAMPLES. The variant *is*
 * byte-identical on the four committed fixtures (v0.1, A-medicare, B256, B4096).
 *
 * Op-count rule: same as `scripts/scp-v014-ops.ts`, with per-point `div = 0`.
 * Setup divisions are recorded separately and are not per-point datapath ops.
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
  compactWinsRobust,
  defaultAssumptions,
  evaluateFixture,
  type CodecId,
  type CostAssumptions,
  type SensitivityHit,
} from "./scp-v015-cost-model";

const MAX_Q = 2 ** 53;

export interface ReciprocalPrecompute {
  eps: number;
  /** 1/eps, computed once per axis. */
  inv: number;
  /** 0.5*eps, computed once per axis. */
  half: number;
}

export interface ReciprocalSetupCounts {
  /** Divisions used to form 1/eps (one per distinct axis). Not a per-point datapath op. */
  setup_div: number;
  setup_mul: number;
}

export const KNOWN_COUNTEREXAMPLES: readonly {
  v: number;
  eps: number;
  pack_q: number;
  recip_q: number;
  naive_q: number;
  note: string;
}[] = [
  {
    v: -0.0045000000000000005,
    eps: 0.001,
    pack_q: -4,
    recip_q: -5,
    naive_q: -5,
    note: "Fixture-axis eps (predicted/observed). v/eps is -4.5, Math.round(-4.5) = -4 (half toward +∞). v*(1/eps) is just below -4.5, so mul+round and residual correction both yield -5.",
  },
  {
    v: 0.0000014999999999999998,
    eps: 0.000001,
    pack_q: 2,
    recip_q: 1,
    naive_q: 1,
    note: "Halfway case: v/eps is exactly 1.5, Math.round(1.5) = 2. v*(1/eps) is 1.4999…, so mul+round and residual stay at 1.",
  },
  {
    v: 0.0045,
    eps: 0.001,
    pack_q: 5,
    recip_q: 4,
    naive_q: 5,
    note: "Residual correction can diverge from both pack.ts and naive mul-by-reciprocal. v/eps is 4.5, Math.round = 5, and v*(1/eps) is also 4.5 (naive = 5), but rem vs an inexact 0.5*eps nudges q down to 4.",
  },
];

export function packQuantizeQ(v: number, eps: number): number {
  const q0 = Math.round(v / eps);
  return q0 === 0 ? 0 : q0;
}

export function naiveReciprocalQ(v: number, eps: number): number {
  const q0 = Math.round(v * (1 / eps));
  return q0 === 0 ? 0 : q0;
}

export function precomputeReciprocal(eps: number, setup?: ReciprocalSetupCounts): ReciprocalPrecompute {
  if (typeof eps !== "number" || !Number.isFinite(eps) || eps <= 0) {
    throw new RangeError("eps must be finite and > 0");
  }
  if (setup) {
    setup.setup_div++;
    setup.setup_mul++;
  }
  return { eps, inv: 1 / eps, half: 0.5 * eps };
}

/**
 * Per-point quantize: mul-by-reciprocal + residual correction. Does not increment counts.div.
 */
export function quantizeReciprocal(v: number, pre: ReciprocalPrecompute, c: OpCounts): { q: number; err: number } {
  const q0 = Math.round(v * pre.inv); c.mul++; c.round++;
  c.branch++;
  let q = q0 === 0 ? 0 : q0;
  for (let step = 0; step < 4; step++) {
    c.branch++; // loop / exit test
    const rem = v - q * pre.eps; c.mul++; c.sub++;
    c.branch++;
    if (rem < -pre.half) { q -= 1; c.sub++; continue; }
    c.branch++;
    if (rem >= pre.half) { q += 1; c.add++; continue; }
    c.branch++;
    const err = rem < 0 ? -rem : rem;
    if (rem < 0) c.sub++;
    c.branch++;
    if (!Number.isFinite(q) || Math.abs(q) > MAX_Q) throw new RangeError("value too large for eps (quantized index out of range)");
    c.branch++;
    if (!(err <= pre.eps)) throw new RangeError("eps too small for value magnitude (error would exceed eps)");
    return { q: q === 0 ? 0 : q, err };
  }
  throw new RangeError("reciprocal residual correction did not converge");
}

export function quantizeReciprocalQ(v: number, eps: number): number {
  return quantizeReciprocal(v, precomputeReciprocal(eps), emptyCounts()).q;
}

export function makeReciprocalQuantizeFn(setup: ReciprocalSetupCounts): QuantizeCountedFn {
  const cache = new Map<number, ReciprocalPrecompute>();
  return (v, eps, c) => {
    let pre = cache.get(eps);
    if (!pre) {
      pre = precomputeReciprocal(eps, setup);
      cache.set(eps, pre);
    }
    return quantizeReciprocal(v, pre, c);
  };
}

export function encodeQuantizedReciprocalCounted(points: readonly PackedPoint[], eps: PackedEps): {
  bytes: Uint8Array;
  max_abs_err: { x: number; y: number; z: number };
  counts: OpCounts;
  setup: ReciprocalSetupCounts;
} {
  const setup: ReciprocalSetupCounts = { setup_div: 0, setup_mul: 0 };
  // One setup reciprocal per axis, even when two axes share an eps value (hardware would
  // still hold three constants). The per-point quantize function then reuses those values
  // without incrementing setup counts again.
  const pres = [
    precomputeReciprocal(eps.x, setup),
    precomputeReciprocal(eps.y, setup),
    precomputeReciprocal(eps.z, setup),
  ];
  const cache = new Map<number, ReciprocalPrecompute>();
  for (const pre of pres) cache.set(pre.eps, pre);
  const quantizeFn: QuantizeCountedFn = (v, e, c) => {
    const pre = cache.get(e) ?? precomputeReciprocal(e, setup);
    return quantizeReciprocal(v, pre, c);
  };
  const result = encodeQuantizedCounted(points, eps, quantizeFn);
  return { ...result, setup };
}

export function noDividerAssumptions(): CostAssumptions {
  const a = defaultAssumptions();
  a.compact.n_fp_divs_encode.value = 0;
  a.compact.n_fp_divs_encode.source = "v0.1.6 assumption: the per-point datapath has no divider. 1/eps is a one-time setup (three divisions per encode), not a hardware unit that stays on the datapath.";
  return a;
}

export function sensitivityFor(
  n: number,
  scqiBytes: number,
  compactBytes: number,
  encode: OpCounts,
  decode: OpCounts,
  assumptions: CostAssumptions,
): SensitivityHit[] {
  const hits: SensitivityHit[] = [];
  const base = evaluateFixture("B4096", n, scqiBytes, compactBytes, encode, decode, assumptions);
  const probeFlip = (
    parameter: string, metric: "energy" | "area", compared: CodecId,
    apply: (x: CostAssumptions, v: number) => void, values: number[], defaultValue: number,
    adverse: "lower" | "higher", note: string,
  ) => {
    const side: CodecId = compared.includes("decode") ? "compact-decode" : "compact-encode";
    const failing: number[] = [];
    for (const v of values) {
      const a = JSON.parse(JSON.stringify(assumptions)) as CostAssumptions;
      apply(a, v);
      const row = evaluateFixture("B4096", n, scqiBytes, compactBytes, encode, decode, a);
      const c = row.codecs.find((x) => x.codec === side)!;
      const o = row.codecs.find((x) => x.codec === compared)!;
      const cr = metric === "energy" ? c.energy_pj_per_point : c.area_um2;
      const or = metric === "energy" ? o.energy_pj_per_point : o.area_um2;
      if (!compactWinsRobust(cr, or)) failing.push(v);
    }
    const defC = base.codecs.find((x) => x.codec === side)!;
    const defO = base.codecs.find((x) => x.codec === compared)!;
    const defCr = metric === "energy" ? defC.energy_pj_per_point : defC.area_um2;
    const defOr = metric === "energy" ? defO.energy_pj_per_point : defO.area_um2;
    const flip = failing.length === 0 ? null : (adverse === "lower" ? Math.max(...failing) : Math.min(...failing));
    hits.push({
      parameter, default_value: defaultValue, flip_value: flip, flips: flip !== null,
      compared, metric,
      note: `${note} Default robust win (compact high < other low) is ${compactWinsRobust(defCr, defOr) ? "true" : "false"}. Closest grid value that loses robustness: ${flip === null ? "none in grid" : flip}.`,
    });
  };
  const gzAcc = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096];
  probeFlip("gzip.l9_accesses_low", "energy", "gzip-l9-encode", (a, v) => { a.gzip.l9_accesses_low.value = v; if (a.gzip.l9_accesses_high.value < v) a.gzip.l9_accesses_high.value = v; }, gzAcc, assumptions.gzip.l9_accesses_low.value, "lower", "Lower the gzip-l9 encode access low-bound.");
  probeFlip("gzip.decode_accesses_low", "energy", "gzip-l9-decode", (a, v) => { a.gzip.decode_accesses_low.value = v; if (a.gzip.decode_accesses_high.value < v) a.gzip.decode_accesses_high.value = v; }, [0.25, 0.5, 1, 2, 4, 8], assumptions.gzip.decode_accesses_low.value, "lower", "Lower gzip decode window accesses per output byte.");
  probeFlip("energy_pj.div_high", "energy", "gzip-l9-encode", (a, v) => { a.energy_pj.div_high.value = v; }, [3.1, 14.8, 50, 100, 156, 200, 500, 1000, 5000], assumptions.energy_pj.div_high.value, "higher", "Inflate compact encode divider energy (pJ). With no per-point divs this should not flip.");
  probeFlip("area_um2.sram_per_bit_low", "area", "gzip-l9-encode", (a, v) => { a.area_um2.sram_per_bit_low.value = v; }, [0.01, 0.02, 0.03, 0.04, 0.045, 0.046, 0.05, 0.06, 0.08, 0.1, 0.16, 0.2, 0.25, 0.5, 1], assumptions.area_um2.sram_per_bit_low.value, "lower", "Lower assumed SRAM µm²/bit (gzip area low corner).");
  probeFlip("gzip.hash_bytes_low", "area", "gzip-l9-encode", (a, v) => { a.gzip.hash_bytes_low.value = v; }, [0, 8192, 16384, 32768, 65536], assumptions.gzip.hash_bytes_low.value, "lower", "Gzip hash-table low bound (0 = window only).");
  probeFlip("brotli.q11_accesses_low", "energy", "brotli-q11-encode", (a, v) => { a.brotli.q11_accesses_low.value = v; if (a.brotli.q11_accesses_high.value < v) a.brotli.q11_accesses_high.value = v; }, [0.25, 0.5, 1, 2, 4, 8, 16], assumptions.brotli.q11_accesses_low.value, "lower", "Lower brotli-q11 encode accesses per input byte.");
  probeFlip("brotli.decode_accesses_low", "energy", "brotli-q11-decode", (a, v) => { a.brotli.decode_accesses_low.value = v; if (a.brotli.decode_accesses_high.value < v) a.brotli.decode_accesses_high.value = v; }, [0.05, 0.1, 0.25, 0.5, 1, 2, 4], assumptions.brotli.decode_accesses_low.value, "lower", "Lower brotli decode accesses.");
  probeFlip("area_um2.fp_div_factor_high", "area", "gzip-l9-encode", (a, v) => { a.area_um2.fp_div_factor_high.value = v; }, [4, 7, 8, 16, 32, 64, 128, 256, 1024], assumptions.area_um2.fp_div_factor_high.value, "higher", "Inflate compact encode divider area factor vs FP32 mul. With n_fp_divs_encode=0 this should not flip.");
  return hits;
}

export interface EdgeScanHit {
  v: number;
  eps: number;
  pack_q: number;
  recip_q: number;
  naive_q: number;
}

export interface EdgeScanResult {
  tested: number;
  skipped_out_of_range: number;
  mismatches: number;
  naive_mismatches: number;
  samples: EdgeScanHit[];
}

function nextUp(x: number): number {
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
function nextDown(x: number): number { return x === 0 ? -Number.MIN_VALUE : -nextUp(-x); }

function mulberry32(a: number): () => number {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function consider(v: number, eps: number, out: EdgeScanResult): void {
  if (!Number.isFinite(v) || !(eps > 0) || !Number.isFinite(eps)) { out.skipped_out_of_range++; return; }
  let packQ: number;
  try { packQ = packQuantizeQ(v, eps); } catch { out.skipped_out_of_range++; return; }
  if (!Number.isFinite(packQ) || Math.abs(packQ) > MAX_Q) { out.skipped_out_of_range++; return; }
  if (!(Math.abs(v - packQ * eps) <= eps)) { out.skipped_out_of_range++; return; }
  let recipQ: number;
  try { recipQ = quantizeReciprocalQ(v, eps); } catch { out.skipped_out_of_range++; return; }
  const naiveQ = naiveReciprocalQ(v, eps);
  out.tested++;
  if (naiveQ !== packQ) out.naive_mismatches++;
  if (recipQ !== packQ) {
    out.mismatches++;
    if (out.samples.length < 12) out.samples.push({ v, eps, pack_q: packQ, recip_q: recipQ, naive_q: naiveQ });
  }
}

/** Deterministic edge + random scan. Does not throw on mismatches; the check reports them. */
export function scanReciprocalMismatches(): EdgeScanResult {
  const out: EdgeScanResult = { tested: 0, skipped_out_of_range: 0, mismatches: 0, naive_mismatches: 0, samples: [] };
  const epsList = [0.001, 0.0001, 0.01, 0.1, 0.000001, 0.25, 0.5, 1, 1 / 3];
  for (const eps of epsList) {
    const kMax = eps <= 0.0001 ? 8000 : 5000;
    for (let k = -kMax; k <= kMax; k++) {
      let x = k * eps; consider(x, eps, out);
      for (let j = 0; j < 3; j++) { x = nextUp(x); consider(x, eps, out); }
      x = k * eps; for (let j = 0; j < 3; j++) { x = nextDown(x); consider(x, eps, out); }
      x = (k + 0.5) * eps; consider(x, eps, out);
      for (let j = 0; j < 3; j++) { x = nextUp(x); consider(x, eps, out); }
      x = (k + 0.5) * eps; for (let j = 0; j < 3; j++) { x = nextDown(x); consider(x, eps, out); }
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
  return out;
}
