/**
 * Tensor binding for the independent-check and seal steps (additive).
 *
 * The sealed sequence is mark_boundary → complete_field →
 * request_independent_check → seal_pack (REUSE_SEQUENCE in measured.ts,
 * SEALED_SEQUENCE in mcp/schema.ts). Those steps are YAction transitions in
 * the core engine (W in closed-loop.ts), which is not modified. This module
 * wraps them from the outside:
 *
 *   request_independent_check + tensor payload → independentTensorCheck
 *   seal_pack                                  → binds H(T_out), H(T_ref), d
 *                                                into the seal; a
 *                                                MISDIAGNOSIS_VIOLATION fails
 *                                                the seal (not eligible).
 *
 * With no tensor payload callers skip this module entirely, so their outputs
 * are unchanged (fields are omitted, never set to null).
 */
import {
  calculateDynamicThreshold,
  independentTensorCheck,
  parseTensor,
  TENSOR_COMMITMENT_RE,
  type Tensor,
  type TensorCheck,
  type TensorMetric,
  type TensorStatus,
} from "./tensor";

export type TensorPayload = {
  /** T_out: tensor produced by the step (embedding, activation, logits, sensor vector). */
  out: Tensor;
  /** T_ref: the sealed reference tensor. */
  ref: Tensor;
  /** Sealed H(T_ref). If given, T_ref must hash to it. */
  refCommitment?: string;
  /** ε: maximum allowed distance. */
  epsilon: number;
  metric?: TensorMetric;
};

/** Seal fields bound into a sealed pack. Only commitments and the distance; never raw tensors. */
export type TensorSeal = {
  tensor_commitment: string;
  tensor_ref_commitment: string;
  tensor_distance: number;
  tensor_epsilon: number;
  tensor_metric: TensorMetric;
  tensor_ref_integrity: boolean;
  tensor_status: TensorStatus;
};

/**
 * Parse an untrusted payload. Returns:
 *   undefined → no payload (caller must behave exactly as before)
 *   null      → payload present but invalid
 */
export function parseTensorPayload(v: unknown): TensorPayload | null | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const out = parseTensor(o.out);
  const ref = parseTensor(o.ref);
  const epsilon = o.epsilon;
  if (!out || !ref || typeof epsilon !== "number" || !Number.isFinite(epsilon) || epsilon < 0) {
    return null;
  }
  if (o.metric !== undefined && o.metric !== "frobenius" && o.metric !== "cosine") return null;
  if (o.refCommitment !== undefined) {
    if (typeof o.refCommitment !== "string" || !TENSOR_COMMITMENT_RE.test(o.refCommitment)) return null;
  }
  return {
    out,
    ref,
    epsilon,
    ...(o.metric ? { metric: o.metric as TensorMetric } : {}),
    ...(typeof o.refCommitment === "string" ? { refCommitment: o.refCommitment } : {}),
  };
}

/** Independent-check step: compare T_out to the sealed T_ref. Throws on shape mismatch. */
export function requestIndependentTensorCheck(p: TensorPayload): TensorCheck {
  return independentTensorCheck({
    out: p.out,
    ref: p.ref,
    refCommitment: p.refCommitment,
    epsilon: p.epsilon,
    metric: p.metric ?? "frobenius",
  });
}

/** Seal step: bind the check into the seal. sealed=false on MISDIAGNOSIS_VIOLATION. */
export function sealTensorBinding(check: TensorCheck): { sealed: boolean; seal: TensorSeal } {
  return {
    sealed: check.status === "TENSOR_VERIFIED",
    seal: {
      tensor_commitment: check.outCommitment,
      tensor_ref_commitment: check.refCommitment,
      tensor_distance: Number(check.distance.toFixed(6)),
      tensor_epsilon: check.epsilon,
      tensor_metric: check.metric,
      tensor_ref_integrity: check.refIntegrity,
      tensor_status: check.status,
    },
  };
}

/** Optional fields for POST /api/level4/experience. Hash and distance only. */
export function experienceTensorFields(check: TensorCheck): {
  tensor_commitment: string;
  tensor_distance: number;
} {
  return {
    tensor_commitment: check.outCommitment,
    tensor_distance: Number(check.distance.toFixed(6)),
  };
}

/** Check annotated with the bound that decided its verdict (additive fields). */
export type BoundTensorCheck = TensorCheck & {
  bound: "holographic" | "fixed";
  /** ε that decided status: ε_base·√(N/4) for holographic, the caller's ε for fixed. */
  max_allowable: number;
  /** The caller's ε from the payload (fixed-path value). */
  fixed_epsilon: number;
};

/**
 * Default for NEW tensor-check / MCP calls: the verdict uses the holographic bound
 * ε_dyn = ε_base·√(N/4) (Frobenius only). Cosine payloads keep the caller's fixed ε.
 * The live demo and verify replay never call this; they call independentTensorCheck
 * directly with the fixed 0.16 (demo-tensor.ts).
 */
export function holographicDefaultCheck(p: TensorPayload, baseEpsilon = 0.16): BoundTensorCheck {
  const metric = p.metric ?? "frobenius";
  if (metric !== "frobenius") {
    return { ...requestIndependentTensorCheck(p), bound: "fixed", max_allowable: p.epsilon, fixed_epsilon: p.epsilon };
  }
  const maxAllowable = calculateDynamicThreshold(p.ref, { baseEpsilon, baseDimensions: 4 });
  const check = requestIndependentTensorCheck({ ...p, epsilon: maxAllowable });
  return { ...check, bound: "holographic", max_allowable: maxAllowable, fixed_epsilon: p.epsilon };
}
