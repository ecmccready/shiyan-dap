/** Fixture checks for the inspect-only ROE look-back (aethel.roe.lookback.v1). */
import assert from "node:assert/strict";
import { lookbackSealedPathsChip, lookbackPhiGapChip, lookbackToastClickAction, lookbackStepsDeltaTargets, LOOKBACK_DELTA_GREEDY_SCROLL_MS, lookbackGreedyFocusTarget, lookbackTopFocusTarget, lookbackTopSteps, lookbackGreedySteps, lookbackStepsDelta, lookbackHelpPulse, LOOKBACK_HELP_PULSE_MS, lookbackFocusPulse, LOOKBACK_FOCUS_PULSE_MS, lookbackExpandPulse, LOOKBACK_EXPAND_PULSE_MS, lookbackSortPulse, LOOKBACK_SORT_PULSE_MS, lookbackFilterPulse, LOOKBACK_FILTER_PULSE_MS, lookbackSummaryCopyPulse, LOOKBACK_SUMMARY_COPY_PULSE_MS, lookbackSummaryCopiedPulse, LOOKBACK_SUMMARY_COPIED_PULSE_MS, lookbackPathCopiedPulse, LOOKBACK_PATH_COPIED_PULSE_MS, lookbackStepsCopiedPulse, LOOKBACK_STEPS_COPIED_PULSE_MS, lookbackComparePulse, LOOKBACK_COMPARE_PULSE_MS, lookbackCompareCopyPulse, LOOKBACK_COMPARE_COPY_PULSE_MS, lookbackTopPulse, LOOKBACK_TOP_PULSE_MS, lookbackWinPulse, LOOKBACK_WIN_PULSE_MS, lookbackCopyAllLabel, restoreLookbackToast, lookbackToastPillLabel, LOOKBACK_TOAST_PILL_COPIED_MS, clearLookbackToastHistory, lookbackToastHistoryJson, removeLookbackToastHistoryEntry, pushLookbackToastHistory, dismissedLookbackToastHistory, LOOKBACK_TOAST_HISTORY_MAX, lookbackToastCopyText, lookbackToastDurationMs, lookbackToastExpiry, lookbackToastsAfterLeave, LOOKBACK_TOAST_LEAVE_GRACE_MS, dismissLookbackToast, clearAllLookbackToasts, showClearAllLookbackToasts, lookbackEscTarget, lookbackToastStack, LOOKBACK_TOAST_ORDER, lookbackAgreeToast, lookbackWinToast, WIN_TOAST_MS, emptyFilterToast, EMPTY_FILTER_TOAST_MS, lookbackKeyChanges, lookbackToastText, LOOKBACK_TOAST_MS, LOOKBACK_KEYMAP, toggleLookbackSort, cycleRoleFilter, ROLE_FILTER_CYCLE, lookbackKey, moveLookbackFocus, toggleRoleFilter, lookbackSummaryJson, lookbackDeltaECopiesSummary, lookbackSummary, lookbackVerdictCopiesCompare, pathStepsJson, pathStepsDetail, sparklinePoints, stepGains, lookbackComparePack, filterLookbackRows, lookbackRowRole, lookbackPathJson, sortLookbackRows, fmtDeltaPhi, lookbackRowEmphasis, rankedLookbackRows, lookbackVerdict, scoreSealedPaths, ROE_LOOKBACK_SCHEMA, ROE_LOOKBACK_NOTE } from "../src/lib/level4/roe-lookback";

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
assert.deepEqual(lookbackSummary(c), { tone: "win", verdict: "Look-back beats greedy", delta_e_gain: 0.65, delta_phi: 0.12, paths: 2, winners: 1, beaten: 1, agree: 0, excluded: 1 });
assert.deepEqual(lookbackSummary(same), { tone: "agree", verdict: "Agree", delta_e_gain: 0, delta_phi: 0, paths: 1, winners: 0, beaten: 0, agree: 1, excluded: 0 });
assert.equal(lookbackSummary(null).tone, "none"); assert.equal(lookbackSummary(scoreSealedPaths([])).paths, 0);
console.log("summary     -> sticky strip: verdict, +Δe, ΔΦ, path counts by role, domain exclusions");
const smj = JSON.parse(lookbackSummaryJson(c));
assert.equal(smj.schema, "aethel.roe.lookback.v1"); assert.equal(smj.kind, "summary"); assert.equal(smj.verdict, "Look-back beats greedy");
const { schema: _s, kind: _k, note: _n, ...rest } = smj; void _s; void _k; void _n; assert.deepEqual(rest, lookbackSummary(c));
assert.equal(JSON.parse(lookbackSummaryJson(same)).verdict, "Agree");
for (const j of [null, undefined, scoreSealedPaths([])]) assert.equal(lookbackSummaryJson(j), "");
console.log("summary json -> strip copies kind:summary JSON matching lookbackSummary");
assert.equal(toggleRoleFilter("all", "winners"), "winners"); assert.equal(toggleRoleFilter("winners", "winners"), "all");
assert.equal(toggleRoleFilter("winners", "beaten"), "beaten"); assert.equal(toggleRoleFilter("agree", "bogus"), "all"); assert.equal(toggleRoleFilter(null, "agree"), "agree");
console.log("strip roles -> ★ / beaten / = counts set the Show filter; re-click returns to all");
assert.equal(lookbackKey({ key: "j" }), "next"); assert.equal(lookbackKey({ key: "ArrowDown" }), null, "arrows left to the page");
assert.equal(lookbackKey({ key: "K" }), "prev"); assert.equal(lookbackKey({ key: "Enter", targetTag: "TR" }), "toggle"); assert.equal(lookbackKey({ key: "Escape" }), "close");
for (const j of [{ key: "j", ctrlKey: true }, { key: "j", targetTag: "input" }, { key: "k", targetTag: "SELECT" }, { key: "Enter", targetTag: "BUTTON" }, { key: "j", editable: true }, { key: "x" }, null]) assert.equal(lookbackKey(j as never), null);
const vis = ["B", "A", "C"];
assert.equal(moveLookbackFocus(vis, null, "next"), "B"); assert.equal(moveLookbackFocus(vis, "B", "next"), "A"); assert.equal(moveLookbackFocus(vis, "C", "next"), "C");
assert.equal(moveLookbackFocus(vis, "B", "prev"), "B"); assert.equal(moveLookbackFocus(vis, "gone", "prev"), "B"); assert.equal(moveLookbackFocus([], "A", "next"), null);
console.log("keys        -> j/k move row focus (clamped), Enter expands, Esc closes; ignored while typing");
// c copies the focused row path JSON.
assert.equal(lookbackKey({ key: "c" }), "copy"); assert.equal(lookbackKey({ key: "C" }), "copy");
assert.equal(lookbackKey({ key: "c", metaKey: true }), null, "Cmd+C left to the browser"); assert.equal(lookbackKey({ key: "c", ctrlKey: true }), null);
assert.equal(lookbackKey({ key: "c", targetTag: "input" }), null); assert.equal(lookbackKey({ key: "c", editable: true }), null);
console.log("key c       -> copies the focused row's path JSON; Ctrl/Cmd+C and typing untouched");
// s copies the focused row steps JSON.
assert.equal(lookbackKey({ key: "s" }), "steps"); assert.equal(lookbackKey({ key: "S" }), "steps");
assert.equal(lookbackKey({ key: "s", metaKey: true }), null, "Cmd+S left to the browser"); assert.equal(lookbackKey({ key: "s", targetTag: "textarea" }), null);
console.log("key s       -> expands the focused row and copies its steps JSON; Ctrl/Cmd+S and typing untouched");
// m copies the compare pack (presses the existing ⚖ button).
assert.equal(lookbackKey({ key: "m" }), "compare"); assert.equal(lookbackKey({ key: "M" }), "compare");
assert.equal(lookbackKey({ key: "m", ctrlKey: true }), null); assert.equal(lookbackKey({ key: "m", targetTag: "input" }), null);
console.log("key m       -> copies the ⚖ compare pack (same button, same JSON); no row focus needed; typing untouched");
// g copies the sticky summary JSON (presses the existing strip button).
assert.equal(lookbackKey({ key: "g" }), "summary"); assert.equal(lookbackKey({ key: "G" }), "summary");
assert.equal(lookbackKey({ key: "g", ctrlKey: true }), null); assert.equal(lookbackKey({ key: "g", editable: true }), null);
console.log("key g       -> copies the sticky summary JSON (same button, same JSON); no row focus needed; typing untouched");
// f cycles the Show filter.
assert.equal(lookbackKey({ key: "f" }), "filter"); assert.equal(lookbackKey({ key: "f", ctrlKey: true }), null); assert.equal(lookbackKey({ key: "f", targetTag: "input" }), null);
{ const seen: string[] = []; let f: unknown = "all"; for (let i = 0; i < 4; i++) { f = cycleRoleFilter(f); seen.push(f as string); }
  assert.deepEqual(seen, ["winners", "beaten", "agree", "all"], "All → winners → beaten → agree → All"); }
assert.equal(ROLE_FILTER_CYCLE.length, 4); assert.equal(cycleRoleFilter("bogus"), "winners"); assert.equal(cycleRoleFilter(null), "winners");
console.log("key f       -> cycles Show All → ★ Winners → Beaten → = Agree → All; works even when the shown list is empty");
// o toggles Sort.
assert.equal(lookbackKey({ key: "o" }), "sort"); assert.equal(lookbackKey({ key: "O" }), "sort"); assert.equal(lookbackKey({ key: "o", metaKey: true }), null, "Cmd+O left to the browser"); assert.equal(lookbackKey({ key: "o", targetTag: "input" }), null);
assert.equal(toggleLookbackSort("rank"), "dphi"); assert.equal(toggleLookbackSort("dphi"), "rank"); assert.equal(toggleLookbackSort(toggleLookbackSort("rank")), "rank"); assert.equal(toggleLookbackSort(undefined), "dphi");
console.log("key o       -> toggles Sort look-back rank ↔ ΔΦ vs greedy; Ctrl/Cmd+O and typing untouched");
// ? cheat sheet.
assert.equal(lookbackKey({ key: "?" }), "help"); assert.equal(lookbackKey({ key: "?", targetTag: "input" }), null); assert.equal(lookbackKey({ key: "?", metaKey: true }), null);
for (const row of LOOKBACK_KEYMAP) for (const k of row.key.split(" / ")) assert.ok(lookbackKey({ key: k, targetTag: "TR" }), `sheet key ${k} is live`);
assert.equal(new Set(LOOKBACK_KEYMAP.map((r) => r.key)).size, LOOKBACK_KEYMAP.length);
console.log("key ?       -> toggles the look-back keyboard cheat sheet (every listed key is live); Esc closes");
// ⌨ toast after look-back keys.
assert.equal(lookbackToastText(lookbackKey({ key: "c" }), "run-a"), "copy path JSON · run-a");
assert.equal(lookbackToastText(lookbackKey({ key: "j" }), "run-a"), "↓ row"); assert.equal(lookbackToastText(lookbackKey({ key: "m" }), null), "⚖ copy compare pack");
assert.equal(lookbackToastText(lookbackKey({ key: "?" }), "x"), null, "cheat sheet has no toast"); assert.equal(lookbackToastText(null, "x"), null);
for (const k of ["j", "k", "Enter", "Escape", "c", "s", "m", "g", "f", "o"]) { const t = lookbackToastText(lookbackKey({ key: k, targetTag: "TR" }), "run-a"); assert.ok(t && t.length <= 60, k); }
assert.ok(LOOKBACK_TOAST_MS > 0 && LOOKBACK_TOAST_MS <= 3000);
console.log("key toast   -> amber ⌨ toast names the last look-back key action for ~1.6 s; none for ?");
// Toast only when the look-back key changes state or copies.
{ const K = (key: string) => lookbackKey({ key, targetTag: "TR" }); const b = { visible: ["a", "b"], focus: null as string | null, open: null as string | null, button_ready: true };
  assert.equal(lookbackKeyChanges(K("j"), b), true, "first j focuses row 1"); assert.equal(lookbackKeyChanges(K("k"), { ...b, focus: "a" }), false, "clamped at top");
  assert.equal(lookbackKeyChanges(K("j"), { ...b, focus: "b" }), false, "clamped at bottom"); assert.equal(lookbackKeyChanges(K("j"), { ...b, visible: [] }), false, "nothing shown");
  assert.equal(lookbackKeyChanges(K("Enter"), b), false); assert.equal(lookbackKeyChanges(K("Enter"), { ...b, focus: "a" }), true);
  assert.equal(lookbackKeyChanges(K("c"), { ...b, focus: "zz" }), false, "focused row hidden by filter"); assert.equal(lookbackKeyChanges(K("s"), { ...b, focus: "b" }), true);
  assert.equal(lookbackKeyChanges(K("Escape"), b), false, "nothing open"); assert.equal(lookbackKeyChanges(K("Escape"), { ...b, open: "a" }), true);
  assert.equal(lookbackKeyChanges(K("m"), { ...b, button_ready: false }), false); assert.equal(lookbackKeyChanges(K("g"), b), true);
  assert.equal(lookbackKeyChanges(K("f"), { ...b, visible: [] }), true); assert.equal(lookbackKeyChanges(K("o"), b), true);
  assert.equal(lookbackKeyChanges(K("?"), b), false); assert.equal(lookbackKeyChanges(null, b), false); assert.equal(lookbackKeyChanges(K("j"), null), false); }
console.log("toast gate  -> look-back ⌨ toast only when the key changes state or copies; clamped j/k, nothing open, hidden focus stay silent");
// Toast when the Show filter hides every row.
assert.equal(emptyFilterToast("winners", 0, 4), "Show ★ Winners: 0 of 4 paths match · press f or click All to show all");
assert.ok(emptyFilterToast("beaten", 0, 4)!.startsWith("Show Beaten: 0 of 4"));
assert.equal(emptyFilterToast("agree", 4, 4), null); assert.equal(emptyFilterToast("all", 0, 4), null, "All never empties by filter");
assert.equal(emptyFilterToast("winners", 0, 0), null, "no sealed paths is its own message"); assert.equal(emptyFilterToast("bogus", 0, 4), null); assert.equal(emptyFilterToast(null, 0, 4), null);
for (const sc of [c, same]) { const rows = rankedLookbackRows(sc); for (const f of ["winners", "beaten", "agree"] as const) { const n = filterLookbackRows(rows, f, sc.winner).length; assert.equal(emptyFilterToast(f, n, rows.length) !== null, n === 0, f); } }
{ const rows = rankedLookbackRows(same); assert.equal(filterLookbackRows(rows, "winners", same.winner).length, 0, "agree data: ★ Winners is empty → toast"); }
assert.ok(EMPTY_FILTER_TOAST_MS >= 2000 && EMPTY_FILTER_TOAST_MS <= 5000);
console.log("empty Show  -> big amber toast when ★ / Beaten / = leaves 0 of N paths; points to f or All");
// Green toast once when look-back beats greedy.
assert.equal(c.winner, "lookback"); { const t = lookbackWinToast(c); assert.ok(t && t.startsWith("★ Look-back beats greedy · +Δe ") && t.includes(String(c.lookback?.run_id)) && t.includes("press m"), String(t)); }
assert.equal(lookbackWinToast(same), null, "agree: no toast"); assert.equal(lookbackWinToast(scoreSealedPaths([])), null, "none: no toast");
assert.equal(lookbackWinToast({ winner: "lookback", delta_e_gain: 0 }), null); assert.equal(lookbackWinToast(null), null);
assert.ok(lookbackWinToast({ winner: "lookback", delta_e_gain: 0.12345 })!.includes("+Δe 0.123 · look-back over greedy"));
assert.ok(WIN_TOAST_MS >= 2000 && WIN_TOAST_MS <= 5000);
console.log("win toast   -> big green toast once per load when look-back beats greedy (+Δe, run ids, m hint); none on agree");
// Blue toast once when look-back and greedy agree.
assert.equal(same.winner, "agree"); { const t = lookbackAgreeToast(same); assert.ok(t && t.startsWith("= Look-back and greedy agree · ") && t.endsWith("greedy was already best"), String(t)); }
assert.equal(lookbackAgreeToast(c), null, "win: green toast instead"); assert.equal(lookbackAgreeToast(scoreSealedPaths([])), null, "no paths");
assert.equal(lookbackAgreeToast({ winner: "agree", paths_considered: 4, greedy: { cumulative_delta_e: 1.4104 } }), "= Look-back and greedy agree · 4 sealed paths · Δe 1.41 · greedy was already best");
assert.equal(lookbackAgreeToast({ winner: "agree", paths_considered: 1 }), "= Look-back and greedy agree · 1 sealed path · greedy was already best"); assert.equal(lookbackAgreeToast(null), null);
for (const sc of [c, same, scoreSealedPaths([])]) assert.ok(!(lookbackWinToast(sc) && lookbackAgreeToast(sc)), "never both");
console.log("agree toast -> big blue toast once per load when look-back and greedy agree; never with the win toast");
// Toast stack: one column, fixed order, never overlapping.
assert.deepEqual(lookbackToastStack({ empty_filter: "e", agree: "a", win: "w" }).map((x) => [x.id, x.tone]), [["win", "green"], ["agree", "blue"], ["empty_filter", "amber"]]);
assert.deepEqual(lookbackToastStack({ agree: lookbackAgreeToast(same), empty_filter: emptyFilterToast("winners", 0, 1) }).map((x) => x.id), ["agree", "empty_filter"], "agree on load + empty ★ filter stack");
assert.deepEqual(lookbackToastStack({ win: "", agree: null }), []); assert.deepEqual(lookbackToastStack(null), []); assert.equal(new Set(LOOKBACK_TOAST_ORDER).size, 3);
console.log("toast stack -> win / agree / empty Show stack in one top column (fixed order, no overlap); ⌨ toast stays at the bottom");
// Esc priority: cheat sheet → stacked toasts → expanded row.
assert.equal(lookbackEscTarget(true, 2, "a"), "help"); assert.equal(lookbackEscTarget(false, 2, "a"), "toasts", "toasts before the row");
assert.equal(lookbackEscTarget(false, 0, "a"), "row"); assert.equal(lookbackEscTarget(false, 0, null), null); assert.equal(lookbackEscTarget(false, 0, ""), null);
{ const seq: unknown[] = []; let h = true, t = 1, o: string | null = "a"; for (let i = 0; i < 4; i++) { const x = lookbackEscTarget(h, t, o); seq.push(x); if (x === "help") h = false; else if (x === "toasts") t = 0; else if (x === "row") o = null; }
  assert.deepEqual(seq, ["help", "toasts", "row", null], "one layer per Esc"); }
console.log("Esc         -> one layer per press: cheat sheet, then stacked top toasts, then the expanded row");
// Click one stacked toast to dismiss only that one.
{ const st = lookbackToastStack({ win: "w", agree: "a", empty_filter: "e" });
  assert.deepEqual(dismissLookbackToast(st, "agree").map((x) => x.id), ["win", "empty_filter"], "others stay in order");
  assert.deepEqual(dismissLookbackToast(st, "nope").map((x) => x.id), ["win", "agree", "empty_filter"]);
  assert.deepEqual(dismissLookbackToast(dismissLookbackToast(st, "win"), "empty_filter").map((x) => x.id), ["agree"]);
  assert.deepEqual(dismissLookbackToast(null, "win"), []); assert.equal(st.length, 3, "input not mutated"); }
console.log("click toast -> clicking a stacked look-back toast (✕) dismisses only that one; the rest keep their order");
// Hover pauses auto-dismiss.
assert.equal(lookbackToastExpiry(true), "defer"); assert.equal(lookbackToastExpiry(false), "dismiss"); assert.equal(lookbackToastExpiry(undefined), "dismiss");
{ const st = lookbackToastStack({ win: "w", agree: "a", empty_filter: "e" });
  assert.deepEqual(lookbackToastsAfterLeave(["empty_filter", "agree"], st), ["agree", "empty_filter"], "deferred go after leave, in stack order");
  assert.deepEqual(lookbackToastsAfterLeave(["agree"], dismissLookbackToast(st, "agree")), [], "already clicked away");
  assert.deepEqual(lookbackToastsAfterLeave([], st), []); assert.deepEqual(lookbackToastsAfterLeave(null, null), []); }
assert.ok(LOOKBACK_TOAST_LEAVE_GRACE_MS >= 500 && LOOKBACK_TOAST_LEAVE_GRACE_MS <= 3000);
console.log("hover       -> hovering a stacked look-back toast pauses its auto-dismiss; it goes ~1.2 s after the pointer leaves");
// Time-left bar duration per stacked toast.
assert.equal(lookbackToastDurationMs("win"), WIN_TOAST_MS); assert.equal(lookbackToastDurationMs("agree"), WIN_TOAST_MS); assert.equal(lookbackToastDurationMs("empty_filter"), EMPTY_FILTER_TOAST_MS);
assert.equal(lookbackToastDurationMs("nope"), 0); for (const id of LOOKBACK_TOAST_ORDER) assert.ok(lookbackToastDurationMs(id) >= 2000 && lookbackToastDurationMs(id) <= 5000, id);
console.log("time bar    -> each stacked look-back toast shows a thin bar shrinking over its own time; it pauses while the stack is hovered");
// Click a stacked toast: copy its text, then dismiss.
{ const st = lookbackToastStack({ agree: lookbackAgreeToast(same), empty_filter: emptyFilterToast("winners", 0, 1) });
  assert.equal(lookbackToastCopyText(st[0]), lookbackAgreeToast(same)); assert.equal(lookbackToastCopyText(st[1]), `⚠ ${emptyFilterToast("winners", 0, 1)}`, "amber keeps ⚠");
  assert.equal(lookbackToastCopyText({ text: "  x  " }), "x"); assert.equal(lookbackToastCopyText({ text: "" }), ""); assert.equal(lookbackToastCopyText(null), "");
  assert.deepEqual(dismissLookbackToast(st, "agree").map((x) => x.id), ["empty_filter"], "still dismissed after copy"); }
console.log("click copy  -> clicking a stacked look-back toast copies its text (⌨ copied toast text), then dismisses it");
// Recent-toast history strip.
{ const a = lookbackToastStack({ agree: "a1" }); const b = lookbackToastStack({ empty_filter: "e1" }); const c2 = lookbackToastStack({ agree: "a1", empty_filter: "e2" });
  let h = pushLookbackToastHistory([], a); h = pushLookbackToastHistory(h, b); h = pushLookbackToastHistory(h, c2);
  assert.deepEqual(h.map((x) => x.text), ["a1", "e2", "e1"], "newest first, de-duplicated");
  assert.deepEqual(dismissedLookbackToastHistory(h, c2).map((x) => x.text), ["e1"], "only gone ones in the strip");
  assert.deepEqual(dismissedLookbackToastHistory(h, []).map((x) => lookbackToastCopyText(x)), ["a1", "⚠ e2", "⚠ e1"]);
  let big: ReturnType<typeof pushLookbackToastHistory> = []; for (let i = 0; i < 9; i++) big = pushLookbackToastHistory(big, lookbackToastStack({ empty_filter: `e${i}` }));
  assert.equal(big.length, LOOKBACK_TOAST_HISTORY_MAX); assert.equal(big[0].text, "e8"); assert.deepEqual(pushLookbackToastHistory(null, null), []); }
console.log("history     -> last 5 dismissed/expired look-back toasts in an amber strip, newest first; click one to re-copy");
// Clear the Recent toasts strip.
{ const on = lookbackToastStack({ agree: "a1" }); let h = pushLookbackToastHistory([], lookbackToastStack({ empty_filter: "e1" })); h = pushLookbackToastHistory(h, on);
  const cl = clearLookbackToastHistory(h, on);
  assert.deepEqual(dismissedLookbackToastHistory(cl, on), [], "strip empty right after Clear"); assert.deepEqual(cl.map((x) => x.text), ["a1"], "on-screen toast kept for later");
  assert.deepEqual(dismissedLookbackToastHistory(cl, []).map((x) => x.text), ["a1"], "it appears once it goes");
  assert.deepEqual(clearLookbackToastHistory(h, []), []); assert.deepEqual(clearLookbackToastHistory(null, null), []); assert.equal(h.length, 2, "input not mutated"); }
{ const g = { text: "agree", tone: "blue" }, a = { text: "warn", tone: "amber" };
  assert.equal(LOOKBACK_TOAST_PILL_COPIED_MS, 1500);
  assert.equal(lookbackToastPillLabel(g, null, 0), "⧉ agree");
  assert.equal(lookbackToastPillLabel(g, { key: "agree", at: 1000 }, 1000), "✓ Copied");
  assert.equal(lookbackToastPillLabel(g, { key: "agree", at: 1000 }, 2499), "✓ Copied");
  assert.equal(lookbackToastPillLabel(g, { key: "agree", at: 1000 }, 2500), "⧉ agree", "reverts after 1.5 s");
  assert.equal(lookbackToastPillLabel(g, { key: "agree", at: 1000 }, 999), "⧉ agree", "clock skew");
  assert.equal(lookbackToastPillLabel(a, { key: "agree", at: 1000 }, 1000), "⧉ ⚠ warn", "only the clicked pill");
  assert.equal(lookbackToastPillLabel(a, { key: "⚠ warn", at: 1000 }, 1100), "✓ Copied");
  assert.equal(lookbackToastPillLabel(g, { key: "agree", at: NaN }, 1000), "⧉ agree");
  assert.equal(lookbackToastPillLabel(null, { key: "", at: 0 }, 0), ""); assert.equal(lookbackToastPillLabel({ text: "" }, null, 0), ""); }
console.log("clear       -> Clear empties the look-back Recent toasts strip; a toast still on screen shows up after it goes");
{
  const st = lookbackToastStack({ win: "A", agree: "B", empty_filter: "C" });
  const orig = JSON.stringify(st);
  const r = clearAllLookbackToasts(st);
  assert.deepEqual(r.cleared, ["win", "agree", "empty_filter"], "clear all lists every live toast in stack order");
  assert.deepEqual(r.stack, []);
  assert.equal(JSON.stringify(st), orig, "input untouched");
  assert.deepEqual(clearAllLookbackToasts(null), { cleared: [], stack: [] });
  assert.deepEqual(clearAllLookbackToasts("x" as never), { cleared: [], stack: [] });
  assert.equal(showClearAllLookbackToasts(st), true);
  assert.equal(showClearAllLookbackToasts(st.slice(0, 1)), false, "single toast: no Clear all");
  assert.equal(showClearAllLookbackToasts([]), false); assert.equal(showClearAllLookbackToasts(null), false);
  const hist = pushLookbackToastHistory([], st);
  assert.equal(dismissedLookbackToastHistory(hist, r.stack).length, 3, "cleared toasts land in Recent toasts");
}
console.log("clear all -> with 2+ stacked look-back top toasts a ✕ Clear all N (Esc) control dismisses them at once; Recent toasts kept");
{ const e = { id: "agree" as const, text: "= Look-back and greedy agree", tone: "blue" as const };
  assert.deepEqual(restoreLookbackToast(e, []), { id: "agree", text: e.text });
  assert.equal(restoreLookbackToast(e, [e]), null, "already on screen -> no-op");
  assert.deepEqual(restoreLookbackToast(e, [{ id: "agree", text: "other" }]), { id: "agree", text: e.text });
  assert.equal(restoreLookbackToast({ id: "bogus", text: "x" }, []), null); assert.equal(restoreLookbackToast({ id: "win", text: " " }, []), null); assert.equal(restoreLookbackToast(null, null), null);
  const st = lookbackToastStack({ agree: e.text }); assert.equal(dismissedLookbackToastHistory(pushLookbackToastHistory([], st), st).length, 0, "restored toast leaves the strip while live"); }
console.log("restore -> 📌 on a look-back Recent toasts pill re-shows it as a live top toast (same slot/timer), no-op if already showing");
console.log("OK");
{ const h = [{ id: "win" as const, text: "A", tone: "green" as const }, { id: "agree" as const, text: "B", tone: "green" as const }, { id: "empty_filter" as const, text: "C", tone: "amber" as const }] as any[];
  assert.deepEqual(removeLookbackToastHistoryEntry(h, h[1]).map((x) => x.text), ["A", "C"], "remove one keeps order");
  assert.equal(removeLookbackToastHistoryEntry(h, { text: "Z", tone: "green" }).length, 3);
  assert.equal(removeLookbackToastHistoryEntry(h, null).length, 3); assert.deepEqual(removeLookbackToastHistoryEntry(null, h[0]), []);
  assert.equal(h.length, 3, "input not mutated"); console.log("removeLookbackToastHistoryEntry OK"); }

{ const h = [{ id: "agree" as const, text: "A", tone: "blue" as const }, { id: "empty_filter" as const, text: "B", tone: "amber" as const }];
  const j = JSON.parse(lookbackToastHistoryJson(h)); assert.equal(j.schema, "aethel.roe.lookback.toast_history.v1"); assert.equal(j.count, 2);
  assert.deepEqual(j.entries, [{ kind: "agree", text: "A", tone: "blue" }, { kind: "empty_filter", text: "B", tone: "amber" }]);
  assert.equal(JSON.parse(lookbackToastHistoryJson(null)).count, 0); assert.equal(JSON.parse(lookbackToastHistoryJson([{ text: " " }, null])).count, 0);
  assert.equal(h.length, 2); console.log("lookbackToastHistoryJson OK"); }
{ assert.equal(lookbackCopyAllLabel(null, 5), "⧉ Copy all"); assert.equal(lookbackCopyAllLabel(1000, 1000), "✓ Copied");
  assert.equal(lookbackCopyAllLabel(1000, 1000 + LOOKBACK_TOAST_PILL_COPIED_MS - 1), "✓ Copied"); assert.equal(lookbackCopyAllLabel(1000, 1000 + LOOKBACK_TOAST_PILL_COPIED_MS), "⧉ Copy all");
  assert.equal(lookbackCopyAllLabel(1000, 999), "⧉ Copy all"); assert.equal(lookbackCopyAllLabel(NaN, 1), "⧉ Copy all"); console.log("lookbackCopyAllLabel OK"); }

{
  assert.equal(lookbackWinPulse(null, 5, "win"), false); assert.equal(lookbackWinPulse(1000, 1000, "win"), true); assert.equal(lookbackWinPulse(1000, 1000 + LOOKBACK_WIN_PULSE_MS - 1, "win"), true);
  assert.equal(lookbackWinPulse(1000, 1000 + LOOKBACK_WIN_PULSE_MS, "win"), false); assert.equal(lookbackWinPulse(1000, 1500, "agree"), false); assert.equal(lookbackWinPulse(1000, 999, "win"), false);
  assert.equal(lookbackWinPulse(NaN, 1, "win"), false); console.log("lookbackWinPulse OK"); }

{ assert.equal(lookbackComparePulse(null, 5, "lookback"), false); assert.equal(lookbackComparePulse(1000, 1000, "lookback"), true); assert.equal(lookbackComparePulse(1000, 1000 + LOOKBACK_COMPARE_PULSE_MS - 1, "lookback"), true);
  assert.equal(lookbackComparePulse(1000, 1000 + LOOKBACK_COMPARE_PULSE_MS, "lookback"), false); assert.equal(lookbackComparePulse(1000, 1500, "agree"), false); assert.equal(lookbackComparePulse(1000, 999, "lookback"), false); assert.equal(lookbackComparePulse(NaN, 1000, "lookback"), false); }
{ assert.equal(LOOKBACK_COMPARE_COPY_PULSE_MS, 2400); assert.equal(lookbackCompareCopyPulse(null, 5), false); assert.equal(lookbackCompareCopyPulse(1000, 1000), true); assert.equal(lookbackCompareCopyPulse(1000, 1000 + LOOKBACK_COMPARE_COPY_PULSE_MS - 1), true);
  assert.equal(lookbackCompareCopyPulse(1000, 1000 + LOOKBACK_COMPARE_COPY_PULSE_MS), false); assert.equal(lookbackCompareCopyPulse(1000, 999), false); assert.equal(lookbackCompareCopyPulse(NaN, 1000), false); assert.equal(lookbackCompareCopyPulse("1", 1000), false); }
{ const P = lookbackPathCopiedPulse, M = LOOKBACK_PATH_COPIED_PULSE_MS, q = { runId: "A", at: 1000 }; assert.equal(M, 2400); assert.equal(P(null, "A", 5), false); assert.equal(P(q, "A", 1000), true); assert.equal(P(q, "A", 1000 + M - 1), true);
  assert.equal(P(q, "A", 1000 + M), false); assert.equal(P(q, "B", 1500), false); assert.equal(P(q, "A", 999), false); assert.equal(P({ runId: "A", at: NaN }, "A", 1000), false); assert.equal(P({ runId: "", at: 1000 }, "", 1000), false); assert.equal(P("x", "A", 1000), false); assert.equal(P(q, "A", Infinity), false); }
{ const P = lookbackStepsCopiedPulse, M = LOOKBACK_STEPS_COPIED_PULSE_MS, q = { runId: "A", at: 1000 }; assert.equal(M, 2400); assert.equal(P(null, "A", 5), false); assert.equal(P(q, "A", 1000), true); assert.equal(P(q, "A", 1000 + M - 1), true);
  assert.equal(P(q, "A", 1000 + M), false); assert.equal(P(q, "B", 1500), false); assert.equal(P(q, "A", 999), false); assert.equal(P({ runId: "A", at: NaN }, "A", 1000), false); assert.equal(P({ runId: "", at: 1000 }, "", 1000), false); assert.equal(P("x", "A", 1000), false); assert.equal(P(q, "A", Infinity), false); }
{ const P = lookbackSummaryCopiedPulse, M = LOOKBACK_SUMMARY_COPIED_PULSE_MS; assert.equal(M, 2400); assert.equal(P(null, 5), false); assert.equal(P(1000, 1000), true); assert.equal(P(1000, 1000 + M - 1), true);
  assert.equal(P(1000, 1000 + M), false); assert.equal(P(1000, 999), false); assert.equal(P(NaN, 1000), false); assert.equal(P("1", 1000), false); assert.equal(P(1000, Infinity), false); }
{ const P = lookbackSummaryCopyPulse, M = LOOKBACK_SUMMARY_COPY_PULSE_MS; assert.equal(M, 2400); assert.equal(P(null, 5, true), false); assert.equal(P(1000, 1000, true), true); assert.equal(P(1000, 1000 + M - 1, true), true);
  assert.equal(P(1000, 1000 + M, true), false); assert.equal(P(1000, 1500, false), false); assert.equal(P(1000, 1500, "yes"), false); assert.equal(P(1000, 999, true), false); assert.equal(P(NaN, 1000, true), false); assert.equal(P(1000, Infinity, true), false); }
{ assert.equal(lookbackTopPulse(null, 5, 3), false); assert.equal(lookbackTopPulse(1000, 1000, 3), true); assert.equal(lookbackTopPulse(1000, 1000 + LOOKBACK_TOP_PULSE_MS - 1, 1), true);
  assert.equal(lookbackTopPulse(1000, 1000 + LOOKBACK_TOP_PULSE_MS, 3), false); assert.equal(lookbackTopPulse(1000, 1500, 0), false); assert.equal(lookbackTopPulse(1000, 999, 3), false);
  assert.equal(lookbackTopPulse(NaN, 1, 3), false); assert.equal(lookbackTopPulse(1000, 1000, "3"), false); console.log("lookbackTopPulse OK"); }
{ const P = lookbackFilterPulse, M = LOOKBACK_FILTER_PULSE_MS; assert.equal(M, 2400); assert.equal(P(null, 5, "winners"), false); assert.equal(P(1000, 1000, "winners"), true); assert.equal(P(1000, 1000 + M - 1, "beaten"), true);
  assert.equal(P(1000, 1000 + M, "winners"), false); assert.equal(P(1000, 1500, "all"), false); assert.equal(P(1000, 1500, 3), false); assert.equal(P(1000, 999, "agree"), false); assert.equal(P(NaN, 1000, "winners"), false); assert.equal(P(1000, Infinity, "winners"), false); console.log("lookbackFilterPulse OK"); }
{ const P = lookbackSortPulse, M = LOOKBACK_SORT_PULSE_MS; assert.equal(M, 2400); assert.equal(P(null, 5, "dphi"), false); assert.equal(P(1000, 1000, "dphi"), true); assert.equal(P(1000, 1000 + M - 1, "dphi"), true);
  assert.equal(P(1000, 1000 + M, "dphi"), false); assert.equal(P(1000, 1500, "rank"), false); assert.equal(P(1000, 1500, 3), false); assert.equal(P(1000, 999, "dphi"), false); assert.equal(P(NaN, 1000, "dphi"), false); assert.equal(P(1000, Infinity, "dphi"), false); console.log("lookbackSortPulse OK"); }
{ const P = lookbackExpandPulse, M = LOOKBACK_EXPAND_PULSE_MS; assert.equal(M, 2400); assert.equal(P(null, 5, "A"), false); assert.equal(P(1000, 1000, "A"), true); assert.equal(P(1000, 1000 + M - 1, "B"), true);
  assert.equal(P(1000, 1000 + M, "A"), false); assert.equal(P(1000, 1500, null), false); assert.equal(P(1000, 1500, ""), false); assert.equal(P(1000, 999, "A"), false); assert.equal(P(NaN, 1000, "A"), false); assert.equal(P(1000, Infinity, "A"), false); console.log("lookbackExpandPulse OK"); }
{ const P = lookbackFocusPulse, M = LOOKBACK_FOCUS_PULSE_MS; assert.equal(M, 2400); assert.equal(P(null, 5, "A"), false); assert.equal(P(1000, 1000, "A"), true); assert.equal(P(1000, 1000 + M - 1, "B"), true);
  assert.equal(P(1000, 1000 + M, "A"), false); assert.equal(P(1000, 1500, null), false); assert.equal(P(1000, 1500, ""), false); assert.equal(P(1000, 999, "A"), false); assert.equal(P(NaN, 1000, "A"), false); assert.equal(P(1000, Infinity, "A"), false); console.log("lookbackFocusPulse OK"); }
{ const P = lookbackHelpPulse, M = LOOKBACK_HELP_PULSE_MS; assert.equal(M, 2400); assert.equal(P(null, 5, true), false); assert.equal(P(1000, 1000, true), true); assert.equal(P(1000, 1000 + M - 1, true), true);
  assert.equal(P(1000, 1000 + M, true), false); assert.equal(P(1000, 1500, false), false); assert.equal(P(1000, 1500, "true"), false); assert.equal(P(1000, 999, true), false); assert.equal(P(NaN, 1000, true), false); assert.equal(P(1000, Infinity, true), false); console.log("lookbackHelpPulse OK"); }

{ const t = lookbackTopSteps(c); assert.ok(t); assert.equal(t!.run_id, rankedLookbackRows(c)[0].run_id); assert.equal(t!.steps, rankedLookbackRows(c)[0].steps); assert.match(t!.label, /^\d+ steps?$/);
  const one = lookbackTopSteps({ ...c, paths: [{ ...c.paths[0], steps: 1 }] } as typeof c); assert.equal(one?.label, "1 step");
  for (const j of [null, undefined, scoreSealedPaths([])]) assert.equal(lookbackTopSteps(j), null);
  console.log("top steps -> summary strip shows top path N steps"); }
{ assert.equal(lookbackGreedySteps(null), null);
  const g = lookbackGreedySteps(c); if (c.greedy && rankedLookbackRows(c)[0].run_id !== c.greedy.run_id) { assert.ok(g); assert.equal(g!.run_id, c.greedy.run_id); assert.match(g!.label, /^\d+ steps?$/); } else assert.equal(g, null);
  const agree = { ...c, greedy: c.greedy ? { ...c.greedy, run_id: rankedLookbackRows(c)[0].run_id } : null } as typeof c; assert.equal(lookbackGreedySteps(agree), null);
  console.log("greedy steps -> strip shows greedy M steps when greedy differs from top"); }
{ assert.equal(lookbackStepsDelta(null), null);
  const t = lookbackTopSteps(c), g = lookbackGreedySteps(c), d = lookbackStepsDelta(c);
  if (t && g && t.steps !== g.steps) { assert.equal(d!.delta, t.steps - g.steps); assert.match(d!.label, /^[+−]\d+ steps? vs greedy$/); } else assert.equal(d, null);
  const top = rankedLookbackRows(c)[0]; const gid = c.greedy?.run_id;
  if (gid && top.run_id !== gid) { const gsteps = c.paths.find((p) => p.run_id === gid)!.steps;
    const mk = (n: number) => ({ ...c, paths: c.paths.map((p) => p.run_id === top.run_id ? { ...p, steps: n } : p) } as typeof c);
    assert.equal(lookbackStepsDelta(mk(gsteps + 1))?.label, "+1 step vs greedy");
    assert.equal(lookbackStepsDelta(mk(gsteps + 3))?.label, "+3 steps vs greedy");
    if (gsteps > 1) assert.equal(lookbackStepsDelta(mk(gsteps - 1))?.label, "−1 step vs greedy");
    assert.equal(lookbackStepsDelta(mk(gsteps)), null); }
  console.log("steps delta -> strip shows ±N steps vs greedy when counts differ"); }

{ assert.equal(lookbackTopFocusTarget(c), rankedLookbackRows(c)[0].run_id);
  for (const j of [null, undefined, scoreSealedPaths([])]) assert.equal(lookbackTopFocusTarget(j), null); }

{ assert.equal(lookbackGreedyFocusTarget(c), lookbackGreedySteps(c)?.run_id ?? null);
  for (const j of [null, undefined, scoreSealedPaths([])]) assert.equal(lookbackGreedyFocusTarget(j), null);
  console.log("greedy steps click -> focuses greedy row"); }

{ const t = lookbackStepsDeltaTargets(c); assert.ok(t); assert.equal(t!.top, lookbackTopFocusTarget(c)); assert.notEqual(t!.greedy, t!.top);
  assert.equal(t!.greedy, lookbackGreedyFocusTarget(c)); assert.ok(LOOKBACK_DELTA_GREEDY_SCROLL_MS > 0);
  for (const j of [null, undefined, scoreSealedPaths([])]) assert.equal(lookbackStepsDeltaTargets(j), null);
  console.log("delta steps click -> TOP then greedy"); }

{ assert.equal(lookbackToastClickAction("empty_filter"), "reset_filter");
  for (const id of ["win", "agree", null, undefined, 3]) assert.equal(lookbackToastClickAction(id), "copy");
  console.log("empty-filter toast click -> resets Show to All (still copies)"); }

{ for (const v of [null, undefined, 0, NaN]) assert.equal(lookbackPhiGapChip(v as any, "rank"), null);
  const a = lookbackPhiGapChip(0.12, "rank")!; assert.equal(a.label, "Φ +0.12 vs greedy"); assert.equal(a.tone, "up"); assert.equal(a.nextSort, "dphi"); assert.equal(a.changes, true);
  const b = lookbackPhiGapChip(-0.05, "dphi")!; assert.equal(b.label, "Φ −0.05 vs greedy"); assert.equal(b.tone, "down"); assert.equal(b.changes, false);
  console.log("ok lookbackPhiGapChip"); }

{ assert.equal(lookbackVerdictCopiesCompare(null), false); assert.equal(lookbackVerdictCopiesCompare(undefined), false);
  const c = scoreSealedPaths([] as any); assert.equal(lookbackVerdictCopiesCompare(c), lookbackComparePack(c) !== "");
  console.log("ok lookbackVerdictCopiesCompare"); }

assert.equal(lookbackDeltaECopiesSummary(c), true); assert.equal(lookbackDeltaECopiesSummary(same), lookbackSummaryJson(same) !== "");
console.log("Δe copy    -> sticky +Δe click copies summary JSON (same as g)");

{ for (const v of [null, undefined, 0, -1, NaN, "3"]) assert.equal(lookbackSealedPathsChip(v), null);
  assert.deepEqual(lookbackSealedPathsChip(1), { count: 1, label: "1 sealed path" });
  assert.deepEqual(lookbackSealedPathsChip(4), { count: 4, label: "4 sealed paths" });
  assert.equal(lookbackSealedPathsChip(lookbackSummary(c).paths)?.count ?? 0, lookbackSummary(c).paths);
  console.log("ok lookbackSealedPathsChip"); }
