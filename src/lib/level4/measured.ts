/**
 * Engine-backed measurement for Level 4 runs.
 *
 * Read-only use of the core closed loop (src/lib/closed-loop.ts): freshPlant,
 * stepLoop, Self. Nothing here changes W, measureE, Self() or the safety gate.
 * The controller stores only the applied actions; e is recomputed by replaying
 * them on a fresh plant, so a recovered run always reports the same e.
 */
import { freshPlant, stepLoop, type YAction } from "../closed-loop";

/** Default reference case. Same case as the first pack on /workbench/proof. */
export const LEVEL4_CASE = "case-incomplete-pack";

/**
 * Approved, reusable experience: the sealed sequence listed on
 * /workbench/marketplace ("Safety evidence gate"), verified on the plant.
 */
export const REUSE_SEQUENCE: YAction[] = [
  "mark_boundary",
  "complete_field",
  "request_independent_check",
  "seal_pack",
];

export type Measurement = {
  e0: number; // error before any action
  e: number; // error after the applied actions
  delta_e: number; // e0 - e  (reduction; higher is better)
};

export function measureActions(actions: YAction[], caseId = LEVEL4_CASE): Measurement {
  let plant = freshPlant(caseId);
  const e0 = plant.M.last_e;
  for (const y of actions) plant = stepLoop(plant, { y }).plant;
  const e = plant.M.last_e;
  return { e0, e, delta_e: Number((e0 - e).toFixed(3)) };
}

/** Cold baseline: Self() alone for the same number of steps (no experience). */
export function coldBaseline(steps: number, caseId = LEVEL4_CASE): number {
  let plant = freshPlant(caseId);
  for (let i = 0; i < steps; i++) plant = stepLoop(plant, { which: "self" }).plant;
  return plant.M.last_e;
}

/** Next action from reusable experience; "hold" once the sequence is spent. */
export function nextFromExperience(applied: YAction[]): YAction {
  return REUSE_SEQUENCE[applied.length] ?? "hold";
}

/**
 * Client-safe proposer for autonomousStep (no KV access in the browser).
 * Used by /workbench/autonomous on the single demo plant. The loop itself is
 * domain-neutral: a proposer for software, logistics or clinical state vectors
 * would plug in here the same way, measured with calculateSystemicError and
 * classified with verifyStep below. Only this demo proposer ships today.
 */
export function experienceProposer(applied: YAction[]) {
  return async () => ({ y: nextFromExperience(applied) as string, source: "approved" as const });
}

/** Parses success conditions of the form "e < 0.16 ..." used by the demo goal. */
export function successThreshold(condition: string): number | null {
  const m = condition.match(/e\s*<\s*([0-9.]+)/);
  return m ? Number(m[1]) : null;
}

/* ------------------------------------------------------------------------ */
/* Domain-agnostic systemic error (additive; existing exports unchanged).   */
/* ------------------------------------------------------------------------ */

/**
 * General variance formula: e = ‖proposal − reference‖₂ (Euclidean distance)
 *
 *   e = sqrt( Σ_i (proposal_i − reference_i)² )
 *
 * - Length mismatch: throws (a silent pad would hide a structural defect).
 * - Empty vectors (both length 0): e = 0.
 * - Non-finite components: throws.
 *
 * The same formula applies to any domain whose state can be written as a
 * vector against a reference. The live demo plant still measures e through
 * the core engine (measureActions); this does not replace it.
 */
export function calculateSystemicError(proposal: number[], reference: number[]): number {
  if (proposal.length !== reference.length) {
    throw new Error(
      `calculateSystemicError: length mismatch (proposal ${proposal.length}, reference ${reference.length})`
    );
  }
  let sum = 0;
  for (let i = 0; i < proposal.length; i++) {
    const p = proposal[i];
    const r = reference[i];
    if (!Number.isFinite(p) || !Number.isFinite(r)) {
      throw new Error(`calculateSystemicError: non-finite component at index ${i}`);
    }
    const d = p - r;
    sum += d * d;
  }
  return Math.sqrt(sum);
}

export type StepVerdict = {
  /** Δe = e0 − e1, rounded to 3 decimals. */
  deltaE: number;
  /** Φ = coldE − e1 when e fell and a cold baseline is given; otherwise 0. */
  phi: number;
  status: "ELIGIBLE_EXPERIENCE" | "MISDIAGNOSIS_REJECTED";
};

/**
 * Per-step classifier. A proposal is ELIGIBLE_EXPERIENCE only if it reduced
 * the error (Δe > 0); anything that changes state without reducing e is
 * MISDIAGNOSIS_REJECTED.
 *
 * Φ follows the live loop: phi = coldE − e1 (same as the value stored by
 * /workbench/autonomous), credited only when final e falls (Δe > 0). With no
 * cold baseline, or when Δe ≤ 0, phi = 0.
 *
 * Note: this is separate from the live run's `eligible` flag, which means the
 * goal threshold (success_condition) was met. verifyStep does not change it.
 */
export function verifyStep({
  e0,
  e1,
  coldE,
}: {
  e0: number;
  e1: number;
  coldE?: number | null;
}): StepVerdict {
  const deltaE = Number((e0 - e1).toFixed(3));
  const fell = deltaE > 0;
  const phi =
    fell && typeof coldE === "number" && Number.isFinite(coldE)
      ? Number((coldE - e1).toFixed(3))
      : 0;
  return { deltaE, phi, status: fell ? "ELIGIBLE_EXPERIENCE" : "MISDIAGNOSIS_REJECTED" };
}
