/** TEST ONLY. 4D-SCP v0.1.4 cost / latency / memory measurement. Fixtures only; no network, no writes.
 *
 * v0.1.3 showed the compact quantized encoding roughly ties brotli on size versus the same
 * rounded int codes. This check tests the hardware-angle hypothesis — equal size at much
 * lower compute / memory — by measuring encode and decode throughput, approximate memory
 * deltas, deterministic compact-codec op counts, and algorithmic working-set size.
 *
 * Codecs, all at the same eps, on the rounded int codes (SCQI) or the compact encoding of
 * the same points:
 *   - quantized compact (SCPQ): timings call pack.ts encodeQuantized / decodeQuantized
 *     (quantize + delta/varint). Op counts come from a test-only instrumented copy
 *     (`scripts/scp-v014-ops.ts`) that must emit byte-identical output.
 *   - gzip level 9 and level 6 of the SCQI payload
 *   - brotli quality 11 and quality 5 of the SCQI payload (generic mode, lgwin 22)
 *
 * Asserted: round-trip, fidelity (max_abs_err <= eps, t/step/verdict exact), retained 1.0,
 * determinism of encoded bytes and of op counts, instrumented bytes === official bytes,
 * v0.1 stored heads unchanged, and a hang bound only. Throughput, memory, and ratios are
 * reported, not asserted.
 *
 * Working set: compact streaming state is 40 bytes of previous-value registers (64 bytes
 * on decode including eps). gzip window is 32 KiB; brotli lgwin 22 is 4 MiB. See the
 * method comment in scp-v014-ops.ts. Memory deltas are approximate process.memoryUsage
 * figures, labelled as such.
 *
 * Fixtures: v0.1, B256, B4096. The 6-row Medicare mapping is skipped (too small for
 * throughput). Single-machine Node timings; not a lab result or a silicon claim.
 *
 * Run: npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-scp-v014.ts
 */
import os from "node:os";
import {
  buildTenantChain,
  verifyChain,
  type SourceRow,
} from "../src/core/compression";
import {
  decodeQuantized,
  decodeQuantizedIntBaseline,
  encodeQuantized,
  encodeQuantizedIntBaseline,
  type PackedPoint,
} from "../src/scp";
import {
  BOUNDED, BOUNDED_EPS, FIXTURE_ROWS, LATENCY_P95_HANG_MS, N, SHUFFLE_SEED, TENANT, V01_HEADS,
  fixturePoint, percentile, retainedFromPacked, sealedPoints, shaBytes, shuffle,
} from "./scp-v01-fixture";
import { B256_N, B4096_N, NOISE_SEED, noisyRows } from "./scp-v012-fixtures";
import {
  brotliDecompressBytes, brotliDeterministic, fmt, gunzipBytes, gzipDeterministic,
  ratio, sealOptsFor, toPacked,
} from "./scp-measure";
import {
  BROTLI_WINDOW_BYTES, COMPACT_STREAMING_DECODE_STATE_BYTES, COMPACT_STREAMING_STATE_BYTES,
  GZIP_WINDOW_BYTES, countsEqual, decodeQuantizedCounted, encodeQuantizedCounted,
  perPoint, totalOps, type OpCounts,
} from "./scp-v014-ops";

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

const packedEps = { x: BOUNDED_EPS.predicted, y: BOUNDED_EPS.observed, z: BOUNDED_EPS.phi };
const WARMUP = 8;
const K = 31;
const MIN_SAMPLE_MS = 2;
const MEM_SAMPLES = 5;

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
  return { ok: timeStepVerdict && err.x <= eps.x && err.y <= eps.y && err.z <= eps.z, err, timeStepVerdict };
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function environment(): Record<string, unknown> {
  const cpus = os.cpus();
  return {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    cpu_model: cpus[0]?.model ?? "unknown",
    cpu_count: cpus.length,
    gc_available: typeof (globalThis as { gc?: () => void }).gc === "function",
    warmup: WARMUP,
    iterations: K,
    min_sample_ms: MIN_SAMPLE_MS,
    note: "Single-machine Node timings, not a controlled lab. p50/p95 can move with load, thermal state, and adjacent processes. Memory deltas are approximate process.memoryUsage figures and can be negative if GC runs mid-sample. Throughput MB/s uses decimal megabytes (1e6) of the shared SCQI (rounded int-code) payload. Not an SLA and not a silicon result.",
  };
}

type Bench = { p50_ms: number; p95_ms: number; samples: number; warmup: number; batch: number };

function calibrateBatch(fn: () => void): number {
  const t0 = performance.now();
  fn();
  const dt = Math.max(performance.now() - t0, 1e-6);
  return dt >= MIN_SAMPLE_MS ? 1 : Math.max(1, Math.ceil(MIN_SAMPLE_MS / dt));
}

function bench(fn: () => void): Bench {
  const batch = calibrateBatch(fn);
  for (let i = 0; i < WARMUP; i++) {
    for (let j = 0; j < batch; j++) fn();
  }
  const times: number[] = [];
  for (let i = 0; i < K; i++) {
    const t0 = performance.now();
    for (let j = 0; j < batch; j++) fn();
    times.push((performance.now() - t0) / batch);
  }
  return { p50_ms: percentile(times, 0.50), p95_ms: percentile(times, 0.95), samples: K, warmup: WARMUP, batch };
}

type Mem = {
  heapUsed_delta_p50: number;
  rss_delta_p50: number;
  external_delta_p50: number;
  samples: number;
  gc_available: boolean;
  label: string;
};

function approxMemory(fn: () => void): Mem {
  const g = (globalThis as { gc?: () => void }).gc;
  const gc_available = typeof g === "function";
  const heaps: number[] = [], rss: number[] = [], ext: number[] = [];
  for (let i = 0; i < MEM_SAMPLES; i++) {
    if (gc_available) g();
    const before = process.memoryUsage();
    fn();
    const after = process.memoryUsage();
    heaps.push(after.heapUsed - before.heapUsed);
    rss.push(after.rss - before.rss);
    ext.push(after.external - before.external);
  }
  return {
    heapUsed_delta_p50: Math.round(percentile(heaps, 0.50)),
    rss_delta_p50: Math.round(percentile(rss, 0.50)),
    external_delta_p50: Math.round(percentile(ext, 0.50)),
    samples: MEM_SAMPLES,
    gc_available,
    label: "approximate process.memoryUsage deltas; not a peak allocator trace",
  };
}

function throughput(n: number, uncompressed: number, p50_ms: number): { points_per_s: number; MB_per_s: number } {
  const s = p50_ms / 1000;
  if (!(s > 0)) return { points_per_s: Number.POSITIVE_INFINITY, MB_per_s: Number.POSITIVE_INFINITY };
  return { points_per_s: n / s, MB_per_s: (uncompressed / 1e6) / s };
}

type Side = {
  bytes: number;
  p50_ms: number;
  p95_ms: number;
  batch: number;
  points_per_s_p50: number;
  MB_per_s_p50: number;
  heapUsed_delta_p50: number;
  rss_delta_p50: number;
  external_delta_p50: number;
};

type CodecRow = {
  codec: string;
  encode: Side;
  decode: Side;
  ops?: { encode: OpCounts; decode: OpCounts; encode_total: number; decode_total: number; encode_per_point: number; decode_per_point: number };
  working_set_bytes: number;
  working_set_note: string;
};

type FixtureRow = {
  fixture: string;
  n: number;
  scqi_bytes: number;
  scqi_width: 4 | 8;
  compact_bytes: number;
  codecs: CodecRow[];
};

const results: FixtureRow[] = [];

function sideOf(bytes: number, n: number, uncompressed: number, b: Bench, mem: Mem): Side {
  const t = throughput(n, uncompressed, b.p50_ms);
  return {
    bytes,
    p50_ms: b.p50_ms,
    p95_ms: b.p95_ms,
    batch: b.batch,
    points_per_s_p50: t.points_per_s,
    MB_per_s_p50: t.MB_per_s,
    heapUsed_delta_p50: mem.heapUsed_delta_p50,
    rss_delta_p50: mem.rss_delta_p50,
    external_delta_p50: mem.external_delta_p50,
  };
}

function measure(name: string, tenant: string, source: readonly SourceRow[], n: number, t0: number, tLast: number, expectHeads?: { lossless: string; bounded: string }) {
  const seal = sealOptsFor(n, t0, tLast);
  const lossless = buildTenantChain(tenant, source, { ...seal, loss: { mode: "lossless" } });
  const bounded = buildTenantChain(tenant, source, { ...seal, loss: BOUNDED });
  const points = sealedPoints(lossless);
  check(`${name}: sealed n=${n}, no pending, no excluded`,
    points.length === n && lossless.pending === 0 && lossless.excluded.count === 0 && bounded.pending === 0,
    `sealed=${points.length}`);
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
  const scqiDec = decodeQuantizedIntBaseline(scqi.bytes);
  const scqiFid = lossyCheck(packed, scqiDec.points, packedEps);
  const scqiKeep = retainedFromPacked(points, scqiDec.points);
  check(`${name}: SCQI max_abs_err <= eps`, scqiFid.ok, `width=${scqi.width} err x=${scqiFid.err.x} y=${scqiFid.err.y} z=${scqiFid.err.z}`);
  check(`${name}: SCQI t/step/verdict exact`, scqiFid.timeStepVerdict);
  check(`${name}: SCQI retained = 1.0`, scqiKeep.score === 1, `score=${scqiKeep.score}`);
  check(`${name}: SCQI determinism`, shaBytes(scqi.bytes) === shaBytes(encodeQuantizedIntBaseline(packed, packedEps).bytes));

  const compact = encodeQuantized(packed, packedEps);
  const compactAgain = encodeQuantized(packed, packedEps);
  const compactDec = decodeQuantized(compact.bytes);
  const compactFid = lossyCheck(packed, compactDec.points, packedEps);
  const compactKeep = retainedFromPacked(points, compactDec.points);
  check(`${name}: compact max_abs_err <= eps`, compactFid.ok, `err x=${compactFid.err.x} y=${compactFid.err.y} z=${compactFid.err.z}`);
  check(`${name}: compact t/step/verdict exact`, compactFid.timeStepVerdict);
  check(`${name}: compact retained = 1.0`, compactKeep.score === 1, `score=${compactKeep.score}`);
  check(`${name}: compact byte determinism`, shaBytes(compact.bytes) === shaBytes(compactAgain.bytes), shaBytes(compact.bytes));

  const countedEnc = encodeQuantizedCounted(packed, packedEps);
  const countedEnc2 = encodeQuantizedCounted(packed, packedEps);
  check(`${name}: instrumented compact bytes match pack.ts`, bytesEqual(countedEnc.bytes, compact.bytes));
  check(`${name}: instrumented encode op counts deterministic`, countsEqual(countedEnc.counts, countedEnc2.counts));
  const countedDec = decodeQuantizedCounted(compact.bytes);
  const countedDec2 = decodeQuantizedCounted(compact.bytes);
  const countedDecFid = lossyCheck(packed, countedDec.points, packedEps);
  check(`${name}: instrumented decode fidelity`, countedDecFid.ok && countedDecFid.timeStepVerdict);
  check(`${name}: instrumented decode op counts deterministic`, countsEqual(countedDec.counts, countedDec2.counts));

  const codecs: { id: string; kind: "compact" | "gzip" | "brotli"; quality?: number; working_set_bytes: number; working_set_note: string }[] = [
    { id: "compact", kind: "compact", working_set_bytes: COMPACT_STREAMING_STATE_BYTES, working_set_note: `algorithmic streaming state: ${COMPACT_STREAMING_STATE_BYTES} B previous-value registers (decode also holds ${COMPACT_STREAMING_DECODE_STATE_BYTES - COMPACT_STREAMING_STATE_BYTES} B of eps). Current JS also uses O(n) arrays + a growing output buffer (implementation artifact).` },
    { id: "gzip-l9", kind: "gzip", quality: 9, working_set_bytes: GZIP_WINDOW_BYTES, working_set_note: "deflate window 32 KiB; Node zlib hasher/scratch not measured" },
    { id: "gzip-l6", kind: "gzip", quality: 6, working_set_bytes: GZIP_WINDOW_BYTES, working_set_note: "deflate window 32 KiB; Node zlib hasher/scratch not measured" },
    { id: "brotli-q11", kind: "brotli", quality: 11, working_set_bytes: BROTLI_WINDOW_BYTES, working_set_note: "brotli lgwin 22 = 4 MiB window; hasher/scratch not measured" },
    { id: "brotli-q5", kind: "brotli", quality: 5, working_set_bytes: BROTLI_WINDOW_BYTES, working_set_note: "brotli lgwin 22 = 4 MiB window; hasher/scratch not measured" },
  ];

  const rows: CodecRow[] = [];
  for (const spec of codecs) {
    let encoded: Uint8Array;
    let encodeFn: () => void;
    let decodeFn: () => void;
    if (spec.kind === "compact") {
      encoded = compact.bytes;
      encodeFn = () => { encodeQuantized(packed, packedEps); };
      decodeFn = () => { decodeQuantized(compact.bytes); };
    } else if (spec.kind === "gzip") {
      const level = spec.quality ?? 9;
      encoded = gzipDeterministic(scqi.bytes, level);
      const again = gzipDeterministic(scqi.bytes, level);
      const raw = gunzipBytes(encoded);
      check(`${name}: ${spec.id} determinism`, bytesEqual(encoded, again));
      check(`${name}: ${spec.id} round-trip to SCQI`, bytesEqual(raw, scqi.bytes));
      encodeFn = () => { gzipDeterministic(scqi.bytes, level); };
      decodeFn = () => { gunzipBytes(encoded); };
    } else {
      const quality = spec.quality ?? 11;
      encoded = brotliDeterministic(scqi.bytes, quality);
      const again = brotliDeterministic(scqi.bytes, quality);
      const raw = brotliDecompressBytes(encoded);
      check(`${name}: ${spec.id} determinism`, bytesEqual(encoded, again));
      check(`${name}: ${spec.id} round-trip to SCQI`, bytesEqual(raw, scqi.bytes));
      encodeFn = () => { brotliDeterministic(scqi.bytes, quality); };
      decodeFn = () => { brotliDecompressBytes(encoded); };
    }

    const encBench = bench(encodeFn);
    const decBench = bench(decodeFn);
    check(`${name}: ${spec.id} encode p95 under hang bound`, encBench.p95_ms < LATENCY_P95_HANG_MS,
      `p50=${encBench.p50_ms.toFixed(3)}ms p95=${encBench.p95_ms.toFixed(3)}ms batch=${encBench.batch} K=${K}`);
    check(`${name}: ${spec.id} decode p95 under hang bound`, decBench.p95_ms < LATENCY_P95_HANG_MS,
      `p50=${decBench.p50_ms.toFixed(3)}ms p95=${decBench.p95_ms.toFixed(3)}ms batch=${decBench.batch} K=${K}`);
    const encMem = approxMemory(encodeFn);
    const decMem = approxMemory(decodeFn);

    const row: CodecRow = {
      codec: spec.id,
      encode: sideOf(encoded.length, n, scqi.bytes.length, encBench, encMem),
      decode: sideOf(encoded.length, n, scqi.bytes.length, decBench, decMem),
      working_set_bytes: spec.working_set_bytes,
      working_set_note: spec.working_set_note,
    };
    if (spec.kind === "compact") {
      row.ops = {
        encode: countedEnc.counts,
        decode: countedDec.counts,
        encode_total: totalOps(countedEnc.counts),
        decode_total: totalOps(countedDec.counts),
        encode_per_point: perPoint(countedEnc.counts, n).total,
        decode_per_point: perPoint(countedDec.counts, n).total,
      };
    }
    rows.push(row);
  }

  results.push({
    fixture: name,
    n,
    scqi_bytes: scqi.bytes.length,
    scqi_width: scqi.width,
    compact_bytes: compact.bytes.length,
    codecs: rows,
  });
}

const env = environment();
console.log(`ENV ${JSON.stringify(env)}`);
console.log(`WORKING_SET compact_encode=${COMPACT_STREAMING_STATE_BYTES}B compact_decode=${COMPACT_STREAMING_DECODE_STATE_BYTES}B gzip_window=${GZIP_WINDOW_BYTES}B brotli_lgwin22=${BROTLI_WINDOW_BYTES}B`);

const b256 = noisyRows(B256_N, "scp-v012-noise256", "b256", NOISE_SEED);
const b4096 = noisyRows(B4096_N, "scp-v012-noise4096", "b4k", NOISE_SEED);
measure("v0.1", TENANT, FIXTURE_ROWS, N, fixturePoint(0).t, fixturePoint(N - 1).t, V01_HEADS);
measure("B256", "scp-v012-noise256", b256.rows, B256_N, b256.points[0].t, b256.points[B256_N - 1].t);
measure("B4096", "scp-v012-noise4096", b4096.rows, B4096_N, b4096.points[0].t, b4096.points[B4096_N - 1].t);

function fmtInt(n: number): string {
  return Number.isFinite(n) ? Math.round(n).toString() : String(n);
}

console.log("--- v0.1.4 cost measurement (encode/decode p50; MB/s is decimal MB of the SCQI payload) ---");
console.log(["fixture", "codec", "n", "encoded_bytes", "vs_scqi", "enc_p50_ms", "enc_p95_ms", "enc_points_s", "enc_MB_s",
  "dec_p50_ms", "dec_p95_ms", "dec_points_s", "dec_MB_s",
  "enc_heap_delta", "dec_heap_delta", "working_set_bytes", "enc_ops_total", "enc_ops_per_pt", "dec_ops_total", "dec_ops_per_pt"].join("\t"));

for (const f of results) {
  for (const c of f.codecs) {
    const vs = ratio(f.scqi_bytes, c.encode.bytes);
    console.log([
      f.fixture, c.codec, f.n, c.encode.bytes, fmt(vs),
      fmt(c.encode.p50_ms, 4), fmt(c.encode.p95_ms, 4), fmtInt(c.encode.points_per_s_p50), fmt(c.encode.MB_per_s_p50, 3),
      fmt(c.decode.p50_ms, 4), fmt(c.decode.p95_ms, 4), fmtInt(c.decode.points_per_s_p50), fmt(c.decode.MB_per_s_p50, 3),
      c.encode.heapUsed_delta_p50, c.decode.heapUsed_delta_p50, c.working_set_bytes,
      c.ops ? c.ops.encode_total : "",
      c.ops ? fmt(c.ops.encode_per_point, 2) : "",
      c.ops ? c.ops.decode_total : "",
      c.ops ? fmt(c.ops.decode_per_point, 2) : "",
    ].join("\t"));
  }
}

function codec(f: FixtureRow, id: string): CodecRow {
  const row = f.codecs.find((c) => c.codec === id);
  if (!row) throw new Error(`missing codec ${id}`);
  return row;
}

const primary = results.find((r) => r.fixture === "B4096")!;
const v01 = results.find((r) => r.fixture === "v0.1")!;
const b256r = results.find((r) => r.fixture === "B256")!;
const c4096 = codec(primary, "compact");
const g9 = codec(primary, "gzip-l9");
const g6 = codec(primary, "gzip-l6");
const b11 = codec(primary, "brotli-q11");
const b5 = codec(primary, "brotli-q5");
const encSpeedVsG9 = c4096.encode.p50_ms === 0 ? Number.POSITIVE_INFINITY : g9.encode.p50_ms / c4096.encode.p50_ms;
const encSpeedVsB11 = c4096.encode.p50_ms === 0 ? Number.POSITIVE_INFINITY : b11.encode.p50_ms / c4096.encode.p50_ms;
const decSpeedVsG9 = c4096.decode.p50_ms === 0 ? Number.POSITIVE_INFINITY : g9.decode.p50_ms / c4096.decode.p50_ms;
const decSpeedVsB11 = c4096.decode.p50_ms === 0 ? Number.POSITIVE_INFINITY : b11.decode.p50_ms / c4096.decode.p50_ms;
const fasterEncG9 = c4096.encode.p50_ms < g9.encode.p50_ms;
const fasterEncB11 = c4096.encode.p50_ms < b11.encode.p50_ms;
const fasterDecG9 = c4096.decode.p50_ms < g9.decode.p50_ms;
const fasterDecB11 = c4096.decode.p50_ms < b11.decode.p50_ms;

const headline = `On B4096 in this single-machine Node process, the compact quantized codec (${primary.compact_bytes} B, ${fmt(ratio(primary.scqi_bytes, primary.compact_bytes))}× vs the ${primary.scqi_bytes} B int32 packing) encodes at p50 ${fmt(c4096.encode.p50_ms, 3)} ms (${fmtInt(c4096.encode.points_per_s_p50)} points/s, ${fmt(c4096.encode.MB_per_s_p50, 2)} MB/s) versus gzip-l9 ${fmt(g9.encode.p50_ms, 3)} ms (${fasterEncG9 ? `${fmt(encSpeedVsG9, 2)}× faster` : `${fmt(1 / encSpeedVsG9, 2)}× slower`}) and brotli-q11 ${fmt(b11.encode.p50_ms, 3)} ms (${fasterEncB11 ? `${fmt(encSpeedVsB11, 2)}× faster` : `${fmt(1 / encSpeedVsB11, 2)}× slower`}); decode p50 is ${fmt(c4096.decode.p50_ms, 3)} ms versus gzip-l9 ${fmt(g9.decode.p50_ms, 3)} ms (${fasterDecG9 ? `${fmt(decSpeedVsG9, 2)}× faster` : `${fmt(1 / decSpeedVsG9, 2)}× slower`}) and brotli-q11 ${fmt(b11.decode.p50_ms, 3)} ms (${fasterDecB11 ? `${fmt(decSpeedVsB11, 2)}× faster` : `${fmt(1 / decSpeedVsB11, 2)}× slower`}). Algorithmic working set is ${COMPACT_STREAMING_STATE_BYTES} B of previous-value registers versus a ${GZIP_WINDOW_BYTES} B gzip window and a ${BROTLI_WINDOW_BYTES} B brotli window; gzip-l6 / brotli-q5 encode p50 on the same fixture are ${fmt(g6.encode.p50_ms, 3)} / ${fmt(b5.encode.p50_ms, 3)} ms. These are JS/Node timings, not a silicon result.`;

console.log(`HEADLINE ${headline}`);
console.log(`MEASURE v014: ${JSON.stringify({
  env,
  working_set: {
    compact_encode_bytes: COMPACT_STREAMING_STATE_BYTES,
    compact_decode_bytes: COMPACT_STREAMING_DECODE_STATE_BYTES,
    gzip_window_bytes: GZIP_WINDOW_BYTES,
    brotli_window_bytes: BROTLI_WINDOW_BYTES,
  },
  results,
  speedups_B4096: { encode_vs_gzip_l9: encSpeedVsG9, encode_vs_brotli_q11: encSpeedVsB11, decode_vs_gzip_l9: decSpeedVsG9, decode_vs_brotli_q11: decSpeedVsB11 },
  compact_ops: {
    "v0.1": codec(v01, "compact").ops,
    B256: codec(b256r, "compact").ops,
    B4096: c4096.ops,
  },
  headline,
})}`);

if (failures.length) {
  console.error(`FAIL check-scp-v014 (${failures.length} failed, ${passed} passed): ${failures.join("; ")}`);
  process.exit(1);
}
console.log(`PASS check-scp-v014 (${passed} checks)`);
