/** TEST ONLY. 4D-SCP v0.1.10 — integer-only, hash-free scp4d golden model, compute-energy test and
 * FPGA reference vectors (software simulation; nothing here is silicon or FPGA).
 *
 * Model: scripts/scp-v0110-int-scp4d.ts. Integer full_q / delta models under the same accounting.
 * Fixtures: the v0.1.9 bench fixtures (v0.1, Medicare 6-row synthetic, B256, B4096, SYNTHETIC
 * environment 16×16×2 at T=64 and T=256, seed 20261118). All test-only and labelled.
 *
 * Asserted (deterministic only): bitstream round-trip, |v − v′| ≤ eps on every element-frame,
 * decision agreement vs v0.1.9, byte-identity of integer full_q / delta with the v0.1.9 streams,
 * v0.1.9 scp4d bytes unchanged, register census ≤ analytic bound ≤ declared width (overflow proof),
 * instrumented op counts == closed-form formulas, golden vectors regenerate byte-identically,
 * the committed JSON report, and the stated findings / verdict.
 * Energy and area are MODEL ESTIMATES from the v0.1.5 45 nm assumption table — not measurements.
 * Latency is reported on stdout only, never asserted. No network, no env reads, no writes unless
 * --write (which only rewrites the two committed fixture files).
 *
 * Run: npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-scp-v0110.ts [--write]
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { encodeQuantized } from "../src/scp/pack";
import {
  decisionAgreement, stateCompressor, stateReconstructor,
  type DecisionTask4D, type Relation4D, type StateSurface4D,
} from "../src/scp/subsystem";
import { defaultAssumptions, sramEnergyPerBytePj } from "./scp-v015-cost-model";
import { BOUNDED_EPS } from "./scp-v01-fixture";
import { ENV_EPS, ENV_LABEL, ENV_SEED, ENV_TASKS, FRAME_EPS, FRAME_TASKS, frameFixtures, makeEnvironment } from "./scp-v019-env-fixture";
import {
  ALL_DENSE_MAX_D, DECLARED_WIDTHS, DEFAULT_G, INT_RANKS, analyticBounds, asr, decodeIntBaseline, decodeIntScp4d, decodeIntScp4dEventDriven,
  encodeIntBaseline, encodeIntScp4d, ingestCodes, ingestOpsPerValue, intOpsTotal, searchIntScp4d, shl, signedBits, zeroIntOps,
  type Census, type FrameEvents, type IntConfig, type IntEncodeResult, type IntOps, type IntStreamInput, type PlanSummary, type RegName,
} from "./scp-v0110-int-scp4d";

const root = resolve(join(import.meta.dirname, ".."));
const MODEL_PATH = "scripts/scp-v0110-int-scp4d.ts";
const REPORT_PATH = "fixtures/scp/v0110-int-report.json";
const VECTORS_PATH = "fixtures/scp/golden-vectors-scp4d.json";
const PACK_SHA256 = "94859d7c26939e63f86c426c5c1a6c7309da096532adf2d3ab5eebc04b07b09a";
const V01_QUANTIZED_SHA = "07a3d04147714747a4823e6e934dc6144740eb2f6243e7113106aed06369d6bc";
const V019_REPORT_SHA256 = "b76cbe7d7108df758e632d334027a6359e98bf9b4cd183316371507a83676d7f";
const V018_VECTORS_SHA256 = "5b5776c7aca50e4aa151892f4c8315f31560863085c63ddc209334bbe877d175";
const SEARCH_G = [4, DEFAULT_G] as const;
const WRITE = process.argv.includes("--write");

let passed = 0;
const failures: string[] = [];
function check(name: string, cond: boolean, detail?: string): void {
  if (cond) { passed++; console.log(`PASS ${name}${detail ? `: ${detail}` : ""}`); }
  else { failures.push(name); console.error(`FAIL ${name}${detail ? `: ${detail}` : ""}`); }
}
function throws(fn: () => unknown): boolean { try { fn(); return false; } catch { return true; } }
const sha = (b: Uint8Array | string) => createHash("sha256").update(b).digest("hex");
const r6 = (x: number) => (Number.isFinite(x) ? Number(x.toPrecision(6)) : x);
const hex = (b: Uint8Array) => Buffer.from(b).toString("hex");
const stripComments = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'])\/\/.*$/gm, "$1");

// ---------- 1. Isolation and integer-only / hash-free datapath (static) ----------
{
  const text = readFileSync(join(root, MODEL_PATH), "utf8");
  const code = stripComments(text);
  const imports = [...code.matchAll(/(?:import|export)[^"';]*?from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)|require\s*\(\s*["']([^"']+)["']\s*\)/g)].map((m) => m[1] ?? m[2] ?? m[3]);
  const allowed = new Set(["../src/scp/subsystem", "./scp-v018-integer-model", "./scp-v014-ops"]);
  const bad = imports.filter((s) => !allowed.has(s));
  check("model imports only the v0.1.9 subsystem (types + float fit for host setup), v0.1.8 integer ingest and v0.1.4 op types",
    bad.length === 0, bad.join(", ") || imports.join(", "));
  check("model has no hashing, crypto, clocks, randomness, env, I/O, Level 4 or app references",
    !/createHash|node:crypto|sha256|Date\.now|Math\.random|performance\.now|process\.env|node:fs|level4|src\/app|metamorphic/i.test(code));
  const a = text.indexOf("// <datapath>"), b = text.indexOf("// </datapath>");
  const region = a >= 0 && b > a ? stripComments(text.slice(a, b)) : "";
  const floatTokens = region.match(/Math\.(round|fround|sqrt|abs|trunc|ceil|exp|log|pow)|Float32Array|\.f64\(|\.f32\(|parseFloat|toFixed|getFloat|setFloat|\d\.\d|e-\d/g) ?? [];
  const divisions = region.split("\n").filter((l) => /[^/*]\/[^/*=]/.test(l) && !/Math\.floor\(x \/ P2\[n\]\)/.test(l));
  check("datapath region: no float ops / literals and no division except the power-of-two asr()",
    region.length > 2000 && floatTokens.length === 0 && divisions.length === 0,
    `${region.length} chars; float tokens ${JSON.stringify(floatTokens)}; division lines ${divisions.length}`);
  const outside: string[] = [];
  const SKIP = new Set(["node_modules", ".git", ".next"]);
  const walk = (d: string) => {
    for (const n of readdirSync(d, { withFileTypes: true })) {
      if (SKIP.has(n.name)) continue;
      const p = join(d, n.name), rel = p.slice(root.length + 1);
      if (rel === "scripts") continue;
      if (n.isDirectory()) walk(p);
      else if (/\.(ts|tsx|mts|js|mjs)$/.test(n.name) && /scp-v0110/.test(readFileSync(p, "utf8"))) outside.push(rel);
    }
  };
  walk(root);
  check("nothing outside scripts/ imports the v0.1.10 model (test-only, unwired)", outside.length === 0, outside.join(", ") || "none");
}

// ---------- 2. Existing invariants unchanged ----------
const frames = frameFixtures();
const packEps = { x: BOUNDED_EPS.predicted, y: BOUNDED_EPS.observed, z: BOUNDED_EPS.phi };
check("src/scp/pack.ts unchanged (sha pinned since v0.1.3)", sha(readFileSync(join(root, "src/scp/pack.ts"))) === PACK_SHA256);
check("v0.1 quantized sha unchanged (07a3d041…69d6bc)", sha(encodeQuantized(frames[0].points, packEps).bytes) === V01_QUANTIZED_SHA);
check("v0.1.9 bench report unchanged (sha pinned)", sha(readFileSync(join(root, "fixtures/scp/v019-bench-report.json"))) === V019_REPORT_SHA256);
check("v0.1.8 golden-vectors.json unchanged (sha pinned)", sha(readFileSync(join(root, "fixtures/scp/golden-vectors.json"))) === V018_VECTORS_SHA256);
const V019 = JSON.parse(readFileSync(join(root, "fixtures/scp/v019-bench-report.json"), "utf8"));

// ---------- 3. Unit lemmas ----------
{
  let ok = true;
  const vals = [0, 1, -1, 2, -2, 127, -128, 255, -256, 2 ** 31 - 1, -(2 ** 31), 2 ** 40 + 3, -(2 ** 40) - 3, 2 ** 52 - 1, -(2 ** 52)];
  for (const v of vals) for (const n of [0, 1, 4, 7, 8, 16]) {
    if (BigInt(asr(v, n)) !== (BigInt(v) >> BigInt(n))) ok = false;
    if (Math.abs(v) < 2 ** 36 && BigInt(shl(v, n)) !== (BigInt(v) << BigInt(n))) ok = false;
  }
  check("asr/shl equal BigInt arithmetic shifts on edge values (incl. negatives, ±2^52)", ok);
  let lemma = true, nonzero = true;
  for (let G = 1; G <= 10; G++) {
    const k = 2 ** G - 1;
    for (let r = -6 * 2 ** G; r <= 6 * 2 ** G; r++) {
      if (r <= k && r >= -k) continue;
      const q = asr(r + 2 ** (G - 1), G);
      if (Math.abs(r - shl(q, G)) > 2 ** (G - 1)) lemma = false;
      if (q === 0) nonzero = false;
    }
    // bound: g/2 + k·g < eps  ⇔  1 + 2k < 2^(G+1)  (integer arithmetic)
    if (!(1 + 2 * k < 2 ** (G + 1))) lemma = false;
  }
  check("event lemma: |r − q·2^G| ≤ 2^(G−1) and q ≠ 0 whenever |r| > 2^G − 1; g/2 + (2^G−1)·g < eps (G = 1..10)", lemma && nonzero);
}

// ---------- 4. Energy / area tables (MODEL ESTIMATES, v0.1.5 45 nm assumptions) ----------
const A = defaultAssumptions();
const E = A.energy_pj, AR = A.area_um2;
const ENERGY_LABEL = "MODEL ESTIMATE from the v0.1.5 45 nm assumption table (Horowitz ISSCC 2014 plus labelled assumptions); integer ops priced as int32 add 0.1 pJ / int32 mul 3.1 pJ; state memory priced per byte by working-set size; not silicon, not FPGA.";
type Pj = [number, number];
function intEnergy(o: IntOps, wsBytes: number): Pj {
  const fixed = (o.add + o.shift + o.bit + o.cmp) * E.int32_add.value + o.mul * E.int32_mul.value;
  const sram = sramEnergyPerBytePj(Math.max(wsBytes, 1), A);
  const st = o.state_read + o.state_write, io = o.bytes_in + o.bytes_out;
  return [fixed + io * E.byte_io_low.value + st * sram.low, fixed + io * E.byte_io_high.value + st * sram.high];
}
const ING = ingestOpsPerValue();
const ingestPj: Pj = (() => {
  const c = ING.counts;
  const simple = (c.add + c.sub + c.shift + c.bit + c.branch) * E.int32_add.value;
  return [simple + c.mul * E.mul_low.value + c.div * E.div_low.value + c.round * E.round_low.value,
    simple + c.mul * E.mul_high.value + c.div * E.div_high.value + c.round * E.round_high.value];
})();
type Area = [number, number];
function area(units: { adders: number; muls: number; fpAdders?: number; fpMuls?: number; fpDivs?: number }, sramBytes: number, regBytes: number): Area {
  const logic = units.adders * AR.int32_add.value + units.muls * AR.int32_mul.value + (units.fpAdders ?? 0) * AR.fp32_add.value + (units.fpMuls ?? 0) * AR.fp32_mul.value;
  const div: Area = [(units.fpDivs ?? 0) * AR.fp_div_factor_low.value * AR.fp32_mul.value, (units.fpDivs ?? 0) * AR.fp_div_factor_high.value * AR.fp32_mul.value];
  return [logic + div[0] + sramBytes * 8 * AR.sram_per_bit_low.value + regBytes * 8 * AR.ff_per_bit_low.value,
    logic + div[1] + sramBytes * 8 * AR.sram_per_bit_high.value + regBytes * 8 * AR.ff_per_bit_high.value];
}
const REG_BYTES = 32;

// ---------- 5. Op-count formulas (closed form from plan + decoded codes + stream layout) ----------
function codesChanged(dec: readonly Float64Array[], t: number, e: number): boolean { return dec[t][e] !== (t === 0 ? 0 : dec[t - 1][e]); }
function varintBytes(n: number): number { let s = 1; while (n >= 128) { n = Math.floor(n / 128); s++; } return s; }
const zz = (n: number) => (n >= 0 ? 2 * n : -2 * n - 1);

function formulaScp4d(side: "encode" | "decode", cfg: IntConfig, p: PlanSummary, dec: readonly Float64Array[], perFrame: readonly FrameEvents[], payloadBytes: number): IntOps {
  const o = zeroIntOps();
  const { D, T } = p;
  const isTarget = new Uint8Array(D); for (const e of p.targets) isTarget[e] = 1;
  const isSource = new Uint8Array(D); for (const e of p.sources) isSource[e] = 1;
  const r = cfg.rank, allDense = D <= ALL_DENSE_MAX_D;
  for (let t = 0; t < T; t++) {
    const f = perFrame[t];
    const evEl = new Uint8Array(D); for (const i of f.positions) evEl[p.order[i]] = 1;
    for (let e = 0; e < D; e++) {
      if (isTarget[e]) { o.add++; o.shift++; o.state_read += 8; }
      else if (r > 0) { o.mul += r; o.add += r + 2; o.shift++; o.state_read += 4 + 2 * r; }
      if (cfg.predictor !== "zero") o.state_read += 4;
      if (cfg.predictor === "linear") { o.state_read += 4; if (t >= 2) { o.shift++; o.add++; } }
      if (p.hasBase[e] && cfg.predictor !== "zero") o.add++;
      if (cfg.predictor === "last" && evEl[e]) { o.state_write += 4; if (p.hasBase[e]) o.add++; }
      if (cfg.predictor === "linear") { o.state_write += 8; if (p.hasBase[e]) o.add++; }
      if (isSource[e]) {
        if (!p.cIsH1Source[e]) o.state_read += 4;
        o.add++; o.cmp++;
        if (codesChanged(dec, t, e)) {
          if (!p.cIsH1Source[e]) o.state_write += 4;
          o.mul += p.fanout[e]; o.add += p.fanout[e]; o.state_read += 8 * p.fanout[e]; o.state_write += 8 * p.fanout[e];
        }
      }
      if (side === "decode") { o.cmp++; if (evEl[e]) { o.add++; o.shift++; } }
      else { o.add++; o.cmp += 2; if (evEl[e]) { o.add += 2; o.shift += 2; o.state_write += 8; if (!allDense) { o.cmp += 4; o.add += 3; } } }
    }
    const n = f.positions.length;
    if (side === "encode") {
      if (!allDense) { o.add++; o.cmp++; }
      if (f.dense) { o.cmp += D; o.state_read += 8 * n; } else { o.add += n; o.state_read += 8 * n; }
    } else {
      if (!allDense) { o.shift++; o.bit++; }
      if (!f.dense && n > 0) o.add += 1 + 2 * (n - 1);
    }
    // svarints: dense → D, sparse → n ; varint bytes are charged per payload byte below
    const sv = f.dense ? D : n;
    o.shift += sv; o.bit += sv;
  }
  const vb = payloadBytes - 1; // minus the layout byte
  o.shift += vb; o.bit += vb; o.cmp += vb;
  if (side === "encode") o.bytes_out = payloadBytes; else o.bytes_in = payloadBytes;
  return o;
}

function formulaEventDriven(p: PlanSummary, perFrame: readonly FrameEvents[], payloadBytes: number): IntOps {
  const o = zeroIntOps();
  const { D } = p;
  const nT = p.targets.length;
  const isTarget = new Uint8Array(D); for (const e of p.targets) isTarget[e] = 1;
  const allDense = D <= ALL_DENSE_MAX_D;
  o.add += nT; o.shift += nT; o.state_read += 8 * nT; o.state_write += 4 * nT;
  for (const f of perFrame) {
    const n = f.positions.length;
    if (!allDense) { o.shift++; o.bit++; }
    if (f.dense) o.cmp += D; else if (n > 0) o.add += 1 + 2 * (n - 1);
    const sv = f.dense ? D : n;
    o.shift += sv; o.bit += sv;
    let U = 0;
    const dirtyT = new Set<number>();
    for (const i of f.positions) {
      const e = p.order[i];
      o.shift++; o.add++; o.state_read += 4; o.state_write += 4;
      if (isTarget[e]) { U++; dirtyT.add(e); }
      else for (const tg of p.fanoutTargets[e]) { o.mul++; o.add++; o.state_read += 8; o.state_write += 8; U++; dirtyT.add(tg); }
    }
    const N = dirtyT.size;
    o.cmp += U; o.bit += U; o.state_read += U; o.bit += N; o.state_write += 3 * N;
    o.add += 2 * N; o.shift += N; o.bit += N; o.state_read += 14 * N; o.state_write += 5 * N;
  }
  const vb = payloadBytes - 1;
  o.shift += vb; o.bit += vb; o.cmp += vb;
  o.bytes_in = payloadBytes;
  return o;
}

function formulaBaseline(side: "encode" | "decode", delta: boolean, codes: readonly Float64Array[], payloadBytes: number): IntOps {
  const o = zeroIntOps();
  const T = codes.length, D = codes[0].length;
  o.shift += T * D + payloadBytes; o.bit += T * D + payloadBytes; o.cmp += payloadBytes;
  if (delta) {
    o.state_read += 4 * T * D; o.add += T * D; o.cmp += T * D;
    for (let t = 0; t < T; t++) for (let e = 0; e < D; e++) if (codesChanged(codes, t, e)) o.state_write += 4;
  }
  if (side === "encode") o.bytes_out = payloadBytes; else o.bytes_in = payloadBytes;
  return o;
}
const sub = (a: IntOps, b: IntOps): IntOps => Object.fromEntries(Object.keys(a).map((k) => [k, a[k as keyof IntOps] - b[k as keyof IntOps]])) as unknown as IntOps;
const sameOps = (a: IntOps, b: IntOps) => (Object.keys(a) as (keyof IntOps)[]).every((k) => a[k] === b[k]);
const diffOps = (a: IntOps, b: IntOps) => (Object.keys(a) as (keyof IntOps)[]).filter((k) => a[k] !== b[k]).map((k) => `${k} ${a[k]}≠${b[k]}`).join(", ");

// ---------- 6. Bench ----------
type Fx = { name: string; surface: StateSurface4D; eps: number[]; tasks: DecisionTask4D[] };
const envMain = makeEnvironment({ nx: 16, ny: 16, nz: 2, T: 64 });
const envLong = makeEnvironment({ nx: 16, ny: 16, nz: 2, T: 256 });
const FIXTURES: Fx[] = [
  ...frames.map((f) => ({ name: f.name, surface: f.surfaceRel, eps: [...FRAME_EPS], tasks: FRAME_TASKS })),
  { name: "env-16x16x2-T64", surface: envMain.surface, eps: [...ENV_EPS], tasks: ENV_TASKS },
  { name: "env-16x16x2-T256", surface: envLong.surface, eps: [...ENV_EPS], tasks: ENV_TASKS },
];
const inputOf = (s: StateSurface4D, eps: number[]): IntStreamInput => ({ shape: s.shape, times: s.times, meta: s.meta, eps, relations: s.relations });
const toValues = (codes: readonly Float64Array[], channels: number, eps: readonly number[], G: number) =>
  codes.map((f) => Float64Array.from(f, (c, e) => c * (eps[e % channels] / 2 ** G))); // back-end only (tasks / fidelity)

function maxErrOverEps(s: StateSurface4D, recon: readonly Float64Array[], eps: readonly number[]): { perChannel: number[]; ok: boolean } {
  const C = s.shape.channels, m = new Array(C).fill(0);
  let ok = true;
  s.frames.forEach((f, t) => f.forEach((v, e) => { const d = Math.abs(v - recon[t][e]); if (d > eps[e % C]) ok = false; m[e % C] = Math.max(m[e % C], d / eps[e % C]); }));
  return { perChannel: m.map(r6), ok };
}
function dirty(codes: readonly Float64Array[]): number {
  let d = 0, n = 0;
  for (let t = 1; t < codes.length; t++) for (let e = 0; e < codes[t].length; e++) { n++; if (codes[t][e] !== codes[t - 1][e]) d++; }
  return n ? d / n : 0;
}
const widthsOf = (c: Census) => Object.fromEntries((Object.keys(c) as RegName[]).map((k) => [k, c[k] === 0 ? 0 : signedBits(c[k])]));
function wsDecode(r: IntEncodeResult): number { const s = r.stateBytes; return s.H1 + s.H2 + s.C + s.ACC + s.mean + s.Bq + s.Aq; }

type Side = { ops_per_ef: number; pj_per_ef: Pj; pj_per_ef_incl_ingest?: Pj; state_bytes_per_ef: number; working_set_bytes: number; area_um2: Area };
type Row = {
  strategy: string; bytes: number; ratio_vs_full_q: number; config?: IntConfig; events?: number; event_fraction?: number; dirty_fraction: number;
  max_err_over_eps: number[]; bound_ok: boolean; decisions: { task: string; agreement: number; slots: number; safe_slots: number; safe_disagree: number }[];
  encode: Side; decode: Side; decode_resident_surface?: Side; max_register_bits: Record<string, number>; sha256_16: string;
};
const results: Record<string, { T: number; D: number; label: string; rows: Row[]; v019: Record<string, unknown>; search: { cfg: IntConfig; bytes: number; events: number }[]; lowrank?: unknown; g_sweep: unknown[] }> = {};
const runsByFixture: Record<string, { best: IntEncodeResult }> = {};
const latency: string[] = [];

for (const fx of FIXTURES) {
  const s = fx.surface, C = s.shape.channels, T = s.frames.length, D = s.frames[0].length, TD = T * D;
  const input = inputOf(s, fx.eps);
  const codesByG = new Map<number, Float64Array[]>();
  for (const G of SEARCH_G) codesByG.set(G, ingestCodes(s.frames, C, fx.eps, G));
  const q0 = ingestCodes(s.frames, C, fx.eps, 0);
  // ingest == pack.ts quantizer on every value (v0.1.8 integer RN quantizer, bit-exact)
  let ingestOk = true;
  for (const [G, codes] of [...codesByG.entries(), [0, q0] as const]) {
    codes.forEach((f, t) => f.forEach((x, e) => { const g = fx.eps[e % C] / 2 ** G; const m = Math.round(s.frames[t][e] / g); if (x !== (m === 0 ? 0 : m)) ingestOk = false; }));
  }
  check(`${fx.name}: integer ingest codes equal Math.round(v/g) (pack.ts rule) on all ${TD * (SEARCH_G.length + 1)} values`, ingestOk);

  // search over G and the v0.1.9 configuration space (rank × relations × predictor)
  let best: IntEncodeResult | null = null;
  const tried: { cfg: IntConfig; bytes: number; events: number }[] = [];
  for (const G of SEARCH_G) {
    const r = searchIntScp4d(input, codesByG.get(G)!, G, INT_RANKS);
    tried.push(...r.tried);
    if (!best || r.best.bytes.length < best.bytes.length) best = r.best;
  }
  const b = best!;
  runsByFixture[fx.name] = { best: b };
  const dec = decodeIntScp4d(b.bytes, s.relations, { verifyAccumulators: true });
  check(`${fx.name}: S4DI decodes from bytes + relation schema to exactly the encoder's integer codes (incremental relation accumulators == full recompute)`,
    dec.codes.every((f, t) => f.every((v, e) => v === b.decoded[t][e])) && dec.events === b.events
    && dec.times.every((x, i) => x === s.times[i]) && (!s.meta || (dec.meta!.verdicts.every((v, i) => v === s.meta!.verdicts[i]) && dec.meta!.steps.every((v, i) => v === s.meta!.steps[i]))));
  const recon = toValues(dec.codes, C, fx.eps, b.cfg.G);
  const err = maxErrOverEps(s, recon, fx.eps);
  const bound = 1 - 2 ** -(b.cfg.G + 1);
  check(`${fx.name}: |v − v′| ≤ eps on every element-frame (proved bound eps·(1 − 2^−(G+1)) = ${bound.toFixed(4)}·eps)`,
    err.ok && err.perChannel.every((m) => m <= bound + 1e-9), `max |err|/eps per channel ${err.perChannel.join("/")}; G=${b.cfg.G}`);
  const again = encodeIntScp4d(input, codesByG.get(b.cfg.G)!, b.cfg, b.base);
  check(`${fx.name}: integer encode is deterministic`, sha(again.bytes) === sha(b.bytes));

  // census ≤ analytic bound ≤ declared width
  let xMax = 0; for (const f of codesByG.get(b.cfg.G)!) for (const x of f) xMax = Math.max(xMax, Math.abs(x));
  const bounds = analyticBounds(b.cfg, xMax, b.rels, b.base);
  const cen: Census = Object.fromEntries((Object.keys(DECLARED_WIDTHS) as RegName[]).map((k) => [k, Math.max(b.census[k], dec.census[k])])) as Census;
  const over = (Object.keys(DECLARED_WIDTHS) as RegName[]).filter((k) => cen[k] > bounds[k] || (bounds[k] > 0 && signedBits(bounds[k]) > DECLARED_WIDTHS[k]));
  check(`${fx.name}: register census ≤ analytic bound ≤ declared width (overflow proof)`, over.length === 0,
    over.join(", ") || (Object.keys(DECLARED_WIDTHS) as RegName[]).filter((k) => cen[k] > 0).map((k) => `${k} ${signedBits(cen[k])}/${signedBits(bounds[k])}/${DECLARED_WIDTHS[k]}b`).join(" "));

  // op counts: instrumented == formula (payload); header counted separately
  const encPayload = sub(b.ops, b.header_ops), decPayload = sub(dec.ops, dec.header_ops);
  const pb = b.bytes.length - b.header_bytes;
  const fEnc = formulaScp4d("encode", b.cfg, b.plan, b.decoded, b.perFrame, pb);
  const fDec = formulaScp4d("decode", b.cfg, dec.plan, dec.codes, dec.perFrame, pb);
  check(`${fx.name}: scp4d-int instrumented encode/decode op counts == closed-form formula`, sameOps(encPayload, fEnc) && sameOps(decPayload, fDec),
    `${diffOps(encPayload, fEnc)} | ${diffOps(decPayload, fDec)}`);

  // baselines (integer models) — byte-identical to v0.1.9 subsystem streams
  const base: Record<"full_q" | "delta", { enc: ReturnType<typeof encodeIntBaseline>; dec: ReturnType<typeof decodeIntBaseline> }> = {} as never;
  for (const st of ["full_q", "delta"] as const) {
    const enc = encodeIntBaseline(input, q0, st), d = decodeIntBaseline(enc.bytes);
    base[st] = { enc, dec: d };
    const v19 = stateCompressor.compress(s, st, { eps: fx.eps }).bytes;
    const pbb = enc.bytes.length - enc.header_bytes;
    check(`${fx.name}: integer ${st} stream is byte-identical to v0.1.9 ${st}; decodes to the ingest codes; op counts == formula`,
      sha(v19) === sha(enc.bytes) && d.codes.every((f, t) => f.every((v, e) => v === q0[t][e]))
      && sameOps(sub(enc.ops, enc.header_ops), formulaBaseline("encode", st === "delta", q0, pbb)) && sameOps(sub(d.ops, d.header_ops), formulaBaseline("decode", st === "delta", q0, pbb)));
  }

  // v0.1.9 scp4d bytes unchanged (re-encode with the committed config, compare to the committed sha prefix)
  const v19rows = V019.fixtures[fx.name].rows as { strategy: string; bytes: number; scp4d: { rank: number; relations: boolean; predictor: "zero" | "last" | "linear" } | null; sha256_16: string; max_abs_err: number[]; decisions: { task: string; agreement: number }[]; energy_estimate_pj_per_element_frame: { encode: number[]; decode: number[] }; encode_ops_per_element_frame: number; decode_ops_per_element_frame: number; decode_working_set_bytes: number; encode_working_set_bytes: number; dirty_fraction: number }[];
  const v19 = v19rows.find((r) => r.strategy === "scp4d")!;
  const v19bytes = stateCompressor.compress(s, "scp4d", { eps: fx.eps, scp4d: v19.scp4d! }).bytes;
  check(`${fx.name}: v0.1.9 scp4d stream unchanged (sha prefix ${v19.sha256_16}); S4DI is a new format next to it, not a replacement`,
    sha(v19bytes).slice(0, 16) === v19.sha256_16 && v19bytes.length === v19.bytes && hex(b.bytes.slice(0, 4)) !== hex(v19bytes.slice(0, 4))
    && throws(() => stateReconstructor.reconstruct(b.bytes, s.relations)) && throws(() => decodeIntScp4d(v19bytes, s.relations)));

  // decisions vs v0.1.9
  const decisionsOf = (rc: readonly Float64Array[]) => fx.tasks.map((task) => { const d = decisionAgreement(task, s, rc); return { task: d.task, agreement: r6(d.agreement), slots: d.slots, safe_slots: d.safe_slots, safe_disagree: d.safe_disagree }; });
  const dInt = decisionsOf(recon);
  const v19Of = (task: string) => v19.decisions.find((x) => x.task === task)!.agreement;
  const isEnv = fx.name.startsWith("env");
  // Guarantee: no flip where the margin exceeds the bound (all fixtures). Equality with v0.1.9 is asserted where
  // v0.1.9 itself was margin-protected (environment threshold tasks: 100%); elsewhere differences are reported.
  check(`${fx.name}: scp4d-int never flips a margin-safe decision${isEnv ? "; environment threshold tasks stay at 100% like v0.1.9" : ""}`,
    dInt.every((d) => d.safe_disagree === 0) && (!isEnv || dInt.filter((d) => !d.task.startsWith("hotspot")).every((d) => d.agreement === 1 && v19Of(d.task) === 1)),
    dInt.map((d) => `${d.task}=${d.agreement} (v0.1.9 ${v19Of(d.task)}; ${d.safe_slots}/${d.slots} margin-safe)`).join("; "));

  // rows
  const qVals = toValues(q0, C, fx.eps, 0);
  const ingestPerEf = ingestPj;
  const sideOf = (ops: IntOps, ws: number, ar: Area, withIngest: boolean): Side => {
    const pj = intEnergy(ops, ws);
    return {
      ops_per_ef: r6(intOpsTotal(ops) / TD), pj_per_ef: [r6(pj[0] / TD), r6(pj[1] / TD)],
      ...(withIngest ? { pj_per_ef_incl_ingest: [r6(pj[0] / TD + ingestPerEf[0]), r6(pj[1] / TD + ingestPerEf[1])] as Pj } : {}),
      state_bytes_per_ef: r6((ops.state_read + ops.state_write) / TD), working_set_bytes: ws, area_um2: [r6(ar[0]), r6(ar[1])],
    };
  };
  const fullQ = base.full_q, delta = base.delta;
  const scpWsDec = wsDecode(b), scpWsEnc = scpWsDec + b.stateBytes.event_buffer;
  const scpUnits = { adders: 4 + (b.cfg.relations ? 1 : 0) + (b.cfg.rank > 0 ? 1 : 0), muls: (b.cfg.relations ? 1 : 0) + (b.cfg.rank > 0 ? 1 : 0) };
  const rows: Row[] = [
    {
      strategy: "full_q (integer)", bytes: fullQ.enc.bytes.length, ratio_vs_full_q: 1, dirty_fraction: r6(dirty(q0)),
      max_err_over_eps: maxErrOverEps(s, qVals, fx.eps).perChannel, bound_ok: maxErrOverEps(s, qVals, fx.eps).ok, decisions: decisionsOf(qVals),
      encode: sideOf(fullQ.enc.ops, 0, area({ adders: 1, muls: 0 }, 0, REG_BYTES), true), decode: sideOf(fullQ.dec.ops, 0, area({ adders: 1, muls: 0 }, 0, REG_BYTES), false),
      max_register_bits: widthsOf(fullQ.enc.census), sha256_16: sha(fullQ.enc.bytes).slice(0, 16),
    },
    {
      strategy: "delta (integer)", bytes: delta.enc.bytes.length, ratio_vs_full_q: r6(fullQ.enc.bytes.length / delta.enc.bytes.length), dirty_fraction: r6(dirty(q0)),
      max_err_over_eps: maxErrOverEps(s, qVals, fx.eps).perChannel, bound_ok: maxErrOverEps(s, qVals, fx.eps).ok, decisions: decisionsOf(qVals),
      encode: sideOf(delta.enc.ops, 4 * D, area({ adders: 2, muls: 0 }, 4 * D, REG_BYTES), true), decode: sideOf(delta.dec.ops, 4 * D, area({ adders: 2, muls: 0 }, 4 * D, REG_BYTES), false),
      max_register_bits: widthsOf(delta.enc.census), sha256_16: sha(delta.enc.bytes).slice(0, 16),
    },
    {
      strategy: "scp4d-int (v0.1.10)", bytes: b.bytes.length, ratio_vs_full_q: r6(fullQ.enc.bytes.length / b.bytes.length), config: b.cfg,
      events: b.events, event_fraction: r6(b.events / TD), dirty_fraction: r6(dirty(dec.codes)),
      max_err_over_eps: err.perChannel, bound_ok: err.ok, decisions: dInt,
      encode: sideOf(b.ops, scpWsEnc, area(scpUnits, scpWsEnc, REG_BYTES), true), decode: sideOf(dec.ops, scpWsDec, area(scpUnits, scpWsDec, REG_BYTES), false),
      max_register_bits: widthsOf(cen), sha256_16: sha(b.bytes).slice(0, 16),
    },
  ];
  // Resident-surface contract: the decoder keeps S_t in memory for downstream compute.
  //   full_q must write every value (4 B per element-frame); delta's previous-value memory already is S_t;
  //   scp4d-int uses the event-driven decoder on its rank-0 / last-value stream (the relations + event path).
  rows[0].decode_resident_surface = sideOf({ ...fullQ.dec.ops, state_write: fullQ.dec.ops.state_write + 4 * TD }, 4 * D, area({ adders: 1, muls: 0 }, 4 * D, REG_BYTES), false);
  rows[1].decode_resident_surface = rows[1].decode;
  for (const variant of [{ name: "scp4d-int event-driven +relations", relations: true }, { name: "scp4d-int event-driven temporal-only", relations: false }]) {
    const edCfg: IntConfig = { rank: 0, relations: variant.relations && s.relations.length > 0, predictor: "last", G: b.cfg.G };
    const edEnc = b.cfg.rank === 0 && b.cfg.predictor === "last" && b.cfg.relations === edCfg.relations ? b : encodeIntScp4d(input, codesByG.get(b.cfg.G)!, edCfg, null);
    const ed = decodeIntScp4dEventDriven(edEnc.bytes, s.relations);
    const edDense = decodeIntScp4d(edEnc.bytes, s.relations);
    const edPayload = sub(ed.ops, ed.header_ops);
    const fEd = formulaEventDriven(ed.plan, ed.perFrame, edEnc.bytes.length - edEnc.header_bytes);
    check(`${fx.name}: ${variant.name} decoder (resident surface) yields exactly the dense decoder's codes; op counts == formula`,
      ed.codes.every((f, t) => f.every((v, e) => v === edDense.codes[t][e] && v === edEnc.decoded[t][e])) && sameOps(edPayload, fEd), diffOps(edPayload, fEd));
    const edRecon = toValues(ed.codes, C, fx.eps, edEnc.cfg.G);
    const edErr = maxErrOverEps(s, edRecon, fx.eps);
    const edUnits = { adders: 4 + (edEnc.cfg.relations ? 1 : 0), muls: edEnc.cfg.relations ? 1 : 0 };
    const edWsEnc = wsDecode(edEnc) + edEnc.stateBytes.event_buffer;
    const edDec = sideOf(ed.ops, ed.working_set_bytes, area(edUnits, ed.working_set_bytes, REG_BYTES), false);
    rows.push({
      strategy: variant.name, bytes: edEnc.bytes.length, ratio_vs_full_q: r6(fullQ.enc.bytes.length / edEnc.bytes.length), config: edEnc.cfg,
      events: edEnc.events, event_fraction: r6(edEnc.events / TD), dirty_fraction: r6(dirty(ed.codes)),
      max_err_over_eps: edErr.perChannel, bound_ok: edErr.ok, decisions: decisionsOf(edRecon),
      encode: sideOf(edEnc.ops, edWsEnc, area(edUnits, edWsEnc, REG_BYTES), true), decode: edDec, decode_resident_surface: edDec,
      max_register_bits: widthsOf(Object.fromEntries((Object.keys(DECLARED_WIDTHS) as RegName[]).map((k) => [k, Math.max(edEnc.census[k], ed.census[k])])) as Census),
      sha256_16: sha(edEnc.bytes).slice(0, 16),
    });
    check(`${fx.name}: ${variant.name} meets eps and never flips a margin-safe decision`, edErr.ok && rows[rows.length - 1].decisions.every((d) => d.safe_disagree === 0));
  }
  // v0.1.9 float scp4d / delta / full_q, as committed (float model; different accounting basis)
  const v19area = (ws: number, enc: boolean): Area => area({ adders: 2, muls: 0, fpAdders: 2, fpMuls: 1, fpDivs: enc ? 1 : 0 }, ws, REG_BYTES);
  const v019 = Object.fromEntries(["full_q", "delta", "scp4d"].map((st) => {
    const r = v19rows.find((x) => x.strategy === st)!;
    return [st, { bytes: r.bytes, config: r.scp4d, max_abs_err: r.max_abs_err, decisions: r.decisions.map((d) => ({ task: d.task, agreement: d.agreement })),
      encode_ops_per_ef: r.encode_ops_per_element_frame, decode_ops_per_ef: r.decode_ops_per_element_frame,
      pj_per_ef: r.energy_estimate_pj_per_element_frame, dirty_fraction: r.dirty_fraction,
      area_um2_float_datapath: st === "scp4d" ? { encode: v19area(r.encode_working_set_bytes, true).map(r6), decode: v19area(r.decode_working_set_bytes, false).map(r6) } : undefined,
      basis: "v0.1.9 float model (f64 state, FP ops, ingest division inside encode); copied from fixtures/scp/v019-bench-report.json" }];
  }));
  // G sweep on the chosen configuration
  const gSweep = [1, 2, 4, 6, 8].map((G) => {
    const codes = codesByG.get(G) ?? ingestCodes(s.frames, C, fx.eps, G);
    const r = encodeIntScp4d(input, codes, { ...b.cfg, G }, b.cfg.rank > 0 ? undefined : null);
    return { G, bytes: r.bytes.length, events: r.events, bound_over_eps: r6(1 - 2 ** -(G + 1)), code_bits: signedBits(r.census.code) };
  });
  results[fx.name] = { T, D, label: s.label, rows, v019, search: tried.map((x) => ({ cfg: x.cfg, bytes: x.bytes, events: x.events })), g_sweep: gSweep };

  // latency (stdout only)
  const t0 = performance.now(); for (let i = 0; i < 3; i++) encodeIntScp4d(input, codesByG.get(b.cfg.G)!, b.cfg, b.base); const te = (performance.now() - t0) / 3;
  const t1 = performance.now(); for (let i = 0; i < 3; i++) decodeIntScp4d(b.bytes, s.relations); const td = (performance.now() - t1) / 3;
  const t2 = performance.now(); for (let i = 0; i < 3; i++) decodeIntBaseline(delta.enc.bytes); const tdd = (performance.now() - t2) / 3;
  latency.push(`${fx.name.padEnd(18)} scp4d-int enc ${te.toFixed(2)} ms / dec ${td.toFixed(2)} ms | delta-int dec ${tdd.toFixed(2)} ms (instrumented model, mean of 3)`);
}

// ---------- 7. Low-rank decision (env T=256 is the only fixture where the search picks rank > 0) ----------
const lowrank = (() => {
  const name = "env-16x16x2-T256", fx = FIXTURES.find((f) => f.name === name)!;
  const s = fx.surface, T = s.frames.length, D = s.frames[0].length, TD = T * D;
  const input = inputOf(s, fx.eps);
  const best = runsByFixture[name].best;
  const codes = ingestCodes(s.frames, s.shape.channels, fx.eps, best.cfg.G);
  const r0 = encodeIntScp4d(input, codes, { ...best.cfg, rank: 0 }, null);
  const d0 = decodeIntScp4d(r0.bytes, s.relations), dB = decodeIntScp4d(best.bytes, s.relations);
  const e0 = intEnergy(d0.ops, wsDecode(r0)), eB = intEnergy(dB.ops, wsDecode(best));
  const ee0 = intEnergy(r0.ops, wsDecode(r0) + r0.stateBytes.event_buffer), eeB = intEnergy(best.ops, wsDecode(best) + best.stateBytes.event_buffer);
  return {
    fixture: name,
    with_low_rank: { config: best.cfg, bytes: best.bytes.length, events: best.events, dirty_fraction: r6(dirty(dB.codes)), decode_pj_per_ef: [r6(eB[0] / TD), r6(eB[1] / TD)], encode_pj_per_ef: [r6(eeB[0] / TD), r6(eeB[1] / TD)], decode_ops_per_ef: r6(intOpsTotal(dB.ops) / TD), decode_working_set_bytes: wsDecode(best), host_fit: "float SVD on host (batch, whole window); not in the datapath" },
    relations_event_only: { config: r0.cfg, bytes: r0.bytes.length, events: r0.events, dirty_fraction: r6(dirty(d0.codes)), decode_pj_per_ef: [r6(e0[0] / TD), r6(e0[1] / TD)], encode_pj_per_ef: [r6(ee0[0] / TD), r6(ee0[1] / TD)], decode_ops_per_ef: r6(intOpsTotal(d0.ops) / TD), decode_working_set_bytes: wsDecode(r0), host_fit: "none (streaming)" },
    byte_saving_of_low_rank: r6(1 - best.bytes.length / r0.bytes.length),
    decode_energy_ratio_low_rank_over_rank0: r6(eB[0] / e0[0]),
  };
})();
check("low-rank decision: in fixed point the rank>0 base stays within eps (bound is base-independent) but costs more decode energy than it saves in bytes",
  lowrank.with_low_rank.config.rank > 0 && lowrank.byte_saving_of_low_rank > 0 && lowrank.decode_energy_ratio_low_rank_over_rank0 > 1,
  `${lowrank.fixture}: rank ${lowrank.with_low_rank.config.rank} ${lowrank.with_low_rank.bytes} B vs rank 0 ${lowrank.relations_event_only.bytes} B (−${(100 * lowrank.byte_saving_of_low_rank).toFixed(1)}% bytes), decode ${lowrank.with_low_rank.decode_pj_per_ef.join("–")} vs ${lowrank.relations_event_only.decode_pj_per_ef.join("–")} pJ/ef (${lowrank.decode_energy_ratio_low_rank_over_rank0}×), dirty ${lowrank.with_low_rank.dirty_fraction} vs ${lowrank.relations_event_only.dirty_fraction}`);

// ---------- 8. Compute-energy verdict (model estimates) ----------
const rowOf = (n: string, st: string) => results[n].rows.find((r) => r.strategy.startsWith(st))!;
const NAMES = FIXTURES.map((f) => f.name);
const ENV_NAMES = ["env-16x16x2-T64", "env-16x16x2-T256"];
const SCP = "scp4d-int (v0.1.10)", EDR = "scp4d-int event-driven +relations", EDT = "scp4d-int event-driven temporal-only";
const v19dec = (n: string) => (results[n].v019.scp4d as { pj_per_ef: { decode: number[] } }).pj_per_ef.decode[0];
const v19enc = (n: string) => (results[n].v019.scp4d as { pj_per_ef: { encode: number[] } }).pj_per_ef.encode[0];
const verdictRows = NAMES.map((n) => {
  const res = (st: string) => rowOf(n, st).decode_resident_surface!.pj_per_ef[0];
  const so = { scp4d_int_byte_optimal: rowOf(n, SCP).decode.pj_per_ef[0], delta: rowOf(n, "delta").decode.pj_per_ef[0], full_q: rowOf(n, "full_q").decode.pj_per_ef[0], v019_scp4d_float: v19dec(n) };
  const rs = { event_driven_relations: res(EDR), event_driven_temporal_only: res(EDT), delta: res("delta"), full_q: res("full_q") };
  const enc = (st: string) => rowOf(n, st).encode.pj_per_ef_incl_ingest![0];
  const en = { scp4d_int_byte_optimal: enc(SCP), event_driven_relations: enc(EDR), event_driven_temporal_only: enc(EDT), delta: enc("delta"), full_q: enc("full_q"), v019_scp4d_float: v19enc(n) };
  const bytes = { scp4d_int_byte_optimal: rowOf(n, SCP).bytes, event_driven_relations: rowOf(n, EDR).bytes, event_driven_temporal_only: rowOf(n, EDT).bytes, delta: rowOf(n, "delta").bytes, full_q: rowOf(n, "full_q").bytes };
  return {
    fixture: n, bytes,
    decode_stream_out_pj_low: so, decode_resident_surface_pj_low: rs, encode_incl_ingest_pj_low: en,
    scp4d_int_over_v019_decode: r6(so.scp4d_int_byte_optimal / so.v019_scp4d_float),
    stream_out_beats_full_q: so.scp4d_int_byte_optimal < so.full_q,
    resident_temporal_beats_both: rs.event_driven_temporal_only < rs.delta && rs.event_driven_temporal_only < rs.full_q,
    resident_relations_beats_both: rs.event_driven_relations < rs.delta && rs.event_driven_relations < rs.full_q,
    encode_temporal_beats_delta: en.event_driven_temporal_only < en.delta,
    encode_temporal_beats_full_q: en.event_driven_temporal_only < en.full_q,
  };
});
const vr = (n: string) => verdictRows.find((v) => v.fixture === n)!;
const allBeatV019 = verdictRows.every((v) => v.scp4d_int_over_v019_decode < 1);
const soNever = verdictRows.every((v) => !v.stream_out_beats_full_q);
const resTemporalEnv = ENV_NAMES.every((n) => vr(n).resident_temporal_beats_both);
const resRelEnv = ENV_NAMES.some((n) => vr(n).resident_relations_beats_both);
const resFrames = verdictRows.filter((v) => !ENV_NAMES.includes(v.fixture)).some((v) => v.resident_temporal_beats_both || v.resident_relations_beats_both);
const encDeltaEnv = ENV_NAMES.every((n) => vr(n).encode_temporal_beats_delta), encFqEnv = ENV_NAMES.every((n) => vr(n).encode_temporal_beats_full_q);
// System view: stream bytes leave the chip (DRAM-class link, Horowitz 1.3–2.6 nJ / 64 bit). Labelled scenario.
const dramPjPerByte: Pj = [E.dram_64b_low.value / 8, E.dram_64b_high.value / 8];
const systemView = NAMES.map((n) => {
  const TD = results[n].T * results[n].D;
  const sys = (st: string) => { const r = rowOf(n, st); const d = r.decode_resident_surface!; return [r6(d.pj_per_ef[0] + (r.bytes / TD) * dramPjPerByte[0]), r6(d.pj_per_ef[1] + (r.bytes / TD) * dramPjPerByte[1])]; };
  return { fixture: n, decode_resident_plus_offchip_stream_pj_per_ef: { event_driven_relations: sys(EDR), event_driven_temporal_only: sys(EDT), delta: sys("delta"), full_q: sys("full_q") } };
});
const sysRelEnv = ENV_NAMES.every((n) => { const v = systemView.find((x) => x.fixture === n)!.decode_resident_plus_offchip_stream_pj_per_ef; return v.event_driven_relations[0] < Math.min(v.full_q[0], v.delta[0], v.event_driven_temporal_only[0]); });
const e64 = vr("env-16x16x2-T64");
const overall = resTemporalEnv && !resRelEnv ? "MIXED" : resTemporalEnv ? "HOLDS (environment)" : "FAILS";
const verdict = {
  claim: "4D-SCP lowers compute energy per element-frame versus conventional full-state (full_q) and delta processing, without losing the agent's decisions",
  overall,
  resident_surface_decode: resTemporalEnv
    ? `HOLDS on the environment for the temporal-only event path (rank 0, last-value hold, event-driven decoder): ${e64.decode_resident_surface_pj_low.event_driven_temporal_only} pJ/ef vs delta ${e64.decode_resident_surface_pj_low.delta} and full_q ${e64.decode_resident_surface_pj_low.full_q} at T=64, with a stream ${(e64.bytes.full_q / e64.bytes.event_driven_temporal_only).toFixed(2)}× smaller than full_q. ${resRelEnv ? "Adding relations also holds." : `It FAILS for the byte-optimal path with relations (${e64.decode_resident_surface_pj_low.event_driven_relations} pJ/ef): every source event fans out into accumulator read-modify-writes and a multiply, so relations buy ${(e64.bytes.event_driven_temporal_only / e64.bytes.event_driven_relations).toFixed(2)}× fewer bytes for ~${(e64.decode_resident_surface_pj_low.event_driven_relations / e64.decode_resident_surface_pj_low.event_driven_temporal_only).toFixed(0)}× the decode energy.`}`
    : "FAILS on the environment",
  frame_fixtures: resFrames ? "holds on some single-cell frame fixtures" : "FAILS on the single-cell frame fixtures (v0.1, Medicare, B256, B4096): almost every element changes every frame, so event-driven bookkeeping only adds cost",
  stream_out_decode: soNever ? "FAILS: when every decoded value must be streamed out each frame, no scp4d-int path beats full_q, which keeps no state" : "beats full_q on some fixtures",
  encode: `${encDeltaEnv ? "HOLDS vs delta" : "FAILS vs delta"} and ${encFqEnv ? "HOLDS vs full_q" : "FAILS vs full_q"} on the environment (temporal-only path, incl. the shared ingest quantizer): the encoder must still read the hold state for every element of every input frame`,
  vs_v019_float: allBeatV019 ? "integer arithmetic makes the byte-optimal scp4d decode cheaper than the v0.1.9 float estimate on every fixture" : "integer scp4d-int decode is not cheaper than the v0.1.9 float estimate on every fixture",
  with_offchip_stream: sysRelEnv ? "With the stream priced as off-chip (DRAM-class) traffic, the relations path is the cheapest on the environment: fewer bytes outweigh its on-chip cost (labelled scenario)" : "With an off-chip stream, the relations path is not the cheapest on the environment",
  low_rank: "Keep low-rank OUT of the hardware datapath (host-side option only): in fixed point it stays within eps, but it changes ~80% of elements every frame and costs ~3.6× the decode energy of the rank-0 path for 16% fewer bytes.",
};
check("verdict: integer scp4d-int (byte-optimal) decode is cheaper than the v0.1.9 float scp4d estimate on every fixture (model estimate)", allBeatV019,
  verdictRows.map((v) => `${v.fixture} ${v.scp4d_int_over_v019_decode}×`).join("; "));
check(`verdict (honest): overall ${overall}`, verdict.overall === overall, `${verdict.resident_surface_decode} | ${verdict.frame_fixtures} | ${verdict.stream_out_decode} | ${verdict.encode}`);

// ---------- 9. FPGA golden vectors ----------
type Vec = { id: string; note: string; label: string; surface: StateSurface4D; eps: number[]; cfg: IntConfig };
function edgeSurface(): StateSurface4D {
  const vals = [[0, 0.25], [1.37, 0.95], [-2.5, -1.0], [-2.49, -1.0], [3.0, 1.75], [3.0, 1.74], [-0.004, 0.249]];
  const relations: Relation4D[] = [{ target: 1, sources: [0], weights: [0.5], bias: 0.25, kind: "ch1 = 0.5·ch0 + 0.25" }];
  return { shape: { nx: 1, ny: 1, nz: 1, channels: 2 }, channelNames: ["a", "b"], times: vals.map((_, i) => 1_000 + 10 * i),
    frames: vals.map((v) => Float64Array.from(v)), relations, label: "TEST-ONLY hand-written edge cases (negatives, large jumps, near-threshold holds, bias)" };
}
function sliceSurface(s: StateSurface4D, T: number, label: string): StateSurface4D {
  return { ...s, times: s.times.slice(0, T), frames: s.frames.slice(0, T), meta: s.meta ? { steps: s.meta.steps.slice(0, T), verdicts: s.meta.verdicts.slice(0, T) } : undefined, label };
}
const envSmall = makeEnvironment({ nx: 4, ny: 4, nz: 1, T: 8 });
const VECS: Vec[] = [
  { id: "v0.1-first-16", note: "First 16 frames of the v0.1 fixture; relations + linear predictor; all-dense layout (D=3).", label: "TEST-ONLY hand-written v0.1 fixture", surface: sliceSurface(frames[0].surfaceRel, 16, "TEST-ONLY hand-written v0.1 fixture (first 16)"), eps: [...FRAME_EPS], cfg: { rank: 0, relations: true, predictor: "linear", G: DEFAULT_G } },
  { id: "medicare-6", note: "Medicare 6-row synthetic file; zero predictor (no temporal hold).", label: frames[1].surfaceRel.label, surface: frames[1].surfaceRel, eps: [...FRAME_EPS], cfg: { rank: 0, relations: false, predictor: "zero", G: DEFAULT_G } },
  { id: "env-4x4x1-T8-relations-last", note: "Small SYNTHETIC environment; relations + last-value hold; adaptive sparse/dense frames.", label: ENV_LABEL, surface: envSmall.surface, eps: [...ENV_EPS], cfg: { rank: 0, relations: true, predictor: "last", G: DEFAULT_G } },
  { id: "env-4x4x1-T8-rank2-linear", note: "Same environment; int16 low-rank base (rank 2) + relations + linear predictor (exercises both multipliers).", label: ENV_LABEL, surface: envSmall.surface, eps: [...ENV_EPS], cfg: { rank: 2, relations: true, predictor: "linear", G: DEFAULT_G } },
  { id: "edge-handwritten-G2", note: "Hand-written edge cases at G=2 (deadband 3 grid units); relation with bias; linear predictor.", label: "TEST-ONLY hand-written", surface: edgeSurface(), eps: [0.01, 0.01], cfg: { rank: 0, relations: true, predictor: "linear", G: 2 } },
];
const bitsHex = (v: number) => { const b = Buffer.alloc(8); b.writeDoubleLE(v); return Buffer.from(b).reverse().toString("hex"); };
function auditHead(perFrame: readonly FrameEvents[], times: readonly number[]): string {
  // Optional, off-datapath audit layer: SHA-256 chain over (frame, t, positions, q). Never inside encode/decode.
  let head = "4d-scp-int-audit-v1";
  perFrame.forEach((f, t) => { head = sha(`${head}|${t}|${times[t]}|${f.positions.join(",")}|${f.q.join(",")}`); });
  return head;
}
const vectors = VECS.map((v) => {
  const s = v.surface, C = s.shape.channels;
  const codes = ingestCodes(s.frames, C, v.eps, v.cfg.G);
  const r = encodeIntScp4d(inputOf(s, v.eps), codes, v.cfg);
  const d = decodeIntScp4d(r.bytes, s.relations, { verifyAccumulators: true });
  let xMax = 0; for (const f of codes) for (const x of f) xMax = Math.max(xMax, Math.abs(x));
  const bnd = analyticBounds(r.cfg, xMax, r.rels, r.base);
  return {
    id: v.id, note: v.note, label: v.label,
    shape: s.shape, eps_f64_bits: v.eps.map(bitsHex), G: r.cfg.G, config: r.cfg, weight_frac_bits: 16,
    processing_order: r.plan.order,
    relations_fixed_point: r.rels, low_rank_base: r.base,
    times: s.times, meta: s.meta ?? null,
    input_f64_bits: s.frames.map((f) => Array.from(f, bitsHex)),
    input_codes: codes.map((f) => Array.from(f)),
    expected_bytes_hex: hex(r.bytes), expected_bytes_sha256: sha(r.bytes),
    expected_decoded_codes: d.codes.map((f) => Array.from(f)),
    expected_events: d.perFrame.map((f) => ({ positions: f.positions, q: f.q, dense: f.dense })),
    register_max_abs: Object.fromEntries((Object.keys(DECLARED_WIDTHS) as RegName[]).map((k) => [k, Math.max(r.census[k], d.census[k])])),
    register_max_bits: widthsOf(Object.fromEntries((Object.keys(DECLARED_WIDTHS) as RegName[]).map((k) => [k, Math.max(r.census[k], d.census[k])])) as Census),
    analytic_bound_bits: Object.fromEntries((Object.keys(bnd) as RegName[]).map((k) => [k, bnd[k] === 0 ? 0 : signedBits(bnd[k])])),
    decode_ops: d.ops, encode_ops: r.ops,
    audit_head_sha256: auditHead(d.perFrame, s.times),
    _ok: d.codes.every((f, t) => f.every((x, e) => x === r.decoded[t][e])) && auditHead(r.perFrame, s.times) === auditHead(d.perFrame, s.times),
  };
});
check("golden vectors: every vector round-trips, encoder and decoder audit heads match (audit hash is off-datapath)", vectors.every((v) => v._ok));
const vectorFile = {
  format: "4d-scp-v0.1.10-scp4d-int-golden-vectors",
  version: 1,
  note: "TEST ONLY. Bit-accurate reference vectors for an FPGA/RTL implementation of the integer scp4d datapath (scripts/scp-v0110-int-scp4d.ts). Inputs are labelled test fixtures, not production data. Datapath input = input_codes (int); input_f64_bits + eps_f64_bits let the ingest quantizer (v0.1.8) be verified too. Relations are schema (out of band); their fixed-point form is given. audit_head_sha256 is an optional off-datapath audit chain, not part of the bitstream.",
  stream_format: "S4DI v1: magic 'S4DI' | u8 version | u32 T | u16 nx ny nz C | eps f64 bits × C | u8 G | svarint t0, Δt… | u8 hasMeta [svarint step0, Δstep… | u8 verdict…] | u8 rank | u8 relations | u8 predictor | u8 FW | [rank>0: u8 F | svarint mean code × D | svarint A_q × T·rank | svarint B_q × D per column] | u8 layout (1 = all frames dense, no head, when D ≤ 8) | frames: [uvarint head 2n|2n+1] then sparse (uvarint gap, svarint q)×n or dense svarint q×D in processing order",
  declared_widths_bits: DECLARED_WIDTHS,
  vectors: vectors.map(({ _ok, ...rest }) => rest),
};
const vectorJson = `${JSON.stringify(vectorFile, null, 2)}\n`;
if (WRITE) { writeFileSync(join(root, VECTORS_PATH), vectorJson); console.log(`NOTE wrote ${VECTORS_PATH}`); }
check(`committed ${VECTORS_PATH} regenerates byte-identically`, existsSync(join(root, VECTORS_PATH)) && readFileSync(join(root, VECTORS_PATH), "utf8") === vectorJson,
  `sha ${sha(vectorJson).slice(0, 16)}, ${vectors.length} vectors`);
{
  const committed = existsSync(join(root, VECTORS_PATH)) ? JSON.parse(readFileSync(join(root, VECTORS_PATH), "utf8")) : { vectors: [] };
  const vs = committed.vectors as { id: string; expected_bytes_hex: string; expected_decoded_codes: number[][]; relations_fixed_point: unknown }[];
  const rels = (id: string) => VECS.find((v) => v.id === id)!.surface.relations;
  check("golden vectors: decoding each committed expected_bytes_hex yields expected_decoded_codes",
    vs.length === VECS.length && vs.every((v) => { const d = decodeIntScp4d(Uint8Array.from(Buffer.from(v.expected_bytes_hex, "hex")), rels(v.id)); return d.codes.every((f, t) => f.every((x, e) => x === v.expected_decoded_codes[t][e])); }));
}

// ---------- 10. Report ----------
const report = {
  format: "4d-scp-v0.1.10-int-report",
  version: 1,
  note: "TEST ONLY. Deterministic outputs of scripts/check-scp-v0110.ts. No timings. Energy and area are MODEL ESTIMATES, not measurements. Environment fixtures are SYNTHETIC.",
  energy_label: ENERGY_LABEL,
  env_label: ENV_LABEL, env_seed: ENV_SEED,
  search: { G: [...SEARCH_G], ranks: [...INT_RANKS], predictors: ["zero", "last", "linear"], relations: [false, true] },
  ingest: { note: "Shared front-end for all strategies: v0.1.8 integer RN quantizer, per value.", ops: ING.counts, ops_total: ING.total, pj_per_value: ingestPj.map(r6) },
  fixtures: Object.fromEntries(Object.entries(results).map(([k, v]) => [k, v])),
  low_rank_decision: lowrank,
  verdict: { ...verdict, per_fixture: verdictRows, system_view_offchip_stream: { label: `Labelled scenario: stream bytes priced at DRAM ${dramPjPerByte.join("–")} pJ/B (Horowitz 1.3–2.6 nJ per 64-bit access).`, rows: systemView } },
};
const reportJson = `${JSON.stringify(report, null, 2)}\n`;
if (WRITE) { writeFileSync(join(root, REPORT_PATH), reportJson); console.log(`NOTE wrote ${REPORT_PATH}`); }
check(`committed ${REPORT_PATH} matches this run (deterministic quantities)`, existsSync(join(root, REPORT_PATH)) && readFileSync(join(root, REPORT_PATH), "utf8") === reportJson,
  `sha ${sha(reportJson).slice(0, 16)}`);

// ---------- 11. Tables (stdout) ----------
console.log(`\nNOTE energy/area: ${ENERGY_LABEL}`);
console.log(`NOTE ingest (shared by all strategies): ${ING.total} ops/value, ${ingestPj.map((x) => x.toFixed(2)).join("–")} pJ/value`);
for (const [name, v] of Object.entries(results)) {
  console.log(`\n=== ${name} (T=${v.T}, D=${v.D})`);
  console.log("strategy                               bytes     vs_q  max|err|/eps            enc ops/ef  dec ops/ef  enc pJ/ef (incl ingest)  dec pJ/ef      resident pJ/ef  dec area µm²        reg bits");
  for (const r of v.rows) {
    console.log(`${r.strategy.padEnd(37)} ${String(r.bytes).padStart(8)} ${r.ratio_vs_full_q.toFixed(2).padStart(6)}  ${r.max_err_over_eps.map((x) => x.toFixed(3)).join("/").padEnd(22)} ${r.encode.ops_per_ef.toFixed(2).padStart(9)} ${r.decode.ops_per_ef.toFixed(2).padStart(11)}  ${r.encode.pj_per_ef_incl_ingest!.map((x) => x.toFixed(2)).join("–").padEnd(23)} ${r.decode.pj_per_ef.map((x) => x.toFixed(2)).join("–").padEnd(13)} ${(r.decode_resident_surface ? r.decode_resident_surface.pj_per_ef.map((x) => x.toFixed(2)).join("–") : "n/a").padEnd(15)} ${r.decode.area_um2.map((x) => x.toFixed(0)).join("–").padEnd(19)} code ${r.max_register_bits.code}${r.config ? `  cfg=${JSON.stringify(r.config)}` : ""}`);
  }
  const s19 = v.v019.scp4d as { bytes: number; pj_per_ef: { encode: number[]; decode: number[] }; encode_ops_per_ef: number; decode_ops_per_ef: number };
  console.log(`${"scp4d v0.1.9 (float, committed)".padEnd(37)} ${String(s19.bytes).padStart(8)}         (committed)              ${s19.encode_ops_per_ef.toFixed(2).padStart(9)} ${s19.decode_ops_per_ef.toFixed(2).padStart(11)}  ${s19.pj_per_ef.encode.map((x) => x.toFixed(2)).join("–").padEnd(23)} ${s19.pj_per_ef.decode.map((x) => x.toFixed(2)).join("–")}`);
  console.log(`G sweep: ${(v.g_sweep as { G: number; bytes: number; events: number }[]).map((g) => `G=${g.G} ${g.bytes} B/${g.events} ev`).join(", ")}`);
}
console.log(`\n=== low-rank decision\n${JSON.stringify(lowrank, null, 1)}`);
console.log(`\n=== verdict: ${verdict.overall}`);
for (const k of ["resident_surface_decode", "frame_fixtures", "stream_out_decode", "encode", "vs_v019_float", "with_offchip_stream", "low_rank"] as const) console.log(`${k}: ${verdict[k]}`);
for (const v of verdictRows) console.log(`${v.fixture.padEnd(18)} resident ${JSON.stringify(v.decode_resident_surface_pj_low)} | stream-out ${JSON.stringify(v.decode_stream_out_pj_low)} | encode ${JSON.stringify(v.encode_incl_ingest_pj_low)}`);
for (const sv of systemView) console.log(`system view ${sv.fixture.padEnd(18)} ${JSON.stringify(sv.decode_resident_plus_offchip_stream_pj_per_ef)}`);
console.log("\n=== latency (reported, not asserted)");
for (const l of latency) console.log(l);

if (failures.length) { console.error(`FAIL check-scp-v0110 (${failures.length} failed: ${failures.join("; ")})`); process.exit(1); }
console.log(`PASS check-scp-v0110 (${passed} checks)`);
