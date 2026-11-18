/** TEST ONLY. 4D-SCP v0.1.5 Layer 2 analytical cost model check.
 * Fixtures only; no network, no writes, no production data.
 *
 * Asserts: determinism of the model, internal consistency with v0.1.4 op-count
 * instrumentation, monotonicity, units, and that area/energy outputs are labelled
 * estimates. Does not assert that compact "wins" — those ratios are reported.
 *
 * Run: npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-scp-v015.ts
 */
import {
  buildTenantChain,
  verifyChain,
  type SourceRow,
} from "../src/core/compression";
import { encodeQuantized, encodeQuantizedIntBaseline } from "../src/scp";
import {
  BOUNDED, FIXTURE_ROWS, N, SHUFFLE_SEED, TENANT, V01_HEADS,
  fixturePoint, sealedPoints, shaBytes, shuffle,
} from "./scp-v01-fixture";
import { B256_N, B4096_N, NOISE_SEED, noisyRows } from "./scp-v012-fixtures";
import { sealOptsFor, toPacked } from "./scp-measure";
import { encodeQuantizedCounted, decodeQuantizedCounted, countsEqual, totalOps, type OpCounts } from "./scp-v014-ops";
import {
  V014_PUBLISHED, codecOf, compactWinsRobust, defaultAssumptions, evaluateFixture,
  evaluatePublished, flattenAssumptions, modelReport, ratioRange, sensitivity,
  stableStringify, unlabeledEstimateFields, type CodecId, type CostAssumptions, type FixtureName,
} from "./scp-v015-cost-model";

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

const packedEps = { x: 0.001, y: 0.001, z: 0.0001 };

function fmt(n: number, d = 4): string {
  return Number.isFinite(n) ? n.toFixed(d) : String(n);
}
function fmtInt(n: number): string {
  return Number.isFinite(n) ? Math.round(n).toString() : String(n);
}

function countsMatchPublished(live: OpCounts, published: OpCounts): boolean {
  return countsEqual(live, published);
}

const reportA = modelReport();
const reportB = modelReport();
check("model report is deterministic", stableStringify(reportA) === stableStringify(reportB));
check("evaluatePublished is deterministic", stableStringify(evaluatePublished()) === stableStringify(evaluatePublished()));
check("sensitivity is deterministic", stableStringify(sensitivity()) === stableStringify(sensitivity()));
check("default assumptions flatten deterministically",
  stableStringify(flattenAssumptions(defaultAssumptions())) === stableStringify(flattenAssumptions(defaultAssumptions())));

const unlabeled = unlabeledEstimateFields(reportA);
check("all area/energy ranges are labelled estimate", unlabeled.length === 0, unlabeled.length ? unlabeled.join(", ") : "ok");
check("report itself is labelled estimate", reportA.label === "estimate");
check("disclaimer present and mentions estimate",
  reportA.disclaimer.includes("estimates") && reportA.disclaimer.includes("not measurements"));
check("process node is the cited 45nm assumption", reportA.process_node === "45nm");
check("every assumption has a source string", reportA.assumptions.every((a) => typeof a.source === "string" && a.source.length > 0));
check("assumption kinds are only assumption, cited-literature, derived-from-v014, or specified",
  reportA.assumptions.every((a) => a.kind === "assumption" || a.kind === "cited-literature" || a.kind === "derived-from-v014" || a.kind === "specified"));
check("no assumption kind is 'measured' for energy or area constants",
  reportA.assumptions.every((a) => a.kind !== ("measured" as string)));

for (const name of Object.keys(V014_PUBLISHED) as FixtureName[]) {
  const pub = V014_PUBLISHED[name];
  check(`${name}: published encode total matches op mix`, totalOps(pub.encode) === pub.encode_total, `${totalOps(pub.encode)} vs ${pub.encode_total}`);
  check(`${name}: published decode total matches op mix`, totalOps(pub.decode) === pub.decode_total, `${totalOps(pub.decode)} vs ${pub.decode_total}`);
}

function measureLive(name: FixtureName, tenant: string, source: readonly SourceRow[], n: number, t0: number, tLast: number, expectHeads?: { lossless: string; bounded: string }) {
  const seal = sealOptsFor(n, t0, tLast);
  const lossless = buildTenantChain(tenant, source, { ...seal, loss: { mode: "lossless" } });
  const bounded = buildTenantChain(tenant, source, { ...seal, loss: BOUNDED });
  const points = sealedPoints(lossless);
  check(`${name}: sealed n=${n}`, points.length === n && lossless.pending === 0 && lossless.excluded.count === 0);
  check(`${name}: lossless chain verifies`, verifyChain(lossless.segments).ok);
  check(`${name}: bounded chain verifies`, verifyChain(bounded.segments).ok);
  if (expectHeads) {
    check(`${name}: lossless head unchanged from v0.1`, lossless.head_sha256 === expectHeads.lossless);
    check(`${name}: bounded head unchanged from v0.1`, bounded.head_sha256 === expectHeads.bounded);
  }
  const shuffled = buildTenantChain(tenant, shuffle(source, SHUFFLE_SEED), { ...seal, loss: { mode: "lossless" } });
  check(`${name}: engine lossless determinism (shuffle)`, shuffled.head_sha256 === lossless.head_sha256);

  const packed = toPacked(points);
  const scqi = encodeQuantizedIntBaseline(packed, packedEps);
  const compact = encodeQuantized(packed, packedEps);
  const pub = V014_PUBLISHED[name];
  check(`${name}: SCQI bytes match v0.1.4 published`, scqi.bytes.length === pub.scqi_bytes, `${scqi.bytes.length} vs ${pub.scqi_bytes}`);
  check(`${name}: compact bytes match v0.1.4 published`, compact.bytes.length === pub.compact_bytes, `${compact.bytes.length} vs ${pub.compact_bytes}`);

  const enc = encodeQuantizedCounted(packed, packedEps);
  const enc2 = encodeQuantizedCounted(packed, packedEps);
  const dec = decodeQuantizedCounted(compact.bytes);
  const dec2 = decodeQuantizedCounted(compact.bytes);
  check(`${name}: instrumented encode bytes match pack.ts`, shaBytes(enc.bytes) === shaBytes(compact.bytes));
  check(`${name}: live encode op counts match v0.1.4 published`, countsMatchPublished(enc.counts, pub.encode));
  check(`${name}: live decode op counts match v0.1.4 published`, countsMatchPublished(dec.counts, pub.decode));
  check(`${name}: instrumented encode op counts deterministic`, countsEqual(enc.counts, enc2.counts));
  check(`${name}: instrumented decode op counts deterministic`, countsEqual(dec.counts, dec2.counts));

  const liveRow = evaluateFixture(name, n, scqi.bytes.length, compact.bytes.length, enc.counts, dec.counts);
  const pubRow = evaluatePublished().find((r) => r.fixture === name)!;
  check(`${name}: model(live counts) equals model(published counts)`, stableStringify(liveRow) === stableStringify(pubRow));
}

const b256 = noisyRows(B256_N, "scp-v012-noise256", "b256", NOISE_SEED);
const b4096 = noisyRows(B4096_N, "scp-v012-noise4096", "b4k", NOISE_SEED);
measureLive("v0.1", TENANT, FIXTURE_ROWS, N, fixturePoint(0).t, fixturePoint(N - 1).t, V01_HEADS);
measureLive("B256", "scp-v012-noise256", b256.rows, B256_N, b256.points[0].t, b256.points[B256_N - 1].t);
measureLive("B4096", "scp-v012-noise4096", b4096.rows, B4096_N, b4096.points[0].t, b4096.points[B4096_N - 1].t);

const a = defaultAssumptions();
const b4 = reportA.fixtures.find((f) => f.fixture === "B4096")!;
const enc = codecOf(b4, "compact-encode");
const dec = codecOf(b4, "compact-decode");
const g9e = codecOf(b4, "gzip-l9-encode");
const g6e = codecOf(b4, "gzip-l6-encode");
const g9d = codecOf(b4, "gzip-l9-decode");
const b11e = codecOf(b4, "brotli-q11-encode");
const b5e = codecOf(b4, "brotli-q5-encode");
const b11d = codecOf(b4, "brotli-q11-decode");

check("units: compact energy is pJ/point", enc.energy_pj_per_point.unit === "pJ/point" && dec.energy_pj_per_point.unit === "pJ/point");
check("units: area is um^2", enc.area_um2.unit === "um^2" && g9e.area_um2.unit === "um^2" && b11e.area_um2.unit === "um^2");
check("units: gate equivalents are GE", enc.area_ge.unit === "GE");
check("units: state is bytes", enc.state_bytes === a.compact.encode_state_bytes.value && dec.state_bytes === a.compact.decode_state_bytes.value);
check("compact encode state is 40 B (v0.1.4)", enc.state_bytes === 40);
check("compact decode state is 64 B (v0.1.4)", dec.state_bytes === 64);
check("gzip window is 32 KiB", g9e.state_bytes === 32768 && g6e.state_bytes === 32768);
check("brotli window is 4 MiB", b11e.state_bytes === 4194304);
check("all energy/area lows are positive and low <= high",
  b4.codecs.every((c) => c.energy_pj_per_point.low > 0 && c.energy_pj_per_point.low <= c.energy_pj_per_point.high
    && c.area_um2.low > 0 && c.area_um2.low <= c.area_um2.high));
check("monotonic: gzip-l9 encode energy high >= gzip-l6 encode energy high", g9e.energy_pj_per_point.high >= g6e.energy_pj_per_point.high);
check("monotonic: gzip-l9 encode energy low >= gzip-l6 encode energy low", g9e.energy_pj_per_point.low >= g6e.energy_pj_per_point.low);
check("monotonic: brotli-q11 encode energy high >= brotli-q5 encode energy high", b11e.energy_pj_per_point.high >= b5e.energy_pj_per_point.high);
check("monotonic: brotli-q11 encode energy low >= brotli-q5 encode energy low", b11e.energy_pj_per_point.low >= b5e.energy_pj_per_point.low);
check("monotonic: brotli area low > gzip area low (4 MiB vs 32 KiB)", b11e.area_um2.low > g9e.area_um2.low);
check("monotonic: brotli area high > gzip area high", b11e.area_um2.high > g9e.area_um2.high);
check("monotonic: gzip-l9 and gzip-l6 share area (same window)",
  g9e.area_um2.low === g6e.area_um2.low && g9e.area_um2.high === g6e.area_um2.high);
check("monotonic: more gzip-l9 accesses increases encode energy", (() => {
  const more = defaultAssumptions();
  more.gzip.l9_accesses_low.value = a.gzip.l9_accesses_low.value * 2;
  more.gzip.l9_accesses_high.value = a.gzip.l9_accesses_high.value * 2;
  const row = evaluatePublished(more).find((f) => f.fixture === "B4096")!;
  const o = codecOf(row, "gzip-l9-encode");
  return o.energy_pj_per_point.low > g9e.energy_pj_per_point.low && o.energy_pj_per_point.high > g9e.energy_pj_per_point.high;
})());
check("monotonic: denser SRAM assumption shrinks gzip area low", (() => {
  const denser = defaultAssumptions();
  denser.area_um2.sram_per_bit_low.value = a.area_um2.sram_per_bit_low.value / 2;
  const row = evaluatePublished(denser).find((f) => f.fixture === "B4096")!;
  return codecOf(row, "gzip-l9-encode").area_um2.low < g9e.area_um2.low;
})());
check("B4096 compact encode ops/point matches v0.1.4 amortization",
  enc.ops_per_point !== null && Math.abs(enc.ops_per_point.low - V014_PUBLISHED.B4096.encode_total / V014_PUBLISHED.B4096.n) < 1e-12);
check("B4096 compact decode ops/point matches v0.1.4 amortization",
  dec.ops_per_point !== null && Math.abs(dec.ops_per_point.low - V014_PUBLISHED.B4096.decode_total / V014_PUBLISHED.B4096.n) < 1e-12);
check("op mix per point includes add/sub/shift/branch/bytes",
  !!enc.op_mix_per_point && enc.op_mix_per_point.add > 0 && enc.op_mix_per_point.sub > 0
  && enc.op_mix_per_point.shift > 0 && enc.op_mix_per_point.branch > 0 && enc.op_mix_per_point.bytes_written > 0);

const a2 = defaultAssumptions();
a2.brotli.four_mb_high_uses_dram.value = false;
const onChip = evaluatePublished(a2).find((f) => f.fixture === "B4096")!;
check("monotonic: treating 4 MiB as DRAM raises brotli high-corner energy",
  b11e.energy_pj_per_point.high > codecOf(onChip, "brotli-q11-encode").energy_pj_per_point.high);

console.log("--- v0.1.5 Layer 2 cost model (ESTIMATES, 45 nm assumptions, not measured silicon) ---");
console.log(["fixture", "codec", "state_B", "ws_low", "ws_high", "ops_per_pt", "acc_low", "acc_high",
  "area_um2_low", "area_um2_high", "rel_area_low", "rel_area_high",
  "E_pJ_pt_low", "E_pJ_pt_high", "rel_E_low", "rel_E_high", "robust_area", "robust_E"].join("\t"));

for (const f of reportA.fixtures) {
  const table = reportA.tables[f.fixture];
  for (const row of table) {
    console.log([
      f.fixture, row.codec, row.state_bytes, fmtInt(row.working_set_bytes_low as number), fmtInt(row.working_set_bytes_high as number),
      row.ops_per_point === null ? "" : fmt(row.ops_per_point as number, 2),
      row.accesses_per_point_low === null ? "" : fmt(row.accesses_per_point_low as number, 1),
      row.accesses_per_point_high === null ? "" : fmt(row.accesses_per_point_high as number, 1),
      fmt(row.area_um2_low as number, 0), fmt(row.area_um2_high as number, 0),
      fmt(row.rel_area_vs_compact_enc_low as number, 3), fmt(row.rel_area_vs_compact_enc_high as number, 3),
      fmt(row.energy_pj_per_point_low as number, 2), fmt(row.energy_pj_per_point_high as number, 2),
      fmt(row.rel_energy_vs_compact_same_side_low as number, 3), fmt(row.rel_energy_vs_compact_same_side_high as number, 3),
      row.robust_area_win_for_compact === null ? "" : String(row.robust_area_win_for_compact),
      row.robust_energy_win_for_compact === null ? "" : String(row.robust_energy_win_for_compact),
    ].join("\t"));
  }
}

console.log("--- assumptions (id, value, unit, kind) ---");
for (const item of reportA.assumptions) {
  console.log([item.id, String(item.value), item.unit, item.kind].join("\t"));
}

console.log("--- sensitivity (B4096; robust win = compact high < other low) ---");
for (const h of reportA.sensitivity) {
  console.log(`SENS ${h.metric} vs ${h.compared}: ${h.parameter} default=${h.default_value} flip=${h.flip_value ?? "none-in-grid"} flips=${h.flips}`);
}

const eRelG9 = ratioRange(enc.energy_pj_per_point, g9e.energy_pj_per_point);
const eRelB11 = ratioRange(enc.energy_pj_per_point, b11e.energy_pj_per_point);
const eRelG9d = ratioRange(dec.energy_pj_per_point, g9d.energy_pj_per_point);
const eRelB11d = ratioRange(dec.energy_pj_per_point, b11d.energy_pj_per_point);
const aRelG9 = ratioRange(enc.area_um2, g9e.area_um2);
const aRelB11 = ratioRange(enc.area_um2, b11e.area_um2);
const flipLines = reportA.sensitivity.filter((h) => h.flips).map((h) => `${h.parameter}→${h.flip_value}`).join("; ");

const headline = `Under Horowitz-45nm-style assumptions (estimates, not measured silicon), the compact quantized codec on B4096 has estimated encode energy ${fmt(enc.energy_pj_per_point.low, 1)}–${fmt(enc.energy_pj_per_point.high, 1)} pJ/point versus gzip-l9 ${fmt(g9e.energy_pj_per_point.low, 1)}–${fmt(g9e.energy_pj_per_point.high, 1)} pJ (${fmt(eRelG9.low, 2)}–${fmt(eRelG9.high, 1)}×) and brotli-q11 ${fmt(b11e.energy_pj_per_point.low, 1)}–${fmt(b11e.energy_pj_per_point.high, 1)} pJ (${fmt(eRelB11.low, 1)}–${fmt(eRelB11.high, 0)}×), and estimated area ${fmt(enc.area_um2.low, 0)}–${fmt(enc.area_um2.high, 0)} µm² versus gzip ${fmt(g9e.area_um2.low, 0)}–${fmt(g9e.area_um2.high, 0)} µm² (${fmt(aRelG9.low, 2)}–${fmt(aRelG9.high, 1)}×) and brotli ${fmt(b11e.area_um2.low / 1e6, 2)}–${fmt(b11e.area_um2.high / 1e6, 2)} mm² (${fmt(aRelB11.low, 0)}–${fmt(aRelB11.high, 0)}×); the 4 MiB vs 40 B working set drives a robust brotli gap, but the gzip area win is modest and flips if SRAM is assumed ≲0.16 µm²/bit or the compact divider is modelled at ≳7× an FP mul, gzip encode energy robustness fails if match-search drops to ~1 access/input-byte, and gzip decode energy is only barely robust (flips below ~0.5 access/output-byte).`;

console.log(`HEADLINE ${headline}`);
console.log(`MEASURE v015: ${JSON.stringify({
  label: "estimate",
  process_node: reportA.process_node,
  disclaimer: reportA.disclaimer,
  tables: reportA.tables,
  sensitivity: reportA.sensitivity,
  robust: {
    gzip_l9_encode_energy: compactWinsRobust(enc.energy_pj_per_point, g9e.energy_pj_per_point),
    gzip_l9_decode_energy: compactWinsRobust(dec.energy_pj_per_point, g9d.energy_pj_per_point),
    brotli_q11_encode_energy: compactWinsRobust(enc.energy_pj_per_point, b11e.energy_pj_per_point),
    brotli_q11_decode_energy: compactWinsRobust(dec.energy_pj_per_point, b11d.energy_pj_per_point),
    gzip_area: compactWinsRobust(enc.area_um2, g9e.area_um2),
    brotli_area: compactWinsRobust(enc.area_um2, b11e.area_um2),
  },
  flip_summary: flipLines,
  headline,
})}`);

if (failures.length) {
  console.error(`FAIL check-scp-v015 (${failures.length} failed, ${passed} passed): ${failures.join("; ")}`);
  process.exit(1);
}
console.log(`PASS check-scp-v015 (${passed} checks)`);
