import { type ExperienceRecord, validateExperienceRecord } from "./experience-schema";

export interface NextActionRecommendation {
  action: string;
  reason: string;
  experience_id: string;
}

/** Synthetic includes simulated runs, not just records explicitly labelled synthetic. */
export function isSyntheticExperience(record: ExperienceRecord): boolean {
  return /synthetic|simulation|simulated/i.test(record.data_classification ?? "")
    || /synthetic|simulation|simulated/i.test(record.provenance.source);
}

/** Pure selector: no mutation, I/O, or execution of the recommended action. Null means no verified memory. */
export function selectNextAction(experiences: readonly ExperienceRecord[]): NextActionRecommendation | null {
  const eligible = experiences.filter((record) => validateExperienceRecord(record)
    && record.reuse_eligibility === true && record.verification.replay_verdict === "PASS"
    && !isSyntheticExperience(record));
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
