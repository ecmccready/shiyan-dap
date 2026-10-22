/**
 * ROE eligibility overlay (inspect-only).
 *
 *   eligible = base_eligible ∧ ¬(tensor present ∧ I_t = 0)
 *
 * base_eligible is the existing stored `eligible` flag (combineEligibility at
 * record time). The overlay never makes a step eligible; it can only flag a step
 * with a tensor whose gated improvement I_t is 0. Reason "tensor_gate_failed"
 * when the tensor gate failed, else the first failing gate, else
 * "roe_no_improvement". No tensor, or I_t > 0 (or unknown) → unchanged.
 *
 * Not enforced: reuse reads `eligible` via isReusable (durable-self.ts), which
 * feeds the autonomous loop's plan, so enforcement is left for a later slice.
 */
import type { ExperienceEntry } from "./experience-client";
import { roeForEntry, type RoeField } from "./roe";

export type RoeEligibility = { eligible: boolean; base_eligible: boolean; override: boolean; reason: string | null };

export function roeEligibilityFromField(baseEligible: boolean, roe: RoeField): RoeEligibility {
  const g = roe.gates;
  const flagged = g.tensor !== null && g.tensor !== undefined && roe.I === 0;
  if (!flagged) return { eligible: baseEligible, base_eligible: baseEligible, override: false, reason: null };
  const reason = g.tensor === false ? "tensor_gate_failed"
    : !g.safety ? "safety" : !g.budget ? "budget" : !g.idempotency ? "idempotency" : "roe_no_improvement";
  return { eligible: false, base_eligible: baseEligible, override: baseEligible, reason };
}

export function roeEligibility(e: Pick<ExperienceEntry, "delta_e" | "eligible">): RoeEligibility {
  return roeEligibilityFromField(e.eligible === true, roeForEntry(e));
}
