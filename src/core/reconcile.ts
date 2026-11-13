// Bounded autonomous recovery that records an append-only audit row.
// Pure decision path: no Date.now, no Math.random, no I/O except the injected recorder
// and optional previous-hash lookup. MetamorphicEngine, metamorphic-runtime, SelfEngine,
// existing routes, and shiyan_anchor.reference_anchors are not imported or modified.
// This module is not wired into any route.
import { createHash } from "node:crypto";
import { TENANT_ID_PATTERN } from "./tenant-auth";

export const RECOVERY_RECORD_VERSION = "recovery-record-v1";
export const MAX_ANCHOR_SHIFT_RATIO = 0.25;
export const ANCHORS_NOT_CONFIGURED = "Anchors storage is not configured";

export type RecoveryStatus = "PROMOTED" | "DRIFT_EXCEEDED" | "REJECTED";

export interface ReconcileInput {
  tenantId: string;
  runId?: string;
  referenceId?: string;
  /** Predicted value before recovery (recorded as priorPredicted). */
  priorPredicted: number;
  /** Observed / target value the counterfactual anchor moves toward. */
  observed: number;
  /**
   * Current anchor used to compute the required shift. Often equal to priorPredicted.
   * requiredDelta = observed - currentAnchor.
   */
  currentAnchor: number;
  /** Identity Φ measured before recovery. */
  phiBefore: number;
  /** Seed forwarded to evaluateDeterministicProof. */
  seed?: unknown;
  step?: number;
  /** Override of the 0.25 default. Must be a finite number > 0. */
  maxAnchorShiftRatio?: number;
  /** Optional previous record hash for the per-tenant chain; takes precedence over deps.getPrevRecordSha256. */
  prevRecordSha256?: string | null;
}

/**
 * Minimal proof surface. The existing evaluateDeterministicProof fits this signature.
 * Callers may set phiAfter to override the default Φ-after measurement used for phiLift.
 */
export interface ReconcileProof {
  verdict: string;
  phiAfter?: number;
  inputs?: { phi?: number } | null;
  transformations?: { phi_after: number }[];
}

export type EvaluateDeterministicProof = (
  input: { predicted: number; observed: number; phi?: number; step?: number },
  seed: unknown,
) => ReconcileProof;

export interface CanonicalRecoveryRecord {
  version: typeof RECOVERY_RECORD_VERSION;
  tenantId: string;
  runId: string | null;
  referenceId: string | null;
  status: RecoveryStatus;
  priorPredicted: number;
  synthesizedPredicted: number | null;
  anchorDelta: number | null;
  phiBefore: number;
  phiAfter: number | null;
  phiLift: number | null;
  maxAnchorShiftRatio: number;
  bound: number;
  scale: number;
  zeroAnchor: boolean;
  requiredDelta: number;
  proofVerdict: string | null;
  prevRecordSha256: string | null;
  createdAt: string;
}

export interface RecoveryRecordWrite extends CanonicalRecoveryRecord {
  recordSha256: string;
}

export type RecorderResult = { ok: true; id?: string } | { ok: false; error: string };

export interface RecoveryRecorder {
  record(row: RecoveryRecordWrite): Promise<RecorderResult>;
}

export interface ReconcileDeps {
  evaluateDeterministicProof: EvaluateDeterministicProof;
  recorder: RecoveryRecorder;
  /** Injected clock; used only for createdAt on the audit record, never for the status decision. */
  clock?: () => Date;
  getPrevRecordSha256?: (tenantId: string) => Promise<string | null>;
}

export interface ReconcileResult {
  ok: boolean;
  promoted: boolean;
  status?: RecoveryStatus;
  priorPredicted: number;
  synthesizedPredicted: number | null;
  anchorDelta: number | null;
  phiLift: number | null;
  proofVerdict: string | null;
  recordSha256?: string;
  record?: RecoveryRecordWrite;
  error?: string;
}

export interface AnchorBound {
  ratio: number;
  scale: number;
  bound: number;
  zeroAnchor: boolean;
}

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Same canonical form as proof-publisher / SelfEngine, so hashes are comparable. */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const r = value as Record<string, unknown>;
    return `{${Object.keys(r).filter((k) => r[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonical(r[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function sha256Canonical(value: unknown): string {
  return createHash("sha256").update(canonical(value)).digest("hex");
}

/**
 * Bound on |anchorDelta|:
 *   scale = |currentAnchor|
 *   bound = ratio * scale  (ratio defaults to 0.25)
 * When currentAnchor is 0, scale and bound are 0. A relative cap of |anchor|
 * cannot authorize a nonzero move from a zero anchor, so any requiredDelta !== 0
 * is DRIFT_EXCEEDED (still recorded, never promoted). The observed value is
 * accepted for the call signature and requiredDelta only; it is not a fallback scale.
 * A required shift is legal iff |requiredDelta| <= bound (the exact edge is allowed).
 */
export function anchorBound(currentAnchor: number, _observed: number, ratio = MAX_ANCHOR_SHIFT_RATIO): AnchorBound {
  const zeroAnchor = currentAnchor === 0;
  const scale = Math.abs(currentAnchor);
  return { ratio, scale, bound: ratio * scale, zeroAnchor };
}

export function measurePhiAfter(proof: ReconcileProof, fallback: number): number {
  if (finite(proof.phiAfter)) return proof.phiAfter;
  const ts = proof.transformations;
  if (Array.isArray(ts) && ts.length > 0 && ts.every((t) => finite(t.phi_after))) {
    return ts.reduce((sum, t) => sum + t.phi_after, 0) / ts.length;
  }
  if (finite(proof.inputs?.phi)) return proof.inputs.phi;
  return fallback;
}

export function createMemoryRecoveryRecorder(): RecoveryRecorder & { rows: RecoveryRecordWrite[] } {
  const rows: RecoveryRecordWrite[] = [];
  return {
    rows,
    async record(row: RecoveryRecordWrite): Promise<RecorderResult> {
      rows.push(row);
      return { ok: true, id: String(rows.length) };
    },
  };
}

export function disabledRecoveryRecorder(reason = ANCHORS_NOT_CONFIGURED): RecoveryRecorder {
  return { async record() { return { ok: false, error: reason }; } };
}

function invalid(input: ReconcileInput, error: string): ReconcileResult {
  return {
    ok: false, promoted: false, priorPredicted: finite(input.priorPredicted) ? input.priorPredicted : NaN,
    synthesizedPredicted: null, anchorDelta: null, phiLift: null, proofVerdict: null, error,
  };
}

/**
 * Synthesize a bounded counterfactual anchor update and, when the required shift
 * is inside the envelope, replay via injected evaluateDeterministicProof.
 *
 * Status:
 *  - DRIFT_EXCEEDED when |observed - currentAnchor| > bound (no promotion; still recorded).
 *  - PROMOTED only when the required shift is within bound and the replayed verdict
 *    flips cleanly from a non-PASS prior verdict to exactly "PASS".
 *  - REJECTED when the shift is within bound but that clean flip does not occur.
 *
 * phiLift = phiAfter - phiBefore.
 * A canonical, key-ordered JSON record is hashed with SHA-256 and written through
 * the injected recorder. The decision does not depend on the clock.
 */
export async function reconcile(input: ReconcileInput, deps: ReconcileDeps): Promise<ReconcileResult> {
  if (!input || !TENANT_ID_PATTERN.test(input.tenantId)) {
    return invalid(input ?? { priorPredicted: NaN } as ReconcileInput, "Invalid tenant id");
  }
  if (!finite(input.priorPredicted) || !finite(input.observed) || !finite(input.currentAnchor) || !finite(input.phiBefore)) {
    return invalid(input, "priorPredicted, observed, currentAnchor, and phiBefore must be finite numbers");
  }
  const ratio = input.maxAnchorShiftRatio === undefined ? MAX_ANCHOR_SHIFT_RATIO : input.maxAnchorShiftRatio;
  if (!finite(ratio) || ratio <= 0) return invalid(input, "maxAnchorShiftRatio must be a finite number greater than 0");

  const requiredDelta = input.observed - input.currentAnchor;
  const env = anchorBound(input.currentAnchor, input.observed, ratio);
  const exceeds = Math.abs(requiredDelta) > env.bound;
  const appliedDelta = requiredDelta;
  const synthesizedPredicted = input.currentAnchor + appliedDelta;

  let priorVerdict: string | null = null;
  let proofVerdict: string | null = null;
  let phiAfter: number | null = null;
  let status: RecoveryStatus;

  try {
    const prior = deps.evaluateDeterministicProof(
      { predicted: input.priorPredicted, observed: input.observed, phi: input.phiBefore, step: input.step },
      input.seed,
    );
    priorVerdict = prior.verdict;
    if (exceeds) {
      status = "DRIFT_EXCEEDED";
      proofVerdict = priorVerdict;
      phiAfter = input.phiBefore;
    } else {
      const replay = deps.evaluateDeterministicProof(
        { predicted: synthesizedPredicted, observed: input.observed, phi: input.phiBefore, step: input.step },
        input.seed,
      );
      proofVerdict = replay.verdict;
      phiAfter = measurePhiAfter(replay, input.phiBefore);
      const flipped = priorVerdict !== "PASS" && proofVerdict === "PASS";
      status = flipped ? "PROMOTED" : "REJECTED";
    }
  } catch {
    return invalid(input, "Deterministic proof evaluation failed");
  }

  const phiLift = phiAfter !== null ? phiAfter - input.phiBefore : null;
  const createdAt = (deps.clock ?? (() => new Date()))().toISOString();
  let prevRecordSha256: string | null = input.prevRecordSha256 !== undefined ? input.prevRecordSha256 : null;
  if (input.prevRecordSha256 === undefined && deps.getPrevRecordSha256) {
    try { prevRecordSha256 = await deps.getPrevRecordSha256(input.tenantId); }
    catch { return invalid(input, "Failed to read previous recovery record hash"); }
  }

  const canonicalRecord: CanonicalRecoveryRecord = {
    version: RECOVERY_RECORD_VERSION,
    tenantId: input.tenantId,
    runId: input.runId ?? null,
    referenceId: input.referenceId ?? null,
    status,
    priorPredicted: input.priorPredicted,
    synthesizedPredicted,
    anchorDelta: appliedDelta,
    phiBefore: input.phiBefore,
    phiAfter,
    phiLift,
    maxAnchorShiftRatio: ratio,
    bound: env.bound,
    scale: env.scale,
    zeroAnchor: env.zeroAnchor,
    requiredDelta,
    proofVerdict,
    prevRecordSha256,
    createdAt,
  };
  const recordSha256 = sha256Canonical(canonicalRecord);
  const record: RecoveryRecordWrite = { ...canonicalRecord, recordSha256 };

  try {
    const written = await deps.recorder.record(record);
    if (!written.ok) {
      return {
        ok: false, promoted: false, status, priorPredicted: input.priorPredicted,
        synthesizedPredicted, anchorDelta: appliedDelta, phiLift, proofVerdict,
        recordSha256, record, error: written.error,
      };
    }
    return {
      ok: true, promoted: status === "PROMOTED", status, priorPredicted: input.priorPredicted,
      synthesizedPredicted, anchorDelta: appliedDelta, phiLift, proofVerdict,
      recordSha256, record,
    };
  } catch {
    return {
      ok: false, promoted: false, status, priorPredicted: input.priorPredicted,
      synthesizedPredicted, anchorDelta: appliedDelta, phiLift, proofVerdict,
      recordSha256, record, error: "Recovery recorder failed",
    };
  }
}
