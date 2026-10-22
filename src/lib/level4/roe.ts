/**
 * Reciprocal Optimization Engine (ROE) — first additive slice, read-only.
 *
 *   I_t = 1[G_t] · max(0, Δe_t),   G_t = safety ∧ budget ∧ idempotency
 *
 * Gate results are read, not recomputed. An experience entry is only written by
 * /workbench/autonomous after the idempotency check (alreadyApplied), the budget
 * precheck (precheckAction) and the safety gate (autonomousStep / checkSafety)
 * have all passed, so a stored entry is the existing record that its gates
 * passed (gate_source "recorded_step"). Entries do not store per-gate values.
 * Δe_t is the stored delta_e (e0 − e, as measured by the engine).
 *
 * Informational only: not used by eligibility, next-action selection, the
 * autonomous loop, the 26 verify checks or the anchor.
 */
import type { ExperienceEntry } from "./experience-client";

export type RoeGates = { safety: boolean; budget: boolean; idempotency: boolean };

export type RoeField = {
  gates: RoeGates;
  gate_source: "recorded_step";
  G: boolean;
  delta_e: number | null;
  I: number | null;
};

/** I_t = 1[G] · max(0, Δe). null when Δe is not known. */
export function gatedImprovement(gates: RoeGates, deltaE: number | null | undefined): { G: boolean; I: number | null } {
  const G = gates.safety && gates.budget && gates.idempotency;
  if (typeof deltaE !== "number" || !Number.isFinite(deltaE)) return { G, I: null };
  return { G, I: G ? Math.max(0, deltaE) : 0 };
}

/** ROE field for a stored experience entry (gates passed by virtue of being recorded). */
export function roeForEntry(e: Pick<ExperienceEntry, "delta_e">): RoeField {
  const gates: RoeGates = { safety: true, budget: true, idempotency: true };
  const delta_e = typeof e.delta_e === "number" && Number.isFinite(e.delta_e) ? e.delta_e : null;
  const { G, I } = gatedImprovement(gates, delta_e);
  return { gates, gate_source: "recorded_step", G, delta_e, I };
}
