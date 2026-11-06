import { runExperiment, evidencePack, verifyPack } from "../src/lib/robotics/experiment-runner";
import { MetamorphicEngine } from '../src/core/metamorphic';

const a = runExperiment([42, 17]);
const b = runExperiment([42, 17]);

if (a.reproducibility_hash !== b.reproducibility_hash) throw new Error("same inputs produced different reproducibility hashes");
if (a.trials.length !== 4) throw new Error("wrong trial count");
if (!a.trials.every((trial) => trial.hash.startsWith("sha256:") && trial.hash.length === 71)) {
  throw new Error("missing full-length trial hashes");
}
const verified = verifyPack(evidencePack(a));
if (!verified.ok) throw new Error(`fresh pack failed verification: ${verified.reason}`);
if (verified.outcome !== "look-back-better") throw new Error("unexpected synthetic fixture outcome");

const tampered = JSON.parse(evidencePack(a));
tampered.trials[0].interventions += 1;
if (verifyPack(JSON.stringify(tampered)).ok) throw new Error("tampered evidence passed verification");

const greedyWins = runExperiment([7]);
const greedyVerification = verifyPack(evidencePack(greedyWins));
if (!greedyVerification.ok || greedyVerification.outcome !== "greedy-better") {
  throw new Error("valid evidence must verify when greedy wins");
}
const tied = runExperiment([17]);
const tieVerification = verifyPack(evidencePack(tied));
if (!tieVerification.ok || tieVerification.outcome !== "tie") {
  throw new Error("valid evidence must verify when policies tie");
}

let rejectedInvalidSeeds = false;
try {
  runExperiment([1, 1]);
} catch {
  rejectedInvalidSeeds = true;
}
if (!rejectedInvalidSeeds) throw new Error("duplicate seeds were accepted");

console.log("ok", {
  reproducibility_hash: a.reproducibility_hash,
  pack_hash: a.pack_hash,
  verification: verified,
});

console.log("🎲 Rolling the dice against the deterministic anchor...");
const initialSeed = { step: 1, observedValue: 0.85, predictedValue: 0.88, phi: 0.159 }; // Baseline Φ

const { emergentState, converged } = MetamorphicEngine.entangle(initialSeed);

console.log(`[Mutation Results] Next Step: ${emergentState.step}`);
console.log(`[Predicted vs Emergent] ${initialSeed.predictedValue} -> ${emergentState.observedValue}`);
console.log(`[System Identity .self()] New Φ: ${emergentState.phi} (Converged: ${converged})`);
