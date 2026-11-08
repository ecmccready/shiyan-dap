import { createHash } from "node:crypto";
import { HFMemory, writeExperience } from "@/core/hf-memory";
import { resolveExperienceStoreRoot } from "@/core/experience-store";
import type { ExperienceRecord } from "@/core/interfaces";
import { evaluateDeterministicProof, type DeterministicProof } from "@/core/deterministic-proof";

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const r = value as Record<string, unknown>;
    return `{${Object.keys(r).filter((k) => r[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonical(r[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
const deterministic = (p: unknown): p is DeterministicProof => typeof p === "object" && p !== null
  && (p as DeterministicProof).version === "deterministic-proof-v1" && Array.isArray((p as DeterministicProof).transformations)
  && Array.isArray((p as DeterministicProof).expected_relations) && ["PASS", "FAIL", "INCONCLUSIVE"].includes((p as DeterministicProof).verdict);
const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);

/** Shared proof path: canonical SHA-256 of a telemetry result, stored as an experience record. Throws on storage failure. */
export function publishProof(body: unknown): { experience_id: string; hash: string } {
  const b = body as Record<string, any>;
  const hash = createHash("sha256").update(canonical(body)).digest("hex");
  const timestamp = new Date().toISOString();
  const experience_id = `telemetry-${Date.now()}-${hash.slice(0, 12)}`;
  // Never trust a submitted verdict: recompute it from the recorded seed and inputs.
  const proof = deterministic(b.proof) && b.proof.inputs ? evaluateDeterministicProof(b.proof.inputs, b.proof.seed) : null;
  const frame = b.frame ?? {};
  const emergent = b.emergentState ?? {};
  const predicted = num(frame.predictedValue ?? emergent.predictedValue, 0);
  const observed = num(frame.observedValue, num(emergent.observedValue, 0));
  const record: ExperienceRecord = {
    experience_id,
    repo: "shiyan-dap",
    commit_sha: process.env.VERCEL_GIT_COMMIT_SHA || "local",
    goal: "Live telemetry metamorphic check",
    baseline: `predicted=${predicted}`,
    action: "MetamorphicEngine.entangle",
    predicted_outcome: String(predicted),
    observed_outcome: String(num(emergent.observedValue, observed)),
    delta_e: Math.abs(predicted - observed),
    metrics: { phi: num(emergent.phi, 0), step: num(emergent.step, 0) },
    verification: { replay_verdict: "SKIP", verifier_version: proof ? proof.version : "telemetry-proof-v1" },
    metamorphic: proof ? {
      seed: proof.seed ?? 0,
      transformation: canonical({ inputs: proof.inputs, transformations: proof.transformations }),
      expected_relation: proof.expected_relations.join("; "),
      result: proof.verdict,
      converged: proof.verdict === "PASS",
    } : {
      seed: num(b.seed, 0),
      transformation: "stochastic-drift",
      expected_relation: "phi stable within 0.05",
      result: b.converged ? "converged" : "diverged",
      converged: b.converged,
    },
    provenance: { source: "api/v1/proof", run_id: hash, timestamp },
    reuse_eligibility: false,
    z_next_action: b.converged ? "continue" : "investigate drift",
    revision: 1,
  };
  const saved = writeExperience(record, new HFMemory(resolveExperienceStoreRoot()));
  return { experience_id: saved.experience_id, hash };
}
