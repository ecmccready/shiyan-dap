import { runExperiment } from "../src/lib/robotics/experiment-runner";

const a = runExperiment([42, 17]);
const b = runExperiment([42, 17]);

if (a.pack_hash !== b.pack_hash) throw new Error("not reproducible");
if (a.trials.length !== 4) throw new Error("wrong trial count");
if (!a.trials.every((t) => t.hash.startsWith("sha256:"))) throw new Error("missing hashes");
if (a.comparison.delta_phi_advantage <= 0) throw new Error("look-back did not beat greedy");
if (a.comparison.intervention_reduction <= 0) throw new Error("no intervention reduction");

console.log("ok", a.pack_hash, a.comparison);