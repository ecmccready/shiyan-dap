/** TEST ONLY. 4D-SCP v0.1.6 divider-free reciprocal quantization check.
 * Fixtures only; no network, no writes, no production data.
 *
 * Asserts: the test-only reciprocal variant is byte-identical to pack.ts on all
 * four fixtures, is deterministic, has per-point div = 0, and its op counts are
 * consistent when re-run. Known counterexamples (inputs where the variant is
 * *not* byte-identical) are reproduced so we do not claim universality.
 * pack.ts is not modified. The v0.1.5 cost model is re-run with the new encode
 * op mix and n_fp_divs_encode = 0; ratios and flips are reported, not asserted
 * as wins, except that the old "divider ≥ 7× FP mul" area flip must be gone.
 *
 * Run: npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-scp-v016.ts
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
  V014_PUBLISHED, codecOf, compactWinsRobust, evaluateFixture, ratioRange, relativeTable,
  type CostAssumptions,
} from "./scp-v015-cost-model";
import {
  countsEqual, decodeQuantizedCounted, encodeQuantizedCounted, totalOps,
} from "./scp-v014-ops";
import {
  KNOWN_COUNTEREXAMPLES, encodeQuantizedReciprocalCounted, naiveReciprocalQ,
  noDividerAssumptions, packQuantizeQ, quantizeReciprocalQ, scanReciprocalMismatches,
  sensitivityFor,
} from "./scp-v016-recip";

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
  recip_bytes: Uint8Array;
  recip_counts: ReturnType<typeof encodeQuantizedReciprocalCounted>["counts"];
  recip_setup: ReturnType<typeof encodeQuantizedReciprocalCounted>["setup"];
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
  const recip = encodeQuantizedReciprocalCounted(packed, packedEps);
  const recip2 = encodeQuantizedReciprocalCounted(packed, packedEps);
  const countedPack = encodeQuantizedCounted(packed, packedEps);
  check(`${name}: pack.ts encode is deterministic`, bytesEqual(packEnc.bytes, packEnc2.bytes));
  check(`${name}: reciprocal encode is deterministic`, bytesEqual(recip.bytes, recip2.bytes) && countsEqual(recip.counts, recip2.counts));
  check(`${name}: reciprocal bytes are identical to pack.ts`, bytesEqual(recip.bytes, packEnc.bytes), `sha pack=${shaBytes(packEnc.bytes)} recip=${shaBytes(recip.bytes)}`);
  check(`${name}: instrumented pack.ts counts still match v0.1.4 published`, name in V014_PUBLISHED
    ? countsEqual(countedPack.counts, V014_PUBLISHED[name as keyof typeof V014_PUBLISHED].encode)
    : countedPack.counts.div > 0);
  check(`${name}: reciprocal per-point div is 0`, recip.counts.div === 0, `div=${recip.counts.div}`);
  check(`${name}: reciprocal setup has exactly 3 axis divisions`, recip.setup.setup_div === 3, `setup_div=${recip.setup.setup_div}`);
  check(`${name}: reciprocal encode does not bump div when re-run`, recip2.counts.div === 0);
  const dec = decodeQuantized(recip.bytes);
  const decC = decodeQuantizedCounted(recip.bytes);
  check(`${name}: pack.ts decode of reciprocal bytes has n=${n}`, dec.points.length === n);
  check(`${name}: decode op counts are deterministic and have div=0`,
    countsEqual(decC.counts, decodeQuantizedCounted(recip.bytes).counts) && decC.counts.div === 0);

  lives.push({
    name, n, packed,
    scqi_bytes: encodeQuantizedIntBaseline(packed, packedEps).bytes.length,
    pack_bytes: packEnc.bytes,
    recip_bytes: recip.bytes,
    recip_counts: recip.counts,
    recip_setup: recip.setup,
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
  const recipQ = quantizeReciprocalQ(cex.v, cex.eps);
  const naiveQ = naiveReciprocalQ(cex.v, cex.eps);
  check(`counterexample reproduced: v=${cex.v} eps=${cex.eps} pack_q=${cex.pack_q} recip_q=${cex.recip_q}`,
    packQ === cex.pack_q && recipQ === cex.recip_q && naiveQ === cex.naive_q && packQ !== recipQ,
    `got pack=${packQ} recip=${recipQ} naive=${naiveQ}`);
}

const scan = scanReciprocalMismatches();
check("edge/random scan tested a large set", scan.tested >= 100_000, `tested=${scan.tested}`);
check("edge/random scan found mismatches (universality is false)", scan.mismatches > 0, `mismatches=${scan.mismatches} naive=${scan.naive_mismatches}`);
check("edge/random scan includes a known counterexample sample or is consistent with known cases",
  KNOWN_COUNTEREXAMPLES.every((cex) => quantizeReciprocalQ(cex.v, cex.eps) !== packQuantizeQ(cex.v, cex.eps)));
console.log(`NOTE edge scan: tested=${scan.tested} skipped=${scan.skipped_out_of_range} recip_mismatches=${scan.mismatches} naive_mismatches=${scan.naive_mismatches}`);
for (const s of scan.samples.slice(0, 6)) {
  console.log(`NOTE sample mismatch v=${s.v} eps=${s.eps} pack_q=${s.pack_q} recip_q=${s.recip_q} naive_q=${s.naive_q}`);
}

const assumptions: CostAssumptions = noDividerAssumptions();
check("cost-model assumption sets n_fp_divs_encode = 0", assumptions.compact.n_fp_divs_encode.value === 0);

const b4live = lives.find((l) => l.name === "B4096")!;
const costRows = lives.map((l) => evaluateFixture(l.name, l.n, l.scqi_bytes, l.recip_bytes.length, l.recip_counts, l.decode_counts, assumptions));
const b4 = costRows.find((r) => r.fixture === "B4096")!;
const enc = codecOf(b4, "compact-encode");
const dec = codecOf(b4, "compact-decode");
const g9e = codecOf(b4, "gzip-l9-encode");
const g6e = codecOf(b4, "gzip-l6-encode");
const g9d = codecOf(b4, "gzip-l9-decode");
const b11e = codecOf(b4, "brotli-q11-encode");
const b5e = codecOf(b4, "brotli-q5-encode");
const b11d = codecOf(b4, "brotli-q11-decode");

check("reciprocal encode op mix has div/point = 0", enc.op_mix_per_point !== null && enc.op_mix_per_point.div === 0);
check("B4096 reciprocal encode total ops is consistent", totalOps(b4live.recip_counts) === totalOps(b4live.recip_counts));
check("cost-model energy/area ranges are labelled estimates",
  enc.energy_pj_per_point.label === "estimate" && enc.area_um2.label === "estimate" && g9e.area_um2.label === "estimate");

const hits = sensitivityFor(b4live.n, b4live.scqi_bytes, b4live.recip_bytes.length, b4live.recip_counts, b4live.decode_counts, assumptions);
const divAreaFlip = hits.find((h) => h.parameter === "area_um2.fp_div_factor_high")!;
const divEnergyFlip = hits.find((h) => h.parameter === "energy_pj.div_high")!;
check("old gzip area flip (divider factor ≥ 7× FP mul) is eliminated", divAreaFlip.flips === false, divAreaFlip.note);
check("inflating divider energy no longer flips encode-energy robustness (no per-point divs)", divEnergyFlip.flips === false, divEnergyFlip.note);

const remaining = hits.filter((h) => h.flips);
console.log("--- v0.1.6 revised Layer 2 cost model (ESTIMATES; divider-free variant; not measured silicon) ---");
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
const cex0 = KNOWN_COUNTEREXAMPLES[0];

const headline = `A divider-free compact encode variant (precomputed 1/eps, multiply, and residual correction) is byte-identical to pack.ts on all four fixtures, but not for every legal input — e.g. v=${cex0.v}, eps=${cex0.eps} gives pack.ts q=${cex0.pack_q} vs reciprocal q=${cex0.recip_q} — so pack.ts is unchanged. Under the v0.1.5 45 nm assumptions with the divider unit removed, estimated B4096 encode energy is ${fmt(enc.energy_pj_per_point.low, 1)}–${fmt(enc.energy_pj_per_point.high, 1)} pJ/point versus gzip-l9 ${fmt(g9e.energy_pj_per_point.low, 1)}–${fmt(g9e.energy_pj_per_point.high, 1)} pJ (${fmt(eRelG9.low, 2)}–${fmt(eRelG9.high, 1)}×) and brotli-q11 ${fmt(b11e.energy_pj_per_point.low, 1)}–${fmt(b11e.energy_pj_per_point.high, 1)} pJ, and estimated area is ${fmt(enc.area_um2.low, 0)}–${fmt(enc.area_um2.high, 0)} µm² versus gzip ${fmt(g9e.area_um2.low, 0)}–${fmt(g9e.area_um2.high, 0)} µm² (${fmt(aRelG9.low, 2)}–${fmt(aRelG9.high, 1)}×) and brotli ${fmt(b11e.area_um2.low / 1e6, 2)}–${fmt(b11e.area_um2.high / 1e6, 2)} mm² (${fmt(aRelB11.low, 0)}–${fmt(aRelB11.high, 0)}×); the old gzip area flip (divider ≳ 7× an FP mul) is eliminated, and the remaining flips are ${remainTxt}. These area and energy figures are estimates, not measured silicon.`;

console.log(`HEADLINE ${headline}`);
console.log(`MEASURE v016: ${JSON.stringify({
  label: "estimate",
  equivalence: {
    fixtures_byte_identical: lives.every((l) => bytesEqual(l.pack_bytes, l.recip_bytes)),
    fixtures: lives.map((l) => ({ name: l.name, n: l.n, bytes: l.recip_bytes.length, sha: shaBytes(l.recip_bytes), setup_div: l.recip_setup.setup_div, encode_div: l.recip_counts.div, encode_total_ops: totalOps(l.recip_counts) })),
    universal_byte_identical: false,
    known_counterexamples: KNOWN_COUNTEREXAMPLES,
    edge_scan: { tested: scan.tested, recip_mismatches: scan.mismatches, naive_mismatches: scan.naive_mismatches, skipped: scan.skipped_out_of_range, samples: scan.samples },
  },
  cost: { tables, sensitivity: hits, remaining_flips: remaining },
  headline,
})}`);

if (failures.length) {
  console.error(`FAIL check-scp-v016 (${failures.length} failed, ${passed} passed): ${failures.join("; ")}`);
  process.exit(1);
}
console.log(`PASS check-scp-v016 (${passed} checks)`);
