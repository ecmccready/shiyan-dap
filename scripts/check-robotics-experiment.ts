import { runExperiment } from "../src/lib/robotics/experiment-runner";

const a = runExperiment([42, 17]);
const b = runExperiment([42, 17]);

if (a.pack_hash !== b.pack_hash) throw new Error("not reproducible");
if (a.trials.length !== 4) throw new Error("wrong trial count");
if (!a.trials.every((t) => t.hash.startsWith("sha256:"))) throw new Error("missing hashes");

const lookback = a.trials.filter((t) => t.policy === "look-back");
const greedy = a.trials.filter((t) => t.policy === "greedy");
const avg = (xs: number[]) => xs.reduce((s, n) => s + n, 0) / xs.length;
if (avg(lookback.map((t) => t.delta_phi)) <= avg(greedy.map((t) => t.delta_phi))) {
  throw new Error("look-back did not beat greedy");
}

console.log("ok", a.pack_hash);