/**
 * Self() durable feed (additive).
 *
 * Reads verified results from the Upstash experience store
 * (/api/level4/experience) and turns eligible ones into the same
 * ApprovedExperience shape that SelfFromApproved consumes
 * (src/lib/approved-experience.ts, unchanged). Selection mirrors
 * SelfFromApproved exactly: the candidate with the highest Φ wins
 * (on a tie, the later candidate, as in its reduce).
 *
 * Reuse filter. Experience entries do NOT record a safety_passed flag, so an
 * entry is reused only when it is:
 *   eligible === true  (goal threshold met)
 *   state === "COMPLETE"
 *   phi > 0            (beat the cold Self() baseline)
 *   and, if it carries tensor_distance, distance ≤ DEMO_TENSOR_EPSILON.
 * Reaching COMPLETE on /workbench/autonomous implies every step passed the
 * precheck and checkSafety gate (a blocked step ends the run in BLOCKED).
 *
 * What is reused: the winning run's ordered action sequence (y per iteration,
 * 1..n contiguous), restricted to the goal's permitted actions. The proposer
 * returns the action at the current position, then "hold".
 *
 * Fallback: no store, an error, no eligible run, a gappy or non-permitted
 * sequence → null, and callers keep their existing proposer.
 */
import type { ApprovedExperience } from "../approved-experience";
import type { ExperienceEntry } from "./experience-client";
import { loadExperienceServer } from "./experience-client";
import { DEMO_TENSOR_EPSILON } from "./demo-tensor";

export type DurablePlan = {
  source: "durable";
  /** run_id of the reused verified run. */
  run_id: string;
  phi: number;
  e: number;
  sequence: string[];
  candidates: number;
};

export function isReusable(x: ExperienceEntry): boolean {
  return (
    x.eligible === true &&
    x.state === "COMPLETE" &&
    typeof x.phi === "number" &&
    x.phi > 0 &&
    typeof x.e === "number" &&
    typeof x.y === "string" &&
    (typeof x.tensor_distance !== "number" || x.tensor_distance <= DEMO_TENSOR_EPSILON)
  );
}

/** Adapter: eligible store entries → ApprovedExperience (SelfFromApproved's shape). */
export function toApprovedExperience(
  list: ExperienceEntry[],
  workflow_version = "safety_v1",
  model_version = "model_3"
): ApprovedExperience[] {
  return list.filter(isReusable).map((x) => ({
    run_id: x.run_id,
    y: x.y as string,
    e: x.e as number,
    phi: x.phi as number,
    workflow_version,
    model_version,
  }));
}

/** Same rule as SelfFromApproved: highest Φ; ties go to the later candidate. */
export function selectBest(approved: ApprovedExperience[]): ApprovedExperience | null {
  if (approved.length === 0) return null;
  return approved.reduce((a, b) => (a.phi > b.phi ? a : b));
}

export function sequenceOf(list: ExperienceEntry[], run_id: string): string[] | null {
  const steps = list.filter((x) => x.run_id === run_id).sort((a, b) => a.iteration - b.iteration);
  const seq: string[] = [];
  for (let i = 0; i < steps.length; i++) {
    if (steps[i].iteration !== i + 1 || typeof steps[i].y !== "string") return null;
    seq.push(steps[i].y as string);
  }
  return seq.length ? seq : null;
}

export function planFromEntries(
  list: ExperienceEntry[],
  permitted: string[],
  excludeRunId?: string
): DurablePlan | null {
  const pool = excludeRunId ? list.filter((x) => x.run_id !== excludeRunId) : list;
  const approved = toApprovedExperience(pool);
  const best = selectBest(approved);
  if (!best) return null;
  const sequence = sequenceOf(pool, best.run_id);
  if (!sequence || !sequence.every((y) => permitted.includes(y))) return null;
  return { source: "durable", run_id: best.run_id, phi: best.phi, e: best.e, sequence, candidates: approved.length };
}

/** Next action from a durable plan; "hold" once spent. */
export function nextFromPlan(plan: DurablePlan, appliedCount: number): string {
  return plan.sequence[appliedCount] ?? "hold";
}

/** Client side: reads GET /api/level4/experience. Never throws. */
export async function loadDurablePlan(permitted: string[], excludeRunId?: string): Promise<DurablePlan | null> {
  try {
    return planFromEntries(await loadExperienceServer(), permitted, excludeRunId);
  } catch {
    return null;
  }
}
