/** Fixture checks for the inspect-only ROE look-back (aethel.roe.lookback.v1). */
import assert from "node:assert/strict";
import { pathStepsJson, pathStepsDetail, sparklinePoints, stepGains, lookbackComparePack, filterLookbackRows, lookbackRowRole, lookbackPathJson, sortLookbackRows, fmtDeltaPhi, lookbackRowEmphasis, rankedLookbackRows, lookbackVerdict, scoreSealedPaths, ROE_LOOKBACK_SCHEMA, ROE_LOOKBACK_NOTE } from "../src/lib/level4/roe-lookback";

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
assert.deepEqual(lookbackVerdict(c), { tone: "win", label: "Look-back beats greedy", detail: "+Δe 0.65: B (Δe 1.4) over greedy A (Δe 0.75)" });
assert.deepEqual(lookbackVerdict(same), { tone: "agree", label: "Agree", detail: "greedy and look-back both pick B" });
for (const j of [null, undefined, scoreSealedPaths([])]) assert.equal(lookbackVerdict(j).tone, "none");
console.log("verdict     -> win callout with +Δe and run ids; quiet Agree badge; none when empty");
const rows = rankedLookbackRows(c);
assert.deepEqual(rows.map((r) => [r.rank, r.run_id, r.is_lookback, r.is_greedy]), [[1, "B", true, false], [2, "A", false, true]]);
assert.equal(rows[0].steps, 3); assert.equal(rows[0].max_step_i, 0.7); assert.equal(rows[0].final_phi, 0.02);
const one = rankedLookbackRows(same); assert.equal(one.length, 1); assert.ok(one[0].is_greedy && one[0].is_lookback);
for (const j of [null, undefined, {} as never]) assert.deepEqual(rankedLookbackRows(j), []);
console.log("table       -> ranked by Σ Δe: 1 B (look-back), 2 A (greedy); single path carries both badges");
assert.equal(lookbackRowEmphasis(1, c.winner), "top_win"); assert.equal(lookbackRowEmphasis(1, same.winner), "top_agree");
assert.equal(lookbackRowEmphasis(2, c.winner), "plain"); assert.equal(lookbackRowEmphasis(1, "none"), "plain"); assert.equal(lookbackRowEmphasis(1, undefined), "plain");
console.log("emphasis    -> TOP row strong when look-back wins, soft when agree, plain otherwise");
assert.deepEqual(rankedLookbackRows(c).map((r) => [r.run_id, r.delta_phi_vs_greedy]), [["B", 0.12], ["A", 0]]);
const noPhi = scoreSealedPaths([row("N", 1, 0.2, { eligible: true, state: "COMPLETE" })]); assert.equal(rankedLookbackRows(noPhi)[0].delta_phi_vs_greedy, null);
assert.equal(fmtDeltaPhi(0.12), "+0.12"); assert.equal(fmtDeltaPhi(-0.05), "−0.05"); assert.equal(fmtDeltaPhi(0), "0"); assert.equal(fmtDeltaPhi(null), "n/a"); assert.equal(fmtDeltaPhi(NaN), "n/a");
console.log("ΔΦ          -> B +0.12 vs greedy A; missing Φ gives n/a");
const mk = (rank: number, d: number | null) => ({ rank, run_id: `r${rank}`, delta_phi_vs_greedy: d });
const mixed = [mk(1, 0.1), mk(2, null), mk(3, 0.3), mk(4, -0.2), mk(5, 0.1)];
assert.deepEqual(sortLookbackRows(mixed, "dphi").map((r) => r.rank), [3, 1, 5, 4, 2], "ΔΦ desc, n/a last, ties by rank");
assert.deepEqual(sortLookbackRows([...mixed].reverse(), "rank").map((r) => r.rank), [1, 2, 3, 4, 5]);
assert.deepEqual(mixed.map((r) => r.rank), [1, 2, 3, 4, 5], "input not mutated");
assert.deepEqual(sortLookbackRows(null as never, "dphi"), []);
console.log("sort        -> ΔΦ vs greedy desc (n/a last, ties by rank) or look-back rank; pure");
const pj = JSON.parse(lookbackPathJson(rankedLookbackRows(c)[0], c.winner));
assert.equal(pj.schema, "aethel.roe.lookback.v1"); assert.equal(pj.kind, "path"); assert.equal(pj.run_id, "B");
assert.equal(pj.final_phi, 0.02); assert.equal(pj.delta_phi_vs_greedy, 0.12); assert.deepEqual(pj.badges, ["top", "look-back"]); assert.equal(pj.winner, "lookback");
assert.deepEqual(JSON.parse(lookbackPathJson(rankedLookbackRows(c)[1], c.winner)).badges, ["greedy"]);
assert.deepEqual(JSON.parse(lookbackPathJson(rankedLookbackRows(same)[0], same.winner)).badges, ["top", "look-back", "greedy"]);
for (const j of [null, undefined, {} as never]) assert.equal(lookbackPathJson(j), "");
console.log("path json   -> per-row JSON with run_id, Φ, ΔΦ vs greedy, badges and winner");
assert.deepEqual(rankedLookbackRows(c).map((r) => lookbackRowRole(r, c.winner)), ["winner_lookback", "greedy_beaten"]);
assert.equal(lookbackRowRole(rankedLookbackRows(same)[0], same.winner), "agree_both");
assert.equal(lookbackRowRole({ is_greedy: false, is_lookback: false }, "lookback"), "other"); assert.equal(lookbackRowRole(null, "lookback"), "other");
assert.equal(lookbackRowRole({ is_greedy: true, is_lookback: true }, "none"), "other");
assert.deepEqual(sortLookbackRows(rankedLookbackRows(c), "dphi").map((r) => lookbackRowRole(r, c.winner)).sort(), ["greedy_beaten", "winner_lookback"], "roles survive sorting");
console.log("roles       -> ★ WINNER on look-back, beaten on greedy, = both agree when same; independent of sort");
const rc = rankedLookbackRows(c);
assert.deepEqual(filterLookbackRows(rc, "all", c.winner).map((r) => r.run_id), ["B", "A"]);
assert.deepEqual(filterLookbackRows(rc, "winners", c.winner).map((r) => r.run_id), ["B"]);
assert.deepEqual(filterLookbackRows(rc, "beaten", c.winner).map((r) => r.run_id), ["A"]);
assert.deepEqual(filterLookbackRows(rc, "agree", c.winner), []);
assert.deepEqual(filterLookbackRows(rankedLookbackRows(same), "agree", same.winner).map((r) => r.run_id), ["B"]);
assert.deepEqual(filterLookbackRows(rc, "bogus" as never, c.winner).length, 2); assert.deepEqual(filterLookbackRows(null as never, "all", c.winner), []);
console.log("role filter -> All / ★ Winners / Beaten / = Agree from lookbackRowRole, with counts");
const cp = JSON.parse(lookbackComparePack(c));
assert.equal(cp.kind, "compare"); assert.equal(cp.schema, "aethel.roe.lookback.v1"); assert.equal(cp.winner, "lookback"); assert.equal(cp.verdict, "Look-back beats greedy");
assert.equal(cp.delta_e_gain, 0.65); assert.equal(cp.delta_phi_lookback_vs_greedy, 0.12); assert.equal(cp.same_path, false);
assert.equal(cp.lookback.run_id, "B"); assert.equal(cp.greedy.run_id, "A"); assert.equal(cp.greedy.best_step_i, 0.7); assert.deepEqual(cp.lookback.actions, ["a1", "a2", "a3"]);
const ca = JSON.parse(lookbackComparePack(same)); assert.equal(ca.verdict, "Agree"); assert.equal(ca.same_path, true); assert.equal(ca.delta_phi_lookback_vs_greedy, 0);
for (const j of [null, undefined, scoreSealedPaths([])]) assert.equal(lookbackComparePack(j), "");
console.log("compare     -> look-back vs greedy paths, verdict, +Δe 0.65, ΔΦ +0.12; agree case same_path");
const bRow = c.paths.find((p) => p.run_id === "B")!;
assert.deepEqual(bRow.e_series, [1.6, 1.3, 0.9, 0.2]); assert.deepEqual(stepGains(bRow.e_series), [0.3, 0.4, 0.7]);
assert.equal(Math.max(...stepGains(bRow.e_series)), bRow.max_step_i, "tallest bar is best I_t");
assert.equal(sparklinePoints([1, 0.5, 0], 64, 16), "0,0 32,8 64,16"); assert.equal(sparklinePoints([1], 64, 16), ""); assert.equal(sparklinePoints(null), "");
assert.equal(sparklinePoints([2, 1], 10, 10, 4), "0,5 10,7.5", "shared scale");
assert.deepEqual(stepGains([1, 1.2, 0.5]), [0, 0.7]); assert.deepEqual(stepGains("x"), []);
assert.deepEqual(live.paths[0].e_series, [1.561, 1.561, 1.413, 0.844, 0.151]);
console.log("sparkline   -> e path per row (e0 … e_final) with per-step I_t bars; best step highlighted");
assert.deepEqual(pathStepsDetail(bRow), [
  { step: 1, action: "a1", e_before: 1.6, e_after: 1.3, gain: 0.3, best: false },
  { step: 2, action: "a2", e_before: 1.3, e_after: 0.9, gain: 0.4, best: false },
  { step: 3, action: "a3", e_before: 0.9, e_after: 0.2, gain: 0.7, best: true },
]);
assert.deepEqual(pathStepsDetail(live.paths[0]).map((d) => [d.action, d.gain, d.best]), [["mark_boundary", 0, false], ["complete_field", 0.148, false], ["request_independent_check", 0.569, false], ["seal_pack", 0.693, true]]);
assert.deepEqual(pathStepsDetail({ actions: ["x"] }), [{ step: 1, action: "x", e_before: null, e_after: null, gain: null, best: false }]);
for (const j of [null, undefined, {}, { actions: "x" }]) assert.deepEqual(pathStepsDetail(j as never), []);
console.log("expand      -> full action list per path with e before/after, I_t and ★ best step");
const sj = JSON.parse(pathStepsJson(rankedLookbackRows(c)[0]));
assert.equal(sj.schema, "aethel.roe.lookback.v1"); assert.equal(sj.kind, "steps"); assert.equal(sj.run_id, "B"); assert.equal(sj.rank, 1); assert.equal(sj.best_step_i, 0.7);
assert.deepEqual(sj.steps, pathStepsDetail(bRow)); assert.equal(sj.steps[2].best, true);
assert.equal(JSON.parse(pathStepsJson(live.paths[0])).steps[3].action, "seal_pack");
for (const j of [null, undefined, {}, { run_id: 3 }]) assert.equal(pathStepsJson(j as never), "");
console.log("steps json  -> expanded row copies kind:steps JSON (action, e before/after, I_t, best)");
console.log("OK");
