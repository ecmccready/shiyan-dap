// Executable platform contract: a third-party Workbench submits a standard run and verifies it.
// Verdicts are always computed server-side from deterministic inputs; caller verdicts/hashes are rejected.
import { createHash } from "node:crypto";
import { experienceDigest } from "./hf-memory";
import { ExperienceAppendError, ExperienceIntegrityError, type ExperienceStore } from "./experience-store";
import { tenantStore } from "./tenant-auth";
import { evaluateDeterministicProof, type DeterministicProof } from "./deterministic-proof";
import type { ExperienceRecord } from "./experience-schema";
import type { ContractVerdict, MetamorphicResult, NextActionProposal, VerificationResult } from "./interfaces";

export const RUN_CONTRACT_VERSION = "aethel.run/1";

export interface StandardRunSubmission {
  contract_version: typeof RUN_CONTRACT_VERSION;
  run_id: string;                       // [A-Za-z0-9][A-Za-z0-9_-]{0,63}, unique per workbench
  workbench: { name: string; version: string };
  goal: string;
  action: string;
  predicted: number;
  observed: number;
  seed: number;                         // integer 0..4294967295
  phi?: number;
  step?: number;
}

export interface StandardRunResult {
  contract_version: typeof RUN_CONTRACT_VERSION;
  experience_id: string;
  experience: ExperienceRecord;
  verification: VerificationResult;
  metamorphic: MetamorphicResult;
  next_action: NextActionProposal;
}

export type ContractOutcome =
  | { ok: true; status: 200 | 201; body: StandardRunResult }
  | { ok: false; status: 400 | 404 | 409 | 422 | 500; body: { contract_version: string; error: string; code: string; experience_id?: string } };

const ALLOWED = new Set(["contract_version", "run_id", "workbench", "goal", "action", "predicted", "observed", "seed", "phi", "step"]);
const text = (v: unknown, max: number) => typeof v === "string" && v.trim().length > 0 && v.length <= max;
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const err = (status: 400 | 404 | 409 | 422 | 500, code: string, error: string, experience_id?: string): ContractOutcome =>
  ({ ok: false, status, body: { contract_version: RUN_CONTRACT_VERSION, code, error, ...(experience_id ? { experience_id } : {}) } });

/** Returns a list of problems; empty means valid. Unknown fields (incl. verdict/hash/verification) are rejected. */
export function validateStandardRun(value: unknown): string[] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return ["body must be a JSON object"];
  const v = value as Record<string, unknown>;
  const problems = Object.keys(v).filter((k) => !ALLOWED.has(k)).map((k) => `unknown field: ${k}`);
  if (v.contract_version !== RUN_CONTRACT_VERSION) problems.push(`contract_version must be "${RUN_CONTRACT_VERSION}"`);
  if (typeof v.run_id !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(v.run_id)) problems.push("run_id must match [A-Za-z0-9][A-Za-z0-9_-]{0,63}");
  const w = v.workbench as Record<string, unknown> | undefined;
  if (typeof w !== "object" || w === null || Array.isArray(w) || !text(w.name, 80) || !text(w.version, 40)
    || Object.keys(w).some((k) => k !== "name" && k !== "version")) problems.push("workbench must be { name (≤80), version (≤40) }");
  if (!text(v.goal, 500)) problems.push("goal must be a non-empty string ≤500");
  if (!text(v.action, 500)) problems.push("action must be a non-empty string ≤500");
  for (const k of ["predicted", "observed"]) if (!finite(v[k])) problems.push(`${k} must be a finite number`);
  for (const k of ["phi", "step"]) if (v[k] !== undefined && !finite(v[k])) problems.push(`${k} must be a finite number if present`);
  if (!Number.isSafeInteger(v.seed) || (v.seed as number) < 0 || (v.seed as number) > 0xffffffff) problems.push("seed must be an integer 0..4294967295");
  return problems;
}

/** Stable, tenant-qualified id: resubmitting the same run in the same tenant hits the same id; tenants never collide. */
export function experienceIdFor(tenant: string, workbenchName: string, runId: string): string {
  return `wb-${createHash("sha256").update(JSON.stringify([tenant, workbenchName, runId])).digest("hex").slice(0, 32)}`;
}

const replayOf = (v: ContractVerdict) => (v === "PASS" ? "PASS" : v === "FAIL" ? "FAIL" : "SKIP");

function proposal(verdict: ContractVerdict, id: string): NextActionProposal {
  const by: Record<ContractVerdict, [string, string]> = {
    PASS: ["Run an independent replay before treating this run as reusable evidence",
      "Deterministic metamorphic relations held for all seeded transformations; this is not an independent replay."],
    FAIL: ["Investigate the drift that violated an expected relation, then submit a new run_id",
      "At least one seeded transformation violated an expected relation."],
    INCONCLUSIVE: ["Resubmit with finite inputs and a fixed integer seed",
      "The deterministic proof could not be evaluated."],
  };
  return { action: by[verdict][0], reason: by[verdict][1], experience_id: id, evidence_used: [id], executable: false, contract_version: RUN_CONTRACT_VERSION };
}

function buildResult(record: ExperienceRecord, recomputed: DeterministicProof, stored: ContractVerdict | null): StandardRunResult {
  const consistent = stored === recomputed.verdict;
  const verdict: ContractVerdict = consistent ? recomputed.verdict : "FAIL";
  return {
    contract_version: RUN_CONTRACT_VERSION,
    experience_id: record.experience_id,
    experience: record,
    verification: {
      replay_verdict: record.verification.replay_verdict, verifier_version: record.verification.verifier_version,
      contract_version: RUN_CONTRACT_VERSION, integrity: "PASS", content_sha256: experienceDigest(record),
      stored_verdict: stored ?? undefined, recomputed_verdict: recomputed.verdict, consistent, verdict,
      reason: consistent ? recomputed.reason : "Stored verdict does not match recomputation from stored seed and inputs",
    },
    metamorphic: { ...record.metamorphic, converged: record.metamorphic.converged === true, verdict: recomputed.verdict,
      transformations: recomputed.transformations, expected_relations: [...recomputed.expected_relations] },
    next_action: proposal(verdict, record.experience_id),
  };
}

/** tenant must come from server-side authentication (authenticateTenant), never from the request body. */
export function submitStandardRun(tenant: string, body: unknown, store: ExperienceStore = tenantStore(tenant)): ContractOutcome {
  const problems = validateStandardRun(body);
  if (problems.length) return err(400, "INVALID_SUBMISSION", problems.join("; "));
  const run = body as StandardRunSubmission;
  const id = experienceIdFor(tenant, run.workbench.name, run.run_id);
  const proof = evaluateDeterministicProof({ predicted: run.predicted, observed: run.observed, phi: run.phi, step: run.step }, run.seed);
  const record: ExperienceRecord = {
    experience_id: id, repo: `workbench:${run.workbench.name}`, commit_sha: run.workbench.version,
    goal: run.goal, baseline: `predicted=${run.predicted}`, action: run.action,
    predicted_outcome: String(run.predicted), observed_outcome: String(run.observed),
    delta_e: Math.abs(run.predicted - run.observed), metrics: { transformations: proof.transformations.length },
    verification: { replay_verdict: replayOf(proof.verdict), verifier_version: proof.version },
    metamorphic: { seed: run.seed, transformation: JSON.stringify({ inputs: proof.inputs, transformations: proof.transformations }),
      expected_relation: proof.expected_relations.join("; "), result: proof.verdict, converged: proof.verdict === "PASS" },
    provenance: { source: "third-party-workbench", run_id: run.run_id, timestamp: new Date().toISOString() },
    reuse_eligibility: false, z_next_action: proposal(proof.verdict, id).action,
    tenant_id: tenant, data_classification: "third-party-submission", revision: 1,
  };
  try {
    const saved = store.append(record);
    return { ok: true, status: 201, body: buildResult(saved, proof, proof.verdict) };
  } catch (e) {
    if (e instanceof ExperienceAppendError && /Append-only|EEXIST|writer\.lock/.test(e.message)) {
      return err(409, /lock/.test(e.message) ? "STORE_BUSY" : "DUPLICATE_RUN", /lock/.test(e.message)
        ? "Store is busy; retry" : "run_id already submitted for this workbench; runs are append-only", id);
    }
    return err(500, "STORE_ERROR", e instanceof Error ? e.message : String(e), id);
  }
}

export function verifyStandardRun(tenant: string, id: unknown, store: ExperienceStore = tenantStore(tenant)): ContractOutcome {
  if (typeof id !== "string" || !/^wb-[0-9a-f]{32}$/.test(id)) return err(400, "INVALID_ID", "experience_id must be wb- followed by 32 hex characters");
  let record: ExperienceRecord;
  try { record = store.readById(id); } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (e instanceof ExperienceIntegrityError && /ENOENT/.test(msg)) return err(404, "NOT_FOUND", "No run with this experience_id", id);
    return err(422, "INTEGRITY_FAILED", msg, id);
  }
  if (record.provenance.source !== "third-party-workbench" || record.tenant_id !== tenant) return err(404, "NOT_FOUND", "No standard run with this experience_id", id);
  let detail: { inputs?: unknown };
  try { detail = JSON.parse(record.metamorphic.transformation); } catch { detail = {}; }
  const inputs = detail.inputs as { predicted: number; observed: number; phi?: number; step?: number } | undefined;
  const recomputed = evaluateDeterministicProof(inputs as never, record.metamorphic.seed);
  const stored = ["PASS", "FAIL", "INCONCLUSIVE"].includes(record.metamorphic.result) ? record.metamorphic.result as ContractVerdict : null;
  return { ok: true, status: 200, body: buildResult(record, recomputed, stored) };
}
