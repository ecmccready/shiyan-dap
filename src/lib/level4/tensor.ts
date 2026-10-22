/**
 * Tensor scope for Level 4 verification (additive).
 *
 * Binds tensors (embeddings, activation states, logit distributions, sensor
 * vectors) into the verification scope next to the existing e / Δe / Φ checks.
 * A tensor T ∈ ℝ^{d1×…×dn} is stored row-major as a flat array plus its shape.
 *
 *   Commitment   H(T) = sha256(serializeTensor(T))   → "sha256:<64 hex>"
 *   Independent  d = ‖T_out − T_ref‖_F   (Frobenius)   or   1 − cos(T_out, T_ref)
 *   check        d > ε  or  H(T_ref) ≠ sealed commitment  → MISDIAGNOSIS_VIOLATION
 *
 * Only the commitment (and the distance) is meant to be stored in a ledger,
 * never the raw tensor. Pure, synchronous and dependency-free, so the same
 * code (and the same hash) runs in Node and in the browser.
 *
 * Nothing here changes the core engine (closed-loop.ts, Self(), measureE, W,
 * safety). The tensor check is an additional gate: when no tensor is supplied
 * nothing changes (see combineEligibility).
 */

export type TensorDType = "f32" | "f64";

export type TensorKind = "embedding" | "activation" | "logits" | "sensor" | (string & {});

export type Tensor = {
  /** Dimensions d1…dn. Every entry a non-negative integer. [] is a scalar. */
  shape: number[];
  /** Row-major flat data; length must equal product(shape). */
  data: number[] | Float32Array;
  /** Serialization width. Default "f64". */
  dtype?: TensorDType;
  /** Informational only; not part of the commitment. */
  kind?: TensorKind;
};

export type TensorMetric = "frobenius" | "cosine";

export type TensorStatus = "TENSOR_VERIFIED" | "MISDIAGNOSIS_VIOLATION";

export const TENSOR_COMMITMENT_RE = /^sha256:[0-9a-f]{64}$/;

/* ------------------------------------------------------------------------ */
/* Validation                                                               */
/* ------------------------------------------------------------------------ */

/** Throws unless shape is valid, product(shape) == data.length and all values are finite. */
export function validateTensor(t: Tensor): void {
  if (!t || !Array.isArray(t.shape)) throw new Error("tensor: shape must be an array");
  if (t.shape.length > 32) throw new Error("tensor: too many dimensions (max 32)");
  let n = 1;
  for (const d of t.shape) {
    if (!Number.isInteger(d) || d < 0) throw new Error(`tensor: invalid dimension ${d}`);
    n *= d;
  }
  const data = t.data;
  if (!(Array.isArray(data) || data instanceof Float32Array)) {
    throw new Error("tensor: data must be number[] or Float32Array");
  }
  if (data.length !== n) {
    throw new Error(`tensor: data length ${data.length} != product(shape) ${n}`);
  }
  for (let i = 0; i < data.length; i++) {
    const v = data[i];
    if (typeof v !== "number" || !Number.isFinite(v)) {
      throw new Error(`tensor: non-finite value at index ${i}`);
    }
  }
  if (t.dtype !== undefined && t.dtype !== "f32" && t.dtype !== "f64") {
    throw new Error(`tensor: unsupported dtype ${String(t.dtype)}`);
  }
}

/* ------------------------------------------------------------------------ */
/* Canonical serialization                                                  */
/* ------------------------------------------------------------------------ */

/**
 * Canonical bytes of a tensor:
 *
 *   ASCII header  "AETHEL-T1;<dtype>;<d1>x<d2>x…x<dn>;"   (scalar: empty shape)
 *   payload       each value, row-major, IEEE-754 little-endian
 *                 (8 bytes for f64, 4 bytes for f32 after Math.fround)
 *
 * −0 is normalized to 0. `kind` is not serialized. DataView with explicit
 * little-endian writes makes the bytes identical in Node and every browser.
 */
export function serializeTensor(t: Tensor): Uint8Array {
  validateTensor(t);
  const dtype: TensorDType = t.dtype ?? "f64";
  const header = `AETHEL-T1;${dtype};${t.shape.join("x")};`;
  const width = dtype === "f32" ? 4 : 8;
  const out = new Uint8Array(header.length + t.data.length * width);
  for (let i = 0; i < header.length; i++) out[i] = header.charCodeAt(i);
  const view = new DataView(out.buffer, header.length);
  for (let i = 0; i < t.data.length; i++) {
    const v = t.data[i] === 0 ? 0 : t.data[i];
    if (width === 4) view.setFloat32(i * 4, v, true);
    else view.setFloat64(i * 8, v, true);
  }
  return out;
}

/* ------------------------------------------------------------------------ */
/* SHA-256 (FIPS 180-4), synchronous, no dependencies                       */
/* ------------------------------------------------------------------------ */

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

/** Hex SHA-256 of a byte array. Pure JS so it is synchronous on server and client. */
export function sha256Hex(bytes: Uint8Array): string {
  const len = bytes.length;
  const padded = new Uint8Array(((len + 9 + 63) >> 6) << 6);
  padded.set(bytes);
  padded[len] = 0x80;
  const dv = new DataView(padded.buffer);
  const bits = len * 8;
  dv.setUint32(padded.length - 8, Math.floor(bits / 0x100000000), false);
  dv.setUint32(padded.length - 4, bits >>> 0, false);

  const H = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const w = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0;
      d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
  }
  let hex = "";
  for (let i = 0; i < 8; i++) hex += H[i].toString(16).padStart(8, "0");
  return hex;
}

/** H(T) = "sha256:" + sha256(serializeTensor(T)). Synchronous; same value in Node and browser. */
export function commitTensor(t: Tensor): string {
  return `sha256:${sha256Hex(serializeTensor(t))}`;
}

/* ------------------------------------------------------------------------ */
/* Distances                                                                */
/* ------------------------------------------------------------------------ */

function assertSameShape(a: Tensor, b: Tensor, fn: string) {
  validateTensor(a);
  validateTensor(b);
  if (a.shape.length !== b.shape.length || a.shape.some((d, i) => d !== b.shape[i])) {
    throw new Error(`${fn}: shape mismatch [${a.shape.join(",")}] vs [${b.shape.join(",")}]`);
  }
}

/** ‖a − b‖_F = sqrt(Σ (a_i − b_i)²). Shapes must match exactly (throws otherwise). */
export function frobeniusDistance(a: Tensor, b: Tensor): number {
  assertSameShape(a, b, "frobeniusDistance");
  let sum = 0;
  for (let i = 0; i < a.data.length; i++) {
    const d = a.data[i] - b.data[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

/**
 * cos(a, b) = ⟨a, b⟩ / (‖a‖ ‖b‖), over the flattened tensors. Shapes must match.
 * Zero vectors: both zero → 1 (identical); exactly one zero → 0 (no shared direction).
 */
export function cosineSimilarity(a: Tensor, b: Tensor): number {
  assertSameShape(a, b, "cosineSimilarity");
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.data.length; i++) {
    dot += a.data[i] * b.data[i];
    na += a.data[i] * a.data[i];
    nb += b.data[i] * b.data[i];
  }
  if (na === 0 && nb === 0) return 1;
  if (na === 0 || nb === 0) return 0;
  const sim = dot / (Math.sqrt(na) * Math.sqrt(nb));
  return Math.max(-1, Math.min(1, sim));
}

/** 1 − cosineSimilarity(a, b), in [0, 2]. */
export function cosineDistance(a: Tensor, b: Tensor): number {
  return 1 - cosineSimilarity(a, b);
}

/* ------------------------------------------------------------------------ */
/* Independent tensor check                                                 */
/* ------------------------------------------------------------------------ */

export type TensorCheck = {
  distance: number;
  epsilon: number;
  metric: TensorMetric;
  /** H(T_out). */
  outCommitment: string;
  /** Sealed H(T_ref) if one was supplied, else the recomputed H(T_ref). */
  refCommitment: string;
  /** Recomputed H(T_ref) equals the sealed refCommitment (true when none was sealed). */
  refIntegrity: boolean;
  status: TensorStatus;
};

/**
 * Compare T_out against a sealed T_ref.
 * MISDIAGNOSIS_VIOLATION when distance > ε, or when the supplied T_ref does not
 * hash to the sealed refCommitment (tampered or wrong reference).
 * Throws on invalid tensors, shape mismatch, or a non-finite / negative ε.
 */
export function independentTensorCheck({
  out,
  ref,
  refCommitment,
  epsilon,
  metric = "frobenius",
}: {
  out: Tensor;
  ref: Tensor;
  refCommitment?: string;
  epsilon: number;
  metric?: TensorMetric;
}): TensorCheck {
  if (typeof epsilon !== "number" || !Number.isFinite(epsilon) || epsilon < 0) {
    throw new Error("independentTensorCheck: epsilon must be a finite number >= 0");
  }
  if (metric !== "frobenius" && metric !== "cosine") {
    throw new Error(`independentTensorCheck: unsupported metric ${String(metric)}`);
  }
  const distance = metric === "cosine" ? cosineDistance(out, ref) : frobeniusDistance(out, ref);
  const outCommitment = commitTensor(out);
  const recomputedRef = commitTensor(ref);
  const refIntegrity = refCommitment === undefined ? true : refCommitment === recomputedRef;
  const status: TensorStatus =
    refIntegrity && distance <= epsilon ? "TENSOR_VERIFIED" : "MISDIAGNOSIS_VIOLATION";
  return {
    distance,
    epsilon,
    metric,
    outCommitment,
    refCommitment: refCommitment ?? recomputedRef,
    refIntegrity,
    status,
  };
}

/**
 * Tensor scope as an additional gate. Eligible only when the existing step
 * logic is eligible AND (no tensor check was run OR it is TENSOR_VERIFIED).
 * With no tensor check the result equals the existing eligibility exactly.
 *
 * Accepts a verifyStep() result ({ status }) or a plain boolean.
 */
export function combineEligibility(
  step: { status: string } | boolean,
  tensorCheck?: Pick<TensorCheck, "status"> | null
): boolean {
  const stepEligible = typeof step === "boolean" ? step : step.status === "ELIGIBLE_EXPERIENCE";
  if (!tensorCheck) return stepEligible;
  return stepEligible && tensorCheck.status === "TENSOR_VERIFIED";
}

/** Upper bound on elements accepted from untrusted input (API / MCP). */
export const MAX_TENSOR_ELEMENTS = 65536;

/**
 * Parse an untrusted JSON value into a Tensor (number[] data only).
 * Returns null if invalid or larger than maxElements.
 */
export function parseTensor(v: unknown, maxElements = MAX_TENSOR_ELEMENTS): Tensor | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (!Array.isArray(o.shape) || !Array.isArray(o.data)) return null;
  if (o.data.length > maxElements) return null;
  const t: Tensor = {
    shape: o.shape as number[],
    data: o.data as number[],
    ...(o.dtype === "f32" || o.dtype === "f64" ? { dtype: o.dtype } : {}),
    ...(typeof o.kind === "string" ? { kind: o.kind.slice(0, 32) } : {}),
  };
  try {
    validateTensor(t);
  } catch {
    return null;
  }
  return t;
}

/* ------------------------------------------------------------------------ */
/* Holographic (dynamic) Frobenius bound — opt-in, additive                 */
/* ------------------------------------------------------------------------ */

export type DynamicThresholdConfig = { baseEpsilon: number; baseDimensions: number };

/**
 * ε_dyn = ε_base · √(N / N_base), N = total elements (product(shape) = data.length).
 * With the defaults a 4-element tensor gets exactly 0.16. Opt-in only: the live
 * run and independentTensorCheck keep their fixed ε.
 */
export function calculateDynamicThreshold(
  tensor: Tensor,
  config: DynamicThresholdConfig = { baseEpsilon: 0.16, baseDimensions: 4 }
): number {
  validateTensor(tensor);
  const { baseEpsilon, baseDimensions } = config;
  if (!Number.isFinite(baseEpsilon) || baseEpsilon < 0) {
    throw new Error("calculateDynamicThreshold: baseEpsilon must be a finite number >= 0");
  }
  if (!Number.isFinite(baseDimensions) || baseDimensions <= 0) {
    throw new Error("calculateDynamicThreshold: baseDimensions must be a finite number > 0");
  }
  const totalElements = tensor.data.length;
  return baseEpsilon * Math.sqrt(totalElements / baseDimensions);
}

export type HolographicBound = { verified: boolean; distance: number; maxAllowable: number };

/**
 * ‖T_out − T_ref‖_F ≤ ε_dyn(T_ref). Same comparison (≤) as independentTensorCheck.
 * Throws on invalid tensors or shape mismatch (via frobeniusDistance).
 */
export function verifyHolographicBound(
  tOut: Tensor,
  tRef: Tensor,
  baseEpsilon = 0.16
): HolographicBound {
  const distance = frobeniusDistance(tOut, tRef);
  const maxAllowable = calculateDynamicThreshold(tRef, { baseEpsilon, baseDimensions: 4 });
  return { verified: distance <= maxAllowable, distance, maxAllowable };
}

/**
 * Ledger-style tokens for an opt-in holographic check, so maxAllowable is inspectable.
 * Only emitted by holographic-mode responses; existing ledger lines are untouched.
 */
export function holographicLedgerTokens(h: HolographicBound): string {
  return `H_MAX=${h.maxAllowable.toFixed(3)} H_DIST=${h.distance.toFixed(3)} H_VERIFIED=${h.verified}`;
}

/* ------------------------------------------------------------------------ */
/* Normalized RMS path (ROE, opt-in, additive)                              */
/* ------------------------------------------------------------------------ */

export type TensorCheckMode = "normalized" | "rms";

/** True for the opt-in normalized RMS mode names ("normalized" or its alias "rms"). */
export function isNormalizedMode(v: unknown): v is TensorCheckMode {
  return v === "normalized" || v === "rms";
}

export type NormalizedRmsCheck = {
  mode: "normalized";
  /** e_t = ‖T_t − T_ref‖_F / √N. */
  e_t: number;
  /** Total elements, product(shape). */
  N: number;
  eps_base: number;
  /** e_t ≤ eps_base. */
  accepted: boolean;
};

/**
 * Normalized RMS error: e_t = ‖T_t − T_ref‖_F / √N, accepted iff e_t ≤ eps_base.
 * Opt-in only; independentTensorCheck, the fixed and the holographic paths are unchanged.
 * eps_base is supplied by the caller (the API/MCP default it to the request's ε).
 * N = 0 gives e_t = 0. Throws on invalid tensors, shape mismatch or invalid eps_base.
 */
export function normalizedRmsCheck(tOut: Tensor, tRef: Tensor, epsBase: number): NormalizedRmsCheck {
  if (!Number.isFinite(epsBase) || epsBase < 0) {
    throw new Error("normalizedRmsCheck: eps_base must be a finite number >= 0");
  }
  const fro = frobeniusDistance(tOut, tRef);
  const N = tRef.data.length;
  const e_t = N > 0 ? fro / Math.sqrt(N) : 0;
  return { mode: "normalized", e_t, N, eps_base: epsBase, accepted: e_t <= epsBase };
}
