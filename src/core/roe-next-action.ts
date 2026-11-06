import { HFMemory, retrieveEligible } from "./hf-memory";
import type { NextActionProposal } from "./interfaces";
import { type ExperienceRecord, validateExperienceRecord } from "./experience-schema";

export interface NextActionRecommendation {
  action: string;
  reason: string;
  experience_id: string;
}

/** Synthetic includes simulated runs, not just records explicitly labelled synthetic. */
export function isSyntheticExperience(record: ExperienceRecord): boolean {
  return /synthetic|simulat/i.test(record.data_classification ?? "")
    || /synthetic|simulat/i.test(record.provenance.source);
}

/** Pure selector: no mutation, I/O, or execution of the recommended action. Null means no verified memory. */
export function selectNextAction(experiences: readonly ExperienceRecord[]): NextActionRecommendation | null {
  const eligible = experiences.filter((record) => validateExperienceRecord(record)
    && record.reuse_eligibility === true && record.verification.replay_verdict === "PASS"
    && record.metamorphic.converged !== false && !isSyntheticExperience(record));
  eligible.sort((a, b) => b.delta_e - a.delta_e
    || Date.parse(b.provenance.timestamp) - Date.parse(a.provenance.timestamp)
    || a.experience_id.localeCompare(b.experience_id));
  const best = eligible[0];
  return best ? {
    action: best.z_next_action,
    experience_id: best.experience_id,
    reason: `Verified experience ${best.experience_id} has the highest eligible delta_e (${best.delta_e}); newest wins ties.`,
  } : null;
}

/** Live ROE retrieval. No action execution, plant mutation, or fixture fallback. */
export function recommendNextAction(memory = new HFMemory()): NextActionProposal {
  const selected = selectNextAction(retrieveEligible(memory));
  if (!selected) return {
    action: "Collect independently verified non-synthetic evidence before recommending a next action",
    reason: "No reusable non-synthetic PASS experience with explicit metamorphic convergence is available.",
    evidence_used: [],
  };
  return { ...selected, evidence_used: [selected.experience_id] };
}
