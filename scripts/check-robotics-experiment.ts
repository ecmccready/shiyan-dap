import { runExperiment, evidencePack, verifyPack } from "../src/lib/robotics/experiment-runner";

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

const honestNegative = runExperiment([3]);
if (!verifyPack(evidencePack(honestNegative)).ok) throw new Error("valid evidence must verify regardless of outcome");

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
