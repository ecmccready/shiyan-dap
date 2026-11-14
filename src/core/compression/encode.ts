// 4D state compression (M1): lossless segment encoding and reconstruction. Pure and deterministic.
import { createHash } from "node:crypto";
import { sha256Canonical } from "../reconcile";
import { TENANT_ID_PATTERN } from "../tenant-auth";
import { comparePoints } from "./extract";
import { STATE_SEGMENT_VERSION, type SealedSegment, type StatePoint, type StateSegment, type StateVector, type StateVerdict } from "./types";

const ZERO = BigInt(0);
const HEX = /^(0|[1-9a-f][0-9a-f]{0,15})$/;
const SHA = /^[0-9a-f]{64}$/;
const VERDICT_CODE: Record<StateVerdict, string> = { PASS: "P", FAIL: "F", INCONCLUSIVE: "I" };
const CODE_VERDICT: Record<string, StateVerdict> = { P: "PASS", F: "FAIL", I: "INCONCLUSIVE" };

function bitsOf(x: number): bigint {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, x);
  return view.getBigUint64(0);
}
function floatOf(bits: bigint): number {
  const view = new DataView(new ArrayBuffer(8));
  view.setBigUint64(0, bits);
  return view.getFloat64(0);
}

/**
 * Lossless float64 column coding: each value's IEEE-754 bit pattern XOR the previous one, as hex.
 * Exact for every finite value including -0 and subnormals; a repeated value encodes as "0".
 */
export function encodeFloats(values: readonly number[]): string[] {
  let prev = ZERO;
  return values.map((v) => {
    if (!Number.isFinite(v)) throw new RangeError("only finite float64 values can be encoded");
    const bits = bitsOf(v);
    const out = (bits ^ prev).toString(16);
    prev = bits;
    return out;
  });
}

export function decodeFloats(codes: readonly string[]): number[] {
  let prev = ZERO;
  return codes.map((c) => {
    if (typeof c !== "string" || !HEX.test(c)) throw new RangeError("invalid float code");
    const bits = BigInt(`0x${c}`) ^ prev;
    prev = bits;
    const v = floatOf(bits);
    if (!Number.isFinite(v)) throw new RangeError("decoded value is not finite");
    return v;
  });
}

const leafHash = (id: string, sha: string) =>
  createHash("sha256").update("\u0000").update(JSON.stringify([id, sha])).digest("hex");
const nodeHash = (l: string, r: string) => createHash("sha256").update("\u0001").update(l).update(r).digest("hex");

/** Domain-separated binary Merkle root; an odd last node is promoted unchanged (not duplicated). */
export function sourceIdsRoot(ids: readonly { experience_id: string; content_sha256: string }[]): string {
  if (ids.length === 0) throw new RangeError("a segment needs at least one source");
  let level = ids.map((p) => leafHash(p.experience_id, p.content_sha256));
  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) next.push(i + 1 < level.length ? nodeHash(level[i], level[i + 1]) : level[i]);
    level = next;
  }
  return level[0];
}

export function sealSegment(segment: StateSegment): SealedSegment {
  return { segment, segment_sha256: sha256Canonical(segment) };
}

/** Builds one lossless segment from points already in canonical order (see comparePoints). */
export function compressPoints(tenant: string, seq: number, points: readonly StatePoint[], prev: string | null): SealedSegment {
  if (!TENANT_ID_PATTERN.test(tenant)) throw new TypeError("tenant must match TENANT_ID_PATTERN");
  if (!Number.isSafeInteger(seq) || seq < 0) throw new RangeError("seq must be a non-negative integer");
  if (points.length === 0) throw new RangeError("a segment needs at least one point");
  if (prev !== null && !SHA.test(prev)) throw new RangeError("prev_segment_sha256 must be null or 64 hex");
  if ((seq === 0) !== (prev === null)) throw new RangeError("only seq 0 may have a null prev_segment_sha256");
  for (let i = 1; i < points.length; i++) if (comparePoints(points[i - 1], points[i]) >= 0) throw new RangeError("points must be strictly ordered");
  for (const p of points) if (!Number.isSafeInteger(p.t)) throw new RangeError("t must be an integer epoch-ms value");
  const segment: StateSegment = {
    version: STATE_SEGMENT_VERSION,
    tenant_id: tenant,
    seq,
    count: points.length,
    t0: points[0].t,
    dt: points.slice(1).map((p, i) => p.t - points[i].t),
    predicted: encodeFloats(points.map((p) => p.predicted)),
    observed: encodeFloats(points.map((p) => p.observed)),
    phi: encodeFloats(points.map((p) => p.phi)),
    step: encodeFloats(points.map((p) => p.step)),
    verdicts: points.map((p) => VERDICT_CODE[p.verdict]).join(""),
    source_ids_root: sourceIdsRoot(points),
    loss: { mode: "lossless" },
    prev_segment_sha256: prev,
  };
  return sealSegment(segment);
}

/** Exact inverse of compressPoints for the 4D state. Source identities are committed by source_ids_root only. */
export function reconstruct(segment: StateSegment): StateVector[] {
  const n = segment.count;
  if (segment.version !== STATE_SEGMENT_VERSION) throw new RangeError("unsupported segment version");
  if (segment.loss?.mode !== "lossless") throw new RangeError("only lossless segments are supported");
  if (!Number.isSafeInteger(n) || n < 1) throw new RangeError("invalid count");
  if (!Number.isSafeInteger(segment.t0) || !Array.isArray(segment.dt) || segment.dt.length !== n - 1
    || !segment.dt.every((d) => Number.isSafeInteger(d) && d >= 0)) throw new RangeError("invalid time axis");
  for (const col of [segment.predicted, segment.observed, segment.phi, segment.step]) {
    if (!Array.isArray(col) || col.length !== n) throw new RangeError("column length mismatch");
  }
  if (typeof segment.verdicts !== "string" || segment.verdicts.length !== n) throw new RangeError("verdict length mismatch");
  const predicted = decodeFloats(segment.predicted);
  const observed = decodeFloats(segment.observed);
  const phi = decodeFloats(segment.phi);
  const step = decodeFloats(segment.step);
  const out: StateVector[] = [];
  let t = segment.t0;
  for (let i = 0; i < n; i++) {
    if (i > 0) t += segment.dt[i - 1];
    if (!Number.isSafeInteger(t)) throw new RangeError("time overflow");
    const verdict = CODE_VERDICT[segment.verdicts[i]];
    if (!verdict) throw new RangeError("invalid verdict code");
    out.push({ t, predicted: predicted[i], observed: observed[i], phi: phi[i], step: step[i], verdict });
  }
  return out;
}
