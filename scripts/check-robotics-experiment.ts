import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { type ExperienceRecord } from "../src/core/experience-schema";
import { HFMemory } from "../src/core/hf-memory";
import { selectNextAction } from "../src/core/roe-next-action";
import { runExperiment, evidencePack, verifyPack } from "../src/lib/robotics/experiment-runner";
import { MetamorphicEngine } from '../src/core/metamorphic';

console.log("🎲 Rolling the dice against the deterministic anchor...");
const initialSeed = { step: 1, observedValue: 0.85, predictedValue: 0.88, phi: 0.159 }; // Baseline Φ

const { emergentState, converged } = MetamorphicEngine.entangle(initialSeed);

console.log(`[Mutation Results] Next Step: ${emergentState.step}`);
console.log(`[Predicted vs Emergent] ${initialSeed.predictedValue} -> ${emergentState.observedValue}`);
console.log(`[System Identity .self()] New Φ: ${emergentState.phi} (Converged: ${converged})`);

// Additive read-only diagnostics: never feed mutations or recommendations into the Level 4 plant.
const experiment = runExperiment([42, 17]);
const replay = runExperiment([42, 17]);
assert.equal(experiment.reproducibility_hash, replay.reproducibility_hash);
const verification = verifyPack(evidencePack(experiment));
assert.equal(verification.ok, true, verification.reason);
const gapBefore = Math.abs(initialSeed.predictedValue - initialSeed.observedValue);
const gapAfter = Math.abs(initialSeed.predictedValue - emergentState.observedValue);
assert.equal(emergentState.step, initialSeed.step + 1);
assert.equal(emergentState.predictedValue, initialSeed.predictedValue);
assert.ok(Math.abs(emergentState.observedValue - initialSeed.observedValue) <= 0.05 * gapBefore + 1e-12);
assert.ok(Number.isFinite(emergentState.phi));
let commitSha = "unknown";
try { commitSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch { /* local check can run outside git */ }
const runId = `robotics-${randomUUID()}`;
// Both the fixed baseline and deterministic robotics runner are synthetic, not field evidence.
// Persist diagnostic eligibility on PASS+convergence, but selector independently excludes synthetic data.
const record: ExperienceRecord = {
  experience_id: runId,
  repo: "ecmccready/shiyan-dap",
  commit_sha: commitSha,
  goal: "Verify identity stability under metamorphic drift",
  baseline: JSON.stringify(initialSeed),
  action: "MetamorphicEngine.entangle (inspect-only)",
  predicted_outcome: "Prediction anchor remains fixed; observation drift bounded by 0.05 * epistemic gap",
  observed_outcome: JSON.stringify({ emergentState, converged, deterministic_replay: verification }),
  delta_e: gapBefore - gapAfter,
  metrics: { gap_before: gapBefore, gap_after: gapAfter, phi_before: initialSeed.phi,
    phi_after: emergentState.phi, delta_phi: emergentState.phi - initialSeed.phi,
    deterministic_delta_phi_advantage: experiment.comparison.delta_phi_advantage },
  verification: { replay_verdict: verification.ok ? "PASS" : "FAIL", verifier_version: experiment.algorithm_version },
  metamorphic: {
    // Numeric baseline step identifies this input; Math.random is NOT seeded/replayable.
    seed: initialSeed.step,
    transformation: "Math.random stochastic drift in [-0.05, 0.05); seed denotes baseline step, not RNG seed",
    expected_relation: "Fixed prediction anchor; bounded observation drift; abs(unrounded nextPhi - phi) < 0.05 for convergence",
    result: JSON.stringify({ emergentState, converged }),
  },
  provenance: { source: "synthetic-robotics-metamorphic-check", run_id: runId, timestamp: new Date().toISOString() },
  reuse_eligibility: verification.ok && converged,
  z_next_action: "Collect independently verified non-synthetic robotics evidence before recommending a field action",
  data_classification: "synthetic",
  consent_policy: "local-only; no upload",
  revision: 1,
};
const memory = new HFMemory();
const saved = memory.writeExperience(record);
if (!saved.ok) throw new Error(`Flywheel write failed: ${saved.error}`);
const readBack = memory.readExperience(runId);
if (!readBack.ok) throw new Error(`Flywheel read-back failed: ${readBack.error}`);
assert.deepEqual(readBack.value, record);
console.log(`[Flywheel] experience_id=${readBack.value.experience_id} reuse_eligibility=${readBack.value.reuse_eligibility}`);
const prior = memory.listExperiences();
if (!prior.ok) throw new Error(`Flywheel retrieval failed: ${prior.error}`);
const next = selectNextAction(prior.value);
console.log(next ? `[ROE next action] ${next.action} — ${next.reason}`
  : "[ROE next action] none: no eligible verified non-synthetic experiences (synthetic diagnostics excluded)");
