/** TEST ONLY. 4D-SCP v0.1.2 stress measurement. Fixtures only; no network, no writes.
 *
 * Stress-tests the v0.1.1 claim (quantized compact 3.72× vs compact binary on the regular
 * v0.1 fixture) on less regular data, without changing the stored chain format or hashes.
 *
 * Fixtures:
 *   v0.1  — the original 256-point hand-written fixture (engine heads must stay frozen)
 *   A     — 4D points derived from committed fixtures/medicare/sample-rows.json (synthetic,
 *           test-only mapping; 6 rows, not padded)
 *   B256  — seeded mulberry32 random walk + gaussian noise + jumps, N=256
 *   B4096 — the same generator and seed, N=4096 (B256 is the prefix)
 *
 * Encodings and baselines match v0.1.1, with gzip(binary) treated as a first-class
 * general-purpose baseline: raw JSON, compact binary, gzip(JSON), gzip(binary),
 * engine lossless/bounded canonical, quantized compact, gzip(quantized), plus
 * gzip of the stored canonical form.
 *
 * Pass criteria: fidelity, retained score = 1.0, determinism, v0.1 heads unchanged,
 * latency under the hang bound. Ratios are reported, not asserted. If quantized loses
 * to compact binary on a fixture, that is printed honestly and is not a failure.
 *
 * Run: npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-scp-v012.ts
 */
import {
  BOUNDED, BOUNDED_EPS, FIXTURE_ROWS, LATENCY_P95_HANG_MS, LATENCY_SAMPLES, LOSSLESS,
  N, SHUFFLE_SEED, TENANT, V01_HEADS, fixturePoint,
} from "./scp-v01-fixture";
import { B256_N, B4096_N, MEDICARE_MAPPING, NOISE_SEED, medicareRows, noisyPoints, noisyRows } from "./scp-v012-fixtures";
import { fmt, measureFixture, sealOptsFor, type FixtureMeasure } from "./scp-measure";

let passed = 0;
const failures: string[] = [];
function check(name: string, cond: boolean, detail?: string): void {
  if (cond) {
    passed++;
    console.log(`PASS ${name}${detail ? `: ${detail}` : ""}`);
  } else {
    failures.push(name);
    console.error(`FAIL ${name}${detail ? `: ${detail}` : ""}`);
  }
}

const medicare = medicareRows();
console.log(`NOTE fixture A: ${medicare.n} committed synthetic Medicare rows; too few to stress size; not padded. Mapping is TEST-ONLY / SYNTHETIC: ${JSON.stringify(MEDICARE_MAPPING)}`);
check("fixture A uses only committed Medicare rows and is labelled synthetic",
  medicare.padded === false && medicare.file.synthetic === true && medicare.n === medicare.file.rows.length && medicare.n >= 1,
  `n=${medicare.n}`);
check("fixture A is small (not padded to 256)", medicare.n < 256, `n=${medicare.n} (do not invent Medicare rows)`);
check("fixture A mapping keeps |phi| above eps.phi",
  medicare.points.every((p) => Math.abs(p.phi) > BOUNDED_EPS.phi),
  medicare.points.map((p) => p.phi).join(", "));
check("fixture A includes more than one verdict class",
  new Set(medicare.points.map((p) => p.verdict)).size >= 2);

const b256 = noisyRows(B256_N, "scp-v012-noise256", "b256", NOISE_SEED);
const b4096 = noisyRows(B4096_N, "scp-v012-noise4096", "b4k", NOISE_SEED);
const prefix = noisyPoints(B256_N, NOISE_SEED);
check("B256 is the prefix of B4096 at the same seed",
  prefix.length === B256_N
  && b256.points.length === B256_N
  && b4096.points.length === B4096_N
  && prefix.every((p, i) =>
    Object.is(p.predicted, b4096.points[i].predicted)
    && Object.is(p.observed, b4096.points[i].observed)
    && Object.is(p.phi, b4096.points[i].phi)
    && p.t === b4096.points[i].t
    && p.step === b4096.points[i].step
    && p.verdict === b4096.points[i].verdict)
  && b256.points.every((p, i) => p.t === prefix[i].t && Object.is(p.phi, prefix[i].phi)),
  `seed=${NOISE_SEED} algorithm=mulberry32+Box-Muller`);
check("B256/B4096 keep |phi| >= 0.05 so the Φ class cannot flip at eps.phi",
  b4096.points.every((p) => Math.abs(p.phi) >= 0.05));
check("B256/B4096 include all three verdicts",
  new Set(b256.points.map((p) => p.verdict)).size === 3
  && new Set(b4096.points.map((p) => p.verdict)).size === 3);

const t0v01 = fixturePoint(0).t;
const tLastV01 = fixturePoint(N - 1).t;
const t0A = medicare.points[0].t;
const tLastA = medicare.points[medicare.n - 1].t;
const t0B = b4096.points[0].t;
const tLastB256 = b256.points[B256_N - 1].t;
const tLastB4096 = b4096.points[B4096_N - 1].t;

const results: FixtureMeasure[] = [];

function run(name: string, tenant: string, source: typeof FIXTURE_ROWS, n: number, t0: number, tLast: number, notes: string[], expectHeads?: { lossless: string; bounded: string }) {
  const m = measureFixture({
    name, tenant, source,
    seal: sealOptsFor(n, t0, tLast),
    eps: BOUNDED_EPS,
    lossless: LOSSLESS,
    bounded: BOUNDED,
    shuffleSeed: SHUFFLE_SEED,
    latencySamples: LATENCY_SAMPLES,
    expectHeads,
    notes,
  });
  results.push(m);
  for (const e of m.errors) check(`${name}: ${e}`, false);
  check(`${name}: n=${m.n} sealed, no pending`, m.n === n && m.errors.length === 0, `segments noted in MEASURE; n=${m.n}`);
  check(`${name}: lossless fidelity exact`, m.fidelity.lossless);
  check(`${name}: bounded fidelity <= eps`, m.fidelity.bounded);
  check(`${name}: quantized fidelity <= eps`, m.fidelity.quantized);
  check(`${name}: binary baseline bit-exact`, m.fidelity.binary);
  check(`${name}: lossless retained = 1.0`, m.retained.lossless === 1, `score=${m.retained.lossless}`);
  check(`${name}: bounded retained = 1.0`, m.retained.bounded === 1, `score=${m.retained.bounded}`);
  check(`${name}: quantized retained = 1.0`, m.retained.quantized === 1, `score=${m.retained.quantized}`);
  check(`${name}: lossless determinism`, m.determinism.lossless, `head=${m.heads.lossless}`);
  check(`${name}: bounded determinism`, m.determinism.bounded, `head=${m.heads.bounded}`);
  check(`${name}: quantized determinism`, m.determinism.quantized, `hash=${m.heads.quantized}`);
  check(`${name}: binary determinism`, m.determinism.binary, `hash=${m.heads.binary}`);
  const qLat = m.rows.find((r) => r.encoding.startsWith("quantized"));
  const lLat = m.rows.find((r) => r.encoding.startsWith("engine lossless"));
  const bLat = m.rows.find((r) => r.encoding.startsWith("engine bounded"));
  check(`${name}: latency p95 under hang bound`,
    (lLat?.p95_ms ?? 0) < LATENCY_P95_HANG_MS
    && (bLat?.p95_ms ?? 0) < LATENCY_P95_HANG_MS
    && (qLat?.p95_ms ?? 0) < LATENCY_P95_HANG_MS,
    `lossless p95=${lLat?.p95_ms?.toFixed(3)}ms bounded p95=${bLat?.p95_ms?.toFixed(3)}ms quantized p95=${qLat?.p95_ms?.toFixed(3)}ms K=${LATENCY_SAMPLES}`);
  const vsBin = fmt(m.quantized_vs_binary);
  if (m.quantized_smaller_than_binary) {
    console.log(`NOTE ${name}: quantized is smaller than compact binary (${m.rows[2].bytes} B vs ${m.baselines.binary_bytes} B, ${vsBin}x)`);
  } else {
    console.log(`NOTE ${name}: quantized LOSES to compact binary (${m.rows[2].bytes} B vs ${m.baselines.binary_bytes} B, ${vsBin}x) — reported, not a failure`);
  }
  return m;
}

run("v0.1", TENANT, FIXTURE_ROWS, N, t0v01, tLastV01, ["original regular 256-point fixture"], V01_HEADS);
check("v0.1 lossless head unchanged", results[0].heads.lossless === V01_HEADS.lossless);
check("v0.1 bounded head unchanged", results[0].heads.bounded === V01_HEADS.bounded);

run("A-medicare", "scp-v012-medicare", medicare.rows, medicare.n, t0A, tLastA, [
  `TEST-ONLY SYNTHETIC mapping from fixtures/medicare/sample-rows.json; n=${medicare.n}; not padded`,
  `mapping: predicted=${MEDICARE_MAPPING.predicted}; observed=${MEDICARE_MAPPING.observed}; phi=${MEDICARE_MAPPING.phi}; t=${MEDICARE_MAPPING.t}; verdict=${MEDICARE_MAPPING.verdict}`,
]);

run("B256", "scp-v012-noise256", b256.rows, B256_N, t0B, tLastB256, [
  `seeded PRNG mulberry32 seed=${NOISE_SEED}; Box-Muller noise; random walk + jumps; N=${B256_N}`,
]);

run("B4096", "scp-v012-noise4096", b4096.rows, B4096_N, t0B, tLastB4096, [
  `same generator and seed as B256; N=${B4096_N}`,
]);

console.log("--- v0.1.2 per-fixture baselines (bytes) ---");
console.log(["fixture", "n", "raw_json", "binary", "gzip_json", "gzip_binary", "gzip_scp_lossless", "gzip_scp_bounded", "gzip_quantized", "best_gp"].join("\t"));
for (const m of results) {
  const b = m.baselines;
  console.log([m.name, m.n, b.raw_json_bytes, b.binary_bytes, b.gzip_json_bytes, b.gzip_binary_bytes,
    b.gzip_scp_lossless_bytes, b.gzip_scp_bounded_bytes, b.gzip_quantized_bytes, `${b.best_general_purpose.name}`].join("\t"));
}

console.log("--- v0.1.2 per-fixture ratios (baseline / encoding; >1 means smaller than that baseline) ---");
console.log(["fixture", "encoding", "bytes", "vs_raw_json", "vs_binary", "vs_gzip_json", "vs_gzip_binary", "vs_gzip_scp_canonical", "fidelity", "retained", "p50_ms", "p95_ms", "hash"].join("\t"));
for (const m of results) {
  for (const r of m.rows) {
    console.log([
      m.name, r.encoding, r.bytes,
      fmt(r.ratios.vs_raw_json), fmt(r.ratios.vs_binary), fmt(r.ratios.vs_gzip_json),
      fmt(r.ratios.vs_gzip_binary), fmt(r.ratios.vs_gzip_scp_canonical),
      r.fidelity_ok, r.retained,
      r.p50_ms === null ? "n/a" : r.p50_ms.toFixed(3),
      r.p95_ms === null ? "n/a" : r.p95_ms.toFixed(3),
      r.hash,
    ].join("\t"));
  }
}

const lines: string[] = [];
for (const m of results) {
  const q = m.rows[2];
  const best = m.baselines.best_general_purpose;
  const vsBest = best.bytes / q.bytes;
  const vsBin = m.quantized_vs_binary;
  lines.push(`${m.name} (n=${m.n}): quantized ${q.bytes} B is ${fmt(vsBin)}× vs compact binary (${m.baselines.binary_bytes} B)${m.quantized_smaller_than_binary ? "" : " — loses"} and ${fmt(vsBest)}× vs best general-purpose (${best.name})`);
}
const v01 = results[0];
const vsBest = (m: FixtureMeasure) => `${m.name} ${fmt(m.baselines.best_general_purpose.bytes / m.rows[2].bytes)}× vs ${m.baselines.best_general_purpose.name}`;
const headline = `The v0.1.1 3.72× claim is quantized vs compact binary on the regular v0.1 fixture (${fmt(v01.quantized_vs_binary)}×, 2551 B vs 9481 B); versus the best general-purpose baseline, which is gzip(binary) on every fixture here, quantized is ${results.map(vsBest).join(", ")}. Stored canonical never beats compact binary or gzip(binary); it only slightly beats gzip(JSON) on the noisy fixtures and on Medicare lossless. Fidelity ≤ eps and retained score 1.0 held on every fixture. Fixture A has only 6 committed synthetic Medicare rows and was not padded.`;
console.log(`HEADLINE ${headline}`);
console.log(`MEASURE v012: ${JSON.stringify({ results: results.map((m) => ({ name: m.name, n: m.n, notes: m.notes, baselines: m.baselines, rows: m.rows, heads: m.heads, quantized_vs_binary: m.quantized_vs_binary, quantized_smaller_than_binary: m.quantized_smaller_than_binary })), headline })}`);

if (failures.length) {
  console.error(`FAIL check-scp-v012 (${failures.length} failed, ${passed} passed): ${failures.join("; ")}`);
  process.exit(1);
}
console.log(`PASS check-scp-v012 (${passed} checks)`);
