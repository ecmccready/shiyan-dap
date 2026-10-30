/** Fixture checks for the inspect-only ROE look-back (aethel.roe.lookback.v1). */
import assert from "node:assert/strict";
import { scoreSealedPaths, ROE_LOOKBACK_SCHEMA, ROE_LOOKBACK_NOTE } from "../src/lib/level4/roe-lookback";

const row = (run_id: string, iteration: number, e: number, o: Record<string, unknown> = {}) => ({ run_id, iteration, e, e0: 1.6, verified_at: "2026-10-01T00:00:00Z", eligible: false, y: `a${iteration}`, state: "CONTINUE", ...o });
// A: big first step, stalls (greedy pick). B: smaller steps, more total Δe (look-back pick). C: unsealed.
const A = [row("A", 1, 0.9), row("A", 2, 0.85, { eligible: true, state: "COMPLETE", phi: -0.1 })];
const B = [row("B", 1, 1.3), row("B", 2, 0.9), row("B", 3, 0.2, { eligible: true, state: "COMPLETE", phi: 0.02 })];
const C = [row("C", 1, 0.1)];
const M = [row("M", 1, 0.0, { system: "medicare", eligible: true, state: "COMPLETE" })];

const c = scoreSealedPaths([...B, ...A, ...C, ...M]);
assert.equal(c.schema, ROE_LOOKBACK_SCHEMA); assert.equal(c.schema, "aethel.roe.lookback.v1"); assert.equal(c.note, ROE_LOOKBACK_NOTE);
assert.equal(c.paths_considered, 2, "unsealed run C excluded"); assert.equal(c.excluded_domain_entries, 1, "medicare entry excluded");
assert.deepEqual(c.greedy, { run_id: "A", max_step_i: 0.7, cumulative_delta_e: 0.75 });
assert.deepEqual(c.lookback, { run_id: "B", cumulative_delta_e: 1.4, final_phi: 0.02 });
assert.equal(c.winner, "lookback"); assert.equal(c.delta_e_gain, 0.65);
assert.deepEqual(c.paths.map((p) => p.run_id), ["A", "B"]); assert.deepEqual(c.paths[1].actions, ["a1", "a2", "a3"]);
console.log("lookback    -> greedy A (I_t 0.7, Δe 0.75) vs look-back B (Δe 1.4, Φ 0.02): look-back gains 0.65; unsealed and medicare excluded");

const same = scoreSealedPaths(B); assert.equal(same.winner, "agree"); assert.equal(same.delta_e_gain, 0);
// Live-shaped record (demo-run): 4 steps, e 1.561 → 0.151.
const live = scoreSealedPaths([
  { run_id: "demo-run", iteration: 1, e: 1.561, e0: 1.561, eligible: false, y: "mark_boundary", phi: -0.462, state: "CONTINUE" },
  { run_id: "demo-run", iteration: 2, e: 1.413, e0: 1.561, eligible: false, y: "complete_field", phi: -0.916, state: "CONTINUE" },
  { run_id: "demo-run", iteration: 3, e: 0.844, e0: 1.561, eligible: false, y: "request_independent_check", phi: -0.679, state: "CONTINUE" },
  { run_id: "demo-run", iteration: 4, e: 0.151, e0: 1.561, eligible: true, y: "seal_pack", phi: 0.014, state: "COMPLETE" },
]);
assert.deepEqual(live.lookback, { run_id: "demo-run", cumulative_delta_e: 1.41, final_phi: 0.014 }); assert.equal(live.greedy?.max_step_i, 0.693);
console.log("live shape  -> demo-run Δe 1.41, best step 0.693, Φ 0.014; single path agrees");

const cyc: Record<string, unknown> = {}; cyc.self = cyc;
const proxy = new Proxy({}, { get() { throw new Error("x"); }, ownKeys() { throw new Error("x"); } });
for (const j of [null, undefined, "x", 1, {}, [], [null, "x", 3], [cyc], [proxy], proxy]) {
  const r = scoreSealedPaths(j); assert.equal(r.winner, "none"); assert.equal(r.paths_considered, 0);
}
const input = [...A, ...B]; const snap = JSON.stringify(input); scoreSealedPaths(input); assert.equal(JSON.stringify(input), snap, "input not mutated");
assert.deepEqual(scoreSealedPaths([...A, ...B]), scoreSealedPaths([...B, ...A]), "order independent");
assert.deepEqual(JSON.parse(JSON.stringify(c)), c, "JSON-safe");
console.log("robust      -> never throws on junk, proxy or cycles; pure, order independent, JSON-safe");
console.log("OK");
