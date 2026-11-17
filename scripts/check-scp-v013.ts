/** TEST ONLY. 4D-SCP v0.1.3 fair lossy baselines. Fixtures only; no network, no writes.
 *
 * v0.1.2 compared the lossy quantized compact encoding to lossless baselines, so part of
 * the reported gain was simply allowing eps error. This check adds same-eps baselines:
 *   (a) fixed-width packing of q = round(v/eps): int32/int64 codes (SCQI) and float64 of
 *       v' = q*eps (SCQF)
 *   (b) gzip level 9 of (a)
 *   (c) brotli quality 11 of (a) and of the quantized compact encoding
 *   (d) gzip level 9 of the quantized compact encoding
 *
 * Each lossy encoding is checked for max_abs_err <= eps, retained score 1.0, and
 * deterministic bytes. The stored chain format and v0.1 hashes are not changed.
 *
 * Gain split: quantization = lossless binary / lossy int (or float) packing;
 * structure = lossy int packing / quantized compact (delta + varint of the same q's);
 * also versus gzip/brotli of those same integer codes.
 *
 * Run: npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-scp-v013.ts
 */
import {
  buildTenantChain,
  verifyChain,
  type SourceRow,
} from "../src/core/compression";
import {
  decodeQuantized,
  decodeQuantizedFloatBaseline,
  decodeQuantizedIntBaseline,
  encodeBinaryBaseline,
  encodeQuantized,
  encodeQuantizedFloatBaseline,
  encodeQuantizedIntBaseline,
  type PackedPoint,
} from "../src/scp";
import {
  BOUNDED, BOUNDED_EPS, FIXTURE_ROWS, LATENCY_P95_HANG_MS, LATENCY_SAMPLES, LOSSLESS,
  N, SHUFFLE_SEED, TENANT, V01_HEADS, fixturePoint, percentile, retainedFromPacked, sealedPoints,
  shaBytes, shuffle,
} from "./scp-v01-fixture";
import { B256_N, B4096_N, MEDICARE_MAPPING, NOISE_SEED, medicareRows, noisyRows } from "./scp-v012-fixtures";
import {
  BROTLI_QUALITY, brotliDeterministic, fmt, gzipDeterministic, ratio, sealOptsFor, toPacked,
} from "./scp-measure";

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

type Err = { x: number; y: number; z: number };

function lossyCheck(original: readonly PackedPoint[], got: readonly PackedPoint[], eps: { x: number; y: number; z: number }): { ok: boolean; err: Err; timeStepVerdict: boolean } {
  const err: Err = { x: 0, y: 0, z: 0 };
  if (original.length !== got.length) return { ok: false, err, timeStepVerdict: false };
  let timeStepVerdict = true;
  for (let i = 0; i < original.length; i++) {
    if (original[i].t !== got[i].t || original[i].step !== got[i].step || original[i].verdict !== got[i].verdict) {
      timeStepVerdict = false;
    }
    err.x = Math.max(err.x, Math.abs(got[i].x - original[i].x));
    err.y = Math.max(err.y, Math.abs(got[i].y - original[i].y));
    err.z = Math.max(err.z, Math.abs(got[i].z - original[i].z));
  }
  const ok = timeStepVerdict && err.x <= eps.x && err.y <= eps.y && err.z <= eps.z;
  return { ok, err, timeStepVerdict };
}

function latencies(fn: () => void, samples: number): { p50: number; p95: number; samples: number } {
  const times: number[] = [];
  for (let k = 0; k < samples; k++) {
    const t0 = performance.now();
    fn();
    times.push(performance.now() - t0);
  }
  return { p50: percentile(times, 0.50), p95: percentile(times, 0.95), samples: times.length };
}

type FairRow = {
  fixture: string;
  n: number;
  lossless_binary: number;
  lossy_int: number;
  lossy_int_width: 4 | 8;
  lossy_float: number;
  quantized_compact: number;
  gzip_lossy_int: number;
  gzip_lossy_float: number;
  gzip_quantized: number;
  brotli_lossy_int: number;
  brotli_lossy_float: number;
  brotli_quantized: number;
  vs_lossy_int: number;
  vs_lossy_float: number;
  vs_gzip_lossy_int: number;
  vs_gzip_lossy_float: number;
  vs_gzip_quantized: number;
  vs_brotli_lossy_int: number;
  vs_brotli_lossy_float: number;
  vs_brotli_quantized: number;
  quantization_gain_int: number;
  quantization_gain_float: number;
  structure_gain_vs_int: number;
  structure_gain_vs_gzip_int: number;
  structure_gain_vs_brotli_int: number;
  heads: { lossless: string; quantized: string; lossy_int: string; lossy_float: string };
};

const packedEps = { x: BOUNDED_EPS.predicted, y: BOUNDED_EPS.observed, z: BOUNDED_EPS.phi };
const results: FairRow[] = [];

function measure(name: string, tenant: string, source: readonly SourceRow[], n: number, t0: number, tLast: number, expectHeads?: { lossless: string; bounded: string }) {
  const seal = sealOptsFor(n, t0, tLast);
  const lossless = buildTenantChain(tenant, source, { ...seal, loss: LOSSLESS });
  const bounded = buildTenantChain(tenant, source, { ...seal, loss: BOUNDED });
  const points = sealedPoints(lossless);
  check(`${name}: sealed n=${n}, no pending, no excluded`,
    points.length === n && lossless.pending === 0 && lossless.excluded.count === 0 && bounded.pending === 0,
    `sealed=${points.length} pending=${lossless.pending} excluded=${lossless.excluded.count}`);
  check(`${name}: lossless chain verifies`, verifyChain(lossless.segments).ok, `head=${lossless.head_sha256}`);
  check(`${name}: bounded chain verifies`, verifyChain(bounded.segments).ok, `head=${bounded.head_sha256}`);
  if (expectHeads) {
    check(`${name}: lossless head unchanged from v0.1`, lossless.head_sha256 === expectHeads.lossless);
    check(`${name}: bounded head unchanged from v0.1`, bounded.head_sha256 === expectHeads.bounded);
  }
  const shuffled = buildTenantChain(tenant, shuffle(source, SHUFFLE_SEED), { ...seal, loss: LOSSLESS });
  check(`${name}: engine lossless determinism (shuffle)`, shuffled.head_sha256 === lossless.head_sha256);

  const packed = toPacked(points);
  const packedShuffled = toPacked(sealedPoints(shuffled));
  const binary = encodeBinaryBaseline(packed);

  const qInt = encodeQuantizedIntBaseline(packed, packedEps);
  const qIntAgain = encodeQuantizedIntBaseline(packed, packedEps);
  const qIntShuffled = encodeQuantizedIntBaseline(packedShuffled, packedEps);
  const qIntDec = decodeQuantizedIntBaseline(qInt.bytes);
  const qIntFid = lossyCheck(packed, qIntDec.points, packedEps);
  const qIntKeep = retainedFromPacked(points, qIntDec.points);
  check(`${name}: lossy int (SCQI) max_abs_err <= eps`, qIntFid.ok,
    `width=${qInt.width} err x=${qIntFid.err.x} y=${qIntFid.err.y} z=${qIntFid.err.z}`);
  check(`${name}: lossy int t/step/verdict exact`, qIntFid.timeStepVerdict);
  check(`${name}: lossy int retained = 1.0`, qIntKeep.score === 1, `score=${qIntKeep.score}`);
  check(`${name}: lossy int determinism`,
    shaBytes(qInt.bytes) === shaBytes(qIntAgain.bytes) && shaBytes(qInt.bytes) === shaBytes(qIntShuffled.bytes),
    shaBytes(qInt.bytes));
  check(`${name}: lossy int stored err matches measured`,
    qInt.max_abs_err.x <= packedEps.x && qInt.max_abs_err.y <= packedEps.y && qInt.max_abs_err.z <= packedEps.z);

  const qFloat = encodeQuantizedFloatBaseline(packed, packedEps);
  const qFloatAgain = encodeQuantizedFloatBaseline(packed, packedEps);
  const qFloatShuffled = encodeQuantizedFloatBaseline(packedShuffled, packedEps);
  const qFloatDec = decodeQuantizedFloatBaseline(qFloat.bytes);
  const qFloatFid = lossyCheck(packed, qFloatDec.points, packedEps);
  const qFloatKeep = retainedFromPacked(points, qFloatDec.points);
  check(`${name}: lossy float64 (SCQF) max_abs_err <= eps`, qFloatFid.ok,
    `err x=${qFloatFid.err.x} y=${qFloatFid.err.y} z=${qFloatFid.err.z}`);
  check(`${name}: lossy float64 t/step/verdict exact`, qFloatFid.timeStepVerdict);
  check(`${name}: lossy float64 retained = 1.0`, qFloatKeep.score === 1, `score=${qFloatKeep.score}`);
  check(`${name}: lossy float64 determinism`,
    shaBytes(qFloat.bytes) === shaBytes(qFloatAgain.bytes) && shaBytes(qFloat.bytes) === shaBytes(qFloatShuffled.bytes),
    shaBytes(qFloat.bytes));

  const compact = encodeQuantized(packed, packedEps);
  const compactAgain = encodeQuantized(packed, packedEps);
  const compactShuffled = encodeQuantized(packedShuffled, packedEps);
  const compactDec = decodeQuantized(compact.bytes);
  const compactFid = lossyCheck(packed, compactDec.points, packedEps);
  const compactKeep = retainedFromPacked(points, compactDec.points);
  check(`${name}: quantized compact max_abs_err <= eps`, compactFid.ok,
    `err x=${compactFid.err.x} y=${compactFid.err.y} z=${compactFid.err.z}`);
  check(`${name}: quantized compact t/step/verdict exact`, compactFid.timeStepVerdict);
  check(`${name}: quantized compact retained = 1.0`, compactKeep.score === 1, `score=${compactKeep.score}`);
  check(`${name}: quantized compact determinism`,
    shaBytes(compact.bytes) === shaBytes(compactAgain.bytes) && shaBytes(compact.bytes) === shaBytes(compactShuffled.bytes),
    shaBytes(compact.bytes));

  const gzipInt = gzipDeterministic(qInt.bytes);
  const gzipFloat = gzipDeterministic(qFloat.bytes);
  const gzipQ = gzipDeterministic(compact.bytes);
  const brotliInt = brotliDeterministic(qInt.bytes);
  const brotliFloat = brotliDeterministic(qFloat.bytes);
  const brotliQ = brotliDeterministic(compact.bytes);
  check(`${name}: gzip/brotli of fair encodings are deterministic`,
    gzipDeterministic(qInt.bytes).equals(gzipInt)
    && gzipDeterministic(compact.bytes).equals(gzipQ)
    && brotliDeterministic(qInt.bytes).equals(brotliInt)
    && brotliDeterministic(compact.bytes).equals(brotliQ));

  const lat = latencies(() => {
    encodeQuantizedIntBaseline(packed, packedEps);
    encodeQuantizedFloatBaseline(packed, packedEps);
    const c = encodeQuantized(packed, packedEps);
    decodeQuantizedIntBaseline(qInt.bytes);
    decodeQuantizedFloatBaseline(qFloat.bytes);
    decodeQuantized(c.bytes);
  }, LATENCY_SAMPLES);
  check(`${name}: encode/decode latency p95 under hang bound`, lat.p95 < LATENCY_P95_HANG_MS,
    `p50=${lat.p50.toFixed(3)}ms p95=${lat.p95.toFixed(3)}ms K=${LATENCY_SAMPLES}`);

  const row: FairRow = {
    fixture: name,
    n: points.length,
    lossless_binary: binary.length,
    lossy_int: qInt.bytes.length,
    lossy_int_width: qInt.width,
    lossy_float: qFloat.bytes.length,
    quantized_compact: compact.bytes.length,
    gzip_lossy_int: gzipInt.length,
    gzip_lossy_float: gzipFloat.length,
    gzip_quantized: gzipQ.length,
    brotli_lossy_int: brotliInt.length,
    brotli_lossy_float: brotliFloat.length,
    brotli_quantized: brotliQ.length,
    vs_lossy_int: ratio(qInt.bytes.length, compact.bytes.length),
    vs_lossy_float: ratio(qFloat.bytes.length, compact.bytes.length),
    vs_gzip_lossy_int: ratio(gzipInt.length, compact.bytes.length),
    vs_gzip_lossy_float: ratio(gzipFloat.length, compact.bytes.length),
    vs_gzip_quantized: ratio(gzipQ.length, compact.bytes.length),
    vs_brotli_lossy_int: ratio(brotliInt.length, compact.bytes.length),
    vs_brotli_lossy_float: ratio(brotliFloat.length, compact.bytes.length),
    vs_brotli_quantized: ratio(brotliQ.length, compact.bytes.length),
    quantization_gain_int: ratio(binary.length, qInt.bytes.length),
    quantization_gain_float: ratio(binary.length, qFloat.bytes.length),
    structure_gain_vs_int: ratio(qInt.bytes.length, compact.bytes.length),
    structure_gain_vs_gzip_int: ratio(gzipInt.length, compact.bytes.length),
    structure_gain_vs_brotli_int: ratio(brotliInt.length, compact.bytes.length),
    heads: {
      lossless: lossless.head_sha256 ?? "",
      quantized: shaBytes(compact.bytes),
      lossy_int: shaBytes(qInt.bytes),
      lossy_float: shaBytes(qFloat.bytes),
    },
  };
  results.push(row);
  const beatsGzipInt = compact.bytes.length < gzipInt.length;
  const beatsBrotliInt = compact.bytes.length < brotliInt.length;
  console.log(`NOTE ${name}: quantization gain (lossless binary / lossy int) ${fmt(row.quantization_gain_int)}x; float packing ${fmt(row.quantization_gain_float)}x; structure gain (lossy int / compact) ${fmt(row.structure_gain_vs_int)}x; vs gzip(lossy int) ${fmt(row.structure_gain_vs_gzip_int)}x${beatsGzipInt ? "" : " — compact LOSES"}; vs brotli(lossy int) ${fmt(row.structure_gain_vs_brotli_int)}x${beatsBrotliInt ? "" : " — compact LOSES"}`);
  return row;
}

const medicare = medicareRows();
const b256 = noisyRows(B256_N, "scp-v012-noise256", "b256", NOISE_SEED);
const b4096 = noisyRows(B4096_N, "scp-v012-noise4096", "b4k", NOISE_SEED);
check("fixture A has 6 committed synthetic Medicare rows, not padded", medicare.n === 6 && medicare.file.synthetic === true && medicare.padded === false, `n=${medicare.n}`);

measure("v0.1", TENANT, FIXTURE_ROWS, N, fixturePoint(0).t, fixturePoint(N - 1).t, V01_HEADS);
measure("A-medicare", "scp-v012-medicare", medicare.rows, medicare.n, medicare.points[0].t, medicare.points[medicare.n - 1].t);
measure("B256", "scp-v012-noise256", b256.rows, B256_N, b256.points[0].t, b256.points[B256_N - 1].t);
measure("B4096", "scp-v012-noise4096", b4096.rows, B4096_N, b4096.points[0].t, b4096.points[B4096_N - 1].t);

console.log("--- v0.1.3 fair lossy baselines (bytes) ---");
console.log(["fixture", "n", "lossless_binary", "lossy_int", "int_width", "lossy_float", "quantized_compact",
  "gzip_lossy_int", "gzip_lossy_float", "gzip_quantized",
  `brotli_q${BROTLI_QUALITY}_lossy_int`, `brotli_q${BROTLI_QUALITY}_lossy_float`, `brotli_q${BROTLI_QUALITY}_quantized`].join("\t"));
for (const r of results) {
  console.log([r.fixture, r.n, r.lossless_binary, r.lossy_int, r.lossy_int_width, r.lossy_float, r.quantized_compact,
    r.gzip_lossy_int, r.gzip_lossy_float, r.gzip_quantized,
    r.brotli_lossy_int, r.brotli_lossy_float, r.brotli_quantized].join("\t"));
}

console.log("--- v0.1.3 quantized compact vs fair lossy baselines (baseline / compact; >1 means compact is smaller) ---");
console.log(["fixture", "vs_lossy_int", "vs_lossy_float", "vs_gzip_lossy_int", "vs_gzip_lossy_float", "vs_gzip_quantized",
  "vs_brotli_lossy_int", "vs_brotli_lossy_float", "vs_brotli_quantized",
  "quantization_gain_int", "quantization_gain_float", "structure_gain_vs_int", "structure_gain_vs_gzip_int", "structure_gain_vs_brotli_int"].join("\t"));
for (const r of results) {
  console.log([r.fixture, fmt(r.vs_lossy_int), fmt(r.vs_lossy_float), fmt(r.vs_gzip_lossy_int), fmt(r.vs_gzip_lossy_float),
    fmt(r.vs_gzip_quantized), fmt(r.vs_brotli_lossy_int), fmt(r.vs_brotli_lossy_float), fmt(r.vs_brotli_quantized),
    fmt(r.quantization_gain_int), fmt(r.quantization_gain_float), fmt(r.structure_gain_vs_int),
    fmt(r.structure_gain_vs_gzip_int), fmt(r.structure_gain_vs_brotli_int)].join("\t"));
}

const v01 = results[0];
const headline = `At the same eps, packing already-rounded values as float64 does not shrink the lossless binary packing (v0.1 ${fmt(v01.quantization_gain_float)}×); switching to fixed-width int32 codes is only a ${fmt(v01.quantization_gain_int)}× quantization gain; the compact delta/varint encoding is ${results.map((r) => `${fmt(r.structure_gain_vs_int)}× on ${r.fixture}`).join(", ")} vs those uncompressed int codes and ${results.map((r) => `${fmt(r.structure_gain_vs_gzip_int)}×`).join(", ")} vs gzip of them, but on the regular v0.1 fixture it loses to brotli of the same codes (${fmt(v01.structure_gain_vs_brotli_int)}×, ${v01.quantized_compact} B vs ${v01.brotli_lossy_int} B) and is only ${fmt(results[2].structure_gain_vs_brotli_int)}× / ${fmt(results[3].structure_gain_vs_brotli_int)}× ahead of brotli on noisy N=256 / N=4096.`;
console.log(`HEADLINE ${headline}`);
console.log(`MEASURE v013: ${JSON.stringify({ brotli_quality: BROTLI_QUALITY, gzip_level: 9, eps: packedEps, mapping_note: MEDICARE_MAPPING.label, results, headline })}`);

if (failures.length) {
  console.error(`FAIL check-scp-v013 (${failures.length} failed, ${passed} passed): ${failures.join("; ")}`);
  process.exit(1);
}
console.log(`PASS check-scp-v013 (${passed} checks)`);
