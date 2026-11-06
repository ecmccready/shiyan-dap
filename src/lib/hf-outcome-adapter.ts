/** Node-only bridge. Does not edit or import the Level 4 plant/controller. */
import { HFMemory } from "@/core/hf-memory";
import { recommendNextAction } from "@/core/roe-next-action";
import { computeB, Self, type OutcomeTransition } from "@/lib/outcomes";

/**
 * Use HF evidence for next-action advice, not as fabricated settlement/outcome state.
 * Local outcome measurements, action gates and error bits remain authoritative.
 * Browser-only Self()/computeB() remain synchronous and unchanged.
 */
export function readOperationalState(outcomes: OutcomeTransition[] = [], memory = new HFMemory()) {
  const self = Self(outcomes);
  const computed_b = computeB(outcomes);
  try {
    // recommendNextAction itself retrieves via retrieveEligible and enforces v1.1 gates.
    const proposal = recommendNextAction(memory);
    if (!proposal.experience_id) return { self, computed_b, proposal, memory_source: "local-outcome-fallback" as const };
    console.log(`[HF outcomes] retrieved_for_next_action=${proposal.experience_id}; Self/computeB server adapter uses verified HF advice`);
    return {
      self: { ...self, z: proposal.action },
      computed_b: { ...computed_b, z: proposal.action, source: `${computed_b.source}; HF next-action advice ${proposal.experience_id}` },
      proposal, memory_source: "hf-memory" as const,
    };
  } catch (error) {
    console.error("HF next-action retrieval failed; retaining local outcomes", error);
    return { self, computed_b, memory_source: "local-outcome-fallback" as const, memory_error: "HF memory unavailable" };
  }
}

export function SelfFromHF(outcomes: OutcomeTransition[] = [], memory = new HFMemory()) {
  return readOperationalState(outcomes, memory).self;
}

export function computeBFromHF(outcomes: OutcomeTransition[] = [], memory = new HFMemory()) {
  return readOperationalState(outcomes, memory).computed_b;
}
