/** Offline integration proof only: temporary observations are NOT production field evidence. */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExperienceRecord } from "../src/core/interfaces";
import { HFMemory, retrieveEligible, writeExperience } from "../src/core/hf-memory";
import { recommendNextAction } from "../src/core/roe-next-action";
import { GET } from "../src/app/api/flywheel/route";

async function main() {
  const root = mkdtempSync(join(tmpdir(), "aethel-flywheel-v11-"));
  const priorRoot = process.env.AETHEL_HF_MEMORY_ROOT;
  process.env.AETHEL_HF_MEMORY_ROOT = root;
  const fixture = (id: string, overrides: Partial<ExperienceRecord> = {}): ExperienceRecord => ({
    experience_id: id, repo: "offline/check", commit_sha: "check-only", goal: "Improve the next observation",
    baseline: "error=1", action: "Inspect boundary", predicted_outcome: "error=0.5",
    observed_outcome: "error=0.4", delta_e: 0.6, metrics: { error: 0.4 },
    verification: { replay_verdict: "PASS", verifier_version: "offline-v11" },
    metamorphic: { seed: 42, transformation: "bounded perturbation", expected_relation: "anchor preserved", result: "PASS", converged: true },
    provenance: { source: "verified-external-observation", run_id: id, timestamp: "2026-11-06T20:00:00Z" },
    reuse_eligibility: true, z_next_action: "Inspect the improved boundary on Run 2", revision: 1,
    ...overrides,
  });
  try {
    const memory = new HFMemory();
    assert.deepEqual(retrieveEligible(), []);
    assert.equal(recommendNextAction().experience_id, undefined);
    let response = await GET();
    assert.equal(response.status, 200);
    assert.equal((await response.json()).latest, null);
    const run1 = fixture("run-1");
    assert.deepEqual(writeExperience(run1), run1);
    assert.throws(() => writeExperience(run1), /Append-only/);
    const proposal = recommendNextAction();
    assert.equal(proposal.experience_id, run1.experience_id);
    assert.deepEqual(proposal.evidence_used, [run1.experience_id]);
    assert.equal(proposal.action, run1.z_next_action);
    const run2 = fixture("run-2", {
      action: proposal.action, z_next_action: proposal.action, delta_e: 0.7,
      provenance: { ...run1.provenance, run_id: "run-2", timestamp: "2026-11-06T21:00:00Z" },
    });
    writeExperience(run2);
    const read2 = memory.readExperience("run-2");
    assert.ok(read2.ok);
    assert.equal(read2.value.action, proposal.action);
    assert.equal(read2.value.z_next_action, proposal.action);
    assert.equal(recommendNextAction().experience_id, "run-2");
    console.log("PASS Run 1 → proposal cites run-1 → Run 2 action/z_next_action → proposal cites run-2 (offline temporary proof)");
    for (const record of [
      fixture("failed", { delta_e: 100, verification: { replay_verdict: "FAIL", verifier_version: "check" } }),
      fixture("skipped", { delta_e: 100, verification: { replay_verdict: "SKIP", verifier_version: "check" } }),
      fixture("unconverged", { delta_e: 100, metamorphic: { ...run1.metamorphic, converged: false } }),
      fixture("synthetic", { delta_e: 100, provenance: { ...run1.provenance, source: "synthetic" } }),
      fixture("simulator", { delta_e: 100, provenance: { ...run1.provenance, source: "robotics-simulator" } }),
      fixture("ineligible", { delta_e: 100, reuse_eligibility: false }),
    ]) writeExperience(record);
    const { converged, ...legacyMetamorphic } = run1.metamorphic;
    assert.equal(converged, true);
    assert.ok(memory.writeExperience({ ...fixture("legacy", { delta_e: 100 }), metamorphic: legacyMetamorphic }).ok);
    assert.equal(recommendNextAction().experience_id, "run-2");
    assert.equal(retrieveEligible()[0].experience_id, "run-2");
    assert.ok(retrieveEligible().every((record) => record.reuse_eligibility === true));
    response = await GET();
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal(payload.latest.experience_id, "run-2");
    assert.equal(payload.proposal.experience_id, "run-2");
    console.log("PASS live API; newest eligible ordering; failed/skipped/synthetic/simulator/unconverged/legacy evidence excluded from ROE");
    const path = join(root, "founder-z/experiences/run-1.json");
    const stored = readFileSync(path, "utf8");
    writeFileSync(path, stored.replace('"error=0.4"', '"tampered"'));
    assert.throws(() => recommendNextAction(), /proof validation failed/);
    // Expected server log is suppressed only for this deliberate corruption check.
    const log = console.error;
    try { console.error = () => {}; response = await GET(); } finally { console.error = log; }
    assert.equal(response.status, 500);
    console.log("PASS corrupt memory fails closed; API returns 500 rather than false empty/success");
  } finally {
    if (priorRoot === undefined) delete process.env.AETHEL_HF_MEMORY_ROOT;
    else process.env.AETHEL_HF_MEMORY_ROOT = priorRoot;
    rmSync(root, { recursive: true, force: true });
  }
}
void main().catch((error) => { console.error(error); process.exitCode = 1; });
