// Bounded autonomous recovery. MetamorphicEngine and metamorphic-runtime stay untouched;
// this module only calls them. A patch is promoted only when a replayed
// evaluateDeterministicProof returns PASS inside the anchor-shift envelope.
import { createHash } from "node:crypto";
import { runTelemetry, type TelemetryInput, type TelemetryResult } from "./metamorphic-runtime";
import type { DeterministicProof } from "./deterministic-proof";

export const AUTONOMOUS_RECOVERY_VERSION = "autonomous-recovery-v1";
export const MAX_ANCHOR_SHIFT_RATIO = 0.25;
export const RECOVERY_FRACTIONS = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => n / 8);

export interface RecoveryEnvelope {
  maxAnchorShiftRatio: typeof MAX_ANCHOR_SHIFT_RATIO;
  scale: number;
  maxShift: number;
  zeroAnchor: boolean;
}

export interface RecoveryRecord {
  version: typeof AUTONOMOUS_RECOVERY_VERSION;
  priorPredicted: number;
  synthesizedPredicted: number | null;
  anchorDelta: number | null;
  phiLift: number | null;
  envelope: RecoveryEnvelope;
  attempts: number;
  replay_hash: string | null;
  promoted: boolean;
  review_flag: "DRIFT_EXCEEDED" | null;
  reason: string;
}

export interface ReconcileResult {
  ran: boolean;
  promoted: boolean;
  record?: RecoveryRecord;
  telemetry?: TelemetryResult;
}

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Same canonical form as proof-publisher, so recovery hashes are comparable. */
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
 * Envelope scale: 0.25·|anchor| when the anchor is nonzero.
 * Zero-anchor case: 0.25·|observed|, so a relative cap still exists.
 * If both are 0, scale and maxShift are 0 and no legal shift exists.
 */
export function envelopeFor(anchor: number, observed: number): RecoveryEnvelope {
  const zeroAnchor = anchor === 0;
  const scale = Math.abs(anchor) > 0 ? Math.abs(anchor) : Math.abs(observed);
  return { maxAnchorShiftRatio: MAX_ANCHOR_SHIFT_RATIO, scale, maxShift: MAX_ANCHOR_SHIFT_RATIO * scale, zeroAnchor };
}

function clampDelta(delta: number, maxShift: number): number {
  if (delta > maxShift) return maxShift;
  if (delta < -maxShift) return -maxShift;
  return delta;
}

/** Pure, deterministic candidate deltas: fractions of the clamped move toward observed, smallest first. */
export function synthesizeAnchorDeltas(anchor: number, observed: number, maxShift: number): number[] {
  if (!(maxShift > 0) || !finite(anchor) || !finite(observed) || !finite(maxShift)) return [];
  const desired = observed - anchor;
  if (desired === 0) return [];
  const clamped = clampDelta(desired, maxShift);
  const out: number[] = [];
  const seen = new Set<string>();
  for (const fraction of RECOVERY_FRACTIONS) {
    const delta = clampDelta(clamped * fraction, maxShift);
    const key = delta.toPrecision(16);
    if (delta === 0 || seen.has(key) || !finite(delta)) continue;
    seen.add(key);
    out.push(delta);
  }
  out.sort((a, b) => Math.abs(a) - Math.abs(b) || a - b);
  return out;
}

export function proofInstability(proof: DeterministicProof): number | null {
  if (!proof.inputs || proof.transformations.length === 0) return null;
  const phi = proof.inputs.phi;
  return Math.max(...proof.transformations.map((t) => Math.abs(t.phi_after - phi)));
}

function replayHash(payload: unknown): string {
  return sha256Canonical({ version: AUTONOMOUS_RECOVERY_VERSION, recovery: payload });
}

export class SelfEngine {
  static readonly maxAnchorShiftRatio = MAX_ANCHOR_SHIFT_RATIO;
  static readonly version = AUTONOMOUS_RECOVERY_VERSION;

  /** Recompute the prior telemetry, then reconcile. */
  static reconcile(input: TelemetryInput): ReconcileResult {
    return SelfEngine.reconcileResult(runTelemetry(input), input);
  }

  /**
   * When the prior seeded proof is FAIL, try bounded counterfactual anchors
   * and replay each through the unchanged runtime. Promote the smallest
   * legal shift that flips the proof to PASS. Otherwise DRIFT_EXCEEDED.
   */
  static reconcileResult(prior: TelemetryResult, input: TelemetryInput): ReconcileResult {
    if (!prior || prior.proof.verdict !== "FAIL" || prior.proof.seed === null) {
      return { ran: false, promoted: false };
    }
    const priorPredicted = input.predicted;
    const observed = input.observed;
    const envelope = envelopeFor(priorPredicted, observed);
    const priorInstability = proofInstability(prior.proof);
    const deltas = synthesizeAnchorDeltas(priorPredicted, observed, envelope.maxShift);
    const failed: { predicted: number; delta: number; telemetry: TelemetryResult }[] = [];

    for (const delta of deltas) {
      const synthesizedPredicted = priorPredicted + delta;
      if (!finite(synthesizedPredicted) || Math.abs(delta) > envelope.maxShift) continue;
      const telemetry = runTelemetry({ ...input, predicted: synthesizedPredicted });
      failed.push({ predicted: synthesizedPredicted, delta, telemetry });
      if (telemetry.proof.verdict !== "PASS") continue;
      const synthesizedInstability = proofInstability(telemetry.proof);
      const phiLift = priorInstability !== null && synthesizedInstability !== null
        ? priorInstability - synthesizedInstability : null;
      const record: RecoveryRecord = {
        version: AUTONOMOUS_RECOVERY_VERSION,
        priorPredicted,
        synthesizedPredicted,
        anchorDelta: delta,
        phiLift,
        envelope,
        attempts: failed.length,
        replay_hash: replayHash({
          priorPredicted, synthesizedPredicted, anchorDelta: delta, phiLift,
          seed: telemetry.seed, proof: telemetry.proof,
        }),
        promoted: true,
        review_flag: null,
        reason: `Promoted bounded anchor shift ${delta} after ${failed.length} deterministic replay(s); evaluateDeterministicProof returned PASS`,
      };
      return { ran: true, promoted: true, record, telemetry };
    }

    const best = failed[failed.length - 1];
    const bestInstability = best ? proofInstability(best.telemetry.proof) : null;
    const phiLift = priorInstability !== null && bestInstability !== null
      ? priorInstability - bestInstability : null;
    const record: RecoveryRecord = {
      version: AUTONOMOUS_RECOVERY_VERSION,
      priorPredicted,
      synthesizedPredicted: null,
      anchorDelta: null,
      phiLift,
      envelope,
      attempts: failed.length,
      replay_hash: best ? replayHash({
        priorPredicted, synthesizedPredicted: best.predicted, anchorDelta: best.delta, phiLift,
        seed: best.telemetry.seed, proof: best.telemetry.proof, promoted: false,
      }) : null,
      promoted: false,
      review_flag: "DRIFT_EXCEEDED",
      reason: deltas.length === 0
        ? "No legal counterfactual anchor exists inside the envelope; flag for human review"
        : `All ${failed.length} bounded replay(s) stayed FAIL; flag for human review`,
    };
    return { ran: true, promoted: false, record };
  }
}

export const self = {
  reconcile: (input: TelemetryInput) => SelfEngine.reconcile(input),
  reconcileResult: (prior: TelemetryResult, input: TelemetryInput) => SelfEngine.reconcileResult(prior, input),
};
