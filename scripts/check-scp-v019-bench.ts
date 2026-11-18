/** TEST ONLY. 4D-SCP v0.1.9 — isolated subsystem + four-strategy proof bench (software simulation).
 *
 * Compares, on the same deterministic fixtures:
 *   (1) conventional full state   full_f64 (raw, lossless reference) and full_q (same-eps quantized)
 *   (2) delta-based               delta
 *   (3) tensor compression        tensor_bound (smallest rank meeting eps) and tensor_energy (99.9 % energy probe)
 *   (4) combined 4D-SCP           scp4d (low-rank base + declared relations + event-driven temporal residual)
 * Fixtures: v0.1 (N=256), Medicare 6-row synthetic (not padded), B256, B4096 (existing), plus a seeded
 * SYNTHETIC 4D environment generated in memory (scripts/scp-v019-env-fixture.ts; test-only, labelled).
 *
 * Asserted: only deterministic quantities (round-trip, eps bounds, decision agreement where the margin
 * guarantees it, determinism, pack.ts/v0.1 invariants, the stated findings, and the committed JSON report).
 * Reported, not asserted: latency (p50 of repeated runs). Energy numbers are MODEL ESTIMATES from the
 * v0.1.5 45 nm assumption table — not measurements of any silicon or FPGA.
 * No network, no env reads, no writes (unless --write, which only rewrites the committed report file).
 *
 * Run: npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-scp-v019-bench.ts [--write]
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { decodeQuantized, encodeQuantized } from "../src/scp/pack";
import {
  ByteReaderForTest, ByteWriterForTest,
} from "./scp-v019-bench-support";
import {
  BENCH_STRATEGIES, TemporalStateSurface, benchSurface, encodeScpFrames, energyProfile, estimateEnergy, gridEncoder,
  lastValuePredictor, linearPredictor, lowRankFit, predictorByName, stateCompressor, stateReconstructor, symmetricEigen,
  type BenchRow, type BenchRun, type CompressOptions4D, type DecisionTask4D, type EnergyTable, type OpCounts4D,
  type StateSurface4D, type StrategyId,
} from "../src/scp/subsystem";
import { defaultAssumptions, sramEnergyPerBytePj } from "./scp-v015-cost-model";
import { encodeFromPacked } from "./scp-v018-integer-model";
import { BOUNDED_EPS, percentile } from "./scp-v01-fixture";
import { mulberry32 } from "./scp-v012-fixtures";
import {
  ENV_EPS, ENV_LABEL, ENV_SEED, ENV_TASKS, FRAME_EPS, FRAME_TASKS, frameFixtures, makeEnvironment,
} from "./scp-v019-env-fixture";

const root = resolve(join(import.meta.dirname, ".."));
const REPORT_PATH = "fixtures/scp/v019-bench-report.json";
const PACK_SHA256 = "94859d7c26939e63f86c426c5c1a6c7309da096532adf2d3ab5eebc04b07b09a";
const V01_QUANTIZED_SHA = "07a3d04147714747a4823e6e934dc6144740eb2f6243e7113106aed06369d6bc";
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
const pct = (x: number) => `${(100 * x).toFixed(2)}%`;

// ---------- 1. Subsystem boundary (stricter than check-scp-boundary for src/scp/subsystem) ----------
{
  const dir = join(root, "src/scp/subsystem");
  const files = readdirSync(dir).filter((f) => f.endsWith(".ts"));
  const bad: string[] = [];
  for (const f of files) {
    const text = readFileSync(join(dir, f), "utf8");
    for (const m of text.matchAll(/(?:import|export)[^"';]*?from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)|require\s*\(\s*["']([^"']+)["']\s*\)/g)) {
      const spec = m[1] ?? m[2] ?? m[3];
      const ok = spec.startsWith("./") || spec === "../pack" || spec === "../types" || spec === "node:crypto";
      if (!ok) bad.push(`${f} → ${spec}`);
    }
    if (/\b(Date\.now|Math\.random|performance\.now|process\.env)\b/.test(text)) bad.push(`${f}: clock/random/env token`);
    if (/level4|src\/app|metamorphic/i.test(text.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ""))) bad.push(`${f}: mentions level4/app/metamorphic in code`);
  }
  check("subsystem imports only ./*, ../pack, ../types, node:crypto; no clocks, randomness, env, Level 4 or app", bad.length === 0 && files.length >= 10, bad.join("; ") || `${files.length} files`);
  const outside: string[] = [];
  const SKIP = new Set(["node_modules", ".git", ".next"]);
  const walk = (d: string) => {
    for (const n of readdirSync(d, { withFileTypes: true })) {
      if (SKIP.has(n.name)) continue;
      const p = join(d, n.name), rel = p.slice(root.length + 1);
      if (rel === "scripts" || rel === "src/scp") continue;
      if (n.isDirectory()) walk(p);
      else if (/\.(ts|tsx|mts)$/.test(n.name) && /scp\/subsystem/.test(readFileSync(p, "utf8"))) outside.push(rel);
    }
  };
  walk(root);
  check("nothing outside scripts/ and src/scp imports the subsystem (unwired)", outside.length === 0, outside.join(", ") || "none");
}

// ---------- 2. Existing invariants (pack.ts, v0.1 quantized bytes, golden model) ----------
const frames = frameFixtures();
const packEps = { x: BOUNDED_EPS.predicted, y: BOUNDED_EPS.observed, z: BOUNDED_EPS.phi };
check("src/scp/pack.ts is byte-identical to v0.1.3–v0.1.8 (sha pinned)", sha(readFileSync(join(root, "src/scp/pack.ts"))) === PACK_SHA256);
check("v0.1 quantized sha unchanged (pack.ts encodeQuantized)", sha(encodeQuantized(frames[0].points, packEps).bytes) === V01_QUANTIZED_SHA);
for (const fx of frames.filter((f) => f.name === "v0.1" || f.name === "A-medicare")) {
  check(`${fx.name}: v0.1.8 integer golden model bytes == pack.ts bytes`, sha(encodeFromPacked(fx.points, packEps).bytes) === sha(encodeQuantized(fx.points, packEps).bytes));
}

// ---------- 3. Subsystem unit checks ----------
{
  const vals = [0, 1, -1, 63, -64, 64, 127, 128, -129, 2 ** 31, -(2 ** 31), 2 ** 51 - 1, -(2 ** 51)];
  const w = new ByteWriterForTest();
  for (const v of vals) w.svarint(v);
  const r = new ByteReaderForTest(w.bytes());
  check("zigzag varint round-trips edge values and refuses |n| > 2^52", vals.every((v) => r.svarint() === v) && r.remaining === 0 && throws(() => new ByteWriterForTest().svarint(2 ** 53 - 1)));

  const m = Float64Array.of(4, 1, 2, 1, 3, 0, 2, 0, 5);
  const eig = symmetricEigen(m, 3);
  let worst = 0;
  for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
    let av = 0; for (let k = 0; k < 3; k++) av += m[i * 3 + k] * eig.vectors[k * 3 + j];
    worst = Math.max(worst, Math.abs(av - eig.values[j] * eig.vectors[i * 3 + j]));
  }
  check("Jacobi eigen: A·v = λ·v on a 3×3 symmetric matrix", worst < 1e-12 && eig.values[0] >= eig.values[1] && eig.values[1] >= eig.values[2], `max residual ${worst.toExponential(2)}`);

  const rng = mulberry32(7);
  const M = Array.from({ length: 8 }, () => Float64Array.from({ length: 5 }, () => rng() * 2 - 1));
  const fit = lowRankFit(M, 5);
  let err = 0;
  for (let t = 0; t < 8; t++) for (let e = 0; e < 5; e++) {
    let v = fit.mean[e]; for (let j = 0; j < fit.rank; j++) v += fit.A[t * fit.rank + j] * fit.B[e * fit.rank + j];
    err = Math.max(err, Math.abs(v - M[t][e]));
  }
  check("full-rank truncated SVD reconstructs an 8×5 matrix", err < 1e-9, `max err ${err.toExponential(2)}`);

  check("predictors: zero / last / linear", predictorByName("zero").predict(3, 1, 5) === 0 && lastValuePredictor.predict(3, 1, 5) === 3
    && linearPredictor.predict(3, 1, 5) === 5 && linearPredictor.predict(3, 1, 1) === 3);

  const D = 6, eps = new Float64Array(D).fill(0.1), order = Int32Array.from({ length: D }, (_, i) => i);
  const enc = new TemporalStateSurface({ D, eps, order, predictor: lastValuePredictor });
  const dec = new TemporalStateSurface({ D, eps, order, predictor: lastValuePredictor });
  const raw = [Float64Array.of(0, 1, 2, 3, 4, 5), Float64Array.of(0.05, 1, 2, 3.5, 4, 5), Float64Array.of(0.05, 1, 2, 3.5, 4, 9)];
  const outs = raw.map((f, t) => { const u = enc.append(f, 1000 + t); return { u, d: dec.apply(u) }; });
  const encEventsPerFrame = outs.map((o) => o.u.positions.length);
  check("temporal_state: decoder replays encoder exactly; events only where change > eps; heads match",
    outs.every((o, t) => o.d.every((v, e) => Math.abs(v - raw[t][e]) <= 0.1)) && enc.head_sha256 === dec.head_sha256
    && JSON.stringify(encEventsPerFrame) === "[5,1,1]" && Object.isFrozen(enc.updates[0]),
    `events per frame ${JSON.stringify(encEventsPerFrame)} (frame 0 element 0 is 0 → no event)`);
  check("temporal_state is append-only (out-of-order apply refused)", throws(() => dec.apply(outs[0].u)));

  check("state_encoder refuses a relation source that is also a target, non-finite values and ragged frames",
    throws(() => gridEncoder.encode({ shape: { nx: 2, ny: 1, nz: 1, channels: 1 }, channelNames: ["a"], times: [0], values: [[1, 2]], label: "t",
      relations: [{ target: 0, sources: [1], weights: [1], kind: "x" }, { target: 1, sources: [0], weights: [1], kind: "y" }] }))
    && throws(() => gridEncoder.encode({ shape: { nx: 1, ny: 1, nz: 1, channels: 1 }, channelNames: ["a"], times: [0], values: [[Number.NaN]], label: "t" }))
    && throws(() => gridEncoder.encode({ shape: { nx: 2, ny: 1, nz: 1, channels: 1 }, channelNames: ["a"], times: [0], values: [[1]], label: "t" })));
  check("ScpFrame adapter invents no step/verdict meta", encodeScpFrames([{ x: 1, y: 2, z: 0.5, t: 0 }], "t").meta === undefined);

  const s = frames[1].surface;
  const b = stateCompressor.compress(s, "scp4d", { eps: FRAME_EPS }).bytes;
  check("state_reconstructor rejects truncated and trailing-byte streams",
    throws(() => stateReconstructor.reconstruct(b.slice(0, b.length - 1), s.relations))
    && throws(() => stateReconstructor.reconstruct(Uint8Array.from([...b, 0]), s.relations)));
}

// ---------- 4. Energy table: v0.1.5 45 nm assumptions (estimates) ----------
const A = defaultAssumptions();
const E = A.energy_pj;
const ENERGY: EnergyTable = {
  fp_add: E.fp32_add.value, fp_mul: E.fp32_mul.value,
  fp_div: [E.div_low.value, E.div_high.value], round: [E.round_low.value, E.round_high.value],
  int_op: E.int32_add.value, compare: E.branch.value, byte_io: [E.byte_io_low.value, E.byte_io_high.value],
  state_byte: (ws) => { const r = sramEnergyPerBytePj(ws, A); return [r.low, r.high]; },
};
const ENERGY_LABEL = "MODEL ESTIMATE from the v0.1.5 45 nm assumption table (Horowitz ISSCC 2014 plus labelled assumptions); not silicon, not FPGA.";
const opsTotal = (o: OpCounts4D) => o.fp_add + o.fp_mul + o.fp_div + o.round + o.int_ops + o.compare + o.sqrt;

// ---------- 5. Bench ----------
type FixtureSpec = { name: string; surface: StateSurface4D; options: CompressOptions4D; tasks: DecisionTask4D[]; points?: ReturnType<typeof frameFixtures>[number]["points"] };
const envMain = makeEnvironment({ nx: 16, ny: 16, nz: 2, T: 64 });
const envLong = makeEnvironment({ nx: 16, ny: 16, nz: 2, T: 256 });
const fixtures: FixtureSpec[] = [
  ...frames.map((f) => ({ name: f.name, surface: f.surfaceRel, options: { eps: FRAME_EPS }, tasks: FRAME_TASKS, points: f.points })),
  { name: "env-16x16x2-T64", surface: envMain.surface, options: { eps: ENV_EPS }, tasks: ENV_TASKS },
  { name: "env-16x16x2-T256", surface: envLong.surface, options: { eps: ENV_EPS }, tasks: ENV_TASKS },
];
const BOUNDED_STRATEGIES: StrategyId[] = ["full_f64", "full_q", "delta", "scp4d"];

function rowJson(r: BenchRow, T: number, D: number, sha16: string) {
  const ef = T * D;
  const enc = estimateEnergy(r.encode_ops, r.encode_working_set_bytes, ENERGY);
  const dec = estimateEnergy(r.decode_ops, r.decode_working_set_bytes, ENERGY);
  return {
    strategy: r.strategy, bytes: r.bytes, ratio_vs_full_f64: r6(r.ratio_vs_full_f64), ratio_vs_full_q: r6(r.ratio_vs_full_q),
    bits_per_element_frame: r6(r.bits_per_element_frame), rank: r.rank, scp4d: r.scp4d ?? null, bounded_claim: r.bounded_claim,
    max_abs_err: r.fidelity.max_abs_err.map(r6), rmse: r.fidelity.rmse.map(r6), within_eps: r6(r.fidelity.within_eps), bound_ok: r.fidelity.bound_ok,
    decisions: r.decisions.map((d) => ({ task: d.task, agreement: r6(d.agreement), slots: d.slots, safe_slots: d.safe_slots, safe_disagree: d.safe_disagree })),
    events: r.events, event_fraction: r6(r.events / ef), dirty_fraction: r6(r.dirty_fraction),
    encode_ops_per_element_frame: r6(opsTotal(r.encode_ops) / ef), decode_ops_per_element_frame: r6(opsTotal(r.decode_ops) / ef),
    encode_working_set_bytes: r.encode_working_set_bytes, decode_working_set_bytes: r.decode_working_set_bytes,
    encode_batch: r.encode_batch, search_tried: r.search_tried,
    energy_estimate_pj_per_element_frame: {
      encode: [r6(enc.low_pj / ef), r6(enc.high_pj / ef)], decode: [r6(dec.low_pj / ef), r6(dec.high_pj / ef)], label: "estimate",
    },
    sha256_16: sha16,
  };
}

const results: Record<string, { T: number; D: number; label: string; rows: ReturnType<typeof rowJson>[]; runs: BenchRun[] }> = {};
for (const fx of fixtures) {
  let runs: BenchRun[] = [];
  const ok = !throws(() => { runs = benchSurface(fx.surface, fx.options, fx.tasks, BENCH_STRATEGIES); });
  const T = fx.surface.frames.length, D = fx.surface.frames[0].length;
  check(`${fx.name}: all ${BENCH_STRATEGIES.length} strategies decode from bytes alone (times and meta round-trip)`, ok && runs.length === BENCH_STRATEGIES.length);
  const by = (s: StrategyId) => runs.find((r) => r.row.strategy === s)!;
  check(`${fx.name}: full_f64 is bit-exact`, by("full_f64").reconstructed.frames.every((f, t) => f.every((v, e) => Object.is(v, fx.surface.frames[t][e]))));
  const boundedRuns = runs.filter((r) => BOUNDED_STRATEGIES.includes(r.row.strategy) || (r.row.strategy === "tensor_bound" && r.row.bounded_claim));
  check(`${fx.name}: every bounded strategy meets eps on every element-frame`, boundedRuns.every((r) => r.row.fidelity.bound_ok),
    boundedRuns.map((r) => `${r.row.strategy} max=${r.row.fidelity.max_abs_err.map((x) => x.toExponential(2)).join("/")}`).join("; "));
  check(`${fx.name}: delta reconstructs exactly the full_q values`, by("delta").reconstructed.frames.every((f, t) => f.every((v, e) => Object.is(v, by("full_q").reconstructed.frames[t][e]))));
  check(`${fx.name}: bounded strategies never flip a decision whose margin exceeds the guarantee`,
    boundedRuns.every((r) => r.row.decisions.every((d) => d.safe_disagree === 0)),
    boundedRuns.map((r) => `${r.row.strategy}:${r.row.decisions.map((d) => `${d.safe_slots}`).join("/")}`).join(" "));
  const again = stateCompressor.compress(fx.surface, "scp4d", fx.options).bytes;
  check(`${fx.name}: scp4d encoding is deterministic`, sha(again) === sha(by("scp4d").compressed.bytes));
  if (fx.points) {
    const packDec = decodeQuantized(encodeQuantized(fx.points, packEps).bytes).points;
    const d = by("delta").reconstructed.frames;
    check(`${fx.name}: subsystem delta values are identical to pack.ts decodeQuantized`,
      packDec.every((p, t) => Object.is(p.x, d[t][0]) && Object.is(p.y, d[t][1]) && Object.is(p.z, d[t][2])));
  }
  results[fx.name] = { T, D, label: fx.surface.label, runs, rows: runs.map((r) => rowJson(r.row, T, D, sha(r.compressed.bytes).slice(0, 16))) };
}

// ---------- 6. Ablation of the combined path, scaling, intrinsic dimensionality ----------
const ABLATION = [
  { name: "temporal only (rank 0, no relations, last)", cfg: { rank: 0, relations: false, predictor: "last" as const } },
  { name: "+ relations (rank 0, relations, last)", cfg: { rank: 0, relations: true, predictor: "last" as const } },
  { name: "+ low-rank base rank 2 (relations, last)", cfg: { rank: 2, relations: true, predictor: "last" as const } },
  { name: "+ low-rank base rank 4 (relations, last)", cfg: { rank: 4, relations: true, predictor: "last" as const } },
];
const ablation: Record<string, { name: string; bytes: number; events: number }[]> = {};
for (const [name, env] of [["env-16x16x2-T64", envMain], ["env-16x16x2-T256", envLong]] as const) {
  ablation[name] = ABLATION.map((a) => {
    const c = stateCompressor.compress(env.surface, "scp4d", { eps: ENV_EPS, scp4d: a.cfg });
    return { name: a.name, bytes: c.bytes.length, events: c.events };
  });
}
// Fairness probe: scp4d spends its whole eps as a deadband (max error up to eps) while full_q/delta round to
// eps/2. Re-run scp4d at eps/2 so its worst-case error matches theirs, and compare.
const fairness = ["v0.1", "B4096", "env-16x16x2-T64", "env-16x16x2-T256"].map((name) => {
  const fx = fixtures.find((f) => f.name === name)!;
  const half = fx.options.eps.map((e) => e / 2);
  const run = benchSurface(fx.surface, { eps: half }, [], ["scp4d"])[0].row;
  const recon = stateReconstructor.reconstruct(stateCompressor.compress(fx.surface, "scp4d", { eps: half }).bytes, fx.surface.relations).frames;
  const fq = results[name].rows.find((r) => r.strategy === "full_q")!, de = results[name].rows.find((r) => r.strategy === "delta")!;
  const agree = fx.tasks.map((task) => { let a = 0, n = 0; fx.surface.frames.forEach((f, t) => { const x = task.decide(f, t, fx.surface), y = task.decide(recon[t], t, fx.surface); x.forEach((v, i) => { n++; if (v === y[i]) a++; }); }); return { task: task.name, agreement: r6(a / n) }; });
  return { fixture: name, scp4d_half_eps_bytes: run.bytes, full_q_bytes: fq.bytes, delta_bytes: de.bytes, bound_ok_at_half_eps: run.fidelity.bound_ok,
    max_abs_err: run.fidelity.max_abs_err.map(r6), vs_delta: r6(de.bytes / run.bytes), config: run.scp4d, decisions: agree };
});
check("fairness probe: scp4d at eps/2 (same worst-case error as full_q/delta) stays bounded at eps/2", fairness.every((f) => f.bound_ok_at_half_eps));
check("fairness probe: on the environment, scp4d at eps/2 is still smaller than delta at eps",
  fairness.filter((f) => f.fixture.startsWith("env")).every((f) => f.scp4d_half_eps_bytes < f.delta_bytes),
  fairness.map((f) => `${f.fixture}: ${f.scp4d_half_eps_bytes} B vs delta ${f.delta_bytes} B (${f.vs_delta}×)`).join("; "));

const scaling: { series: "spatial" | "temporal"; cells: number; T: number; D: number; full_q: number; delta: number; scp4d: number; scp4d_vs_full_q: number; scp4d_vs_delta: number; scp4d_config: unknown; threshold_agreement: number }[] = [];
for (const [series, nx, ny, nz, T] of [
  ["spatial", 8, 8, 2, 64], ["spatial", 16, 16, 2, 64], ["spatial", 32, 32, 2, 64],
  ["temporal", 16, 16, 2, 16], ["temporal", 16, 16, 2, 32], ["temporal", 16, 16, 2, 128],
] as const) {
  const env = makeEnvironment({ nx, ny, nz, T });
  const runs = benchSurface(env.surface, { eps: ENV_EPS }, ENV_TASKS.slice(0, 3), ["full_q", "delta", "scp4d"]);
  const g = (s: StrategyId) => runs.find((r) => r.row.strategy === s)!.row;
  check(`scaling ${nx}x${ny}x${nz} T=${T}: scp4d bounded and no margin-safe decision flips`, g("scp4d").fidelity.bound_ok && g("scp4d").decisions.every((d) => d.safe_disagree === 0));
  scaling.push({ series, cells: nx * ny * nz, T, D: nx * ny * nz * 4, full_q: g("full_q").bytes, delta: g("delta").bytes, scp4d: g("scp4d").bytes,
    scp4d_vs_full_q: r6(g("full_q").bytes / g("scp4d").bytes), scp4d_vs_delta: r6(g("delta").bytes / g("scp4d").bytes), scp4d_config: g("scp4d").scp4d,
    threshold_agreement: r6(g("scp4d").decision_agreement) });
}
for (const name of ["env-16x16x2-T64", "env-16x16x2-T256"]) {
  const row = results[name].rows.find((r) => r.strategy === "scp4d")!, fq = results[name].rows.find((r) => r.strategy === "full_q")!, de = results[name].rows.find((r) => r.strategy === "delta")!;
  scaling.push({ series: "temporal", cells: 512, T: results[name].T, D: results[name].D, full_q: fq.bytes, delta: de.bytes, scp4d: row.bytes,
    scp4d_vs_full_q: r6(fq.bytes / row.bytes), scp4d_vs_delta: r6(de.bytes / row.bytes), scp4d_config: row.scp4d,
    threshold_agreement: r6(row.decisions.slice(0, 3).reduce((s, d) => s + d.agreement, 0) / 3) });
}
scaling.sort((a, b) => (a.series === b.series ? a.cells - b.cells || a.T - b.T : a.series < b.series ? -1 : 1));

const envNoEvents = makeEnvironment({ nx: 16, ny: 16, nz: 2, T: 64, events: false });
const fieldOnly = (s: StateSurface4D) => s.frames.map((f) => Float64Array.from({ length: f.length / 4 }, (_, i) => f[i * 4]));
const profile = (fr: Float64Array[]) => { const p = energyProfile(lowRankFit(fr, Math.min(fr.length, fr[0].length)).energy); return { k90: p.k90, k99: p.k99, k999: p.k999, participation_ratio: r6(p.participation_ratio), top8_cumulative: p.top.map(r6) }; };
const intrinsic = {
  "env-16x16x2-T64 all channels (with events)": profile(envMain.surface.frames as Float64Array[]),
  "env-16x16x2-T64 all channels (events off, same seed)": profile(envNoEvents.surface.frames as Float64Array[]),
  "env-16x16x2-T64 c0 field only": profile(fieldOnly(envMain.surface)),
  "B4096 (x, y, z)": profile(frames[3].surface.frames as Float64Array[]),
};

// ---------- 7. Five properties and findings (deterministic) ----------
const envRows = (n: string) => results[n].rows;
const get = (n: string, s: StrategyId) => envRows(n).find((r) => r.strategy === s)!;
const ENV_NAMES = ["env-16x16x2-T64", "env-16x16x2-T256"];
const FRAME_NAMES = frames.map((f) => f.name);
const bestBoundedOther = (n: string) => Math.min(...envRows(n).filter((r) => r.strategy !== "scp4d" && (r.bounded_claim && r.bound_ok)).map((r) => r.bytes));
const thresholdAgreement = (n: string, s: StrategyId) => get(n, s).decisions.filter((d) => !d.task.startsWith("hotspot")).every((d) => d.agreement === 1);

check("finding: on the 4D environment, scp4d is the smallest bounded encoding",
  ENV_NAMES.every((n) => get(n, "scp4d").bytes < bestBoundedOther(n)),
  ENV_NAMES.map((n) => `${n}: scp4d ${get(n, "scp4d").bytes} B vs best other bounded ${bestBoundedOther(n)} B (${(bestBoundedOther(n) / get(n, "scp4d").bytes).toFixed(2)}×)`).join("; "));
check("finding: on the 4D environment, scp4d keeps 100% agreement on every threshold decision (anomaly, relation-break, occupancy)",
  ENV_NAMES.every((n) => thresholdAgreement(n, "scp4d")));
check("finding (honest): argmax hotspot has no margin-safe frames at eps, so every lossy strategy may flip it",
  ENV_NAMES.every((n) => get(n, "scp4d").decisions.find((d) => d.task.startsWith("hotspot"))!.safe_slots === 0),
  ENV_NAMES.map((n) => BENCH_STRATEGIES.map((s) => `${s}=${get(n, s).decisions.find((d) => d.task.startsWith("hotspot"))!.agreement}`).join(" ")).join(" | "));
check("finding (honest): tensor_energy (99.9% energy) is NOT eps-bounded on the environment; pure low-rank loses sparse events",
  ENV_NAMES.every((n) => !get(n, "tensor_energy").bound_ok));
check("finding (honest): on single-cell frame fixtures scp4d does not beat delta by more than 1.3× and loses on Medicare",
  FRAME_NAMES.every((n) => get(n, "scp4d").bytes * 1.3 >= get(n, "delta").bytes) && get("A-medicare", "scp4d").bytes > get("A-medicare", "full_q").bytes,
  FRAME_NAMES.map((n) => `${n}: scp4d ${get(n, "scp4d").bytes} / delta ${get(n, "delta").bytes} / full_q ${get(n, "full_q").bytes}`).join("; "));
check("finding: the low-rank base is chosen only at T=256 (factor cost amortised), not at T=64",
  get("env-16x16x2-T64", "scp4d").rank === 0 && get("env-16x16x2-T256", "scp4d").rank > 0,
  `T64 rank ${get("env-16x16x2-T64", "scp4d").rank}, T256 rank ${get("env-16x16x2-T256", "scp4d").rank}`);
check("finding: events off lowers intrinsic dimensionality (k99) of the same environment",
  intrinsic["env-16x16x2-T64 all channels (events off, same seed)"].k99 < intrinsic["env-16x16x2-T64 all channels (with events)"].k99,
  `k99 ${intrinsic["env-16x16x2-T64 all channels (with events)"].k99} → ${intrinsic["env-16x16x2-T64 all channels (events off, same seed)"].k99}`);

const mainEnv = "env-16x16x2-T64";
const props = {
  state_fidelity: {
    verdict: "PASS",
    evidence: "full_q, delta and scp4d meet |v − v′| ≤ eps on every element-frame of all 6 bench fixtures (scp4d also on the 6 scaling fixtures); tensor_bound meets eps where its search succeeded (rank listed); full_f64 bit-exact.",
  },
  compression_scaling: {
    verdict: "PASS (bounded range measured; not a law)",
    evidence: `scp4d vs full_q stays within ${Math.min(...scaling.map((s) => s.scp4d_vs_full_q)).toFixed(2)}–${Math.max(...scaling.map((s) => s.scp4d_vs_full_q)).toFixed(2)}× across 128–2048 cells and T = 16–256; it grows with T once the low-rank base pays for itself (T=256).`,
  },
  temporal_compression: {
    verdict: "PASS on the environment; tie on single-cell frame streams",
    evidence: `${mainEnv}: scp4d events cover ${pct(get(mainEnv, "scp4d").event_fraction)} of element-frames vs ${pct(get(mainEnv, "delta").event_fraction)} nonzero deltas; ${(get(mainEnv, "delta").bytes / get(mainEnv, "scp4d").bytes).toFixed(2)}× smaller than delta. Frame fixtures: within ±25% of delta.`,
  },
  computational_efficiency: {
    verdict: "MIXED (estimate): fewer bytes and fewer downstream updates, more per-element decode work",
    evidence: `${mainEnv}: downstream dirty fraction scp4d ${pct(get(mainEnv, "scp4d").dirty_fraction)} vs full_q ${pct(get(mainEnv, "full_q").dirty_fraction)} vs tensor ${pct(get(mainEnv, "tensor_bound").dirty_fraction)}; but at T=256 the rank-2 base changes every element each frame (dirty ${pct(get("env-16x16x2-T256", "scp4d").dirty_fraction)}). Decode estimate ${get(mainEnv, "scp4d").energy_estimate_pj_per_element_frame.decode.join("–")} pJ/element-frame vs delta ${get(mainEnv, "delta").energy_estimate_pj_per_element_frame.decode.join("–")} and full_q ${get(mainEnv, "full_q").energy_estimate_pj_per_element_frame.decode.join("–")} (model estimates). Software decode latency is also slower than delta on single-cell streams (stdout).`,
  },
  intelligence_preservation: {
    verdict: "PASS for threshold decisions; argmax over a smooth field is not preserved by any lossy strategy",
    evidence: "No bounded strategy flips a decision whose margin exceeds its guarantee (all fixtures). Environment threshold tasks: 100% agreement for scp4d. Hotspot argmax has 0 margin-safe frames.",
  },
};

// ---------- 8. Report (deterministic only) ----------
const report = {
  format: "4d-scp-v0.1.9-bench-report",
  version: 1,
  note: "TEST ONLY. Deterministic outputs of scripts/check-scp-v019-bench.ts on committed / seeded fixtures. No timings (reported on stdout only). Energy values are model estimates, not measurements. The environment fixture is SYNTHETIC.",
  energy_label: ENERGY_LABEL,
  env_label: ENV_LABEL,
  env_seed: ENV_SEED,
  eps: { frames: [...FRAME_EPS], env: [...ENV_EPS] },
  truth: { "env-16x16x2-T64": envMain.truth, "env-16x16x2-T256": envLong.truth },
  fixtures: Object.fromEntries(Object.entries(results).map(([k, v]) => [k, { T: v.T, D: v.D, label: v.label, rows: v.rows }])),
  ablation, fairness_probe_half_eps: fairness, scaling, intrinsic_dimensionality: intrinsic, five_properties: props,
};
const reportJson = `${JSON.stringify(report, null, 2)}\n`;
const reportFile = join(root, REPORT_PATH);
if (WRITE) { writeFileSync(reportFile, reportJson); console.log(`NOTE wrote ${REPORT_PATH}`); }
check(`committed ${REPORT_PATH} matches this run (deterministic quantities)`, existsSync(reportFile) && readFileSync(reportFile, "utf8") === reportJson,
  existsSync(reportFile) ? `sha ${sha(reportJson).slice(0, 16)}` : "missing; run with --write");

// ---------- 9. Print tables + latency (reported, not asserted) ----------
console.log(`\nNOTE energy: ${ENERGY_LABEL}`);
for (const [name, v] of Object.entries(results)) {
  console.log(`\n=== ${name} (T=${v.T}, D=${v.D}) — ${v.label}`);
  console.log("strategy       bytes      vs_f64  vs_q   bits/ef  rank bound  max_abs_err                 agree(per task)            events%  dirty%  dec pJ/ef (est)");
  for (const r of v.rows) {
    console.log(`${r.strategy.padEnd(14)} ${String(r.bytes).padStart(9)}  ${r.ratio_vs_full_f64.toFixed(2).padStart(6)} ${r.ratio_vs_full_q.toFixed(2).padStart(5)}  ${r.bits_per_element_frame.toFixed(2).padStart(6)}  ${String(r.rank).padStart(4)} ${String(r.bound_ok).padEnd(6)} ${r.max_abs_err.map((x) => x.toExponential(1)).join("/").padEnd(27)} ${r.decisions.map((d) => d.agreement.toFixed(3)).join("/").padEnd(26)} ${(100 * r.event_fraction).toFixed(1).padStart(6)} ${(100 * r.dirty_fraction).toFixed(1).padStart(6)}  ${r.energy_estimate_pj_per_element_frame.decode.join("–")}${r.scp4d ? `  cfg=${JSON.stringify(r.scp4d)} tried=${r.search_tried}` : ""}`);
  }
}
console.log("\n=== ablation (combined path components)");
for (const [k, rows] of Object.entries(ablation)) for (const a of rows) console.log(`${k.padEnd(18)} ${a.name.padEnd(46)} ${String(a.bytes).padStart(8)} B  events=${a.events}`);
console.log("\n=== fairness probe: scp4d at eps/2 (worst-case error equal to full_q / delta at eps)");
for (const f of fairness) console.log(`${f.fixture.padEnd(18)} scp4d@eps/2=${f.scp4d_half_eps_bytes} B  delta@eps=${f.delta_bytes} B  full_q@eps=${f.full_q_bytes} B  → ${f.vs_delta}× vs delta  agree=${f.decisions.map((d) => d.agreement).join("/")}`);
console.log("\n=== scaling (scp4d vs full_q / delta)");
for (const s of scaling) console.log(`${s.series.padEnd(8)} cells=${String(s.cells).padStart(4)} T=${String(s.T).padStart(3)} full_q=${s.full_q} delta=${s.delta} scp4d=${s.scp4d} → ${s.scp4d_vs_full_q.toFixed(2)}× / ${s.scp4d_vs_delta.toFixed(2)}×  cfg=${JSON.stringify(s.scp4d_config)}`);
console.log("\n=== intrinsic dimensionality (centred energy)");
for (const [k, p] of Object.entries(intrinsic)) console.log(`${k.padEnd(52)} k90=${p.k90} k99=${p.k99} k99.9=${p.k999} PR=${p.participation_ratio}`);
console.log("\n=== five properties");
for (const [k, p] of Object.entries(props)) console.log(`${k.padEnd(26)} ${p.verdict} — ${p.evidence}`);

console.log("\n=== latency p50 (ms; 5 runs; reported, not asserted; scp4d timed with its chosen config, search excluded)");
for (const name of ["v0.1", "B4096", "env-16x16x2-T64"]) {
  const fx = fixtures.find((f) => f.name === name)!;
  const parts: string[] = [];
  for (const s of ["full_q", "delta", "tensor_bound", "scp4d"] as StrategyId[]) {
    const cfg = results[name].rows.find((r) => r.strategy === "scp4d")!.scp4d ?? undefined;
    const opts = { ...fx.options, scp4d: s === "scp4d" ? cfg : undefined };
    const enc: number[] = [], dec: number[] = [];
    let bytes: Uint8Array = new Uint8Array();
    for (let i = 0; i < 5; i++) {
      const t0 = performance.now(); bytes = stateCompressor.compress(fx.surface, s, opts).bytes; enc.push(performance.now() - t0);
      const t1 = performance.now(); stateReconstructor.reconstruct(bytes, fx.surface.relations); dec.push(performance.now() - t1);
    }
    parts.push(`${s} enc ${percentile(enc, 0.5).toFixed(2)} / dec ${percentile(dec, 0.5).toFixed(2)}`);
  }
  console.log(`${name.padEnd(16)} ${parts.join(" | ")}`);
}

if (failures.length) { console.error(`FAIL check-scp-v019-bench (${failures.length} failed: ${failures.join("; ")})`); process.exit(1); }
console.log(`PASS check-scp-v019-bench (${passed} checks)`);
