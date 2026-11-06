/** Offline fixtures only; no network, deployment, plant changes, or production data. */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ExperienceRecord, validateExperienceRecord } from "../src/core/experience-schema";
import { HFMemory } from "../src/core/hf-memory";
import { selectNextAction } from "../src/core/roe-next-action";

// Models a verified external observation for selector tests, NOT a claim of field evidence.
// These fixtures live only in a temporary directory removed in finally.
const fixture = (id: string, overrides: Partial<ExperienceRecord> = {}): ExperienceRecord => ({
  experience_id: id, repo: "fixture/repo", commit_sha: "fixture-sha", goal: "Reduce observed error",
  baseline: "error=1", action: "Inspect verified boundary", predicted_outcome: "error=0.5",
  observed_outcome: "error=0.4", delta_e: 0.6, metrics: { error: 0.4 },
  verification: { replay_verdict: "PASS", verifier_version: "fixture-v1" },
  metamorphic: { seed: 42, transformation: "bounded perturbation", expected_relation: "anchor preserved", result: "PASS" },
  provenance: { source: "verified-external-observation", run_id: id, timestamp: "2026-11-06T20:00:00Z" },
  reuse_eligibility: true, z_next_action: "Review the verified boundary before the next action",
  data_classification: "public", consent_policy: "local-only fixture", revision: 1,
  ...overrides,
});
const root = mkdtempSync(join(tmpdir(), "aethel-flywheel-"));
try {
  const memory = new HFMemory(root);
  assert.deepEqual(memory.listExperiences(), { ok: true, value: [] });
  const first = fixture("first");
  assert.equal(validateExperienceRecord(first), true);
  for (const invalid of [null, {}, { ...first, experience_id: "../escape" }, { ...first, metrics: { e: NaN } },
    { ...first, metamorphic: { ...first.metamorphic, seed: Infinity } }, { ...first, revision: 0 },
    { ...first, provenance: { ...first.provenance, timestamp: "bad" } },
    { ...first, verification: { ...first.verification, replay_verdict: "UNKNOWN" } }]) {
    assert.equal(validateExperienceRecord(invalid), false);
    assert.equal(memory.writeExperience(invalid as ExperienceRecord).ok, false);
  }
  assert.equal(memory.writeExperience(first).ok, true);
  assert.deepEqual(memory.readExperience(first.experience_id), { ok: true, value: first });
  const indexPath = join(root, "founder-z/indexes/latest.json");
  const recordPath = join(root, "founder-z/experiences/first.json");
  const proofPath = join(root, "founder-z/proofs/first.json");
  const before = [recordPath, proofPath, indexPath].map((path) => readFileSync(path, "utf8"));
  const overwrite = memory.writeExperience({ ...first, observed_outcome: "overwrite attempt", revision: 2 });
  assert.equal(overwrite.ok, false);
  assert.deepEqual([recordPath, proofPath, indexPath].map((path) => readFileSync(path, "utf8")), before);
  console.log("ok: append-only overwrite refused; record, proof, latest unchanged");

  const second = fixture("second", { delta_e: 0.7,
    provenance: { ...first.provenance, run_id: "second", timestamp: "2026-11-06T21:00:00Z" } });
  assert.equal(memory.writeExperience(second).ok, true);
  assert.equal(JSON.parse(readFileSync(indexPath, "utf8")).experience_id, "second");
  const listed = memory.listExperiences();
  if (!listed.ok) throw new Error(listed.error);
  assert.equal(listed.value.length, 2);
  const next = selectNextAction(listed.value);
  assert.equal(next?.experience_id, "second");
  assert.ok(next?.reason.includes("second"));
  console.log(`[ROE next action fixture] ${next?.action} — ${next?.reason}`);

  const rejected = [fixture("failed", { delta_e: 100, verification: { replay_verdict: "FAIL", verifier_version: "v1" } }),
    fixture("skip", { delta_e: 100, verification: { replay_verdict: "SKIP", verifier_version: "v1" } }),
    fixture("ineligible", { delta_e: 100, reuse_eligibility: false }),
    fixture("synthetic", { delta_e: 100, data_classification: "synthetic" }),
    fixture("synthetic-source", { delta_e: 100, provenance: { ...first.provenance, source: "Synthetic-robotics-check" } }),
    fixture("simulated", { delta_e: 100, data_classification: "simulated" })];
  assert.equal(selectNextAction(rejected), null);
  assert.equal(selectNextAction([]), null);
  const inputs = [...rejected, second, first];
  const snapshot = JSON.stringify(inputs);
  assert.equal(selectNextAction(inputs)?.experience_id, "second");
  assert.equal(JSON.stringify(inputs), snapshot);
  const newer = fixture("newer", { delta_e: second.delta_e,
    provenance: { ...first.provenance, timestamp: "2026-11-06T22:00:00Z" } });
  assert.equal(selectNextAction([second, newer])?.experience_id, "newer");
  assert.deepEqual(selectNextAction([newer, second]), selectNextAction([second, newer]));
  console.log("ok: selector excludes failed, skipped, ineligible, synthetic; ranks delta_e/newest without mutation");

  const stableIndex = readFileSync(indexPath, "utf8");
  // Inject an actual read-back fault at each pre-publication stage; no success or index update.
  for (const [id, faultPath] of [["bad-record", "/experiences/bad-record.json"],
    ["bad-proof", "/proofs/bad-proof.json"], ["bad-index", "/indexes/.latest-"]] as const) {
    const faulty = new HFMemory(root, (path) => path.includes(faultPath) ? "{}" : readFileSync(path, "utf8"));
    const failed = faulty.writeExperience(fixture(id));
    assert.equal(failed.ok, false);
    assert.equal(readFileSync(indexPath, "utf8"), stableIndex);
    assert.equal(existsSync(join(root, "founder-z/indexes/.writer.lock")), false);
  }
  console.log("ok: record/proof/index read-back failures return errors and leave latest unchanged");
  // Corruption after a successful write fails hash validation and retrieval fails closed.
  writeFileSync(recordPath, JSON.stringify({ ...first, observed_outcome: "tampered" }));
  const corrupt = memory.readExperience("first");
  assert.equal(corrupt.ok, false);
  if (!corrupt.ok) assert.match(corrupt.error, /proof validation failed/);
  assert.equal(memory.listExperiences().ok, false);
  assert.equal(memory.readExperience("../escape").ok, false);
  console.log("ok: corruption and unsafe IDs refused; incomplete datasets fail closed");
  console.log("Founder Reference Flywheel checks PASS");
} finally { rmSync(root, { recursive: true, force: true }); }
