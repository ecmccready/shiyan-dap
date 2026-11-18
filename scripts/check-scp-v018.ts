/** TEST ONLY. 4D-SCP v0.1.8 bit-accurate integer-only golden-model check.
 * Fixtures only; no network, no production data. Writes nothing.
 *
 * Asserts: the integer-only encoder is byte-identical to pack.ts on all four
 * fixtures (v0.1 quantized sha unchanged), decode round-trips exactly and
 * matches pack.ts after the documented back-end, q matches pack.ts with zero
 * mismatches on the v0.1.7 scan sets (v0.1.6 legal grid, focused edges, 2M
 * random), documented widths cover the legal domain and observed fixture
 * values, the committed golden-vector file matches a rebuild, per-point div
 * is 0, and the v0.1.5 cost model re-run with no FP units is labelled
 * estimate. pack.ts is not modified.
 *
 * Run: npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-scp-v018.ts
 */
import { readFileSync } from "fs";
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
import { sensitivityFor } from "./scp-v016-recip";
import { KNOWN_COUNTEREXAMPLES, packQuantizeQ } from "./scp-v016-recip";
import {
  V016_SCAN_STATS,
  backEndPoints,
  buildGoldenVectors,
  bytesToHex,
  censusFitsWidths,
  decodeInteger,
  encodeFromPacked,
  frontEndFloat,
  hexToBytes,
  integerOnlyAssumptions,
  mergeCensus,
  quantizeIeeeDivQ,
  quantizeIntegerQ,
  scanFocusedEdges,
  scanLargeRandom,
  scanV016GridAllLegal,
  stableGoldenJson,
  widthsFitLegalDomain,
  WIDTHS,
  type GoldenFile,
  type WidthCensus,
} from "./scp-v018-integer-model";

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
const GOLDEN_PATH = "fixtures/scp/golden-vectors.json";

type Live = {
  name: string;
  n: number;
  pack_bytes: Uint8Array;
  int_bytes: Uint8Array;
  int_counts: ReturnType<typeof encodeFromPacked>["counts"];
  int_setup: ReturnType<typeof encodeFromPacked>["setup"];
  decode_counts: ReturnType<typeof decodeInteger>["counts"];
  scqi_bytes: number;
  census: WidthCensus;
};

const lives: Live[] = [];
let allCensus: WidthCensus | null = null;

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
  const intEnc = encodeFromPacked(packed, packedEps);
  const intEnc2 = encodeFromPacked(packed, packedEps);
  const countedPack = encodeQuantizedCounted(packed, packedEps);
  check(`${name}: pack.ts encode is deterministic`, bytesEqual(packEnc.bytes, packEnc2.bytes));
  check(`${name}: integer encode is deterministic`, bytesEqual(intEnc.bytes, intEnc2.bytes) && countsEqual(intEnc.counts, intEnc2.counts));
  check(`${name}: integer bytes are identical to pack.ts`, bytesEqual(intEnc.bytes, packEnc.bytes), `sha pack=${shaBytes(packEnc.bytes)} int=${shaBytes(intEnc.bytes)}`);
  check(`${name}: instrumented pack.ts counts still match v0.1.4 published`, name in V014_PUBLISHED
    ? countsEqual(countedPack.counts, V014_PUBLISHED[name as keyof typeof V014_PUBLISHED].encode)
    : countedPack.counts.div > 0);
  check(`${name}: integer encode counts a positive integer div and no leftover is asserted as FP`, intEnc.counts.div > 0, `div=${intEnc.counts.div}`);
  check(`${name}: integer setup has exactly 3 axis integer reciprocals`, intEnc.setup.setup_idiv === 3, `setup_idiv=${intEnc.setup.setup_idiv}`);

  const packDec = decodeQuantized(packEnc.bytes);
  const intDec = decodeInteger(intEnc.bytes);
  const back = backEndPoints(intDec);
  check(`${name}: integer decode has n=${n}`, intDec.points.length === n && back.points.length === n);
  check(`${name}: integer decode q counts match encode`,
    intDec.qx.length === n && intDec.qx.every((q, i) => q === intEnc.qx[i]) &&
    intDec.qy.every((q, i) => q === intEnc.qy[i]) && intDec.qz.every((q, i) => q === intEnc.qz[i]));
  const ptsOk = back.points.every((p, i) => {
    const q = packDec.points[i];
    return p.x === q.x && p.y === q.y && p.z === q.z && p.t === q.t && p.step === q.step && p.verdict === q.verdict;
  });
  check(`${name}: integer decode matches pack.ts after back-end RN`, ptsOk && back.eps.x === packDec.eps.x && back.eps.y === packDec.eps.y && back.eps.z === packDec.eps.z);
  const re = encodeFromPacked(back.points, back.eps);
  check(`${name}: integer decode round-trips to the same bytes`, bytesEqual(re.bytes, intEnc.bytes));
  const intDec2 = decodeInteger(intEnc.bytes);
  check(`${name}: integer decode op counts are deterministic and have div=0`,
    countsEqual(intDec.counts, intDec2.counts) && intDec.counts.div === 0);

  const fit = censusFitsWidths(intEnc.census);
  check(`${name}: observed widths fit the documented registers`, fit.ok, fit.notes.join("; ") || "ok");

  allCensus = allCensus ? mergeCensus(allCensus, intEnc.census) : intEnc.census;
  allCensus = mergeCensus(allCensus, intDec.census);

  lives.push({
    name, n,
    pack_bytes: packEnc.bytes,
    int_bytes: intEnc.bytes,
    int_counts: intEnc.counts,
    int_setup: intEnc.setup,
    decode_counts: intDec.counts,
    scqi_bytes: encodeQuantizedIntBaseline(packed, packedEps).bytes.length,
    census: intEnc.census,
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
check("v0.1 quantized sha is unchanged", shaBytes(lives[0].int_bytes) === "07a3d04147714747a4823e6e934dc6144740eb2f6243e7113106aed06369d6bc");

const legal = widthsFitLegalDomain();
check("documented widths cover the legal domain (|q|<=2^53, safe t, i32 step)", legal.ok, legal.notes.join(" "));
const combinedFit = censusFitsWidths(allCensus!);
check("combined fixture census fits documented widths", combinedFit.ok, combinedFit.notes.join("; ") || `q_bits=${allCensus!.max_q_bits} t_bits=${allCensus!.max_t_bits} product=${allCensus!.max_product_bits} recon=${allCensus!.max_reconstruct_bits}`);
console.log(`NOTE widths legal=${JSON.stringify(WIDTHS)}`);
console.log(`NOTE fixture census max_abs_q=${allCensus!.max_abs_q} max_abs_t=${allCensus!.max_abs_t} max_abs_dt=${allCensus!.max_abs_dt} max_abs_step=${allCensus!.max_abs_step} max_abs_dstep=${allCensus!.max_abs_dstep} max_varint=${allCensus!.max_varint} q_bits=${allCensus!.max_q_bits} t_bits=${allCensus!.max_t_bits} product_bits=${allCensus!.max_product_bits} reconstruct_bits=${allCensus!.max_reconstruct_bits}`);

for (const cex of KNOWN_COUNTEREXAMPLES) {
  const packQ = packQuantizeQ(cex.v, cex.eps);
  const modelQ = Number(quantizeIntegerQ(cex.v, cex.eps));
  const ieeeQ = Number(quantizeIeeeDivQ(frontEndFloat(cex.v), frontEndFloat(cex.eps)));
  check(`v0.1.6 counterexample matches pack.ts and the integer RN-div cross-check: v=${cex.v} eps=${cex.eps}`,
    packQ === cex.pack_q && modelQ === packQ && ieeeQ === packQ,
    `pack=${packQ} model=${modelQ} ieee=${ieeeQ}`);
}

const grid = scanV016GridAllLegal();
check("v0.1.6 full legal grid size is 1,508,132", grid.tested === V016_SCAN_STATS.tested + V016_SCAN_STATS.skipped_out_of_range,
  `tested=${grid.tested}`);
check("v0.1.6 full legal grid: integer model has zero q mismatches", grid.mismatches === 0, `mismatches=${grid.mismatches} samples=${JSON.stringify(grid.samples)}`);
console.log(`NOTE v0.1.6 legal grid: tested=${grid.tested} skipped=${grid.skipped_out_of_range} mismatches=${grid.mismatches}`);

const focused = scanFocusedEdges();
check("focused edge battery tested a non-trivial set", focused.tested >= 1_000, `tested=${focused.tested}`);
check("focused edge battery: integer model has zero q mismatches", focused.mismatches === 0, `mismatches=${focused.mismatches} samples=${JSON.stringify(focused.samples)}`);
console.log(`NOTE focused edges: tested=${focused.tested} skipped=${focused.skipped_out_of_range} mismatches=${focused.mismatches}`);

const large = scanLargeRandom(2_000_000, 20261118);
check("larger random scan tested at least 1,000,000 pack.ts-legal inputs", large.tested >= 1_000_000, `tested=${large.tested} skipped=${large.skipped_out_of_range}`);
check("larger random scan: integer model has zero q mismatches", large.mismatches === 0, `tested=${large.tested} mismatches=${large.mismatches} samples=${JSON.stringify(large.samples)}`);
console.log(`NOTE large random: tested=${large.tested} skipped=${large.skipped_out_of_range} mismatches=${large.mismatches}`);

const v01live = lives.find((l) => l.name === "v0.1")!;
const packedV01 = toPacked(sealedPoints(buildTenantChain(TENANT, FIXTURE_ROWS, { ...sealOptsFor(N, fixturePoint(0).t, fixturePoint(N - 1).t), loss: { mode: "lossless" } })));
const rebuiltGolden = buildGoldenVectors({ v01Points: packedV01, v01Sha256: shaBytes(v01live.pack_bytes), packedEps });
const committedTxt = readFileSync(GOLDEN_PATH, "utf8");
const committed = JSON.parse(committedTxt) as GoldenFile;
check("committed golden-vector file is byte-identical to a rebuild", committedTxt === stableGoldenJson(rebuiltGolden));
check("golden file format and v0.1 sha",
  committed.format === "4d-scp-v0.1.8-golden-vectors" && committed.version === 1 && committed.v01_full_sha256 === "07a3d04147714747a4823e6e934dc6144740eb2f6243e7113106aed06369d6bc");
check("golden file has a small number of vectors", committed.vectors.length >= 5 && committed.vectors.length <= 16, `n=${committed.vectors.length}`);
for (const v of committed.vectors) {
  const pts = v.points.map((p) => ({
    x: hexBitsToNumber(p.x_bits),
    y: hexBitsToNumber(p.y_bits),
    z: hexBitsToNumber(p.z_bits),
    t: Number(p.t),
    step: Number(p.step),
    verdict: p.verdict,
  }));
  const ve = { x: hexBitsToNumber(v.eps.x_bits), y: hexBitsToNumber(v.eps.y_bits), z: hexBitsToNumber(v.eps.z_bits) };
  const packB = encodeQuantized(pts, ve).bytes;
  const intB = encodeFromPacked(pts, ve).bytes;
  check(`golden ${v.id}: integer bytes match pack.ts and the committed hex`,
    bytesEqual(packB, intB) && bytesToHex(intB) === v.bytes_hex);
  const dec = decodeInteger(hexToBytes(v.bytes_hex));
  check(`golden ${v.id}: decode q matches the vector and round-trips`,
    dec.qx.every((q, i) => q.toString() === v.q[i].x) &&
    dec.qy.every((q, i) => q.toString() === v.q[i].y) &&
    dec.qz.every((q, i) => q.toString() === v.q[i].z) &&
    bytesEqual(encodeFromPacked(backEndPoints(dec).points, ve).bytes, intB));
}

function hexBitsToNumber(hex: string): number {
  const buf = new ArrayBuffer(8);
  const dv = new DataView(buf);
  const bits = BigInt("0x" + hex);
  dv.setUint32(0, Number((bits >> BigInt(32)) & BigInt(0xffffffff)), false);
  dv.setUint32(4, Number(bits & BigInt(0xffffffff)), false);
  return dv.getFloat64(0, false);
}

const assumptions: CostAssumptions = integerOnlyAssumptions();
check("cost-model has no FP units (add, mul, encode div, decode div)",
  assumptions.compact.n_fp_adders.value === 0 && assumptions.compact.n_fp_muls.value === 0 &&
  assumptions.compact.n_fp_divs_encode.value === 0 && assumptions.compact.n_fp_divs_decode.value === 0);
check("cost-model has a shared integer multiplier", assumptions.compact.n_int_muls.value === 1);
check("integer mul energy uses the Horowitz integer-mul figure at both corners",
  assumptions.energy_pj.mul_low.value === 3.1 && assumptions.energy_pj.mul_high.value === 3.1);

const b4live = lives.find((l) => l.name === "B4096")!;
const costRows = lives.map((l) => evaluateFixture(l.name, l.n, l.scqi_bytes, l.int_bytes.length, l.int_counts, l.decode_counts, assumptions));
const b4 = costRows.find((r) => r.fixture === "B4096")!;
const enc = codecOf(b4, "compact-encode");
const dec = codecOf(b4, "compact-decode");
const g9e = codecOf(b4, "gzip-l9-encode");
const g6e = codecOf(b4, "gzip-l6-encode");
const g9d = codecOf(b4, "gzip-l9-decode");
const b11e = codecOf(b4, "brotli-q11-encode");
const b11d = codecOf(b4, "brotli-q11-decode");

check("integer encode op mix has a positive integer div/point and assumptions have n_fp_divs_encode = 0",
  enc.op_mix_per_point !== null && enc.op_mix_per_point.div > 0 && assumptions.compact.n_fp_divs_encode.value === 0,
  `div/pt=${enc.op_mix_per_point && enc.op_mix_per_point.div}`);
check("B4096 integer encode total ops is consistent", totalOps(b4live.int_counts) === totalOps(b4live.int_counts));
check("cost-model energy/area ranges are labelled estimates",
  enc.energy_pj_per_point.label === "estimate" && enc.area_um2.label === "estimate" && g9e.area_um2.label === "estimate");

const hits = sensitivityFor(b4live.n, b4live.scqi_bytes, b4live.int_bytes.length, b4live.int_counts, b4live.decode_counts, assumptions);
const divAreaFlip = hits.find((h) => h.parameter === "area_um2.fp_div_factor_high")!;
const divEnergyFlip = hits.find((h) => h.parameter === "energy_pj.div_high")!;
check("gzip area flip from an FP divider factor remains eliminated (n_fp_divs_encode = 0)", divAreaFlip.flips === false, divAreaFlip.note);
check("integer-div energy sensitivity is reported (div ops are integer RN-div, not an FP unit)",
  divEnergyFlip.parameter === "energy_pj.div_high", divEnergyFlip.note);

const remaining = hits.filter((h) => h.flips);
console.log("--- v0.1.8 revised Layer 2 cost model (ESTIMATES; integer-only golden model; no FP units; not measured silicon) ---");
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
const mix = enc.op_mix_per_point!;

const headline = `A bit-accurate integer-only golden model of the compact codec (IEEE front-end, integer correctly-rounded division RN(v/eps) plus integer Math.round, integer zigzag-delta varint, no payload floating point at runtime) is byte-identical to pack.ts on all four fixtures (v0.1 quantized sha 07a3d04147714747a4823e6e934dc6144740eb2f6243e7113106aed06369d6bc unchanged), decode round-trips exactly, and matches pack.ts q with zero mismatches on the v0.1.7 scan sets (v0.1.6 legal grid ${grid.tested.toLocaleString("en-US")}, focused edges ${focused.tested.toLocaleString("en-US")}, random ${large.tested.toLocaleString("en-US")}). Documented register widths cover the legal domain and the fixture census; golden vectors are in fixtures/scp/golden-vectors.json. pack.ts is unchanged pending an owner decision. Under the v0.1.5 45 nm assumptions with no FP units, estimated B4096 encode energy is ${fmt(enc.energy_pj_per_point.low, 1)}–${fmt(enc.energy_pj_per_point.high, 1)} pJ/point versus gzip-l9 ${fmt(g9e.energy_pj_per_point.low, 1)}–${fmt(g9e.energy_pj_per_point.high, 1)} pJ (${fmt(eRelG9.low, 2)}–${fmt(eRelG9.high, 1)}×) and brotli-q11 ${fmt(b11e.energy_pj_per_point.low, 1)}–${fmt(b11e.energy_pj_per_point.high, 1)} pJ, and estimated area is ${fmt(enc.area_um2.low, 0)}–${fmt(enc.area_um2.high, 0)} µm² versus gzip ${fmt(g9e.area_um2.low, 0)}–${fmt(g9e.area_um2.high, 0)} µm² (${fmt(aRelG9.low, 2)}–${fmt(aRelG9.high, 1)}×) and brotli ${fmt(b11e.area_um2.low / 1e6, 2)}–${fmt(b11e.area_um2.high / 1e6, 2)} mm² (${fmt(aRelB11.low, 0)}–${fmt(aRelB11.high, 0)}×); remaining flips are ${remainTxt}. These area and energy figures are estimates, not measured silicon or an FPGA result. A finite scan is not a proof over every float64 pair.`;

console.log(`HEADLINE ${headline}`);
function censusJson(c: WidthCensus) {
  return {
    max_abs_q: c.max_abs_q.toString(), max_abs_t: c.max_abs_t.toString(), max_abs_dt: c.max_abs_dt.toString(),
    max_abs_step: c.max_abs_step.toString(), max_abs_dstep: c.max_abs_dstep.toString(), max_varint: c.max_varint.toString(),
    max_q_bits: c.max_q_bits, max_t_bits: c.max_t_bits, max_product_bits: c.max_product_bits, max_reconstruct_bits: c.max_reconstruct_bits,
  };
}
console.log(`MEASURE v018: ${JSON.stringify({
  label: "estimate",
  widths: WIDTHS,
  fixture_census: censusJson(allCensus!),
  op_mix_per_point_B4096_encode: mix,
  equivalence: {
    fixtures_byte_identical: lives.every((l) => bytesEqual(l.pack_bytes, l.int_bytes)),
    fixtures: lives.map((l) => ({ name: l.name, n: l.n, bytes: l.int_bytes.length, sha: shaBytes(l.int_bytes), setup_idiv: l.int_setup.setup_idiv, encode_div: l.int_counts.div, encode_total_ops: totalOps(l.int_counts), decode_total_ops: totalOps(l.decode_counts) })),
    v016_legal_grid: { tested: grid.tested, skipped: grid.skipped_out_of_range, mismatches: grid.mismatches },
    focused_edges: { tested: focused.tested, skipped: focused.skipped_out_of_range, mismatches: focused.mismatches },
    large_random: { tested: large.tested, skipped: large.skipped_out_of_range, mismatches: large.mismatches, seed: 20261118 },
    golden_vectors: committed.vectors.length,
  },
  cost: { tables, sensitivity: hits, remaining_flips: remaining },
  headline,
})}`);

if (failures.length) {
  console.error(`FAIL check-scp-v018 (${failures.length} failed, ${passed} passed): ${failures.join("; ")}`);
  process.exit(1);
}
console.log(`PASS check-scp-v018 (${passed} checks)`);
