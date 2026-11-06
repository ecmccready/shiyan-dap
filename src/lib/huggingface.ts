// Server-only emitter: durable only when AETHEL_HF_MEMORY_ROOT is on persistent storage.
import { randomUUID } from "node:crypto";
import type { ExperienceRecord } from "@/core/interfaces";
import { validateExperienceRecord } from "@/core/experience-schema";
import { HFMemory, retrieveEligible, writeExperience } from "@/core/hf-memory";
import { isSyntheticExperience, recommendNextAction } from "@/core/roe-next-action";

/** Remote Hub availability only; local emission never needs an HF_TOKEN. */
export function hfEnabled() {
  return Boolean(process.env.HF_TOKEN);
}

export type TrainingRecord = {
  clusterId: string;
  domain: string;
  input: string;
  cleaned?: string;
};

export function isTrainingRecord(value: unknown): value is TrainingRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return ["clusterId", "domain", "input"].every((key) => typeof row[key] === "string"
    && (row[key] as string).trim().length > 0 && (row[key] as string).length <= (key === "input" ? 65_536 : 128))
    && (row.cleaned === undefined || (typeof row.cleaned === "string" && row.cleaned.length <= 65_536));
}

/**
 * Canonical callers supply their verifier's evidence; emission does NOT invent PASS.
 * Legacy text-only calls are stored as unverified model-training data, never reusable.
 * The local SHA-256 proof verifies storage integrity, not the truth of a caller's verdict.
 */
export async function emitTrainingRecord(input: TrainingRecord | ExperienceRecord, memory = new HFMemory()) {
  let record: ExperienceRecord;
  if (validateExperienceRecord(input) && typeof input.metamorphic.converged === "boolean") {
    record = { ...input,
      metamorphic: { ...input.metamorphic, converged: input.metamorphic.converged },
      provenance: { ...input.provenance, source: `training-emitter/${input.provenance.source}` },
    };
    record.reuse_eligibility = input.reuse_eligibility === true
      && input.verification.replay_verdict === "PASS" && input.metamorphic.converged === true
      && !isSyntheticExperience(input);
  } else if (isTrainingRecord(input)) {
    const id = `training-${randomUUID()}`;
    record = {
      experience_id: id, repo: "ecmccready/shiyan-dap", commit_sha: process.env.VERCEL_GIT_COMMIT_SHA || "unknown-local-commit",
      goal: `Record training input for ${input.domain} / ${input.clusterId}`,
      baseline: input.input, action: "Emit training text; no environment action or replay performed",
      predicted_outcome: "Not measured", observed_outcome: input.cleaned || input.input,
      delta_e: 0, metrics: {},
      verification: { replay_verdict: "SKIP", verifier_version: "training-emitter-unverified-v1" },
      metamorphic: { seed: 0, transformation: "Not performed", expected_relation: "Not established", result: "SKIP", converged: false },
      provenance: { source: "training-emitter/unverified-model-training-text", run_id: id, timestamp: new Date().toISOString() },
      reuse_eligibility: false, z_next_action: "Obtain independently verified non-synthetic outcome evidence before reuse", revision: 1,
    };
  } else throw new Error("Invalid training record: supply training text or a canonical experience with explicit convergence");

  writeExperience(record, memory);
  const readBack = memory.readExperience(record.experience_id);
  if (!readBack.ok) throw new Error(`Training read-back failed: ${readBack.error}`);
  const eligible = retrieveEligible(memory);
  const proposal = recommendNextAction(memory);
  const retrievedForNextAction = proposal.experience_id === record.experience_id;
  console.log(`[HF training] read-back=${readBack.value.experience_id} retrieved_eligible=${eligible.some((row) => row.experience_id === record.experience_id)} retrieved_for_next_action=${retrievedForNextAction} next_action_experience=${proposal.experience_id ?? "none"}`);
  return { ok: true as const, backend: "local-hf-memory" as const, repo: "founder-z", record: readBack.value,
    proposal, retrieved_for_next_action: retrievedForNextAction };
}
