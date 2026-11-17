/** TEST ONLY. Shared v0.1.1/v0.1.2 size-measurement helpers. Fixtures only; no network, no writes. */
import { brotliCompressSync, constants as zc, gzipSync } from "node:zlib";
import {
  buildTenantChain,
  reconstruct,
  verifyChain,
  verifyReconstruction,
  verifyTenantChain,
  type AxisEps,
  type LossOption,
  type SourceRow,
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
  bitExact,
  compressedBytes,
  maxAbsErr,
  percentile,
  rawBytes,
  rawJsonBytes,
  reconstructAll as reconstructAllFrom,
  retained,
  retainedFromPacked,
  sealedPoints,
  shaBytes,
  shuffle,
} from "./scp-v01-fixture";

export const GZIP_LEVEL = 9;

export function gzipDeterministic(data: string | Uint8Array): Buffer {
  const input = typeof data === "string" ? Buffer.from(data, "utf8") : Buffer.from(data);
  const buf = gzipSync(input, { level: GZIP_LEVEL });
  buf[4] = 0; buf[5] = 0; buf[6] = 0; buf[7] = 0;
  buf[9] = 0xff;
  return buf;
}

/** Brotli quality 11 (max), generic mode, lgwin 22. No size hint. Deterministic for a given payload. */
export const BROTLI_QUALITY = 11;
export const BROTLI_LGWIN = 22;

export function brotliDeterministic(data: string | Uint8Array): Buffer {
  const input = typeof data === "string" ? Buffer.from(data, "utf8") : Buffer.from(data);
  return brotliCompressSync(input, {
    params: {
      [zc.BROTLI_PARAM_MODE]: zc.BROTLI_MODE_GENERIC,
      [zc.BROTLI_PARAM_QUALITY]: BROTLI_QUALITY,
      [zc.BROTLI_PARAM_LGWIN]: BROTLI_LGWIN,
    },
  });
}

export function ratio(baseline: number, encoded: number): number {
  return encoded === 0 ? Number.POSITIVE_INFINITY : baseline / encoded;
}

export function fmt(n: number, digits = 4): string {
  return Number.isFinite(n) ? n.toFixed(digits) : String(n);
}

export function toPacked(points: readonly StatePoint[]): PackedPoint[] {
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

export type ChainSealOpts = {
  asOfMs: number;
  segmentSize: number;
  cutoffMs: number;
  graceMs: number;
};

/** Seal a full 256-point window, or (when n < 256) close by cutoff so a short fixture still produces a segment. */
export function sealOptsFor(n: number, t0: number, tLast: number, segmentSize = 256): ChainSealOpts {
  if (n >= segmentSize) {
    return { asOfMs: tLast + 1, segmentSize, cutoffMs: Number.POSITIVE_INFINITY, graceMs: 0 };
  }
  const cutoffMs = 86_400_000;
  return { asOfMs: t0 + cutoffMs + 1, segmentSize, cutoffMs, graceMs: 0 };
}

export type RatioSheet = {
  vs_raw_json: number;
  vs_binary: number;
  vs_gzip_json: number;
  vs_gzip_binary: number;
  vs_gzip_scp_canonical: number;
};

export type EncodingRow = {
  encoding: string;
  bytes: number;
  ratios: RatioSheet;
  fidelity_ok: boolean;
  retained: number;
  p50_ms: number | null;
  p95_ms: number | null;
  hash: string;
};

export type FixtureMeasure = {
  name: string;
  n: number;
  notes: string[];
  baselines: {
    raw_json_bytes: number;
    binary_bytes: number;
    gzip_json_bytes: number;
    gzip_binary_bytes: number;
    gzip_scp_lossless_bytes: number;
    gzip_scp_bounded_bytes: number;
    gzip_quantized_bytes: number;
    gzip_level: number;
    best_general_purpose: { name: string; bytes: number };
  };
  rows: EncodingRow[];
  fidelity: { lossless: boolean; bounded: boolean; quantized: boolean; binary: boolean };
  retained: { lossless: number; bounded: number; quantized: number };
  determinism: { lossless: boolean; bounded: boolean; quantized: boolean; binary: boolean };
  heads: { lossless: string; bounded: string; quantized: string; binary: string };
  quantized_vs_binary: number;
  quantized_smaller_than_binary: boolean;
  errors: string[];
};

function sheet(bytes: number, b: { raw: number; binary: number; gzipJson: number; gzipBinary: number; gzipScp: number }): RatioSheet {
  return {
    vs_raw_json: ratio(b.raw, bytes),
    vs_binary: ratio(b.binary, bytes),
    vs_gzip_json: ratio(b.gzipJson, bytes),
    vs_gzip_binary: ratio(b.gzipBinary, bytes),
    vs_gzip_scp_canonical: ratio(b.gzipScp, bytes),
  };
}

function measureEngine(
  tenant: string,
  source: readonly SourceRow[],
  seal: ChainSealOpts,
  loss: LossOption,
  label: "lossless" | "bounded",
  eps: AxisEps,
) {
  const opts = { ...seal, loss };
  const chain = buildTenantChain(tenant, source, opts);
  const points = sealedPoints(chain);
  const got = reconstructAll(chain);
  const err = maxAbsErr(points, got);
  const keep = retained(points, got);
  const reconOk = chain.segments.every((s, i) => verifyReconstruction(s, chain.windows[i].points).ok);
  const fidelityOk = label === "lossless"
    ? bitExact(points, got) && reconOk
    : reconOk
      && err.x <= eps.predicted
      && err.y <= eps.observed
      && err.z <= eps.phi
      && points.every((p, i) => p.t === got[i].t && Object.is(p.step, got[i].step) && p.verdict === got[i].verdict);
  const tenantOk = verifyTenantChain(tenant, chain.segments, source, opts);
  const canonicalText = chain.segments.map((s) => canonical(s.segment)).join("");
  return {
    chain, points, got, err, keep, fidelityOk, tenantOk, opts,
    raw: rawBytes(chain, source),
    canonical_bytes: compressedBytes(chain, canonical),
    canonicalText,
    head: chain.head_sha256 ?? "",
    pending: chain.pending,
    segments: chain.segments.length,
    excluded: chain.excluded.count,
  };
}

function measureEngineLatency(
  tenant: string,
  source: readonly SourceRow[],
  opts: ReturnType<typeof measureEngine>["opts"],
  samples: number,
): { p50: number; p95: number; samples: number } {
  const times: number[] = [];
  for (let k = 0; k < samples; k++) {
    const t0 = performance.now();
    const chain = buildTenantChain(tenant, source, opts);
    const checks = verifyTenantChain(tenant, chain.segments, source, opts);
    const dt = performance.now() - t0;
    if (!(checks.chain.ok && checks.reconstruction.ok)) throw new Error("latency sample failed verify");
    times.push(dt);
  }
  return { p50: percentile(times, 0.50), p95: percentile(times, 0.95), samples: times.length };
}

export function measureFixture(args: {
  name: string;
  tenant: string;
  source: readonly SourceRow[];
  seal: ChainSealOpts;
  eps: AxisEps;
  lossless: LossOption;
  bounded: LossOption;
  shuffleSeed: number;
  latencySamples: number;
  expectHeads?: { lossless: string; bounded: string };
  notes?: string[];
}): FixtureMeasure {
  const errors: string[] = [];
  const notes = [...(args.notes ?? [])];
  const lossless = measureEngine(args.tenant, args.source, args.seal, args.lossless, "lossless", args.eps);
  const bounded = measureEngine(args.tenant, args.source, args.seal, args.bounded, "bounded", args.eps);
  if (lossless.pending !== 0 || bounded.pending !== 0) {
    errors.push(`pending points not sealed (lossless=${lossless.pending} bounded=${bounded.pending})`);
  }
  if (lossless.excluded !== 0 || bounded.excluded !== 0) {
    errors.push(`excluded rows (lossless=${lossless.excluded} bounded=${bounded.excluded})`);
  }
  if (lossless.points.length !== args.source.length) {
    errors.push(`lossless sealed ${lossless.points.length} != source ${args.source.length}`);
  }

  const shuffledL = buildTenantChain(args.tenant, shuffle(args.source, args.shuffleSeed), lossless.opts);
  const againL = buildTenantChain(args.tenant, args.source, lossless.opts);
  const detL = verifyChain(lossless.chain.segments).ok
    && shuffledL.head_sha256 === lossless.head
    && againL.head_sha256 === lossless.head
    && lossless.tenantOk.chain.ok && lossless.tenantOk.reconstruction.ok;
  const shuffledB = buildTenantChain(args.tenant, shuffle(args.source, args.shuffleSeed), bounded.opts);
  const againB = buildTenantChain(args.tenant, args.source, bounded.opts);
  const detB = verifyChain(bounded.chain.segments).ok
    && shuffledB.head_sha256 === bounded.head
    && againB.head_sha256 === bounded.head
    && bounded.tenantOk.chain.ok && bounded.tenantOk.reconstruction.ok;
  if (args.expectHeads) {
    if (lossless.head !== args.expectHeads.lossless) errors.push("lossless engine head drifted from expected v0.1 value");
    if (bounded.head !== args.expectHeads.bounded) errors.push("bounded engine head drifted from expected v0.1 value");
  }

  const packed = toPacked(lossless.points);
  const binary = encodeBinaryBaseline(packed);
  const binaryDecoded = decodeBinaryBaseline(binary);
  const binaryOk = binaryRoundTripOk(packed, binaryDecoded);
  const binaryDet = shaBytes(binary) === shaBytes(encodeBinaryBaseline(packed))
    && shaBytes(binary) === shaBytes(encodeBinaryBaseline(toPacked(sealedPoints(shuffledL))));

  const packedEps = { x: args.eps.predicted, y: args.eps.observed, z: args.eps.phi };
  const quantized = encodeQuantized(packed, packedEps);
  const qDec = decodeQuantized(quantized.bytes);
  const qErr = {
    x: Math.max(0, ...packed.map((p, i) => Math.abs(qDec.points[i].x - p.x))),
    y: Math.max(0, ...packed.map((p, i) => Math.abs(qDec.points[i].y - p.y))),
    z: Math.max(0, ...packed.map((p, i) => Math.abs(qDec.points[i].z - p.z))),
  };
  const qExact = packed.every((p, i) =>
    p.t === qDec.points[i].t && p.step === qDec.points[i].step && p.verdict === qDec.points[i].verdict);
  const qFid = qExact
    && qErr.x <= packedEps.x && qErr.y <= packedEps.y && qErr.z <= packedEps.z
    && quantized.max_abs_err.x <= packedEps.x
    && quantized.max_abs_err.y <= packedEps.y
    && quantized.max_abs_err.z <= packedEps.z;
  const qKeep = retainedFromPacked(lossless.points, qDec.points);
  const qDet = shaBytes(quantized.bytes) === shaBytes(encodeQuantized(packed, packedEps).bytes)
    && shaBytes(quantized.bytes) === shaBytes(encodeQuantized(toPacked(sealedPoints(shuffledL)), packedEps).bytes);

  const rawJson = rawJsonBytes(args.source);
  if (rawJson !== lossless.raw) errors.push("raw JSON baseline does not match engine included raw_bytes");
  const rawJsonBlob = Buffer.concat(args.source.map((r) => Buffer.from(r.record_json, "utf8")));
  const gzipJsonBlob = gzipDeterministic(rawJsonBlob);
  const gzipBinary = gzipDeterministic(binary);
  const gzipScpL = gzipDeterministic(lossless.canonicalText);
  const gzipScpB = gzipDeterministic(bounded.canonicalText);
  const gzipQ = gzipDeterministic(quantized.bytes);

  const gp = [
    { name: `compact binary (${binary.length} B)`, bytes: binary.length },
    { name: `gzip(JSON) level ${GZIP_LEVEL} (${gzipJsonBlob.length} B)`, bytes: gzipJsonBlob.length },
    { name: `gzip(binary) level ${GZIP_LEVEL} (${gzipBinary.length} B)`, bytes: gzipBinary.length },
  ];
  gp.sort((a, b) => a.bytes - b.bytes || a.name.localeCompare(b.name));
  const bestGp = gp[0];

  const latL = measureEngineLatency(args.tenant, args.source, lossless.opts, args.latencySamples);
  const latB = measureEngineLatency(args.tenant, args.source, bounded.opts, args.latencySamples);
  const qTimes: number[] = [];
  for (let k = 0; k < args.latencySamples; k++) {
    const t0 = performance.now();
    const enc = encodeQuantized(packed, packedEps);
    const dec = decodeQuantized(enc.bytes);
    if (dec.points.length !== packed.length) throw new Error("quantized latency sample failed");
    qTimes.push(performance.now() - t0);
  }
  const latQ = { p50: percentile(qTimes, 0.50), p95: percentile(qTimes, 0.95), samples: qTimes.length };

  const baseL = { raw: rawJson, binary: binary.length, gzipJson: gzipJsonBlob.length, gzipBinary: gzipBinary.length, gzipScp: gzipScpL.length };
  const baseB = { raw: rawJson, binary: binary.length, gzipJson: gzipJsonBlob.length, gzipBinary: gzipBinary.length, gzipScp: gzipScpB.length };

  const rows: EncodingRow[] = [
    {
      encoding: "engine lossless canonical (stored)",
      bytes: lossless.canonical_bytes,
      ratios: sheet(lossless.canonical_bytes, baseL),
      fidelity_ok: lossless.fidelityOk,
      retained: lossless.keep.score,
      p50_ms: latL.p50,
      p95_ms: latL.p95,
      hash: lossless.head,
    },
    {
      encoding: "engine bounded canonical (stored)",
      bytes: bounded.canonical_bytes,
      ratios: sheet(bounded.canonical_bytes, baseB),
      fidelity_ok: bounded.fidelityOk,
      retained: bounded.keep.score,
      p50_ms: latB.p50,
      p95_ms: latB.p95,
      hash: bounded.head,
    },
    {
      encoding: "quantized compact (measured, not stored)",
      bytes: quantized.bytes.length,
      ratios: sheet(quantized.bytes.length, baseB),
      fidelity_ok: qFid,
      retained: qKeep.score,
      p50_ms: latQ.p50,
      p95_ms: latQ.p95,
      hash: shaBytes(quantized.bytes),
    },
  ];

  return {
    name: args.name,
    n: lossless.points.length,
    notes,
    baselines: {
      raw_json_bytes: rawJson,
      binary_bytes: binary.length,
      gzip_json_bytes: gzipJsonBlob.length,
      gzip_binary_bytes: gzipBinary.length,
      gzip_scp_lossless_bytes: gzipScpL.length,
      gzip_scp_bounded_bytes: gzipScpB.length,
      gzip_quantized_bytes: gzipQ.length,
      gzip_level: GZIP_LEVEL,
      best_general_purpose: bestGp,
    },
    rows,
    fidelity: { lossless: lossless.fidelityOk, bounded: bounded.fidelityOk, quantized: qFid, binary: binaryOk },
    retained: { lossless: lossless.keep.score, bounded: bounded.keep.score, quantized: qKeep.score },
    determinism: { lossless: detL, bounded: detB, quantized: qDet, binary: binaryDet },
    heads: {
      lossless: lossless.head,
      bounded: bounded.head,
      quantized: shaBytes(quantized.bytes),
      binary: shaBytes(binary),
    },
    quantized_vs_binary: ratio(binary.length, quantized.bytes.length),
    quantized_smaller_than_binary: quantized.bytes.length <= binary.length,
    errors,
  };
}
