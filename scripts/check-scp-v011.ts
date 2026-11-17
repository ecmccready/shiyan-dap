/** TEST ONLY. 4D-SCP v0.1.1 defensible size measurement. Fixtures only; no network, no writes.
 *
 * v0.1 reported compression_ratio = record_json / canonical(segment). That number is mostly
 * JSON envelope overhead, and the stored bounded text form can be slightly *larger* than
 * lossless because quantization is still written as hex text.
 *
 * This check keeps the stored engine format and v0.1 chain hashes unchanged, and adds:
 *   (a) raw JSON baseline (record_json UTF-8, same as v0.1 raw_bytes)
 *   (b) compact binary baseline of the same 4D points (float64 x,y,z + int64 t + int32 step
 *       + verdict byte), via src/scp/pack.ts
 *   (c) deterministic gzip (node zlib, level 9, mtime=0, OS=0xff) of raw JSON
 *   (d) the same gzip of the SCP segment canonical form
 * plus a measured bounded compact encoding (integer quantization at eps, zigzag-delta varint)
 * that is NOT written to the stored chain.
 *
 * Ratio convention (same as v0.1): baseline_bytes / encoding_bytes; greater than 1 means
 * the encoding is smaller than that baseline. The honest headline is the encoding versus
 * the best general-purpose baseline, min(binary, gzip-JSON) — not versus raw JSON.
 *
 * Run: npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-scp-v011.ts
 */
import { gzipSync } from "node:zlib";
import {
  buildTenantChain,
  reconstruct,
  verifyChain,
  verifyReconstruction,
  verifyTenantChain,
  type LossOption,
  type StatePoint,
} from "../src/core/compression";
import { canonical } from "../src/core/reconcile";
import {
  decodeBinaryBaseline,
  decodeQuantized,
  encodeBinaryBaseline,
  encodeQuantized,
  type PackedPoint,
} from "../src/scp";
import {
  BOUNDED, BOUNDED_EPS, FIXTURE_ROWS, LATENCY_P95_HANG_MS, LATENCY_SAMPLES, LOSSLESS,
  N, SHUFFLE_SEED, TENANT, V01_HEADS, bitExact, chainOpts, compressedBytes, maxAbsErr,
  percentile, rawBytes, rawJsonBytes, reconstructAll as reconstructAllFrom, retained,
  retainedFromPacked, sealedPoints, shaBytes, shuffle,
} from "./scp-v01-fixture";

/** Fixed gzip settings for a deterministic, comparable size. Not a speed measurement. */
const GZIP_LEVEL = 9;

function gzipDeterministic(data: string | Uint8Array): Buffer {
  const input = typeof data === "string" ? Buffer.from(data, "utf8") : Buffer.from(data);
  const buf = gzipSync(input, { level: GZIP_LEVEL });
  // Gzip header: MTIME at bytes 4-7, OS at byte 9. Pin both so the blob is host-independent.
  buf[4] = 0; buf[5] = 0; buf[6] = 0; buf[7] = 0;
  buf[9] = 0xff;
  return buf;
}

function ratio(baseline: number, encoded: number): number {
  return encoded === 0 ? Number.POSITIVE_INFINITY : baseline / encoded;
}

function fmt(n: number, digits = 4): string {
  return Number.isFinite(n) ? n.toFixed(digits) : String(n);
}

function toPacked(points: readonly StatePoint[]): PackedPoint[] {
  return points.map((p) => ({
    x: p.predicted, y: p.observed, z: p.phi, t: p.t, step: p.step, verdict: p.verdict,
  }));
}

function reconstructAll(chain: Parameters<typeof reconstructAllFrom>[0]) {
  return reconstructAllFrom(chain, reconstruct);
}

function binaryRoundTripOk(original: readonly PackedPoint[], got: readonly PackedPoint[]): boolean {
  if (original.length !== got.length) return false;
  return original.every((p, i) =>
    Object.is(p.x, got[i].x) && Object.is(p.y, got[i].y) && Object.is(p.z, got[i].z)
    && p.t === got[i].t && p.step === got[i].step && p.verdict === got[i].verdict);
}

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

type RatioSheet = {
  vs_raw_json: number;
  vs_binary: number;
  vs_gzip_json: number;
  vs_gzip_scp_canonical: number;
};

type Row = {
  encoding: string;
  bytes: number;
  ratios: RatioSheet;
  fidelity_ok: boolean;
  retained: number;
  p50_ms: number | null;
  p95_ms: number | null;
  hash: string;
};

function sheet(bytes: number, baselines: { raw: number; binary: number; gzipJson: number; gzipScp: number }): RatioSheet {
  return {
    vs_raw_json: ratio(baselines.raw, bytes),
    vs_binary: ratio(baselines.binary, bytes),
    vs_gzip_json: ratio(baselines.gzipJson, bytes),
    vs_gzip_scp_canonical: ratio(baselines.gzipScp, bytes),
  };
}

function measureEngine(label: "lossless" | "bounded", loss: LossOption) {
  const opts = chainOpts(loss);
  const chain = buildTenantChain(TENANT, FIXTURE_ROWS, opts);
  const points = sealedPoints(chain);
  const got = reconstructAll(chain);
  const err = maxAbsErr(points, got);
  const keep = retained(points, got);
  const reconOk = chain.segments.every((s, i) => verifyReconstruction(s, chain.windows[i].points).ok);
  const fidelityOk = label === "lossless"
    ? bitExact(points, got) && reconOk
    : reconOk
      && err.x <= BOUNDED_EPS.predicted
      && err.y <= BOUNDED_EPS.observed
      && err.z <= BOUNDED_EPS.phi
      && points.every((p, i) => p.t === got[i].t && Object.is(p.step, got[i].step) && p.verdict === got[i].verdict);
  const tenantOk = verifyTenantChain(TENANT, chain.segments, FIXTURE_ROWS, opts);
  const shuffled = buildTenantChain(TENANT, shuffle(FIXTURE_ROWS, SHUFFLE_SEED), opts);
  const again = buildTenantChain(TENANT, FIXTURE_ROWS, opts);
  const determinismOk = verifyChain(chain.segments).ok
    && chain.head_sha256 === V01_HEADS[label]
    && shuffled.head_sha256 === chain.head_sha256
    && again.head_sha256 === chain.head_sha256;
  const canonicalText = chain.segments.map((s) => canonical(s.segment)).join("");
  return {
    chain, points, got, err, keep, fidelityOk, determinismOk, tenantOk,
    raw: rawBytes(chain, FIXTURE_ROWS),
    canonical_bytes: compressedBytes(chain, canonical),
    canonicalText,
    head: chain.head_sha256 ?? "",
  };
}

function measureEngineLatency(loss: LossOption): { p50: number; p95: number; samples: number } {
  const opts = chainOpts(loss);
  const times: number[] = [];
  for (let k = 0; k < LATENCY_SAMPLES; k++) {
    const t0 = performance.now();
    const chain = buildTenantChain(TENANT, FIXTURE_ROWS, opts);
    const checks = verifyTenantChain(TENANT, chain.segments, FIXTURE_ROWS, opts);
    const dt = performance.now() - t0;
    if (!(checks.chain.ok && checks.reconstruction.ok)) throw new Error("latency sample failed verify");
    times.push(dt);
  }
  return { p50: percentile(times, 0.50), p95: percentile(times, 0.95), samples: times.length };
}

const lossless = measureEngine("lossless", LOSSLESS);
const bounded = measureEngine("bounded", BOUNDED);
check("engine lossless head unchanged from v0.1", lossless.head === V01_HEADS.lossless, lossless.head);
check("engine bounded head unchanged from v0.1", bounded.head === V01_HEADS.bounded, bounded.head);
check("engine lossless fidelity exact", lossless.fidelityOk);
check("engine bounded max_abs_err <= eps", bounded.fidelityOk,
  `err x=${bounded.err.x} y=${bounded.err.y} z=${bounded.err.z}`);
check("engine lossless retained score = 1.0", lossless.keep.score === 1, `score=${lossless.keep.score}`);
check("engine bounded retained score = 1.0", bounded.keep.score === 1, `score=${bounded.keep.score}`);
check("engine lossless determinism + v0.1 hash", lossless.determinismOk);
check("engine bounded determinism + v0.1 hash", bounded.determinismOk);
check("engine lossless verifyTenantChain", lossless.tenantOk.chain.ok && lossless.tenantOk.reconstruction.ok);
check("engine bounded verifyTenantChain", bounded.tenantOk.chain.ok && bounded.tenantOk.reconstruction.ok);

const points = lossless.points;
check(`same sealed fixture of ${N} points`, points.length === N && bounded.points.length === N
  && lossless.chain.pending === 0 && bounded.chain.pending === 0);

const packed = toPacked(points);
const binary = encodeBinaryBaseline(packed);
const binaryAgain = encodeBinaryBaseline(packed);
const binaryDecoded = decodeBinaryBaseline(binary);
check("binary baseline round-trip is bit-exact", binaryRoundTripOk(packed, binaryDecoded));
check("binary baseline is deterministic", shaBytes(binary) === shaBytes(binaryAgain), shaBytes(binary));

const packedEps = { x: BOUNDED_EPS.predicted, y: BOUNDED_EPS.observed, z: BOUNDED_EPS.phi };
const quantized = encodeQuantized(packed, packedEps);
const quantizedAgain = encodeQuantized(packed, packedEps);
const quantizedDecoded = decodeQuantized(quantized.bytes);
const qErr = {
  x: Math.max(...packed.map((p, i) => Math.abs(quantizedDecoded.points[i].x - p.x))),
  y: Math.max(...packed.map((p, i) => Math.abs(quantizedDecoded.points[i].y - p.y))),
  z: Math.max(...packed.map((p, i) => Math.abs(quantizedDecoded.points[i].z - p.z))),
};
const qTimeStepVerdict = packed.every((p, i) =>
  p.t === quantizedDecoded.points[i].t
  && p.step === quantizedDecoded.points[i].step
  && p.verdict === quantizedDecoded.points[i].verdict);
const qFidelity = qTimeStepVerdict
  && qErr.x <= packedEps.x && qErr.y <= packedEps.y && qErr.z <= packedEps.z
  && quantized.max_abs_err.x <= packedEps.x
  && quantized.max_abs_err.y <= packedEps.y
  && quantized.max_abs_err.z <= packedEps.z;
const qKeep = retainedFromPacked(points, quantizedDecoded.points);
check("quantized compact max_abs_err <= eps", qFidelity,
  `err x=${qErr.x} y=${qErr.y} z=${qErr.z} stored=${JSON.stringify(quantized.max_abs_err)}`);
check("quantized t, step, verdict exact", qTimeStepVerdict);
check("quantized retained score = 1.0", qKeep.score === 1,
  `score=${qKeep.score} verdict_phi=${qKeep.agreement_verdict_phi} snapshot=${qKeep.agreement_snapshot}`);
check("quantized encoding is deterministic", shaBytes(quantized.bytes) === shaBytes(quantizedAgain.bytes),
  shaBytes(quantized.bytes));
check("quantized eps round-trips",
  Object.is(quantizedDecoded.eps.x, packedEps.x)
  && Object.is(quantizedDecoded.eps.y, packedEps.y)
  && Object.is(quantizedDecoded.eps.z, packedEps.z));

// Shuffling the *packed sequence* must change bytes (order matters), but encoding the
// engine's canonical point order twice (including from a shuffled-row chain) must not.
const packedFromShuffledChain = toPacked(sealedPoints(buildTenantChain(TENANT, shuffle(FIXTURE_ROWS, SHUFFLE_SEED), chainOpts(LOSSLESS))));
const quantizedFromShuffled = encodeQuantized(packedFromShuffledChain, packedEps);
check("quantized hash stable for shuffled rows in canonical point order",
  shaBytes(quantized.bytes) === shaBytes(quantizedFromShuffled.bytes));
check("binary hash stable for shuffled rows in canonical point order",
  shaBytes(binary) === shaBytes(encodeBinaryBaseline(packedFromShuffledChain)));

const rawJson = rawJsonBytes(FIXTURE_ROWS);
check("raw JSON baseline matches v0.1 raw_bytes", rawJson === lossless.raw && rawJson === bounded.raw, `raw_json=${rawJson}`);

const gzipJson = gzipDeterministic(FIXTURE_ROWS.map((r) => r.record_json).join("\n"));
// Join with newlines is not "raw JSON as stored". Gzip the concatenation of record_json
// in experience order used for raw_bytes: just concatenate, no separator, same bytes summed.
const rawJsonBlob = Buffer.concat(FIXTURE_ROWS.map((r) => Buffer.from(r.record_json, "utf8")));
check("raw JSON blob length equals raw_bytes", rawJsonBlob.length === rawJson);
const gzipJsonBlob = gzipDeterministic(rawJsonBlob);
const gzipScpLossless = gzipDeterministic(lossless.canonicalText);
const gzipScpBounded = gzipDeterministic(bounded.canonicalText);
const gzipQuantized = gzipDeterministic(quantized.bytes);
const gzipBinary = gzipDeterministic(binary);

check("gzip(JSON) is deterministic", gzipDeterministic(rawJsonBlob).equals(gzipJsonBlob));
check("gzip(SCP lossless canonical) is deterministic", gzipDeterministic(lossless.canonicalText).equals(gzipScpLossless));

const baselinesLossless = {
  raw: rawJson,
  binary: binary.length,
  gzipJson: gzipJsonBlob.length,
  gzipScp: gzipScpLossless.length,
};
const baselinesBounded = {
  raw: rawJson,
  binary: binary.length,
  gzipJson: gzipJsonBlob.length,
  gzipScp: gzipScpBounded.length,
};

const latLossless = measureEngineLatency(LOSSLESS);
const latBounded = measureEngineLatency(BOUNDED);
const qTimes: number[] = [];
for (let k = 0; k < LATENCY_SAMPLES; k++) {
  const t0 = performance.now();
  const enc = encodeQuantized(packed, packedEps);
  const dec = decodeQuantized(enc.bytes);
  if (dec.points.length !== packed.length) throw new Error("quantized latency sample failed");
  qTimes.push(performance.now() - t0);
}
const latQ = { p50: percentile(qTimes, 0.50), p95: percentile(qTimes, 0.95), samples: qTimes.length };

check("engine lossless latency p95 under hang bound", latLossless.p95 < LATENCY_P95_HANG_MS,
  `p50=${latLossless.p50.toFixed(3)}ms p95=${latLossless.p95.toFixed(3)}ms K=${LATENCY_SAMPLES}`);
check("engine bounded latency p95 under hang bound", latBounded.p95 < LATENCY_P95_HANG_MS,
  `p50=${latBounded.p50.toFixed(3)}ms p95=${latBounded.p95.toFixed(3)}ms K=${LATENCY_SAMPLES}`);
check("quantized encode/decode latency p95 under hang bound", latQ.p95 < LATENCY_P95_HANG_MS,
  `p50=${latQ.p50.toFixed(3)}ms p95=${latQ.p95.toFixed(3)}ms K=${LATENCY_SAMPLES}`);

const rows: Row[] = [
  {
    encoding: "engine lossless canonical (stored)",
    bytes: lossless.canonical_bytes,
    ratios: sheet(lossless.canonical_bytes, baselinesLossless),
    fidelity_ok: lossless.fidelityOk,
    retained: lossless.keep.score,
    p50_ms: latLossless.p50,
    p95_ms: latLossless.p95,
    hash: lossless.head,
  },
  {
    encoding: "engine bounded canonical (stored)",
    bytes: bounded.canonical_bytes,
    ratios: sheet(bounded.canonical_bytes, baselinesBounded),
    fidelity_ok: bounded.fidelityOk,
    retained: bounded.keep.score,
    p50_ms: latBounded.p50,
    p95_ms: latBounded.p95,
    hash: bounded.head,
  },
  {
    encoding: "quantized compact (measured, not stored)",
    bytes: quantized.bytes.length,
    ratios: sheet(quantized.bytes.length, baselinesBounded),
    fidelity_ok: qFidelity,
    retained: qKeep.score,
    p50_ms: latQ.p50,
    p95_ms: latQ.p95,
    hash: shaBytes(quantized.bytes),
  },
];

const bestGpBytes = Math.min(binary.length, gzipJsonBlob.length);
const bestGpName = binary.length <= gzipJsonBlob.length
  ? `compact binary (${binary.length} B)`
  : `gzip(JSON) level ${GZIP_LEVEL} (${gzipJsonBlob.length} B)`;

check("baselines are positive and gzip is not larger than a hang-bound sanity cap",
  rawJson > 0 && binary.length > 0 && gzipJsonBlob.length > 0 && gzipScpLossless.length > 0);

console.log("--- v0.1.1 baselines (bytes) ---");
console.log(`raw JSON (a):              ${rawJson}`);
console.log(`compact binary (b):        ${binary.length}  sha256=${shaBytes(binary)}`);
console.log(`gzip(JSON) (c) level=${GZIP_LEVEL}: ${gzipJsonBlob.length}`);
console.log(`gzip(SCP lossless) (d):    ${gzipScpLossless.length}`);
console.log(`gzip(SCP bounded) (d):     ${gzipScpBounded.length}`);
console.log(`gzip(quantized) (extra):   ${gzipQuantized.length}`);
console.log(`gzip(binary) (extra):      ${gzipBinary.length}`);
console.log(`best general-purpose baseline: ${bestGpName}`);
console.log("--- v0.1.1 ratios (baseline / encoding; >1 means smaller than that baseline) ---");
console.log("encoding\tbytes\tvs_raw_json\tvs_binary\tvs_gzip_json\tvs_gzip_scp_canonical\tfidelity\tretained\tp50_ms\tp95_ms\thash");
for (const r of rows) {
  console.log([
    r.encoding,
    r.bytes,
    fmt(r.ratios.vs_raw_json),
    fmt(r.ratios.vs_binary),
    fmt(r.ratios.vs_gzip_json),
    fmt(r.ratios.vs_gzip_scp_canonical),
    r.fidelity_ok,
    r.retained,
    r.p50_ms === null ? "n/a" : r.p50_ms.toFixed(3),
    r.p95_ms === null ? "n/a" : r.p95_ms.toFixed(3),
    r.hash,
  ].join("\t"));
}

const qVsBest = ratio(bestGpBytes, quantized.bytes.length);
const losslessVsBest = ratio(bestGpBytes, lossless.canonical_bytes);
const boundedVsBest = ratio(bestGpBytes, bounded.canonical_bytes);
const headline = `On this fixture, the honest headline is versus ${bestGpName}: stored lossless canonical is ${fmt(losslessVsBest)}x (${lossless.canonical_bytes} B, does ${losslessVsBest >= 1 ? "" : "not "}beat it), stored bounded canonical is ${fmt(boundedVsBest)}x (${bounded.canonical_bytes} B), and the measured quantized compact encoding is ${fmt(qVsBest)}x (${quantized.bytes.length} B, fidelity <= eps, retained=1). The v0.1 ${fmt(ratio(rawJson, lossless.canonical_bytes))}x vs record_json is mostly JSON envelope, not 4D-state compression.`;
console.log(`HEADLINE ${headline}`);
console.log(`MEASURE v011: ${JSON.stringify({
  baselines: {
    raw_json_bytes: rawJson,
    binary_bytes: binary.length,
    gzip_json_bytes: gzipJsonBlob.length,
    gzip_scp_lossless_bytes: gzipScpLossless.length,
    gzip_scp_bounded_bytes: gzipScpBounded.length,
    gzip_quantized_bytes: gzipQuantized.length,
    gzip_binary_bytes: gzipBinary.length,
    gzip_level: GZIP_LEVEL,
    best_general_purpose: { name: bestGpName, bytes: bestGpBytes },
  },
  rows,
  heads: { lossless: lossless.head, bounded: bounded.head, quantized: shaBytes(quantized.bytes), binary: shaBytes(binary) },
  headline,
})}`);

if (failures.length) {
  console.error(`FAIL check-scp-v011 (${failures.length} failed, ${passed} passed): ${failures.join("; ")}`);
  process.exit(1);
}
console.log(`PASS check-scp-v011 (${passed} checks)`);
