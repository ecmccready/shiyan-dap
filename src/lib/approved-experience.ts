import type { PersistedRun } from "./run-store";
import { listClientRuns } from "./run-store";

export type ApprovedExperience = {
  run_id: string;
  y: string;
  e: number;
  phi: number;
  workflow_version: string;
  model_version: string;
};

export async function retrieveApproved(
  client_id: string,
  workflow_version: string,
  model_version: string
): Promise<ApprovedExperience[]> {
  const runs = await listClientRuns(client_id);
  return runs
    .filter(
      (r) =>
        r.approved &&
        r.safety_passed &&
        r.workflow_version === workflow_version &&
        r.model_version === model_version &&
        r.phi !== null &&
        r.phi > 0
    )
    .map((r) => ({
      run_id: r.id,
      y: r.y,
      e: r.e,
      phi: r.phi!,
      workflow_version: r.workflow_version,
      model_version: r.model_version,
    }));
}

/** Defined interface — Self() calls only this. */
export async function SelfFromApproved(
  client_id: string,
  workflow_version: string,
  model_version: string,
  fallbackY: string
): Promise<{ y: string; source: "approved" | "fallback"; justification?: string }> {
  const approved = await retrieveApproved(client_id, workflow_version, model_version);
  if (approved.length === 0) return { y: fallbackY, source: "fallback" };
  const best = approved.reduce((a, b) => (a.phi > b.phi ? a : b));
  return { y: best.y, source: "approved", justification: best.run_id };
}