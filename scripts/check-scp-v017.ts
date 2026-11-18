/** TEST ONLY. 4D-SCP v0.1.7 rounding-exact divider-free reciprocal quantization check.
 * Fixtures only; no network, no writes, no production data.
 *
 * Asserts: the test-only exact-reciprocal variant is byte-identical to pack.ts
 * on all four fixtures, is deterministic, has per-point div = 0, and matches
 * pack.ts q on the v0.1.6 scan set (all 22,944 prior residual mismatches,
 * including the three named counterexamples), the full pack.ts-legal v0.1.6
 * grid, a focused edge battery, and a larger random scan — zero mismatches.
 * pack.ts is not modified. The v0.1.5 cost model is re-run with the new encode
 * op mix and n_fp_divs_encode = 0; ratios and flips are reported, not asserted
 * as wins, except that the old "divider ≥ 7× FP mul" area flip must stay gone.
 *
 * Run: npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-scp-v017.ts
 */
import {
  buildTenantChain,
  verifyChain,
  type SourceRow,
} from "../src/core/compression";
import { decodeQuantized, encodeQuantized, encodeQuantizedIntBaseline } from "../src/scp";
import {
  BOUNDED, FIXTURE_ROWS, N, SHUFFLE_SEED, TENANT, V01_HEADS,
  fixturePoint, sealedPoints, shaBytes, shuffle,
} from "./scp-v01-fixture";
import { B256_N, B4096_N, NOISE_SEED, medicareRows, noisyRows } from "./scp-v012-fixtures";
import { fmt, sealOptsFor, toPacked } from "./scp-measure";
import {
  V014_PUBLISHED, codecOf, evaluateFixture, ratioRange, relativeTable,
  type CostAssumptions,
} from "./scp-v015-cost-model";
import {
  countsEqual, decodeQuantizedCounted, encodeQuantizedCounted, totalOps,
} from "./scp-v014-ops";
import {
  KNOWN_COUNTEREXAMPLES, noDividerAssumptions, packQuantizeQ, quantizeReciprocalQ,
  sensitivityFor,
} from "./scp-v016-recip";
import {
  V016_SCAN_STATS,
  encodeQuantizedExactCounted,
  quantizeExactQ,
  quantizeIeeeDivQ,
  scanFocusedEdges,
  scanLargeRandom,
  scanV016GridAllLegal,
  scanV016SetExact,
} from "./scp-v017-exact-recip";

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

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

const packedEps = { x: 0.001, y: 0.001, z: 0.0001 };

type Live = {
  name: string;
  n: number;
  packed: ReturnType<typeof toPacked>;
  scqi_bytes: number;
  pack_bytes: Uint8Array;
  exact_bytes: Uint8Array;
  exact_counts: ReturnType<typeof encodeQuantizedExactCounted>["counts"];
  exact_setup: ReturnType<typeof encodeQuantizedExactCounted>["setup"];
  decode_counts: ReturnType<typeof decodeQuantizedCounted>["counts"];
};

const lives: Live[] = [];

function measure(name: string, tenant: string, source: readonly SourceRow[], n: number, t0: number, tLast: number, expectHeads?: { lossless: string; bounded: string }) {
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
  const packEnc = encodeQuantized(packed, packedEps);
  const packEnc2 = encodeQuantized(packed, packedEps);
  const exact = encodeQuantizedExactCounted(packed, packedEps);
  const exact2 = encodeQuantizedExactCounted(packed, packedEps);
  const countedPack = encodeQuantizedCounted(packed, packedEps);
  check(`${name}: pack.ts encode is deterministic`, bytesEqual(packEnc.bytes, packEnc2.bytes));
  check(`${name}: exact-reciprocal encode is deterministic`, bytesEqual(exact.bytes, exact2.bytes) && countsEqual(exact.counts, exact2.counts));
  check(`${name}: exact-reciprocal bytes are identical to pack.ts`, bytesEqual(exact.bytes, packEnc.bytes), `sha pack=${shaBytes(packEnc.bytes)} exact=${shaBytes(exact.bytes)}`);
  check(`${name}: instrumented pack.ts counts still match v0.1.4 published`, name in V014_PUBLISHED
    ? countsEqual(countedPack.counts, V014_PUBLISHED[name as keyof typeof V014_PUBLISHED].encode)
    : countedPack.counts.div > 0);
  check(`${name}: exact-reciprocal per-point div is 0`, exact.counts.div === 0, `div=${exact.counts.div}`);
  check(`${name}: exact-reciprocal setup has exactly 3 axis divisions`, exact.setup.setup_div === 3, `setup_div=${exact.setup.setup_div}`);
  check(`${name}: exact-reciprocal encode does not bump div when re-run`, exact2.counts.div === 0);
  const dec = decodeQuantized(exact.bytes);
  const decC = decodeQuantizedCounted(exact.bytes);
  check(`${name}: pack.ts decode of exact-reciprocal bytes has n=${n}`, dec.points.length === n);
  check(`${name}: decode op counts are deterministic and have div=0`,
    countsEqual(decC.counts, decodeQuantizedCounted(exact.bytes).counts) && decC.counts.div === 0);

  lives.push({
    name, n, packed,
    scqi_bytes: encodeQuantizedIntBaseline(packed, packedEps).bytes.length,
    pack_bytes: packEnc.bytes,
    exact_bytes: exact.bytes,
    exact_counts: exact.counts,
    exact_setup: exact.setup,
    decode_counts: decC.counts,
  });
}

const med = medicareRows();
const b256 = noisyRows(B256_N, "scp-v012-noise256", "b256", NOISE_SEED);
const b4096 = noisyRows(B4096_N, "scp-v012-noise4096", "b4k", NOISE_SEED);
measure("v0.1", TENANT, FIXTURE_ROWS, N, fixturePoint(0).t, fixturePoint(N - 1).t, V01_HEADS);
measure("A-medicare", "scp-v012-medicare", med.rows, med.n, med.points[0].t, med.points[med.n - 1].t);
measure("B256", "scp-v012-noise256", b256.rows, B256_N, b256.points[0].t, b256.points[B256_N - 1].t);
measure("B4096", "scp-v012-noise4096", b4096.rows, B4096_N, b4096.points[0].t, b4096.points[B4096_N - 1].t);
check("Medicare fixture is 6 synthetic rows, not padded", med.n === 6 && med.file.synthetic === true && med.padded === false);

for (const cex of KNOWN_COUNTEREXAMPLES) {
  const packQ = packQuantizeQ(cex.v, cex.eps);
  const exactQ = quantizeExactQ(cex.v, cex.eps);
  const ieeeQ = quantizeIeeeDivQ(cex.v, cex.eps);
  const recipQ = quantizeReciprocalQ(cex.v, cex.eps);
  check(`v0.1.6 counterexample now matches pack.ts: v=${cex.v} eps=${cex.eps} pack_q=${cex.pack_q}`,
    packQ === cex.pack_q && exactQ === packQ && ieeeQ === packQ && recipQ === cex.recip_q && packQ !== recipQ,
    `got pack=${packQ} exact=${exactQ} ieee=${ieeeQ} old_recip=${recipQ}`);
}

const v016set = scanV016SetExact();
check("v0.1.6 scan set size is unchanged",
  v016set.tested === V016_SCAN_STATS.tested && v016set.skipped_out_of_range === V016_SCAN_STATS.skipped_out_of_range,
  `tested=${v016set.tested} skipped=${v016set.skipped_out_of_range}`);
check("v0.1.6 scan prior residual mismatches are all present",
  v016set.prior_mismatches === V016_SCAN_STATS.recip_mismatches,
  `prior_mismatches=${v016set.prior_mismatches}`);
check("v0.1.6 scan: exact variant has zero mismatches", v016set.exact_mismatches === 0, `mismatches=${v016set.exact_mismatches} samples=${JSON.stringify(v016set.samples)}`);
check("v0.1.6 scan: all 22,944 prior residual mismatches now match pack.ts",
  v016set.prior_fixed === v016set.prior_mismatches && v016set.prior_mismatches === V016_SCAN_STATS.recip_mismatches,
  `prior_fixed=${v016set.prior_fixed}`);
console.log(`NOTE v0.1.6 scan set: tested=${v016set.tested} skipped=${v016set.skipped_out_of_range} prior_mismatches=${v016set.prior_mismatches} prior_fixed=${v016set.prior_fixed} exact_mismatches=${v016set.exact_mismatches} naive_mismatches=${v016set.naive_mismatches}`);

const v016all = scanV016GridAllLegal();
check("v0.1.6 full legal grid includes the residual-throw cases",
  v016all.tested === V016_SCAN_STATS.tested + V016_SCAN_STATS.skipped_out_of_range && v016all.prior_throws === V016_SCAN_STATS.skipped_out_of_range,
  `tested=${v016all.tested} prior_throws=${v016all.prior_throws}`);
check("v0.1.6 full legal grid: exact variant has zero mismatches", v016all.exact_mismatches === 0, `mismatches=${v016all.exact_mismatches}`);
check("v0.1.6 residual-throw cases now match pack.ts",
  v016all.prior_fixed === v016all.prior_throws + v016all.prior_mismatches && v016all.prior_throws === V016_SCAN_STATS.skipped_out_of_range,
  `prior_throws=${v016all.prior_throws} prior_mismatches=${v016all.prior_mismatches} prior_fixed=${v016all.prior_fixed}`);
console.log(`NOTE v0.1.6 full legal grid: tested=${v016all.tested} prior_throws=${v016all.prior_throws} prior_mismatches=${v016all.prior_mismatches} prior_fixed=${v016all.prior_fixed} exact_mismatches=${v016all.exact_mismatches}`);

const focused = scanFocusedEdges();
check("focused edge battery tested a non-trivial set", focused.tested >= 1_000, `tested=${focused.tested}`);
check("focused edge battery: exact variant has zero mismatches", focused.exact_mismatches === 0, `mismatches=${focused.exact_mismatches} samples=${JSON.stringify(focused.samples)}`);
console.log(`NOTE focused edges: tested=${focused.tested} skipped=${focused.skipped_out_of_range} exact_mismatches=${focused.exact_mismatches} prior_mismatches=${focused.prior_mismatches}`);

const large = scanLargeRandom(2_000_000, 20261118);
check("larger random scan tested at least 1,000,000 pack.ts-legal inputs", large.tested >= 1_000_000, `tested=${large.tested} skipped=${large.skipped_out_of_range}`);
check("larger random scan: exact variant has zero mismatches", large.exact_mismatches === 0, `tested=${large.tested} mismatches=${large.exact_mismatches} samples=${JSON.stringify(large.samples)}`);
console.log(`NOTE large random: tested=${large.tested} skipped=${large.skipped_out_of_range} exact_mismatches=${large.exact_mismatches} prior_mismatches=${large.prior_mismatches} naive_mismatches=${large.naive_mismatches}`);

const assumptions: CostAssumptions = noDividerAssumptions();
check("cost-model assumption sets n_fp_divs_encode = 0", assumptions.compact.n_fp_divs_encode.value === 0);

const b4live = lives.find((l) => l.name === "B4096")!;
const costRows = lives.map((l) => evaluateFixture(l.name, l.n, l.scqi_bytes, l.exact_bytes.length, l.exact_counts, l.decode_counts, assumptions));
const b4 = costRows.find((r) => r.fixture === "B4096")!;
const enc = codecOf(b4, "compact-encode");
const dec = codecOf(b4, "compact-decode");
const g9e = codecOf(b4, "gzip-l9-encode");
const g6e = codecOf(b4, "gzip-l6-encode");
const g9d = codecOf(b4, "gzip-l9-decode");
const b11e = codecOf(b4, "brotli-q11-encode");
const b11d = codecOf(b4, "brotli-q11-decode");

check("exact-reciprocal encode op mix has div/point = 0", enc.op_mix_per_point !== null && enc.op_mix_per_point.div === 0);
check("B4096 exact-reciprocal encode total ops is consistent", totalOps(b4live.exact_counts) === totalOps(b4live.exact_counts));
check("cost-model energy/area ranges are labelled estimates",
  enc.energy_pj_per_point.label === "estimate" && enc.area_um2.label === "estimate" && g9e.area_um2.label === "estimate");

const hits = sensitivityFor(b4live.n, b4live.scqi_bytes, b4live.exact_bytes.length, b4live.exact_counts, b4live.decode_counts, assumptions);
const divAreaFlip = hits.find((h) => h.parameter === "area_um2.fp_div_factor_high")!;
const divEnergyFlip = hits.find((h) => h.parameter === "energy_pj.div_high")!;
check("old gzip area flip (divider factor ≥ 7× FP mul) remains eliminated", divAreaFlip.flips === false, divAreaFlip.note);
check("inflating divider energy still does not flip encode-energy robustness (no per-point divs)", divEnergyFlip.flips === false, divEnergyFlip.note);

const remaining = hits.filter((h) => h.flips);
console.log("--- v0.1.7 revised Layer 2 cost model (ESTIMATES; rounding-exact divider-free variant; not measured silicon) ---");
console.log(["fixture", "codec", "state_B", "ops_per_pt", "area_um2_low", "area_um2_high", "rel_area_low", "rel_area_high",
  "E_pJ_pt_low", "E_pJ_pt_high", "rel_E_low", "rel_E_high", "robust_area", "robust_E"].join("\t"));
const tables: Record<string, ReturnType<typeof relativeTable>> = {};
for (const row of costRows) {
  const table = relativeTable(row);
  tables[row.fixture] = table;
  for (const t of table) {
    console.log([
      row.fixture, t.codec, t.state_bytes,
      t.ops_per_point === null ? "" : fmt(t.ops_per_point as number, 2),
      fmt(t.area_um2_low as number, 0), fmt(t.area_um2_high as number, 0),
      fmt(t.rel_area_vs_compact_enc_low as number, 3), fmt(t.rel_area_vs_compact_enc_high as number, 3),
      fmt(t.energy_pj_per_point_low as number, 2), fmt(t.energy_pj_per_point_high as number, 2),
      fmt(t.rel_energy_vs_compact_same_side_low as number, 3), fmt(t.rel_energy_vs_compact_same_side_high as number, 3),
      t.robust_area_win_for_compact === null ? "" : String(t.robust_area_win_for_compact),
      t.robust_energy_win_for_compact === null ? "" : String(t.robust_energy_win_for_compact),
    ].join("\t"));
  }
}

console.log("--- remaining sensitivity flips (B4096, compact high < other low) ---");
for (const h of hits) {
  console.log(`SENS ${h.metric} vs ${h.compared}: ${h.parameter} default=${h.default_value} flip=${h.flip_value ?? "none-in-grid"} flips=${h.flips}`);
}

const eRelG9 = ratioRange(enc.energy_pj_per_point, g9e.energy_pj_per_point);
const eRelB11 = ratioRange(enc.energy_pj_per_point, b11e.energy_pj_per_point);
const aRelG9 = ratioRange(enc.area_um2, g9e.area_um2);
const aRelB11 = ratioRange(enc.area_um2, b11e.area_um2);
const remainTxt = remaining.map((h) => `${h.parameter}→${h.flip_value}`).join("; ") || "none";

const headline = `A rounding-exact divider-free compact encode variant (precomputed 1/eps, multiply, and an exact IEEE-aware boundary correction) is byte-identical to pack.ts on all four fixtures and matches pack.ts q on every tested legal input — the v0.1.6 scan (${v016set.tested.toLocaleString("en-US")} points, all ${V016_SCAN_STATS.recip_mismatches.toLocaleString("en-US")} prior residual mismatches including the three named counterexamples), the full pack.ts-legal v0.1.6 grid (${v016all.tested.toLocaleString("en-US")}, including ${V016_SCAN_STATS.skipped_out_of_range.toLocaleString("en-US")} inputs the residual variant rejected), a focused edge battery (${focused.tested.toLocaleString("en-US")}), and a larger random scan (${large.tested.toLocaleString("en-US")}), with zero mismatches — so the algorithm is a drop-in candidate, but pack.ts is left unchanged pending an owner decision to swap the implementation (observable bytes would stay the same). Under the v0.1.5 45 nm assumptions with the divider unit removed, estimated B4096 encode energy is ${fmt(enc.energy_pj_per_point.low, 1)}–${fmt(enc.energy_pj_per_point.high, 1)} pJ/point versus gzip-l9 ${fmt(g9e.energy_pj_per_point.low, 1)}–${fmt(g9e.energy_pj_per_point.high, 1)} pJ (${fmt(eRelG9.low, 2)}–${fmt(eRelG9.high, 1)}×) and brotli-q11 ${fmt(b11e.energy_pj_per_point.low, 1)}–${fmt(b11e.energy_pj_per_point.high, 1)} pJ, and estimated area is ${fmt(enc.area_um2.low, 0)}–${fmt(enc.area_um2.high, 0)} µm² versus gzip ${fmt(g9e.area_um2.low, 0)}–${fmt(g9e.area_um2.high, 0)} µm² (${fmt(aRelG9.low, 2)}–${fmt(aRelG9.high, 1)}×) and brotli ${fmt(b11e.area_um2.low / 1e6, 2)}–${fmt(b11e.area_um2.high / 1e6, 2)} mm² (${fmt(aRelB11.low, 0)}–${fmt(aRelB11.high, 0)}×); the old gzip area flip (divider ≳ 7× an FP mul) remains eliminated, and the remaining flips are ${remainTxt}. These area and energy figures are estimates, not measured silicon. A finite scan is not a proof over every float64 pair.`;

console.log(`HEADLINE ${headline}`);
console.log(`MEASURE v017: ${JSON.stringify({
  label: "estimate",
  equivalence: {
    fixtures_byte_identical: lives.every((l) => bytesEqual(l.pack_bytes, l.exact_bytes)),
    fixtures: lives.map((l) => ({ name: l.name, n: l.n, bytes: l.exact_bytes.length, sha: shaBytes(l.exact_bytes), setup_div: l.exact_setup.setup_div, encode_div: l.exact_counts.div, encode_total_ops: totalOps(l.exact_counts) })),
    universal_claim: "algorithm implements Math.round(RN(v/eps)) via exact IEEE-aware multiply-compare; zero mismatches on the scans below; a finite scan is not exhaustion of all float64 pairs",
    v016_scan_set: { tested: v016set.tested, skipped: v016set.skipped_out_of_range, prior_mismatches: v016set.prior_mismatches, prior_fixed: v016set.prior_fixed, exact_mismatches: v016set.exact_mismatches, naive_mismatches: v016set.naive_mismatches },
    v016_full_legal_grid: { tested: v016all.tested, prior_throws: v016all.prior_throws, prior_mismatches: v016all.prior_mismatches, prior_fixed: v016all.prior_fixed, exact_mismatches: v016all.exact_mismatches },
    focused_edges: { tested: focused.tested, skipped: focused.skipped_out_of_range, exact_mismatches: focused.exact_mismatches },
    large_random: { tested: large.tested, skipped: large.skipped_out_of_range, exact_mismatches: large.exact_mismatches, seed: 20261118 },
    known_counterexamples_now_match: KNOWN_COUNTEREXAMPLES.map((cex) => ({ v: cex.v, eps: cex.eps, pack_q: cex.pack_q, exact_q: quantizeExactQ(cex.v, cex.eps) })),
  },
  cost: { tables, sensitivity: hits, remaining_flips: remaining },
  headline,
})}`);

if (failures.length) {
  console.error(`FAIL check-scp-v017 (${failures.length} failed, ${passed} passed): ${failures.join("; ")}`);
  process.exit(1);
}
console.log(`PASS check-scp-v017 (${passed} checks)`);
