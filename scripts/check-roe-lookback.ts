import * as UrlView from "../src/lib/roe-lookback-url";
import { readFileSync } from "node:fs";
/** Fixture checks for the inspect-only ROE look-back (aethel.roe.lookback.v1). */
import assert from "node:assert/strict";
import { lookbackApplyViewShouldPulse, lookbackApplyViewPulse, LOOKBACK_APPLY_VIEW_PULSE_MS } from "../src/lib/level4/roe-lookback";
import { lookbackCopyLinkKey, parseLookbackViewSnapshot, applyLookbackViewSnapshot, lookbackApplyViewToast, lookbackApplyViewKey, lookbackCopyViewKey, lookbackViewSnapshot, lookbackViewSnapshotJson, lookbackCopyViewToast, lookbackCopyViewShouldPulse, lookbackCopyViewPulse, LOOKBACK_VIEW_SNAPSHOT_SCHEMA, LOOKBACK_COPY_VIEW_PULSE_MS, lookbackResetViewKey, clearLookbackViewSession, lookbackResetViewToast, LOOKBACK_RESET_VIEW_KEYS, LOOKBACK_RESET_VIEW_DEFAULTS, LOOKBACK_FOCUS_KEY, readLookbackFocus, writeLookbackFocus, resolveLookbackFocus, LOOKBACK_EXPAND_ALL_KEY, readLookbackExpandAll, writeLookbackExpandAll, LOOKBACK_SHOW_FILTER_KEY, LOOKBACK_SORT_MODE_KEY, readLookbackViewState, writeLookbackViewState, LOOKBACK_JUMPS_HIDDEN, lookbackJumpsChip, lookbackJumpsToggle, lookbackJumpsPulse, LOOKBACK_JUMPS_PULSE_MS, LOOKBACK_PACKS_HIDDEN, lookbackPacksChip, lookbackPacksToggle, lookbackPacksPulse, LOOKBACK_PACKS_PULSE_MS, lookbackMinPhiJumpChip, lookbackMinPhiJumpChanged, lookbackMinPhiJumpPulse, LOOKBACK_MIN_PHI_JUMP_PULSE_MS, lookbackMaxGapJumpChip, lookbackMaxGapJumpChanged, lookbackMaxGapJumpPulse, LOOKBACK_MAX_GAP_JUMP_PULSE_MS, lookbackGapsJson, lookbackCopyGapsChip, lookbackVerdictJson, lookbackCopyVerdictChip, lookbackRolesJson, lookbackCopyRolesChip, lookbackAllStepsJson, lookbackCopyAllStepsChip, pathStepsJson as _pathStepsJsonAll, lookbackAllPathsJson, lookbackCopyAllPathsChip, lookbackAgreeJumpChip, lookbackAgreeJumpChanged, lookbackAgreeJumpPulse, LOOKBACK_AGREE_JUMP_PULSE_MS, lookbackWinnersJumpChip, lookbackWinnersJumpChanged, lookbackWinnersJumpPulse, LOOKBACK_WINNERS_JUMP_PULSE_MS, lookbackBeatenJumpChip, lookbackBeatenJumpChanged, lookbackBeatenJumpPulse, LOOKBACK_BEATEN_JUMP_PULSE_MS, lookbackCopySummaryChip, lookbackExpandAllChip, lookbackExpandAllKey, lookbackStripToggleKey, lookbackExpandAllShouldPulse, lookbackThirdStepsJson, lookbackCopyThirdStepsChip, lookbackCopyThirdStepsKey, lookbackRunnerUpStepsJson, lookbackCopyRunnerUpStepsChip, lookbackCopyRunnerUpStepsKey, lookbackThirdPathJson, lookbackCopyThirdKey, lookbackCopyThirdChip, lookbackRunnerUpPathJson, lookbackCopyRunnerUpKey, lookbackCopyRunnerUpChip, lookbackCopyFocusStepsKey, lookbackCopyFocusStepsChip, lookbackCopyFocusChip, lookbackCopyGreedyStepsKey, lookbackGreedyStepsJson, lookbackCopyGreedyStepsChip, lookbackCopyLastStepsKey, lookbackLastStepsJson, lookbackCopyLastStepsChip, lookbackCopyTopStepsKey, lookbackTopStepsJson, lookbackCopyTopStepsChip, lookbackSummaryButtonToast, lookbackKeyToastDeferred, lookbackCopyChipToast, lookbackCompareChipToast, lookbackCopyCompareChip, lookbackGreedyPathJson, lookbackCopyGreedyKey, lookbackCopyGreedyChip, lookbackCopyChipShouldPulse, lookbackCopyChipPulse, LOOKBACK_COPY_TOP_LAST_PULSE_MS, lookbackCopyTopChip, lookbackCopyLastChip, lookbackLastPathJson, lookbackCopyLastKey, lookbackTopPathJson, lookbackCopyTopKey, lookbackFirstUpPulse, lookbackFirstUpShouldPulse, lookbackFirstUpChipChanged, lookbackLastChipChanged, LOOKBACK_FIRST_UP_PULSE_MS, lookbackLastPulse, lookbackLastShouldPulse, LOOKBACK_LAST_PULSE_MS, lookbackLastChip, lookbackFirstUpChip, lookbackLastKey, lookbackLastFocusTarget, lookbackPilotPulse, LOOKBACK_PILOT_PULSE_MS, lookbackAgreeKey, lookbackWinnersKey, lookbackBeatenKey, lookbackBeatenPulse, lookbackBeatenShouldPulse, LOOKBACK_BEATEN_PULSE_MS, lookbackCopyRecentKey, lookbackClearRecentKey, lookbackClearToastsKey, lookbackShowAllChip, lookbackShowAllPulse, lookbackShowAllShouldPulse, LOOKBACK_SHOW_ALL_PULSE_MS, lookbackShowAllKey, lookbackGreedyKey, lookbackGreedyChip, lookbackGreedyChipPulse, lookbackGreedyChipShouldPulse, LOOKBACK_GREEDY_CHIP_PULSE_MS, lookbackFirstChip, lookbackSecondChip, lookbackThirdChip, lookbackThirdPulse, lookbackThirdShouldPulse, LOOKBACK_THIRD_PULSE_MS, lookbackThirdKey, lookbackThirdFocusTarget, lookbackTopKey, lookbackRunnerUpKey, lookbackRunnerUpPulse, lookbackRunnerUpShouldPulse, LOOKBACK_RUNNER_UP_PULSE_MS, lookbackVerdictKey, lookbackVerdictFilterPulse, lookbackVerdictFilterShouldPulse, LOOKBACK_VERDICT_FILTER_PULSE_MS, lookbackVerdictFilterChip, lookbackBeatenChip, lookbackCopyRecentPulse, LOOKBACK_COPY_RECENT_PULSE_MS, lookbackCopyRecentChip, lookbackRecentChip, lookbackToastsChip, lookbackCheatsheetChip, lookbackExpandedChip, lookbackFocusChip, lookbackShowChip, lookbackSortChip, lookbackShownChip, lookbackSealedPathsChip, lookbackPhiGapChip, lookbackRunnerUpLeadChip, lookbackToastClickAction, lookbackStepsDeltaTargets, LOOKBACK_DELTA_GREEDY_SCROLL_MS, lookbackGreedyFocusTarget, lookbackTopFocusTarget, lookbackTopSteps, lookbackGreedySteps, lookbackStepsDelta, lookbackHelpPulse, LOOKBACK_HELP_PULSE_MS, lookbackFocusPulse, LOOKBACK_FOCUS_PULSE_MS, lookbackExpandPulse, LOOKBACK_EXPAND_PULSE_MS, lookbackSortPulse, LOOKBACK_SORT_PULSE_MS, lookbackFilterPulse, LOOKBACK_FILTER_PULSE_MS, lookbackSummaryCopyPulse, LOOKBACK_SUMMARY_COPY_PULSE_MS, lookbackSummaryCopiedPulse, LOOKBACK_SUMMARY_COPIED_PULSE_MS, lookbackPathCopiedPulse, LOOKBACK_PATH_COPIED_PULSE_MS, lookbackStepsCopiedPulse, LOOKBACK_STEPS_COPIED_PULSE_MS, lookbackComparePulse, LOOKBACK_COMPARE_PULSE_MS, lookbackCompareCopyPulse, LOOKBACK_COMPARE_COPY_PULSE_MS, lookbackTopPulse, LOOKBACK_TOP_PULSE_MS, lookbackWinPulse, LOOKBACK_WIN_PULSE_MS, lookbackCopyAllLabel, restoreLookbackToast, lookbackToastPillLabel, LOOKBACK_TOAST_PILL_COPIED_MS, clearLookbackToastHistory, lookbackToastHistoryJson, removeLookbackToastHistoryEntry, pushLookbackToastHistory, dismissedLookbackToastHistory, LOOKBACK_TOAST_HISTORY_MAX, lookbackToastCopyText, lookbackToastDurationMs, lookbackToastExpiry, lookbackToastsAfterLeave, LOOKBACK_TOAST_LEAVE_GRACE_MS, dismissLookbackToast, clearAllLookbackToasts, showClearAllLookbackToasts, lookbackEscTarget, lookbackEscToast, LOOKBACK_ESC_ORDER, lookbackToastStack, LOOKBACK_TOAST_ORDER, lookbackAgreeToast, lookbackWinToast, WIN_TOAST_MS, emptyFilterToast, EMPTY_FILTER_TOAST_MS, lookbackKeyChanges, lookbackToastText, LOOKBACK_TOAST_MS, LOOKBACK_KEYMAP, toggleLookbackSort, cycleRoleFilter, ROLE_FILTER_CYCLE, lookbackKey, moveLookbackFocus, toggleRoleFilter, lookbackSummaryJson, lookbackDeltaECopiesSummary, lookbackSummary, lookbackVerdictCopiesCompare, pathStepsJson, pathStepsDetail, sparklinePoints, stepGains, lookbackComparePack, filterLookbackRows, lookbackRowRole, lookbackPathJson, sortLookbackRows, fmtDeltaPhi, lookbackRowEmphasis, rankedLookbackRows, lookbackVerdict, scoreSealedPaths, ROE_LOOKBACK_SCHEMA, ROE_LOOKBACK_NOTE , readLookbackStripState, writeLookbackStripState, LOOKBACK_PACKS_OPEN_KEY, LOOKBACK_JUMPS_OPEN_KEY } from "../src/lib/level4/roe-lookback";

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
{ const vu = "https://x.test/workbench/status?lb_show=winners&lb_packs=1"; assert.equal(JSON.parse(lookbackComparePack(c, vu)).view_url, vu);
  for (const bad of [null, undefined, "", "javascript:x", "/rel"]) assert.equal(lookbackComparePack(c, bad as never), lookbackComparePack(c), "no view_url = unchanged compare pack");
  console.log("compare     -> optional view_url (shareable lb_* link); absent when not http(s)"); }
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
{ const vu = "https://x.test/workbench/status?lb_show=winners"; assert.equal(JSON.parse(lookbackSummaryJson(c, vu)).view_url, vu);
  for (const bad of [null, undefined, "", "javascript:x", "/rel"]) assert.equal(lookbackSummaryJson(c, bad as never), lookbackSummaryJson(c), "no view_url = unchanged summary");
  console.log("summary     -> optional view_url (shareable lb_* link); absent when not http(s)"); }
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
for (const row of LOOKBACK_KEYMAP) for (const k of row.key.split(" / ")) assert.ok(lookbackCopyLinkKey({ key: k, targetTag: "TR" }) || lookbackApplyViewKey({ key: k, targetTag: "TR" }) || lookbackCopyViewKey({ key: k, targetTag: "TR" }) || lookbackResetViewKey({ key: k, targetTag: "TR" }) || lookbackStripToggleKey({ key: k, targetTag: "TR" }) !== null || lookbackExpandAllKey({ key: k, targetTag: "TR" }, 2) || lookbackKey({ key: k, targetTag: "TR" }) || lookbackVerdictKey({ key: k, targetTag: "TR" }, "lookback", "all") || lookbackBeatenKey({ key: k, targetTag: "TR" }, 2, "all") || lookbackRunnerUpKey({ key: k, targetTag: "TR" }, "p2", null) || lookbackTopKey({ key: k, targetTag: "TR" }, "p1", null) || lookbackThirdKey({ key: k, targetTag: "TR" }, "p3", null) || lookbackGreedyKey({ key: k, targetTag: "TR" }, "pg", null) || lookbackShowAllKey({ key: k, targetTag: "TR" }, "winner") || lookbackClearToastsKey({ key: k, targetTag: "TR" }, 1) || lookbackClearRecentKey({ key: k, targetTag: "TR" }, 1) || lookbackWinnersKey({ key: k, targetTag: "TR" }, 1, "all") || lookbackAgreeKey({ key: k, targetTag: "TR" }, 1, "all") || lookbackCopyRecentKey({ key: k, targetTag: "TR" }, 1) || lookbackLastKey({ key: k, targetTag: "TR" }, "pz", null) || lookbackCopyTopKey({ key: k, targetTag: "TR" }, "{}") || lookbackCopyLastKey({ key: k, targetTag: "TR" }, "{}") || lookbackCopyGreedyKey({ key: k, targetTag: "TR" }, "{}") || lookbackCopyTopStepsKey({ key: k, targetTag: "TR" }, "{}") || lookbackCopyLastStepsKey({ key: k, targetTag: "TR" }, "{}") || lookbackCopyGreedyStepsKey({ key: k, targetTag: "TR" }, "{}") || lookbackCopyRunnerUpKey({ key: k, targetTag: "TR" }, "{}") || lookbackCopyThirdKey({ key: k, targetTag: "TR" }, "{}") || lookbackCopyFocusStepsKey({ key: k, targetTag: "TR" }, "p1", "[]") || lookbackCopyRunnerUpStepsKey({ key: k, targetTag: "TR" }, "[]") || lookbackCopyThirdStepsKey({ key: k, targetTag: "TR" }, "[]"), `sheet key ${k} is live`);
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
// Esc collapses ⊞ Expand all after sheet + toasts, before the single row.
assert.equal(lookbackEscTarget(true, 1, "a", true), "help"); assert.equal(lookbackEscTarget(false, 1, "a", true), "toasts"); assert.equal(lookbackEscTarget(false, 0, "a", true), "all"); assert.equal(lookbackEscTarget(false, 0, null, true), "all"); assert.equal(lookbackEscTarget(false, 0, "a", false), "row"); assert.equal(lookbackEscTarget(false, 0, null, "yes"), null);
assert.ok(LOOKBACK_KEYMAP.some((r) => r.key === "Escape" && /Expand all/.test(r.does)), "cheat sheet documents Esc collapse-all");
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
  assert.equal(showClearAllLookbackToasts(st.slice(0, 1)), true, "single toast: Clear all (same as d)");
  assert.equal(showClearAllLookbackToasts([]), false); assert.equal(showClearAllLookbackToasts(null), false);
  const hist = pushLookbackToastHistory([], st);
  assert.equal(dismissedLookbackToastHistory(hist, r.stack).length, 3, "cleared toasts land in Recent toasts");
}
console.log("clear all -> with 1+ stacked look-back top toasts a ✕ Clear all N (Esc) control dismisses them at once; Recent toasts kept");
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

{ assert.equal(lookbackShownChip("all", 2, 4), null); assert.equal(lookbackShownChip("bogus", 1, 4), null); assert.equal(lookbackShownChip("winners", 1, 0), null);
  assert.deepEqual(lookbackShownChip("winners", 1, 4), { shown: 1, total: 4, label: "1 of 4 shown" });
  assert.deepEqual(lookbackShownChip("beaten", 0, 3), { shown: 0, total: 3, label: "0 of 3 shown" });
  assert.deepEqual(lookbackShownChip("agree", 9, 3)?.shown, 3); assert.equal(lookbackShownChip("agree", NaN, 3)?.shown, 0);
  console.log("ok lookbackShownChip"); }

{ assert.deepEqual(lookbackSortChip("rank"), { sort: "rank", label: "sort: rank", next: "dphi" });
  assert.deepEqual(lookbackSortChip("dphi"), { sort: "dphi", label: "sort: ΔΦ", next: "rank" });
  assert.equal(lookbackSortChip("bogus").sort, "rank"); assert.equal(lookbackSortChip(undefined).next, toggleLookbackSort("rank"));
  assert.equal(lookbackSortChip(lookbackSortChip("rank").next).next, "rank");
  console.log("ok lookbackSortChip"); }

{ assert.deepEqual(lookbackShowChip("all"), { filter: "all", label: "show: All", next: cycleRoleFilter("all") });
  assert.equal(lookbackShowChip("winners").label, "show: Winners"); assert.equal(lookbackShowChip("beaten").label, "show: Beaten");
  assert.equal(lookbackShowChip("agree").label, "show: Agree"); assert.equal(lookbackShowChip("bogus").filter, "all");
  let f: unknown = "all"; const seen = new Set<string>(); for (let i = 0; i < ROLE_FILTER_CYCLE.length; i++) { seen.add(lookbackShowChip(f).filter); f = lookbackShowChip(f).next; }
  assert.equal(f, "all"); assert.equal(seen.size, ROLE_FILTER_CYCLE.length);
  console.log("ok lookbackShowChip"); }

{ const F = lookbackFocusChip; const rs = [{ run_id: "r1", rank: 1 }, { run_id: "r2", rank: 2 }];
  assert.deepEqual(F(rs, "r2"), { show: true, label: "focus: #2 r2 ↓", id: "r2", jump: "r2" });
  assert.deepEqual(F(rs, null), { show: true, label: "focus: — (j) ↓", id: null, jump: "r1" }); assert.equal(F(rs, "zz").jump, "r1");
  assert.equal(F([{ run_id: "x" }], "x").label, "focus: #1 x ↓"); assert.equal(F([], "r1").show, false); assert.equal(F(null, "r1").show, false); assert.equal(F([7, null], "a").show, false); console.log("lookbackFocusChip OK"); }

{ const E = lookbackExpandedChip; const rs = [{ run_id: "r1", rank: 1 }, { run_id: "r2", rank: 2 }];
  assert.deepEqual(E(rs, "r2"), { show: true, label: "expanded: #2 r2 ✕", id: "r2" });
  assert.equal(E(rs, null).show, false); assert.equal(E(rs, "zz").show, false); assert.equal(E(rs, "").show, false);
  assert.equal(E([{ run_id: "x" }], "x").label, "expanded: #1 x ✕"); assert.equal(E(null, "r1").show, false); assert.equal(E([7, null], "a").show, false); console.log("lookbackExpandedChip OK"); }

{ const T = lookbackToastsChip; assert.deepEqual(T([]), { show: false, label: "", clearable: false }); assert.deepEqual(T(null), { show: false, label: "", clearable: false }); assert.deepEqual(T([1]), { show: true, label: "1 toast ✕", clearable: true }); assert.deepEqual(T([1,2]), { show: true, label: "2 toasts ✕", clearable: true }); }
{ const R = lookbackRecentChip; assert.deepEqual(R([]), { show: false, label: "" }); assert.deepEqual(R(null), { show: false, label: "" }); assert.deepEqual(R([1]), { show: true, label: "1 recent ✕" }); assert.deepEqual(R([1,2,3]), { show: true, label: "3 recent ✕" }); console.log("lookbackRecentChip OK"); }
{ const K = lookbackCheatsheetChip; assert.deepEqual(K(true), { show: true, label: "keys open ✕" }); assert.deepEqual(K(false), { show: false, label: "" });
  assert.equal(K(1).show, false); assert.equal(K("true").show, false); assert.equal(K(null).show, false); console.log("lookbackCheatsheetChip OK"); }

{ const C = lookbackCopyRecentChip; assert.deepEqual(C([], null, 0), { show: false, label: "", copied: false }); assert.deepEqual(C(null, 5, 5), { show: false, label: "", copied: false });
  assert.deepEqual(C([1], null, 0), { show: true, label: "⧉ Copy recent", copied: false }); assert.deepEqual(C([1,2], 1000, 1000), { show: true, label: "✓ Copied", copied: true });
  assert.equal(C([1], 1000, 1000 + LOOKBACK_TOAST_PILL_COPIED_MS).label, "⧉ Copy recent"); assert.equal(C([1], 1000, 999).label, "⧉ Copy recent"); assert.equal(C([1], NaN, 1).label, "⧉ Copy recent"); console.log("lookbackCopyRecentChip OK"); }

{ const P = lookbackCopyRecentPulse, M = LOOKBACK_COPY_RECENT_PULSE_MS; assert.equal(M, 2400); assert.equal(P(null, 5), false); assert.equal(P(1000, 1000), true); assert.equal(P(1000, 1000 + M - 1), true);
  assert.equal(P(1000, 1000 + M), false); assert.equal(P(1000, 999), false); assert.equal(P(NaN, 1), false); assert.equal(P("1", 1), false); console.log("lookbackCopyRecentPulse OK"); }

{ const V = lookbackVerdictFilterChip;
  assert.deepEqual(V("lookback", "all"), { show: true, label: "look-back wins → ★", target: "winners", active: false, next: "winners" });
  assert.deepEqual(V("lookback", "winners"), { show: true, label: "look-back wins → ★ ✓", target: "winners", active: true, next: "all" });
  assert.equal(V("lookback", "agree").next, "winners");
  assert.deepEqual(V("agree", "bogus"), { show: true, label: "agree → =", target: "agree", active: false, next: "agree" });
  assert.equal(V("agree", "agree").next, "all"); assert.equal(V("none", "all").show, false); assert.equal(V(undefined, "x").show, false);
  console.log("lookbackVerdictFilterChip OK"); }
{ const P = lookbackVerdictFilterPulse, M = LOOKBACK_VERDICT_FILTER_PULSE_MS; assert.equal(M, 2400); assert.equal(P(null, 5), false); assert.equal(P(1000, 1000), true); assert.equal(P(1000, 1000 + M - 1), true); assert.equal(P(1000, 1000 + M), false); assert.equal(P(1000, 999), false); assert.equal(P(NaN, 1), false);
  const S = lookbackVerdictFilterShouldPulse; assert.equal(S(false, "all", "winners"), true); assert.equal(S(false, "agree", "agree"), false); assert.equal(S(true, "all", "winners"), false); assert.equal(S(false, "all", undefined), false); console.log("lookbackVerdictFilterPulse OK"); }
{ const vk = lookbackVerdictKey({ key: "v" }, "lookback", "all"); if (vk && vk.changed) { assert.equal(lookbackVerdictFilterShouldPulse(false, "all", vk.next), true); assert.equal(lookbackVerdictFilterShouldPulse(true, "all", vk.next), false); } const back = lookbackVerdictKey({ key: "v" }, "lookback", "winners"); if (back && back.changed) assert.equal(lookbackVerdictFilterShouldPulse(false, "winners", back.next), back.next !== "winners"); console.log("v key → verdict-filter pulse OK"); }

{ const K = lookbackVerdictKey;
  assert.deepEqual(K({ key: "v" }, "lookback", "all"), { next: "winners", changed: true, toast: "v → Show: ★ Winners (look-back wins)" });
  assert.deepEqual(K({ key: "V" }, "lookback", "winners"), { next: "all", changed: true, toast: "v → Show: All" });
  assert.deepEqual(K({ key: "v" }, "agree", "beaten"), { next: "agree", changed: true, toast: "v → Show: = Agree" });
  assert.equal(K({ key: "v" }, "none", "all"), null); assert.equal(K({ key: "v" }, undefined, "all"), null);
  assert.equal(K({ key: "v", ctrlKey: true }, "lookback", "all"), null); assert.equal(K({ key: "v", targetTag: "input" }, "lookback", "all"), null);
  assert.equal(K({ key: "x" }, "lookback", "all"), null); assert.equal(K(null, "lookback", "all"), null);
  assert.ok(LOOKBACK_KEYMAP.some((k) => k.key === "v")); console.log("lookbackVerdictKey OK"); }

{ assert.equal(lookbackRunnerUpLeadChip(null), null);
  const P = (run_id: string, e: number) => ({ run_id, cumulative_delta_e: e, final_phi: 1, steps: 2 } as any);
  assert.equal(lookbackRunnerUpLeadChip({ paths: [P("a", 1)] } as any), null);
  const a = lookbackRunnerUpLeadChip({ paths: [P("b", 0.5), P("a", 0.62)] } as any)!; assert.equal(a.label, "lead +0.12 over #2"); assert.equal(a.runner_up, "b"); assert.equal(a.tie, false);
  const t = lookbackRunnerUpLeadChip({ paths: [P("a", 0.5), P("b", 0.5)] } as any)!; assert.equal(t.tie, true); assert.equal(t.label, "tie with #2");
  console.log("ok lookbackRunnerUpLeadChip"); }

{ const P = lookbackRunnerUpPulse, M = LOOKBACK_RUNNER_UP_PULSE_MS; assert.equal(M, 2400); assert.equal(P(null, 5), false); assert.equal(P(1000, 1000), true); assert.equal(P(1000, 1000 + M - 1), true); assert.equal(P(1000, 1000 + M), false); assert.equal(P(1000, 999), false); assert.equal(P(NaN, 1), false);
  const S = lookbackRunnerUpShouldPulse; assert.equal(S(false, "p2"), true); assert.equal(S(true, "p2"), false); assert.equal(S(false, ""), false); assert.equal(S(false, null), false); console.log("lookbackRunnerUpPulse OK"); }

{ const K = lookbackRunnerUpKey, E = { key: "2" };
  assert.equal(K(null, "b", null), null); assert.equal(K({ key: "1" }, "b", null), null); assert.equal(K(E, null, null), null); assert.equal(K(E, "", null), null);
  assert.equal(K({ key: "2", ctrlKey: true }, "b", null), null); assert.equal(K({ key: "2", targetTag: "textarea" }, "b", null), null); assert.equal(K({ key: "2", editable: true }, "b", null), null);
  const a = K(E, "b", { filter: "winners", focus: null, open: null })!; assert.equal(a.target, "b"); assert.equal(a.changed, true); assert.equal(a.toast, "2 → runner-up (#2)");
  const n = K(E, "b", { filter: "all", focus: "b", open: "b" })!; assert.equal(n.changed, false); assert.equal(n.toast, null);
  assert.ok(LOOKBACK_KEYMAP.some((x: any) => x.key === "2")); console.log("lookbackRunnerUpKey OK"); }

{ const K = lookbackTopKey, E = { key: "1" };
  assert.equal(K(null, "a", null), null); assert.equal(K({ key: "2" }, "a", null), null); assert.equal(K(E, null, null), null); assert.equal(K(E, "", null), null);
  assert.equal(K({ key: "1", metaKey: true }, "a", null), null); assert.equal(K({ key: "1", targetTag: "input" }, "a", null), null); assert.equal(K({ key: "1", editable: true }, "a", null), null);
  const a = K(E, "a", { filter: "beaten", focus: "b", open: null })!; assert.equal(a.target, "a"); assert.equal(a.changed, true); assert.equal(a.toast, "1 → TOP (#1)");
  const n = K(E, "a", { filter: "all", focus: "a", open: "a" })!; assert.equal(n.changed, false); assert.equal(n.toast, null);
  assert.ok(LOOKBACK_KEYMAP.some((x: any) => x.key === "1")); console.log("lookbackTopKey OK"); }

{ const K = lookbackThirdKey, E = { key: "3" };
  assert.equal(K(null, "a", null), null); assert.equal(K({ key: "1" }, "a", null), null); assert.equal(K(E, null, null), null);
  assert.equal(K({ key: "3", ctrlKey: true }, "a", null), null); assert.equal(K({ key: "3", targetTag: "textarea" }, "a", null), null); assert.equal(K({ key: "3", editable: true }, "a", null), null);
  const a = K(E, "c", { filter: "winners", focus: "a", open: null })!; assert.equal(a.target, "c"); assert.equal(a.changed, true); assert.equal(a.toast, "3 → path #3");
  const n = K(E, "c", { filter: "all", focus: "c", open: "c" })!; assert.equal(n.changed, false); assert.equal(n.toast, null);
  assert.equal(lookbackThirdFocusTarget(null), null); assert.equal(lookbackThirdFocusTarget({} as any), null);
  assert.ok(LOOKBACK_KEYMAP.some((x: any) => x.key === "3")); console.log("lookbackThirdKey OK (no-op <3 paths)"); }

{ assert.equal(lookbackThirdChip(null), null); assert.equal(lookbackThirdChip({} as any), null);
  const P = lookbackThirdPulse, M = LOOKBACK_THIRD_PULSE_MS; assert.equal(P(null, 1), false); assert.equal(P(10, 10), true); assert.equal(P(10, 10 + M), false); assert.equal(P(10, 9), false);
  const S = lookbackThirdShouldPulse; assert.equal(S(false, "p3"), true); assert.equal(S(true, "p3"), false); assert.equal(S(false, null), false); console.log("lookbackThirdChip/Pulse OK"); }

{ assert.equal(lookbackSecondChip(null), null); assert.equal(lookbackSecondChip({} as any), null);
  console.log("lookbackSecondChip OK (null <2 paths; shares runner-up pulse)"); }

{ assert.equal(lookbackFirstChip(null), null); assert.equal(lookbackFirstChip({} as any), null);
  console.log("lookbackFirstChip OK (null with no paths; reuses TOP badge pulse)"); }

{ assert.equal(lookbackGreedyChip(null), null); assert.equal(lookbackGreedyChip({} as any), null); assert.equal(lookbackGreedyChip(scoreSealedPaths([])), null);
  const P = lookbackGreedyChipPulse, M = LOOKBACK_GREEDY_CHIP_PULSE_MS; assert.equal(P(null, 1), false); assert.equal(P(10, 10), true); assert.equal(P(10, 10 + M), false); assert.equal(P(10, 9), false);
  const S = lookbackGreedyChipShouldPulse; assert.equal(S(false, "g"), true); assert.equal(S(true, "g"), false); assert.equal(S(false, null), false); console.log("lookbackGreedyChip/Pulse OK"); }

{ const K = lookbackGreedyKey, E = { key: "q" };
  assert.equal(K(null, "g", null), null); assert.equal(K({ key: "3" }, "g", null), null); assert.equal(K(E, null, null), null); assert.equal(K(E, "", null), null);
  assert.equal(K({ key: "q", metaKey: true }, "g", null), null); assert.equal(K({ key: "q", targetTag: "input" }, "g", null), null); assert.equal(K({ key: "q", editable: true }, "g", null), null);
  const a = K(E, "g", { filter: "winners", focus: "a", open: null })!; assert.equal(a.target, "g"); assert.equal(a.changed, true); assert.equal(a.toast, "q → greedy path");
  const n = K(E, "g", { filter: "all", focus: "g", open: "g" })!; assert.equal(n.changed, false); assert.equal(n.toast, null);
  assert.equal(lookbackGreedyChipShouldPulse(false, a.target), true); assert.equal(lookbackGreedyChipShouldPulse(true, a.target), false);
  assert.ok(LOOKBACK_KEYMAP.some((x: any) => x.key === "q")); console.log("lookbackGreedyKey OK"); }

{ const K = lookbackShowAllKey, E = { key: "a" };
  assert.deepEqual(K(E, "winner"), { next: "all", changed: true, toast: "a → Show All" });
  assert.deepEqual(K(E, "all"), { next: "all", changed: false, toast: null }, "already All: no toast");
  assert.equal(K(E, undefined)!.changed, false);
  for (const j of [{ key: "a", ctrlKey: true }, { key: "a", metaKey: true }, { key: "a", altKey: true }, { key: "a", targetTag: "input" }, { key: "a", targetTag: "TEXTAREA" }, { key: "a", editable: true }, { key: "A" }, { key: "b" }, null]) assert.equal(K(j as never, "winner"), null);
  assert.ok(LOOKBACK_KEYMAP.some((x: any) => x.key === "a")); console.log("lookbackShowAllKey OK"); }

{ const M = LOOKBACK_SHOW_ALL_PULSE_MS; assert.equal(M, 2400); assert.equal(lookbackShowAllPulse(null, 5), false); assert.equal(lookbackShowAllPulse(1000, 1000), true); assert.equal(lookbackShowAllPulse(1000, 1000 + M - 1), true); assert.equal(lookbackShowAllPulse(1000, 1000 + M), false); assert.equal(lookbackShowAllPulse(1000, 999), false); assert.equal(lookbackShowAllPulse(NaN, 1000), false);
  assert.equal(lookbackShowAllShouldPulse(false, true), true); assert.equal(lookbackShowAllShouldPulse(true, true), false); assert.equal(lookbackShowAllShouldPulse(false, false), false); assert.equal(lookbackShowAllShouldPulse(false, "x"), false); console.log("lookbackShowAllPulse OK"); }

{ assert.equal(lookbackShowAllChip("winner").show, true); assert.equal(lookbackShowAllChip("all").show, false); assert.equal(lookbackShowAllChip(null).show, false); assert.equal(lookbackShowAllChip("agree").label, "All ✕"); assert.equal(lookbackShowAllChip("x").next, "all");
  const src = require("fs").readFileSync(require("path").join(__dirname, "../src/components/RoeLookbackNote.tsx"), "utf8") as string; const l = src.split("\n").find((x) => x.includes("data-roe-show-all-chip")) ?? ""; assert.ok(l.includes("lookbackShowAllShouldPulse") && l.includes('setRoleFilter("all")')); console.log("lookbackShowAllChip OK"); }

{ const K = lookbackClearToastsKey;
  assert.deepEqual(K({ key: "d" }, 2), { changed: true, cleared: 2, toast: "d → cleared 2 toasts" });
  assert.equal(K({ key: "d" }, 1)!.toast, "d → cleared 1 toast");
  assert.deepEqual(K({ key: "d" }, 0), { changed: false, cleared: 0, toast: null }, "none showing: no-op, no toast");
  assert.equal(K({ key: "d" }, NaN)!.changed, false); assert.equal(K({ key: "d" }, "3" as never)!.changed, false);
  for (const j of [{ key: "d", ctrlKey: true }, { key: "d", metaKey: true }, { key: "d", altKey: true }, { key: "d", targetTag: "input" }, { key: "d", targetTag: "TEXTAREA" }, { key: "d", editable: true }, { key: "D" }, { key: "x" }, null]) assert.equal(K(j as never, 2), null);
  assert.ok(LOOKBACK_KEYMAP.some((x: any) => x.key === "d")); console.log("lookbackClearToastsKey OK"); }

{ const K = lookbackClearRecentKey;
  assert.deepEqual(K({ key: "e" }, 3), { changed: true, cleared: 3, toast: "e → cleared 3 recent toasts" });
  assert.equal(K({ key: "e" }, 1)!.toast, "e → cleared 1 recent toast");
  assert.deepEqual(K({ key: "e" }, 0), { changed: false, cleared: 0, toast: null });
  assert.equal(K({ key: "e" }, NaN)!.changed, false);
  for (const j of [{ key: "e", ctrlKey: true }, { key: "e", metaKey: true }, { key: "e", altKey: true }, { key: "e", targetTag: "input" }, { key: "e", editable: true }, { key: "E" }, { key: "d" }, null]) assert.equal(K(j as never, 2), null);
  assert.ok(LOOKBACK_KEYMAP.some((x: any) => x.key === "e"));
  const src = require("fs").readFileSync(require("path").join(__dirname, "../src/components/RoeLookbackNote.tsx"), "utf8") as string; assert.ok(src.includes("clearRecentKeyRef.current.clear = () => setToastHist((h) => clearLookbackToastHistory(h, topStack))")); console.log("lookbackClearRecentKey OK"); }

{ const K = lookbackCopyRecentKey;
  assert.deepEqual(K({ key: "p", targetTag: "TR" }, 2), { changed: true, copied: 2, toast: "p → copied 2 recent toasts JSON" });
  assert.deepEqual(K({ key: "p" }, 1), { changed: true, copied: 1, toast: "p → copied 1 recent toast JSON" });
  assert.deepEqual(K({ key: "p" }, 0), { changed: false, copied: 0, toast: null });
  assert.equal(K({ key: "p", metaKey: true }, 2), null); assert.equal(K({ key: "p", targetTag: "textarea" }, 2), null); assert.equal(K({ key: "p", editable: true }, 2), null);
  assert.equal(K({ key: "e" }, 2), null); assert.equal(K(null, 2), null); assert.equal(K({ key: "p" }, NaN)?.changed, false);
  assert.ok(LOOKBACK_KEYMAP.some((r) => r.key === "p")); assert.equal(LOOKBACK_KEYMAP.filter((r) => r.key === "p").length, 1);
  const src = require("fs").readFileSync(require("path").join(__dirname, "../src/components/RoeLookbackNote.tsx"), "utf8") as string; assert.ok(src.includes("copyRecentKeyRef.current.copy = (txt: string)")); assert.ok(src.includes("setCopyRecentPulseAt((p) => p ?? at); window.setTimeout(() => setCopyRecentAt((x) => (x === at ? null : x)), LOOKBACK_TOAST_PILL_COPIED_MS); setToast({ txt, at })"));
  console.log("lookbackCopyRecentKey OK"); }
{ const B = lookbackBeatenChip; assert.equal(B(0, "all").show, false); assert.equal(B(NaN, "all").show, false); assert.equal(B("x", "beaten").next, "beaten");
  assert.deepEqual(B(2, "all"), { show: true, label: "2 beaten", active: false, next: "beaten" }); assert.deepEqual(B(1, "beaten"), { show: true, label: "1 beaten ✓", active: true, next: "all" });
  assert.equal(B(1, "winners").next, "beaten"); assert.equal(B(lookbackSummary(c).beaten, "all").show, true); assert.equal(B(lookbackSummary(same).beaten, "all").show, false); console.log("lookbackBeatenChip OK"); }

{ const P = lookbackBeatenPulse, M = LOOKBACK_BEATEN_PULSE_MS; assert.equal(M, 2400); assert.equal(P(null, 5), false); assert.equal(P(1000, 1000), true); assert.equal(P(1000, 1000 + M - 1), true); assert.equal(P(1000, 1000 + M), false); assert.equal(P(1000, 999), false); assert.equal(P(NaN, 1), false);
  const S = lookbackBeatenShouldPulse; assert.equal(S(false, "all", "beaten"), true); assert.equal(S(false, "beaten", "beaten"), false); assert.equal(S(true, "all", "beaten"), false); assert.equal(S(false, "all", undefined), false); console.log("lookbackBeatenPulse OK"); }
{ const K = lookbackBeatenKey;
  assert.deepEqual(K({ key: "b" }, 2, "all"), { next: "beaten", changed: true, toast: "b → Show: Beaten" });
  assert.deepEqual(K({ key: "B" }, 2, "beaten"), { next: "all", changed: true, toast: "b → Show: All" });
  assert.deepEqual(K({ key: "b" }, 1, "winners"), { next: "beaten", changed: true, toast: "b → Show: Beaten" });
  assert.equal(K({ key: "b" }, 0, "all"), null); assert.equal(K({ key: "b" }, NaN, "all"), null);
  assert.equal(K({ key: "b", metaKey: true }, 2, "all"), null); assert.equal(K({ key: "b", targetTag: "textarea" }, 2, "all"), null); assert.equal(K({ key: "b", editable: true }, 2, "all"), null);
  assert.equal(K({ key: "x" }, 2, "all"), null); assert.equal(K(null, 2, "all"), null);
  const bk = K({ key: "b" }, 2, "all")!; assert.equal(bk.next, lookbackBeatenChip(2, "all").next); assert.equal(lookbackBeatenShouldPulse(false, "all", bk.next), true);
  assert.ok(LOOKBACK_KEYMAP.some((k) => k.key === "b")); console.log("lookbackBeatenKey OK (b shares chip next + pulse; effective-only toast; ? sheet)"); }

{ const { lookbackWinnersChip: W, lookbackWinnersPulse: P, lookbackWinnersShouldPulse: S, lookbackWinnersKey: K, LOOKBACK_WINNERS_PULSE_MS: M } = require("../src/lib/level4/roe-lookback");
  assert.equal(W(0, "all").show, false); assert.equal(W(NaN, "all").show, false);
  assert.deepEqual(W(2, "all"), { show: true, label: "2 winners", active: false, next: "winners" }); assert.deepEqual(W(1, "winners"), { show: true, label: "1 winner ✓", active: true, next: "all" });
  assert.equal(W(1, "beaten").next, "winners"); assert.equal(W(lookbackSummary(c).winners, "all").show, true); assert.equal(W(lookbackSummary(same).winners, "all").show, false);
  assert.equal(M, 2400); assert.equal(P(1000, 1000), true); assert.equal(P(1000, 1000 + M), false); assert.equal(P(null, 1), false);
  assert.equal(S(false, "all", "winners"), true); assert.equal(S(true, "all", "winners"), false); assert.equal(S(false, "winners", "winners"), false);
  assert.deepEqual(K({ key: "w" }, 1, "all"), { next: "winners", changed: true, toast: "w → Show: ★ Winners" }); assert.deepEqual(K({ key: "W" }, 1, "winners"), { next: "all", changed: true, toast: "w → Show: All" });
  assert.equal(K({ key: "w" }, 0, "all"), null); assert.equal(K({ key: "w", metaKey: true }, 1, "all"), null); assert.equal(K({ key: "w", targetTag: "input" }, 1, "all"), null); assert.equal(K({ key: "x" }, 1, "all"), null);
  assert.equal(LOOKBACK_KEYMAP.filter((k) => k.key === "w").length, 1); console.log("lookbackWinnersChip/Pulse/Key OK (w toggles ★ Winners ↔ All)"); }

{ const { lookbackAgreeChip: A, lookbackAgreePulse: P, lookbackAgreeShouldPulse: S, lookbackAgreeKey: K, LOOKBACK_AGREE_PULSE_MS: M } = require("../src/lib/level4/roe-lookback");
  assert.equal(A(0, "all").show, false); assert.equal(A(NaN, "all").show, false);
  assert.deepEqual(A(2, "all"), { show: true, label: "2 agree", active: false, next: "agree" }); assert.deepEqual(A(1, "agree"), { show: true, label: "1 agree ✓", active: true, next: "all" });
  assert.equal(A(1, "winners").next, "agree");
  assert.equal(M, 2400); assert.equal(P(1000, 1000), true); assert.equal(P(1000, 1000 + M), false); assert.equal(P(null, 1), false);
  assert.equal(S(false, "all", "agree"), true); assert.equal(S(true, "all", "agree"), false); assert.equal(S(false, "agree", "agree"), false);
  assert.deepEqual(K({ key: "=" }, 1, "all"), { next: "agree", changed: true, toast: "= → Show: = Agree" }); assert.deepEqual(K({ key: "=" }, 1, "agree"), { next: "all", changed: true, toast: "= → Show: All" });
  assert.equal(K({ key: "=" }, 0, "all"), null); assert.equal(K({ key: "=", ctrlKey: true }, 1, "all"), null); assert.equal(K({ key: "=", targetTag: "textarea" }, 1, "all"), null); assert.equal(K({ key: "w" }, 1, "all"), null);
  assert.equal(LOOKBACK_KEYMAP.filter((k) => k.key === "=").length, 1); console.log("lookbackAgreeChip/Pulse/Key OK (= toggles = Agree ↔ All)"); }
{ const p = lookbackPilotPulse, M = LOOKBACK_PILOT_PULSE_MS;
  assert.equal(p(false, 1000, 1000), true); assert.equal(p(false, 1000, 1000 + M - 1), true);
  assert.equal(p(false, 1000, 1000 + M), false); assert.equal(p(true, 1000, 1000), false);
  assert.equal(p(false, null, 1), false); assert.equal(p(false, 5, 1), false); assert.equal(p(false, NaN, 1), false);
  console.log("ok lookbackPilotPulse"); }

{ const K = lookbackLastKey, E = { key: "z" };
  assert.equal(K(null, "z1", null), null); assert.equal(K({ key: "q" }, "z1", null), null); assert.equal(K(E, null, null), null); assert.equal(K(E, "", null), null);
  assert.equal(K({ key: "z", ctrlKey: true }, "z1", null), null); assert.equal(K({ key: "z", targetTag: "textarea" }, "z1", null), null); assert.equal(K({ key: "z", editable: true }, "z1", null), null);
  const a = K(E, "z1", { filter: "beaten", focus: "x", open: null })!; assert.equal(a.target, "z1"); assert.equal(a.changed, true); assert.equal(a.toast, "z → last-ranked path");
  const n = K(E, "z1", { filter: "all", focus: "z1", open: "z1" })!; assert.equal(n.changed, false); assert.equal(n.toast, null);
  assert.equal(lookbackLastFocusTarget(null), null); assert.equal(lookbackLastFocusTarget({} as any), null);
  assert.ok(LOOKBACK_KEYMAP.some((x: any) => x.key === "z")); console.log("lookbackLastKey OK"); }

{ assert.equal(lookbackLastChip(null), null); assert.equal(lookbackLastChip({} as any), null);
  console.log("lookbackLastChip OK (null with <2 paths; click mirrors key z)"); }
{ const F = lookbackFirstUpChip; assert.equal(F(null), null); assert.equal(F({} as any), null); assert.equal(F(scoreSealedPaths([])), null);
  const f = F(c); assert.ok(f); assert.equal(f!.target, lookbackTopFocusTarget(c)); assert.equal(f!.label, "First ↑"); assert.equal(f!.target, lookbackFirstChip(c)!.target);
  assert.ok(lookbackLastChip(c)); assert.notEqual(f!.target, lookbackLastChip(c)!.target);
  console.log("lookbackFirstUpChip OK (pairs with Last ↓; same target as key 1 / #1)"); }
{ const P = lookbackLastPulse, S = lookbackLastShouldPulse, M = LOOKBACK_LAST_PULSE_MS;
  assert.equal(S(false, "B:1"), true); assert.equal(S(true, "B:1"), false); assert.equal(S(false, ""), false); assert.equal(S(false, null), false);
  assert.equal(P(1000, 1000), true); assert.equal(P(1000, 1000 + M - 1), true); assert.equal(P(1000, 1000 + M), false);
  assert.equal(P(null, 1), false); assert.equal(P(5, 1), false); assert.equal(P(NaN, 1), false);
  console.log("ok lookbackLastPulse/ShouldPulse (first-use per session, chip or z)"); }
{ const P = lookbackFirstUpPulse, S = lookbackFirstUpShouldPulse, M = LOOKBACK_FIRST_UP_PULSE_MS; assert.equal(M, 1200);
  assert.equal(S(false, "A:1"), true); assert.equal(S(true, "A:1"), false); assert.equal(S(false, ""), false); assert.equal(S(false, undefined), false);
  assert.equal(P(1000, 1000), true); assert.equal(P(1000, 1000 + M - 1), true); assert.equal(P(1000, 1000 + M), false);
  assert.equal(P(null, 1), false); assert.equal(P(5, 1), false); assert.equal(P(1, Infinity), false);
  { const G = lookbackFirstUpChipChanged; assert.equal(G(null, {}), false); assert.equal(G("", {}), false);
    assert.equal(G("t", { filter: "all", focus: "t", open: "t" }), false); assert.equal(G("t", { focus: "t", open: "t" }), false);
    assert.equal(G("t", { filter: "winners", focus: "t", open: "t" }), true); assert.equal(G("t", { filter: "all", focus: "x", open: "t" }), true);
    assert.equal(G("t", { filter: "all", focus: "t", open: null }), true); assert.equal(G("t", null), true);
    const st = { filter: "all", focus: "t", open: "t" }; assert.equal(G("t", st), lookbackTopKey({ key: "1" }, "t", st)!.changed);
    assert.equal(G("t", { focus: "u" }), lookbackTopKey({ key: "1" }, "t", { focus: "u" })!.changed); console.log("ok lookbackFirstUpChipChanged (matches key 1 changed)"); }
{ const L = lookbackLastChipChanged; assert.equal(L(null, {}), false); assert.equal(L("z", { filter: "all", focus: "z", open: "z" }), false);
  assert.equal(L("z", { focus: "z", open: "z" }), false); assert.equal(L("z", { filter: "beaten", focus: "z", open: "z" }), true);
  assert.equal(L("z", { filter: "all", focus: "a", open: "z" }), true); assert.equal(L("z", { filter: "all", focus: "z", open: null }), true);
  console.log("ok lookbackLastChipChanged (quiet when already on LAST, All, expanded)"); }
  console.log("ok lookbackFirstUpPulse/ShouldPulse (first-use per session, chip or key 1)"); }
{ const K = lookbackCopyTopKey; assert.equal(lookbackTopPathJson(null), null);
  assert.deepEqual(K({ key: "x" }, "{}"), { json: "{}", toast: "x → copied TOP path JSON" });
  assert.equal(K({ key: "x" }, null), null); assert.equal(K({ key: "x", metaKey: true }, "{}"), null); assert.equal(K({ key: "x", targetTag: "input" }, "{}"), null); assert.equal(K({ key: "y" }, "{}"), null); assert.equal(K(null, "{}"), null);
  assert.ok(LOOKBACK_KEYMAP.some((k) => k.key === "x"));
  console.log("ok lookbackCopyTopKey/TopPathJson (x copies #1 path JSON)"); }
{ const K = lookbackCopyLastKey; assert.equal(lookbackLastPathJson(null), null);
  assert.deepEqual(K({ key: ";" }, "{}"), { json: "{}", toast: "; → copied LAST path JSON" });
  assert.equal(K({ key: ";" }, null), null); assert.equal(K({ key: ";", ctrlKey: true }, "{}"), null); assert.equal(K({ key: ";", targetTag: "textarea" }, "{}"), null); assert.equal(K({ key: ";", editable: true }, "{}"), null); assert.equal(K({ key: "x" }, "{}"), null); assert.equal(K(null, "{}"), null);
  assert.ok(LOOKBACK_KEYMAP.some((k) => k.key === ";"));
  console.log("ok lookbackCopyLastKey/LastPathJson (; copies last-ranked path JSON)"); }
{ assert.equal(lookbackCopyTopChip(null), null); assert.equal(lookbackCopyTopChip(""), null); assert.equal(lookbackCopyLastChip(undefined), null);
  assert.deepEqual(lookbackCopyTopChip("{}"), { json: "{}", label: "⧉ TOP", toast: "⧉ TOP → copied TOP path JSON" });
  assert.deepEqual(lookbackCopyLastChip("{}"), { json: "{}", label: "⧉ Last", toast: "⧉ Last → copied LAST path JSON" });
  assert.equal(lookbackCopyLastChip(lookbackLastPathJson(null)), null); assert.equal(lookbackCopyTopChip(lookbackTopPathJson(null)), null);
  console.log("ok lookbackCopyTopChip/CopyLastChip (⧉ TOP / ⧉ Last mirror x / ;)"); }
{ const P = lookbackCopyChipPulse, S = lookbackCopyChipShouldPulse, M = LOOKBACK_COPY_TOP_LAST_PULSE_MS; assert.equal(M, 1200);
  assert.equal(S(false, "{}"), true); assert.equal(S(true, "{}"), false); assert.equal(S(false, ""), false); assert.equal(S(false, null), false);
  assert.equal(P(1000, 1000), true); assert.equal(P(1000, 1000 + M - 1), true); assert.equal(P(1000, 1000 + M), false);
  assert.equal(P(null, 1), false); assert.equal(P(5, 1), false); assert.equal(P(NaN, 1), false);
  console.log("ok lookbackCopyChipPulse/ShouldPulse (⧉ TOP / ⧉ Last first-use per session, chip or x / ;)"); }
{ const K = lookbackCopyGreedyKey; assert.equal(lookbackGreedyPathJson(null), null);
  assert.deepEqual(K({ key: "y", targetTag: "TR" }, "{}"), { json: "{}", toast: "y → copied greedy path JSON" });
  assert.equal(K({ key: "y", targetTag: "INPUT" }, "{}"), null); assert.equal(K({ key: "y", ctrlKey: true }, "{}"), null); assert.equal(K({ key: "x" }, "{}"), null); assert.equal(K({ key: "y" }, null), null); assert.equal(K(null, "{}"), null);
  assert.equal(lookbackCopyGreedyChip(null), null); assert.equal(lookbackCopyGreedyChip(""), null);
  assert.deepEqual(lookbackCopyGreedyChip("{}"), { json: "{}", label: "⧉ Greedy", toast: "⧉ Greedy → copied greedy path JSON" });
  console.log("ok lookbackCopyGreedyKey/GreedyChip/GreedyPathJson (y / ⧉ Greedy copy greedy path JSON)"); }

{ const C = lookbackCopyCompareChip; assert.equal(C(null), null); assert.equal(C(""), null);
  assert.deepEqual(C("{}"), { json: "{}", label: "⚖ Compare", toast: "⚖ Compare → copied compare pack JSON" });
  assert.equal(C("{}", "lookback", 3)!.label, "⚖ Compare +Δe 3"); assert.equal(C("{}", "agree", 3)!.label, "⚖ Compare");
  assert.equal(C("{}", "lookback", NaN)!.label, "⚖ Compare");
  console.log("ok lookbackCopyCompareChip (sticky ⚖ Compare = key m)"); }
{ const T = lookbackCompareChipToast; assert.equal(T(true, "⚖ x"), "⚖ x"); assert.equal(T(false, "⚖ x"), null); assert.equal(T(undefined, "⚖ x"), null); assert.equal(T("true", "⚖ x"), null); assert.equal(T(true, ""), null); assert.equal(T(true, 3), null);
  console.log("ok lookbackCompareChipToast (⚖ toast only after clipboard success)"); }
{ const T = lookbackCopyChipToast; assert.equal(T(true, "⧉ TOP → x"), "⧉ TOP → x"); assert.equal(T(false, "⧉ x"), null); assert.equal(T(undefined, "⧉ x"), null); assert.equal(T("true", "⧉ x"), null); assert.equal(T(true, ""), null); assert.equal(T(true, 3), null);
  console.log("ok lookbackCopyChipToast (⧉ TOP/Last/Greedy toast + pulse only after clipboard success)"); }
{ const T = lookbackCopyChipToast; assert.equal(T(true, "⧉ TOP JSON (x)"), "⧉ TOP JSON (x)"); assert.equal(T(false, "⧉ Last JSON (;)"), null); assert.equal(T(undefined, "⧉ Greedy JSON (y)"), null);
  console.log("ok lookbackCopyChipToast keys (x / ; / y toast + pulse only after clipboard success)"); }
{ const D = lookbackKeyToastDeferred; for (const k of ["compare", "summary", "copy", "steps"]) assert.equal(D(k), true); for (const k of ["next", "prev", "toggle", "filter", "sort", "help", null, undefined, 3]) assert.equal(D(k), false);
  assert.equal(lookbackCopyChipToast(true, lookbackToastText("compare", null)), "⚖ copy compare pack"); assert.equal(lookbackCopyChipToast(false, lookbackToastText("summary", null)), null); assert.equal(lookbackCopyChipToast(true, null), null);
  console.log("ok lookbackKeyToastDeferred (m / g / c / s toast only after clipboard success)"); }

{ const T = lookbackSummaryButtonToast; assert.equal(T(true, "button"), "Copy summary → copied summary JSON"); assert.equal(T(true, "delta_e"), "+Δe → copied summary JSON"); assert.equal(T(false, "button"), null); assert.equal(T(undefined, "delta_e"), null); assert.equal(T("true", "button"), null);
  console.log("ok lookbackSummaryButtonToast (Copy summary / +Δe toast only after clipboard success)"); }

{ assert.equal(lookbackTopStepsJson(null), null); assert.equal(lookbackCopyTopStepsChip(null), null); assert.equal(lookbackCopyTopStepsChip(""), null); assert.equal(lookbackCopyTopStepsChip(42), null);
  assert.deepEqual(lookbackCopyTopStepsChip("{}"), { json: "{}", label: "⧉ TOP steps", toast: "⧉ TOP steps → copied TOP steps JSON" });
  assert.equal(lookbackCopyTopStepsChip(lookbackTopStepsJson(undefined)), null);
  console.log("ok lookbackTopStepsJson/CopyTopStepsChip (⧉ TOP steps without expanding)"); }
{ const K = lookbackCopyTopStepsKey;
  assert.deepEqual(K({ key: "t", targetTag: "TR" }, "{}"), { json: "{}", toast: "t → copied TOP steps JSON" });
  assert.equal(K({ key: "t", targetTag: "INPUT" }, "{}"), null); assert.equal(K({ key: "t", targetTag: "textarea" }, "{}"), null); assert.equal(K({ key: "t", editable: true }, "{}"), null);
  assert.equal(K({ key: "t", metaKey: true }, "{}"), null); assert.equal(K({ key: "T" }, "{}"), null); assert.equal(K({ key: "s" }, "{}"), null); assert.equal(K({ key: "t" }, null), null); assert.equal(K(null, "{}"), null);
  assert.equal(K({ key: "t" }, lookbackTopStepsJson(null)), null);
  for (const k of ["j", "k", "c", "s", "m", "g", "f", "o", "q", "a", "b", "w", "v", "p", "e", "z", "x", "y", ";", "d", "1", "2", "3", "="]) assert.equal(K({ key: k }, "{}"), null);
  assert.equal(LOOKBACK_KEYMAP.filter((r) => r.key === "t").length, 1);
  console.log("ok lookbackCopyTopStepsKey (t copies TOP steps JSON, same as ⧉ TOP steps)"); }

{ assert.equal(lookbackLastStepsJson(null), null); assert.equal(lookbackLastStepsJson(scoreSealedPaths([])), null);
  assert.equal(lookbackCopyLastStepsChip(null), null); assert.equal(lookbackCopyLastStepsChip(""), null); assert.equal(lookbackCopyLastStepsChip(7), null);
  assert.deepEqual(lookbackCopyLastStepsChip("{}"), { json: "{}", label: "⧉ Last steps", toast: "⧉ Last steps → copied LAST steps JSON" });
  console.log("ok lookbackLastStepsJson/CopyLastStepsChip (⧉ Last steps without expanding, ≥2 paths)"); }
{ const rs = rankedLookbackRows(c); assert.ok(rs.length >= 2); const j = lookbackLastStepsJson(c); assert.equal(j, pathStepsJson(rs[rs.length - 1]) || null); assert.notEqual(j, null);
  assert.equal(lookbackLastStepsJson({ ...c, paths: [c.paths[0]] } as typeof c), null);
  console.log("ok lookbackLastStepsJson picks LAST-ranked row"); }

{ const K = lookbackCopyLastStepsKey;
  assert.deepEqual(K({ key: "l", targetTag: "TR" }, "{}"), { json: "{}", toast: "l → copied LAST steps JSON" });
  assert.equal(K({ key: "l", targetTag: "INPUT" }, "{}"), null); assert.equal(K({ key: "l", targetTag: "select" }, "{}"), null); assert.equal(K({ key: "l", editable: true }, "{}"), null);
  assert.equal(K({ key: "l", ctrlKey: true }, "{}"), null); assert.equal(K({ key: "L" }, "{}"), null); assert.equal(K({ key: "t" }, "{}"), null); assert.equal(K({ key: "l" }, null), null); assert.equal(K(null, "{}"), null);
  assert.equal(K({ key: "l" }, lookbackLastStepsJson(null)), null);
  for (const k of ["j", "k", "c", "s", "m", "g", "f", "o", "q", "a", "b", "w", "v", "p", "e", "z", "x", "y", ";", "d", "t", "1", "2", "3", "="]) assert.equal(K({ key: k }, "{}"), null);
  assert.equal(LOOKBACK_KEYMAP.filter((r) => r.key === "l").length, 1); assert.equal(LOOKBACK_KEYMAP.filter((r) => r.key === "t").length, 1);
  assert.deepEqual(K({ key: "l" }, lookbackLastStepsJson(c)), lookbackLastStepsJson(c) ? { json: lookbackLastStepsJson(c), toast: "l → copied LAST steps JSON" } : null);
  console.log("ok lookbackCopyLastStepsKey (l copies LAST steps JSON, same as ⧉ Last steps; t stays TOP steps)"); }
{ assert.equal(lookbackGreedyStepsJson(null), null); assert.equal(lookbackGreedyStepsJson(scoreSealedPaths([])), null);
  const gj = lookbackGreedyStepsJson(c); const gr = rankedLookbackRows(c).find((r) => r.is_greedy)!; assert.equal(gj, pathStepsJson(gr));
  assert.equal(lookbackCopyGreedyStepsChip(null), null); assert.equal(lookbackCopyGreedyStepsChip(""), null); assert.equal(lookbackCopyGreedyStepsChip(7), null);
  assert.deepEqual(lookbackCopyGreedyStepsChip("{}"), { json: "{}", label: "⧉ Greedy steps", toast: "⧉ Greedy steps → copied greedy steps JSON" });
  console.log("ok lookbackGreedyStepsJson/CopyGreedyStepsChip (⧉ Greedy steps without expanding)"); }

{ const K = lookbackCopyGreedyStepsKey;
  assert.deepEqual(K({ key: "r", targetTag: "TR" }, "{}"), { json: "{}", toast: "r → copied greedy steps JSON" });
  assert.equal(K({ key: "r", targetTag: "INPUT" }, "{}"), null); assert.equal(K({ key: "r", targetTag: "textarea" }, "{}"), null); assert.equal(K({ key: "r", editable: true }, "{}"), null);
  assert.equal(K({ key: "r", metaKey: true }, "{}"), null); assert.equal(K({ key: "R" }, "{}"), null); assert.equal(K({ key: "l" }, "{}"), null); assert.equal(K({ key: "r" }, ""), null); assert.equal(K(null, "{}"), null);
  const gj = lookbackGreedyStepsJson(c); if (gj) assert.equal(K({ key: "r" }, gj)!.json, gj);
  assert.ok(LOOKBACK_KEYMAP.some((x) => x.key === "r" && /t = TOP steps, l = Last steps/.test(x.does)));
  console.log("ok lookbackCopyGreedyStepsKey (r = greedy steps; t = TOP, l = Last)"); }

{ assert.equal(lookbackCopyFocusChip(null, "{}"), null); assert.equal(lookbackCopyFocusChip("p1", ""), null); assert.equal(lookbackCopyFocusChip("p1", 7), null); assert.equal(lookbackCopyFocusChip(3, "{}"), null);
  assert.deepEqual(lookbackCopyFocusChip("p1", "{}"), { id: "p1", json: "{}", label: "⧉ Focus", toast: "⧉ Focus → copied p1 path JSON" });
  console.log("ok lookbackCopyFocusChip (⧉ Focus = c without moving focus)"); }
{ const F = lookbackCopyFocusStepsChip; assert.equal(F(null, "[]"), null); assert.equal(F("p1", ""), null); assert.equal(F("p1", 7), null); assert.equal(F(3, "[]"), null);
  assert.deepEqual(F("p1", "[]"), { id: "p1", json: "[]", label: "⧉ Focus steps", toast: "⧉ Focus steps → copied p1 steps JSON" });
  const c2 = scoreSealedPaths([]); void c2; console.log("ok lookbackCopyFocusStepsChip (⧉ Focus steps = expand + s without expanding)"); }

{ const K = lookbackCopyFocusStepsKey;
  assert.deepEqual(K({ key: "i", targetTag: "TR" }, "p1", "[]"), { json: "[]", toast: "i → copied p1 steps JSON" });
  assert.equal(K({ key: "i", targetTag: "INPUT" }, "p1", "[]"), null); assert.equal(K({ key: "i", editable: true }, "p1", "[]"), null); assert.equal(K({ key: "i", ctrlKey: true }, "p1", "[]"), null);
  assert.equal(K({ key: "I" }, "p1", "[]"), null); assert.equal(K({ key: "s" }, "p1", "[]"), null); assert.equal(K({ key: "i" }, null, "[]"), null); assert.equal(K({ key: "i" }, "p1", ""), null); assert.equal(K(null, "p1", "[]"), null);
  assert.equal(K({ key: "i" }, "p1", "[]")!.json, lookbackCopyFocusStepsChip("p1", "[]")!.json);
  assert.ok(LOOKBACK_KEYMAP.some((x) => x.key === "i" && /s still expands \+ copies/.test(x.does)));
  assert.ok(!lookbackKey({ key: "i", targetTag: "TR" }), "i not claimed by lookbackKey");
  console.log("ok lookbackCopyFocusStepsKey (i = focus steps without expanding; s still expands + copies)"); }

{ const K = lookbackCopyRunnerUpKey, C = lookbackCopyRunnerUpChip;
  assert.deepEqual(K({ key: "n", targetTag: "TR" }, "{}"), { json: "{}", toast: "n → copied #2 path JSON" });
  assert.equal(K({ key: "n", targetTag: "INPUT" }, "{}"), null); assert.equal(K({ key: "n", editable: true }, "{}"), null); assert.equal(K({ key: "n", metaKey: true }, "{}"), null);
  assert.equal(K({ key: "N" }, "{}"), null); assert.equal(K({ key: "n" }, null), null); assert.equal(K(null, "{}"), null);
  assert.deepEqual(C("{}"), { json: "{}", label: "⧉ #2", toast: "⧉ #2 → copied #2 path JSON" }); assert.equal(C(""), null); assert.equal(C(3), null);
  const ru = lookbackRunnerUpPathJson(c); assert.ok(ru); assert.equal(ru, lookbackPathJson(rankedLookbackRows(c)[1], c.winner));
  assert.equal(lookbackRunnerUpPathJson(same), null); assert.equal(lookbackRunnerUpPathJson(null), null);
  assert.ok(LOOKBACK_KEYMAP.some((x) => x.key === "n")); assert.ok(!lookbackKey({ key: "n", targetTag: "TR" }), "n not claimed by lookbackKey");
  console.log("ok lookbackCopyRunnerUpKey/Chip (n / ⧉ #2 = copy runner-up path JSON)"); }

{ const K = lookbackCopyThirdKey, C = lookbackCopyThirdChip;
  assert.deepEqual(K({ key: "h", targetTag: "TR" }, "{}"), { json: "{}", toast: "h → copied #3 path JSON" });
  assert.equal(K({ key: "h", targetTag: "INPUT" }, "{}"), null); assert.equal(K({ key: "h", editable: true }, "{}"), null); assert.equal(K({ key: "h", ctrlKey: true }, "{}"), null);
  assert.equal(K({ key: "H" }, "{}"), null); assert.equal(K({ key: "h" }, null), null); assert.equal(K(null, "{}"), null);
  assert.deepEqual(C("{}"), { json: "{}", label: "⧉ #3", toast: "⧉ #3 → copied #3 path JSON" }); assert.equal(C(""), null); assert.equal(C(3), null);
  const rows = rankedLookbackRows(c); const th = lookbackThirdPathJson(c);
  if (rows.length >= 3) assert.equal(th, lookbackPathJson(rows[2], c.winner)); else assert.equal(th, null);
  assert.equal(lookbackThirdPathJson(same), null); assert.equal(lookbackThirdPathJson(null), null);
  assert.ok(LOOKBACK_KEYMAP.some((x) => x.key === "h")); assert.ok(!lookbackKey({ key: "h", targetTag: "TR" }), "h not claimed by lookbackKey");
  console.log("ok lookbackCopyThirdKey/Chip (h / ⧉ #3 = copy #3 path JSON)"); }

{ assert.equal(lookbackRunnerUpStepsJson(null), null); assert.equal(lookbackRunnerUpStepsJson(scoreSealedPaths([])), null);
  const rows = rankedLookbackRows(c); const uj = lookbackRunnerUpStepsJson(c); if (rows.length >= 2) assert.equal(uj, pathStepsJson(rows[1])); else assert.equal(uj, null);
  assert.equal(lookbackCopyRunnerUpStepsChip(null), null); assert.equal(lookbackCopyRunnerUpStepsChip(""), null);
  assert.deepEqual(lookbackCopyRunnerUpStepsChip("[]"), { json: "[]", label: "⧉ #2 steps", toast: "⧉ #2 steps → copied runner-up steps JSON" });
  const K = lookbackCopyRunnerUpStepsKey;
  assert.deepEqual(K({ key: "u", targetTag: "TR" }, "[]"), { json: "[]", toast: "u → copied runner-up steps JSON" });
  for (const e of [{ key: "u", targetTag: "INPUT" }, { key: "u", targetTag: "textarea" }, { key: "u", editable: true }, { key: "u", metaKey: true }, { key: "U" }, { key: "n" }]) assert.equal(K(e, "[]"), null);
  assert.equal(K({ key: "u" }, ""), null); assert.equal(K(null, "[]"), null);
  for (const k of ["t", "l", "r", "i", "n"]) assert.equal(K({ key: k }, "[]"), null);
  assert.ok(LOOKBACK_KEYMAP.some((r) => r.key === "u"));
  console.log("ok lookbackRunnerUpSteps (u + ⧉ #2 steps; t/l/r/i = TOP/Last/Greedy/Focus)"); }

{ assert.equal(lookbackThirdStepsJson(null), null); assert.equal(lookbackThirdStepsJson(scoreSealedPaths([])), null);
  const rows = rankedLookbackRows(c); const tj = lookbackThirdStepsJson(c); if (rows.length >= 3) assert.equal(tj, pathStepsJson(rows[2])); else assert.equal(tj, null);
  assert.equal(lookbackCopyThirdStepsChip(null), null); assert.equal(lookbackCopyThirdStepsChip(""), null);
  assert.deepEqual(lookbackCopyThirdStepsChip("[]"), { json: "[]", label: "⧉ #3 steps", toast: "⧉ #3 steps → copied #3 steps JSON" });
  const K = lookbackCopyThirdStepsKey;
  assert.deepEqual(K({ key: "#", targetTag: "TR" }, "[]"), { json: "[]", toast: "# → copied #3 steps JSON" });
  for (const e of [{ key: "#", targetTag: "INPUT" }, { key: "#", targetTag: "textarea" }, { key: "#", editable: true }, { key: "#", metaKey: true }, { key: "#", ctrlKey: true }, { key: "3" }, { key: "h" }]) assert.equal(K(e, "[]"), null);
  assert.equal(K({ key: "#" }, ""), null); assert.equal(K(null, "[]"), null);
  for (const k of ["t", "l", "r", "i", "u"]) assert.equal(K({ key: k }, "[]"), null);
  assert.ok(!lookbackKey({ key: "#", targetTag: "TR" }), "# not claimed by lookbackKey");
  assert.ok(LOOKBACK_KEYMAP.some((r) => r.key === "#"));
  console.log("ok lookbackThirdSteps (# + ⧉ #3 steps; t/l/r/i/u = TOP/Last/Greedy/Focus/#2)"); }

{ const rows = [{ run_id: "a" }, { run_id: "b" }];
  assert.equal(lookbackExpandAllChip([], false, null).show, false);
  assert.equal(lookbackExpandAllChip(rows, false, "a").action, "expand");
  assert.equal(lookbackExpandAllChip(rows, true, null).label, "⊟ Collapse all");
  assert.equal(lookbackExpandAllChip([{ run_id: "a" }], false, "a").action, "collapse");
  assert.equal(lookbackExpandAllChip(rows, false, null).toast, "⊞ Expanded all 2 sealed paths");
  assert.ok(lookbackExpandAllKey({ key: "*" }, 2)); assert.ok(!lookbackExpandAllKey({ key: "*" }, 0)); assert.ok(!lookbackExpandAllKey({ key: "*", targetTag: "INPUT" }, 2)); assert.ok(!lookbackExpandAllKey({ key: "*", metaKey: true }, 2));
  assert.ok(!lookbackKey({ key: "*", targetTag: "TR" }), "* not claimed by lookbackKey");
  assert.ok(lookbackExpandAllShouldPulse(false, "expand")); assert.ok(!lookbackExpandAllShouldPulse(true, "expand")); assert.ok(!lookbackExpandAllShouldPulse(false, "collapse"));
  assert.ok(LOOKBACK_KEYMAP.some((r) => r.key === "*"));
  console.log("ok lookbackExpandAllChip (⊞ Expand all / ⊟ Collapse all + *)"); }

{ assert.equal(lookbackCopySummaryChip(null), null); assert.equal(lookbackCopySummaryChip(""), null);
  assert.deepEqual(lookbackCopySummaryChip("{}"), { label: "⧉ Summary", selector: "[data-copy-roe-summary]" });
  assert.equal(lookbackSummaryButtonToast(false, "button"), null); assert.ok(LOOKBACK_KEYMAP.some((r) => r.key === "g"));
  console.log("ok lookbackCopySummaryChip (sticky ⧉ Summary -> Copy summary JSON button, same as g)"); }

{ assert.equal(lookbackBeatenJumpChip(null), null);
  const J = lookbackBeatenJumpChanged; assert.equal(J(null, {}), false); assert.equal(J("t", { filter: "beaten", focus: "t", open: "t" }), false);
  assert.equal(J("t", { filter: "all", focus: "t", open: "t" }), true); assert.equal(J("t", { filter: "beaten", focus: "u", open: "t" }), true);
  assert.equal(lookbackBeatenJumpPulse(0, 1), true); assert.equal(lookbackBeatenJumpPulse(0, LOOKBACK_BEATEN_JUMP_PULSE_MS), false); assert.equal(lookbackBeatenJumpPulse(null, 1), false);
  console.log("ok lookbackBeatenJumpChip / Changed / Pulse (sticky beaten ↓)"); }
{ const bj = lookbackBeatenJumpChip(c); const bs = filterLookbackRows(rankedLookbackRows(c), "beaten", c.winner);
  if (bs.length) { assert.ok(bj); assert.equal(bj!.target, bs[0].run_id); assert.equal(bj!.count, lookbackSummary(c).beaten); } else assert.equal(bj, null);
  assert.equal(lookbackBeatenJumpChip(same), null); console.log(`ok lookbackBeatenJumpChip fixture (beaten=${bs.length})`); }
{ assert.equal(lookbackWinnersJumpChip(null), null);
  const J = lookbackWinnersJumpChanged; assert.equal(J(null, {}), false); assert.equal(J("t", { filter: "winners", focus: "t", open: "t" }), false);
  assert.equal(J("t", { filter: "all", focus: "t", open: "t" }), true); assert.equal(J("t", { filter: "winners", focus: "t", open: null }), true); assert.equal(J("t", { filter: "beaten", focus: "t", open: "t" }), true);
  assert.equal(lookbackWinnersJumpPulse(0, 1), true); assert.equal(lookbackWinnersJumpPulse(0, LOOKBACK_WINNERS_JUMP_PULSE_MS), false); assert.equal(lookbackWinnersJumpPulse(null, 1), false);
  const wj = lookbackWinnersJumpChip(c); const ws = filterLookbackRows(rankedLookbackRows(c), "winners", c.winner);
  if (ws.length) { assert.ok(wj); assert.equal(wj!.target, ws[0].run_id); assert.equal(wj!.count, lookbackSummary(c).winners); assert.equal(wj!.label, "winners ↓"); } else assert.equal(wj, null);
  console.log(`ok lookbackWinnersJumpChip / Changed / Pulse (sticky winners ↓, winners=${ws.length})`); }
{ assert.equal(lookbackAgreeJumpChip(null), null);
  const J = lookbackAgreeJumpChanged; assert.equal(J(null, {}), false); assert.equal(J("t", { filter: "agree", focus: "t", open: "t" }), false);
  assert.equal(J("t", { filter: "all", focus: "t", open: "t" }), true); assert.equal(J("t", { filter: "agree", focus: "t", open: null }), true); assert.equal(J("t", { filter: "winners", focus: "t", open: "t" }), true);
  assert.equal(lookbackAgreeJumpPulse(0, 1), true); assert.equal(lookbackAgreeJumpPulse(0, LOOKBACK_AGREE_JUMP_PULSE_MS), false); assert.equal(lookbackAgreeJumpPulse(null, 1), false);
  const aj = lookbackAgreeJumpChip(c); const as_ = filterLookbackRows(rankedLookbackRows(c), "agree", c.winner);
  if (as_.length) { assert.ok(aj); assert.equal(aj!.target, as_[0].run_id); assert.equal(aj!.count, lookbackSummary(c).agree); assert.equal(aj!.label, "agree ↓"); } else assert.equal(aj, null);
  { const sa = filterLookbackRows(rankedLookbackRows(same), "agree", same?.winner); const sj = lookbackAgreeJumpChip(same); if (sa.length) assert.equal(sj?.target, sa[0].run_id); else assert.equal(sj, null); console.log(`ok agree ↓ on agree fixture (agree=${sa.length})`); }
  console.log(`ok lookbackAgreeJumpChip / Changed / Pulse (sticky agree ↓, agree=${as_.length})`); }
{ assert.equal(lookbackMaxGapJumpChip(null), null);
  const J = lookbackMaxGapJumpChanged; assert.equal(J(null, {}), false); assert.equal(J("t", { visible: true, focus: "t", open: "t" }), false); assert.equal(J("t", { visible: false, focus: "t", open: "t" }), true); assert.equal(J("t", { focus: "u", open: "t" }), true);
  assert.equal(lookbackMaxGapJumpPulse(0, 1), true); assert.equal(lookbackMaxGapJumpPulse(0, LOOKBACK_MAX_GAP_JUMP_PULSE_MS), false); assert.equal(lookbackMaxGapJumpPulse("x", 1), false);
  const rows = rankedLookbackRows(c); const mg = lookbackMaxGapJumpChip(c);
  if (rows.length) { assert.ok(mg); const v = (r: any) => (typeof r.delta_phi_vs_greedy === "number" ? r.delta_phi_vs_greedy : -Infinity); const exp = [...rows].sort((a, b) => v(b) - v(a) || a.rank - b.rank)[0]; assert.equal(mg!.target, exp.run_id); assert.equal(mg!.label, "ΔΦ ↓"); } else assert.equal(mg, null);
  console.log(`ok lookbackMaxGapJumpChip / Changed / Pulse (sticky ΔΦ ↓ → ${mg?.target ?? "none"})`); }
{ assert.equal(lookbackMinPhiJumpChip(null), null);
  const J = lookbackMinPhiJumpChanged; assert.equal(J(null, {}), false); assert.equal(J("t", { visible: true, focus: "t", open: "t" }), false); assert.equal(J("t", { visible: false, focus: "t", open: "t" }), true); assert.equal(J("t", { focus: "t", open: null }), true);
  assert.equal(lookbackMinPhiJumpPulse(0, 1), true); assert.equal(lookbackMinPhiJumpPulse(0, LOOKBACK_MIN_PHI_JUMP_PULSE_MS), false); assert.equal(lookbackMinPhiJumpPulse("x", 1), false);
  const rows = rankedLookbackRows(c); const lp = lookbackMinPhiJumpChip(c);
  if (rows.length) { assert.ok(lp); const v = (r: any) => (typeof r.final_phi === "number" ? r.final_phi : Infinity); const exp = [...rows].sort((a, b) => v(a) - v(b) || a.rank - b.rank)[0]; assert.equal(lp!.target, exp.run_id); assert.equal(lp!.label, "Φ ↑"); assert.equal(lp!.rank, exp.rank); } else assert.equal(lp, null);
  const tie = { ...c!, paths: c!.paths.map((p) => ({ ...p, final_phi: 0.5 })) } as typeof c; assert.equal(lookbackMinPhiJumpChip(tie)!.target, rankedLookbackRows(tie)[0].run_id);
  const nul = { ...c!, paths: c!.paths.map((p) => ({ ...p, final_phi: null })) } as typeof c; assert.equal(lookbackMinPhiJumpChip(nul)!.rank, 1);
  console.log(`ok lookbackMinPhiJumpChip / Changed / Pulse (sticky Φ ↑ → ${lp?.target ?? "none"})`); }
{ assert.equal(lookbackAllPathsJson(null), null); assert.equal(lookbackCopyAllPathsChip(null), null); assert.equal(lookbackCopyAllPathsChip(""), null);
  const j = lookbackAllPathsJson(c); const rows = rankedLookbackRows(c);
  if (rows.length) { assert.ok(j); const o = JSON.parse(j!); assert.equal(o.kind, "all_paths"); assert.equal(o.count, rows.length); assert.deepEqual(o.paths.map((p: { run_id: string }) => p.run_id), rows.map((r) => r.run_id)); assert.equal(o.paths[0].rank, 1);
    const ch = lookbackCopyAllPathsChip(j, rows.length)!; assert.equal(ch.label, `⧉ All ${rows.length} paths`); assert.equal(lookbackCopyChipToast(true, ch.toast), ch.toast); assert.equal(lookbackCopyChipToast(false, ch.toast), null); }
  else assert.equal(j, null);
  console.log(`ok lookbackAllPathsJson / CopyAllPathsChip (sticky ⧉ All paths, n=${rows.length})`); }
if (rankedLookbackRows(c).length) { const vu = "https://x.test/workbench/status?lb_show=winners"; assert.equal(JSON.parse(lookbackAllPathsJson(c, vu)!).view_url, vu);
  for (const bad of [null, undefined, "", "javascript:x", "/rel"]) assert.equal(lookbackAllPathsJson(c, bad as never), lookbackAllPathsJson(c), "no view_url = unchanged all_paths");
  console.log("all_paths   -> optional view_url (shareable lb_* link); absent when not http(s)"); }
{ assert.equal(lookbackRolesJson(null), null); assert.equal(lookbackCopyRolesChip(null), null); assert.equal(lookbackCopyRolesChip(""), null);
  const j = lookbackRolesJson(c); const rows = rankedLookbackRows(c);
  if (rows.length) { assert.ok(j); const o = JSON.parse(j!); assert.equal(o.kind, "roles"); assert.equal(o.count, rows.length); assert.deepEqual(o.roles.map((p: { run_id: string }) => p.run_id), rows.map((r) => r.run_id));
    for (const [i, r] of o.roles.entries()) { assert.equal(r.steps, undefined); assert.equal(r.actions, undefined); assert.equal(r.final_phi, rows[i].final_phi); assert.equal(r.delta_phi_vs_greedy, rows[i].delta_phi_vs_greedy); assert.equal(r.is_greedy, rows[i].is_greedy); assert.ok(["winner", "beaten", "agree", "other"].includes(r.role)); }
    assert.equal(Object.values(o.counts as Record<string, number>).reduce((a, b) => a + b, 0), rows.length); assert.ok(j!.length < lookbackAllPathsJson(c)!.length);
    const ch = lookbackCopyRolesChip(j, rows.length)!; assert.equal(ch.label, `⧉ Roles ${rows.length}`); assert.equal(lookbackCopyChipToast(true, ch.toast), ch.toast); assert.equal(lookbackCopyChipToast(false, ch.toast), null); }
  else assert.equal(j, null);
  { const vu = "https://x.test/workbench/status?lb_show=winners"; assert.equal(JSON.parse(lookbackRolesJson(c, vu)!).view_url, vu);
    for (const bad of [null, undefined, "", "javascript:x", "/rel"]) assert.equal(lookbackRolesJson(c, bad as never), lookbackRolesJson(c), "no view_url = unchanged roles");
    console.log("roles       -> optional view_url (shareable lb_* link); absent when not http(s)"); }
  console.log(`ok lookbackRolesJson / CopyRolesChip (sticky ⧉ Roles, n=${rows.length})`); }
{ const vu = "https://x.test/workbench/status?lb_show=winners"; assert.equal(JSON.parse(lookbackVerdictJson(c, vu)!).view_url, vu);
  for (const bad of [null, undefined, "", "javascript:x", "/rel"]) assert.equal(lookbackVerdictJson(c, bad as never), lookbackVerdictJson(c), "no view_url = unchanged verdict");
  console.log("verdict     -> optional view_url (shareable lb_* link); absent when not http(s)"); }
{ const vu = "https://x.test/workbench/status?lb_show=winners"; assert.equal(JSON.parse(lookbackGapsJson(c, vu)!).view_url, vu);
  for (const bad of [null, undefined, "", "javascript:x", "/rel"]) assert.equal(lookbackGapsJson(c, bad as never), lookbackGapsJson(c), "no view_url = unchanged gaps");
  console.log("gaps        -> optional view_url (shareable lb_* link); absent when not http(s)"); }
{ assert.equal(lookbackVerdictJson(null), null); assert.equal(lookbackCopyVerdictChip(null), null); assert.equal(lookbackCopyVerdictChip(""), null);
  const j = lookbackVerdictJson(c); const rows = rankedLookbackRows(c);
  if (rows.length) { assert.ok(j); const o = JSON.parse(j!); assert.equal(o.kind, "verdict"); assert.equal(o.verdict, lookbackVerdict(c).label); assert.equal(o.delta_e_gain, c.delta_e_gain); assert.equal(o.greedy_run_id, c.greedy?.run_id ?? null); assert.equal(o.lookback_run_id, c.lookback?.run_id ?? null); assert.equal(o.paths, rows.length);
    assert.equal(o.delta_phi, rows.find((r) => r.is_lookback)?.delta_phi_vs_greedy ?? null); assert.deepEqual(o.counts, JSON.parse(lookbackRolesJson(c)!).counts); assert.equal(o.roles, undefined); assert.equal(o.paths_list, undefined);
    assert.ok(j!.length < lookbackRolesJson(c)!.length); assert.ok(j!.length < lookbackSummaryJson(c)!.length); assert.ok(j!.length < lookbackComparePack(c).length);
    const ch = lookbackCopyVerdictChip(j)!; assert.equal(ch.label, "⧉ Verdict"); assert.equal(lookbackCopyChipToast(true, ch.toast), ch.toast); assert.equal(lookbackCopyChipToast(false, ch.toast), null); }
  else assert.equal(j, null);
  console.log(`ok lookbackVerdictJson / CopyVerdictChip (sticky ⧉ Verdict, n=${rows.length})`); }
{ assert.equal(lookbackGapsJson(null), null); assert.equal(lookbackCopyGapsChip(null), null); assert.equal(lookbackCopyGapsChip(""), null);
  const j = lookbackGapsJson(c); const rows = rankedLookbackRows(c);
  if (rows.length) { assert.ok(j); const o = JSON.parse(j!); assert.equal(o.kind, "gaps"); assert.equal(o.gaps.length, rows.length); assert.deepEqual(Object.keys(o.gaps[0]), ["rank", "run_id", "role", "delta_phi_vs_greedy", "phi"]);
    for (let i = 1; i < o.gaps.length; i++) assert.ok((o.gaps[i - 1].delta_phi_vs_greedy ?? -Infinity) >= (o.gaps[i].delta_phi_vs_greedy ?? -Infinity));
    const roles = JSON.parse(lookbackRolesJson(c)!).roles; for (const g of o.gaps) { const r = roles.find((x: { run_id: string }) => x.run_id === g.run_id); assert.equal(g.role, r.role); assert.equal(g.rank, r.rank); }
    assert.ok(j!.length < lookbackRolesJson(c)!.length); assert.ok(j!.length < lookbackAllPathsJson(c)!.length);
    const ch = lookbackCopyGapsChip(j)!; assert.equal(ch.label, "⧉ Gaps"); assert.equal(lookbackCopyChipToast(true, ch.toast), ch.toast); assert.equal(lookbackCopyChipToast(false, ch.toast), null); }
  else assert.equal(j, null);
  console.log(`ok lookbackGapsJson / CopyGapsChip (sticky ⧉ Gaps, n=${rows.length})`); }
{ assert.equal(lookbackAllStepsJson(null), null); assert.equal(lookbackCopyAllStepsChip(null), null); assert.equal(lookbackCopyAllStepsChip(""), null);
  const j = lookbackAllStepsJson(c); const rows = rankedLookbackRows(c);
  if (rows.length) { assert.ok(j); const o = JSON.parse(j!); assert.equal(o.kind, "all_steps"); assert.equal(o.count, rows.length); assert.deepEqual(o.paths[0], JSON.parse(_pathStepsJsonAll(rows[0]))); assert.notEqual(j, lookbackAllPathsJson(c));
    const ch = lookbackCopyAllStepsChip(j, rows.length)!; assert.equal(ch.label, `⧉ All ${rows.length} steps`); assert.equal(lookbackCopyChipToast(true, ch.toast), ch.toast); assert.equal(lookbackCopyChipToast(false, ch.toast), null); }
  else assert.equal(j, null);
  console.log(`ok lookbackAllStepsJson / CopyAllStepsChip (sticky ⧉ All steps, n=${rows.length})`); }
if (rankedLookbackRows(c).length) { const vu = "https://x.test/workbench/status?lb_show=winners"; assert.equal(JSON.parse(lookbackAllStepsJson(c, vu)!).view_url, vu);
  for (const bad of [null, undefined, "", "javascript:x", "/rel"]) assert.equal(lookbackAllStepsJson(c, bad as never), lookbackAllStepsJson(c), "no view_url = unchanged all_steps");
  console.log("all_steps   -> optional view_url (shareable lb_* link); absent when not http(s)"); }
{ const m = require("../src/lib/evidence-packs-link"); assert.equal(m.EVIDENCE_PACKS_HREF, "/workbench/offer#evidence-packs");
  assert.equal(m.evidencePacksChipLabel("medicare"), "Medicare · Evidence packs →"); assert.equal(m.evidencePacksChipLabel("lookback"), "Evidence packs →");
  console.log("evidencePacksChip OK (→ /workbench/offer#evidence-packs)"); }
{ const fs = require("fs"), path = require("path"); const c = fs.readFileSync(path.join(__dirname, "../src/components/AuditSummaryChip.tsx"), "utf8"); assert.ok(c.includes('"/workbench/audit"')); const s = fs.readFileSync(path.join(__dirname, "../src/components/RoeLookbackNote.tsx"), "utf8"); assert.ok(s.includes('<AuditSummaryChip scope="lookback" />'));
  console.log("auditSummaryChip OK (sticky → /workbench/audit)"); }

// Packs ▾/▴ toggle
assert.deepEqual([...LOOKBACK_PACKS_HIDDEN], ["All paths", "All steps", "Roles", "Gaps", "Verdict", "Summary"]);
assert.equal(lookbackPacksChip(false).label, "Packs \u25be"); assert.equal(lookbackPacksChip(undefined).open, false); assert.equal(lookbackPacksChip(true).label, "Packs \u25b4");
for (const p of ["Compare", "TOP", "Focus", "Greedy"]) assert.ok(!(LOOKBACK_PACKS_HIDDEN as readonly string[]).includes(p));
{ const a = lookbackPacksToggle(false, false); assert.equal(a.next, true); assert.ok(a.toast); const b = lookbackPacksToggle(true, a.everOpened); assert.equal(b.next, false); assert.equal(b.toast, null); assert.equal(lookbackPacksToggle(false, b.everOpened).toast, null); }
assert.ok(lookbackPacksPulse(0, 10)); assert.ok(!lookbackPacksPulse(0, LOOKBACK_PACKS_PULSE_MS)); assert.ok(!lookbackPacksPulse(null, 1));
{ const src = readFileSync(new URL("../src/components/RoeLookbackNote.tsx", import.meta.url), "utf8"); assert.ok(src.includes("data-roe-summary-packs-toggle")); assert.equal((src.match(/\{packsOpen && \(\(\) =>/g) || []).length, 6); }
console.log("check-roe-lookback: Packs toggle ok");

// Jumps ▾/▴ toggle
assert.deepEqual([...LOOKBACK_JUMPS_HIDDEN], ["beaten \u2193", "winners \u2193", "agree \u2193", "\u0394\u03a6 \u2193", "\u03a6 \u2191"]);
assert.equal(lookbackJumpsChip(false).label, "Jumps \u25be"); assert.equal(lookbackJumpsChip(undefined).open, false); assert.equal(lookbackJumpsChip(true).label, "Jumps \u25b4");
for (const p of ["First \u2191", "Last \u2193", "#1", "#2", "#3", "greedy", "Expand all"]) assert.ok(!(LOOKBACK_JUMPS_HIDDEN as readonly string[]).includes(p));
{ const a = lookbackJumpsToggle(false, false); assert.equal(a.next, true); assert.ok(a.toast); const b = lookbackJumpsToggle(true, a.everOpened); assert.equal(b.next, false); assert.equal(b.toast, null); assert.equal(lookbackJumpsToggle(false, b.everOpened).toast, null); }
assert.ok(lookbackJumpsPulse(0, 10)); assert.ok(!lookbackJumpsPulse(0, LOOKBACK_JUMPS_PULSE_MS)); assert.ok(!lookbackJumpsPulse(null, 1));
{ const src = readFileSync(new URL("../src/components/RoeLookbackNote.tsx", import.meta.url), "utf8"); assert.ok(src.includes("data-roe-summary-jumps-toggle")); assert.equal((src.match(/\{jumpsOpen && \(\(\) =>/g) || []).length, 5); }
console.log("check-roe-lookback: Jumps toggle ok");

// Esc priority: cheat sheet → top toasts → Packs ▴ → Jumps ▴ → Expand all → single row.
assert.deepEqual([...LOOKBACK_ESC_ORDER], ["help", "toasts", "packs", "jumps", "all", "row"]);
assert.equal(lookbackEscTarget(true, 1, "a", true, true, true), "help"); assert.equal(lookbackEscTarget(false, 1, "a", true, true, true), "toasts");
assert.equal(lookbackEscTarget(false, 0, "a", true, true, true), "packs"); assert.equal(lookbackEscTarget(false, 0, "a", true, false, true), "jumps");
assert.equal(lookbackEscTarget(false, 0, null, false, false, true), "jumps"); assert.equal(lookbackEscTarget(false, 0, "a", true, "yes", 1), "all");
{ const seq: unknown[] = []; let h = true, t = 2, p = true, j = true, al = true, o: string | null = "a"; for (let i = 0; i < 6; i++) { const x = lookbackEscTarget(h, t, o, al, p, j); seq.push(x); if (x === "help") h = false; else if (x === "toasts") t = 0; else if (x === "packs") p = false; else if (x === "jumps") j = false; else if (x === "all") { al = false; o = null; } else if (x === "row") o = null; }
  assert.deepEqual(seq, ["help", "toasts", "packs", "jumps", "all", null]); }
assert.ok(lookbackEscToast("packs")?.includes("Packs")); assert.ok(lookbackEscToast("jumps")?.includes("Jumps")); assert.equal(lookbackEscToast("help"), null);
assert.ok(LOOKBACK_KEYMAP.some((r) => r.key === "Escape" && /Packs.*Jumps.*Expand all/.test(r.does)));
console.log("check-roe-lookback: Esc order help → toasts → Packs ▴ → Jumps ▴ → Expand all → row ok");

// [ / ] toggle Packs / Jumps
{ const f = lookbackStripToggleKey;
  assert.equal(f({ key: "[" }), "packs"); assert.equal(f({ key: "]" }), "jumps"); assert.equal(f({ key: "x" }), null);
  assert.equal(f({ key: "[", ctrlKey: true }), null); assert.equal(f({ key: "]", targetTag: "input" }), null); assert.equal(f({ key: "[", editable: true }), null); assert.equal(f(null), null);
  const src = readFileSync(new URL("../src/components/RoeLookbackNote.tsx", import.meta.url), "utf8"); assert.ok(src.includes("lookbackStripToggleKey(")); }

// sessionStorage persistence for Packs / Jumps
{ const mem = new Map<string, string>(); const st = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v); } };
  assert.equal(LOOKBACK_PACKS_OPEN_KEY, "aethel.lookback.packsOpen"); assert.equal(LOOKBACK_JUMPS_OPEN_KEY, "aethel.lookback.jumpsOpen");
  assert.deepEqual(readLookbackStripState(st), { packs: false, jumps: false }); assert.deepEqual(readLookbackStripState(null), { packs: false, jumps: false });
  assert.equal(writeLookbackStripState(st, "packs", true), true); assert.deepEqual(readLookbackStripState(st), { packs: true, jumps: false });
  writeLookbackStripState(st, "jumps", true); writeLookbackStripState(st, "packs", false); assert.deepEqual(readLookbackStripState(st), { packs: false, jumps: true });
  assert.equal(writeLookbackStripState(null, "packs", true), false);
  const bad = { getItem: () => { throw new Error("x"); }, setItem: () => { throw new Error("x"); } };
  assert.deepEqual(readLookbackStripState(bad), { packs: false, jumps: false }); assert.equal(writeLookbackStripState(bad, "jumps", true), false);
  const src = readFileSync(new URL("../src/components/RoeLookbackNote.tsx", import.meta.url), "utf8"); assert.ok(src.includes("window.sessionStorage") && !/localStorage[^\n]*(LOOKBACK_PACKS_OPEN_KEY|LOOKBACK_JUMPS_OPEN_KEY|StripState)/.test(src) && src.includes("readLookbackStripState(") && src.includes("writeLookbackStripState(")); }

// sessionStorage persistence for Show filter / Sort mode
{ const mem = new Map<string, string>(); const st = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v); } };
  assert.equal(LOOKBACK_SHOW_FILTER_KEY, "aethel.lookback.showFilter"); assert.equal(LOOKBACK_SORT_MODE_KEY, "aethel.lookback.sortMode");
  assert.deepEqual(readLookbackViewState(st), { filter: "all", sort: "rank" }); assert.deepEqual(readLookbackViewState(null), { filter: "all", sort: "rank" });
  assert.equal(writeLookbackViewState(st, "filter", "beaten"), true); writeLookbackViewState(st, "sort", "dphi"); assert.deepEqual(readLookbackViewState(st), { filter: "beaten", sort: "dphi" });
  mem.set(LOOKBACK_SHOW_FILTER_KEY, "bogus"); mem.set(LOOKBACK_SORT_MODE_KEY, "x"); assert.deepEqual(readLookbackViewState(st), { filter: "all", sort: "rank" });
  writeLookbackViewState(st, "filter", "nope"); assert.equal(mem.get(LOOKBACK_SHOW_FILTER_KEY), "all");
  assert.equal(writeLookbackViewState(null, "sort", "dphi"), false);
  const bad = { getItem: () => { throw new Error("x"); }, setItem: () => { throw new Error("x"); } };
  assert.deepEqual(readLookbackViewState(bad), { filter: "all", sort: "rank" }); assert.equal(writeLookbackViewState(bad, "filter", "agree"), false);
  const src = readFileSync(new URL("../src/components/RoeLookbackNote.tsx", import.meta.url), "utf8"); assert.ok(src.includes("readLookbackViewState(") && src.includes("writeLookbackViewState(") && !/localStorage[^\n]*(ViewState|SHOW_FILTER|SORT_MODE)/.test(src));
  console.log("ok lookback view sessionStorage"); }

// sessionStorage persistence for Expand all
{ const mem = new Map<string, string>(); const st = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v); } };
  assert.equal(LOOKBACK_EXPAND_ALL_KEY, "aethel.lookback.expandAll");
  assert.equal(readLookbackExpandAll(st), false); assert.equal(readLookbackExpandAll(null), false);
  assert.equal(writeLookbackExpandAll(st, true), true); assert.equal(readLookbackExpandAll(st), true);
  writeLookbackExpandAll(st, "yes"); assert.equal(mem.get(LOOKBACK_EXPAND_ALL_KEY), "0"); assert.equal(readLookbackExpandAll(st), false);
  mem.set(LOOKBACK_EXPAND_ALL_KEY, "true"); assert.equal(readLookbackExpandAll(st), false);
  assert.equal(writeLookbackExpandAll(null, true), false);
  const bad = { getItem: () => { throw new Error("x"); }, setItem: () => { throw new Error("x"); } };
  assert.equal(readLookbackExpandAll(bad), false); assert.equal(writeLookbackExpandAll(bad, true), false);
  const src = readFileSync(new URL("../src/components/RoeLookbackNote.tsx", import.meta.url), "utf8"); assert.ok(src.includes("readLookbackExpandAll(") && src.includes("writeLookbackExpandAll(") && !/localStorage[^\n]*ExpandAll/.test(src));
  console.log("ok lookback expandAll sessionStorage"); }

// sessionStorage persistence for focused sealed path (run_id + expanded)
{ const mem = new Map<string, string>(); const st = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v); } };
  assert.equal(LOOKBACK_FOCUS_KEY, "aethel.lookback.focus");
  assert.equal(readLookbackFocus(st), null); assert.equal(readLookbackFocus(null), null);
  assert.equal(writeLookbackFocus(st, "B", true), true); assert.deepEqual(readLookbackFocus(st), { run_id: "B", expanded: true });
  writeLookbackFocus(st, "A", "yes"); assert.deepEqual(readLookbackFocus(st), { run_id: "A", expanded: false });
  writeLookbackFocus(st, null, true); assert.equal(mem.get(LOOKBACK_FOCUS_KEY), ""); assert.equal(readLookbackFocus(st), null);
  mem.set(LOOKBACK_FOCUS_KEY, "{bad"); assert.equal(readLookbackFocus(st), null);
  mem.set(LOOKBACK_FOCUS_KEY, JSON.stringify({ run_id: 3 })); assert.equal(readLookbackFocus(st), null);
  assert.equal(writeLookbackFocus(null, "A", true), false);
  const bad = { getItem: () => { throw new Error("x"); }, setItem: () => { throw new Error("x"); } };
  assert.equal(readLookbackFocus(bad), null); assert.equal(writeLookbackFocus(bad, "A", true), false);
  assert.deepEqual(resolveLookbackFocus({ run_id: "B", expanded: true }, ["A", "B"]), { focus: "B", open: "B" });
  assert.deepEqual(resolveLookbackFocus({ run_id: "B", expanded: false }, ["A", "B"]), { focus: "B", open: null });
  assert.deepEqual(resolveLookbackFocus({ run_id: "Z", expanded: true }, ["A", "B"]), { focus: null, open: null });
  assert.deepEqual(resolveLookbackFocus({ run_id: "Z", expanded: true }, ["A", "B"], "first"), { focus: "A", open: null });
  assert.deepEqual(resolveLookbackFocus({ run_id: "Z", expanded: true }, [], "first"), { focus: null, open: null });
  assert.deepEqual(resolveLookbackFocus(null, ["A"], "first"), { focus: null, open: null });
  const src = readFileSync(new URL("../src/components/RoeLookbackNote.tsx", import.meta.url), "utf8"); assert.ok(src.includes("readLookbackFocus(") && src.includes("writeLookbackFocus(") && src.includes("resolveLookbackFocus(") && !/localStorage[^\n]*Focus/.test(src));
  console.log("ok lookback focus sessionStorage"); }

{ // reset view
  assert.deepEqual([...LOOKBACK_RESET_VIEW_KEYS], ["aethel.lookback.packsOpen", "aethel.lookback.jumpsOpen", "aethel.lookback.showFilter", "aethel.lookback.sortMode", "aethel.lookback.expandAll", "aethel.lookback.focus"]);
  assert.deepEqual({ ...LOOKBACK_RESET_VIEW_DEFAULTS }, { filter: "all", sort: "rank", packs: false, jumps: false, expandAll: false, focus: null, open: null });
  const m = new Map<string, string>(LOOKBACK_RESET_VIEW_KEYS.map((k) => [k, "x"])); m.set("aethel.lookback.pilotSeen.v1", "1");
  assert.equal(clearLookbackViewSession({ removeItem: (k) => { m.delete(k); } }).length, 6); assert.deepEqual([...m.keys()], ["aethel.lookback.pilotSeen.v1"]);
  assert.deepEqual(clearLookbackViewSession(null), []);
  assert.deepEqual(clearLookbackViewSession({ removeItem: () => { throw new Error("x"); } }), []);
  assert.ok(lookbackResetViewToast(6).includes("6 session keys cleared") && lookbackResetViewToast(1).includes("1 session key cleared"));
  const src = readFileSync(new URL("../src/components/RoeLookbackNote.tsx", import.meta.url), "utf8"); assert.ok(src.includes("data-roe-summary-reset-view") && src.includes("clearLookbackViewSession(") && src.includes("lookbackResetViewToast("));
  console.log("ok lookback reset view"); }

{ // 0 presses Reset view
  assert.ok(lookbackResetViewKey({ key: "0" })); assert.ok(!lookbackResetViewKey({ key: "0", targetTag: "INPUT" })); assert.ok(!lookbackResetViewKey({ key: "0", editable: true })); assert.ok(!lookbackResetViewKey({ key: "0", ctrlKey: true })); assert.ok(!lookbackResetViewKey({ key: "0", metaKey: true })); assert.ok(!lookbackResetViewKey({ key: "0", altKey: true })); assert.ok(!lookbackResetViewKey({ key: "1" })); assert.ok(!lookbackResetViewKey(null));
  assert.ok(LOOKBACK_KEYMAP.some((r) => r.key === "0"));
}

{
  const vi = { show: "winners", sort: "phi", packsOpen: true, jumpsOpen: false, expandAll: false, focusRunId: "r1", expandedRunId: "r1" };
  assert.deepEqual(lookbackViewSnapshot(vi), { schema: LOOKBACK_VIEW_SNAPSHOT_SCHEMA, show: "winners", sort: "phi", packsOpen: true, jumpsOpen: false, expandAll: false, focus: { run_id: "r1", expanded: true } });
  assert.equal(lookbackViewSnapshot({ ...vi, expandedRunId: "r2" }).focus.expanded, false);
  assert.deepEqual(lookbackViewSnapshot({ ...vi, focusRunId: null, expandedRunId: null }).focus, { run_id: null, expanded: false });
  const j = lookbackViewSnapshotJson(vi); assert.ok(!j.includes("aethel.lookback.") && JSON.parse(j).schema === "aethel.roe_lookback.view.v1");
  assert.ok(lookbackCopyViewToast(vi).includes("copied view JSON") && lookbackCopyViewToast(vi).includes("focus r1"));
  assert.equal(lookbackCopyViewShouldPulse(false), true); assert.equal(lookbackCopyViewShouldPulse(true), false);
  assert.equal(lookbackCopyViewPulse(100, 100 + LOOKBACK_COPY_VIEW_PULSE_MS - 1), true); assert.equal(lookbackCopyViewPulse(100, 100 + LOOKBACK_COPY_VIEW_PULSE_MS), false); assert.equal(lookbackCopyViewPulse(null, 5), false);
  const src2 = readFileSync(new URL("../src/components/RoeLookbackNote.tsx", import.meta.url), "utf8");
  assert.ok(src2.includes("data-roe-summary-copy-view") && src2.includes("lookbackViewSnapshotJson(") && src2.indexOf("data-roe-summary-copy-view=\"1\"") < src2.indexOf("<button type=\"button\" data-roe-summary-reset-view"));
  { const u = "https://x.test/workbench/status?lb_show=winners&lb_focus=r1&lb_expand=1"; const sj = JSON.parse(lookbackViewSnapshotJson(vi, u)); assert.equal(sj.view_url, u); assert.ok(!("view_url" in JSON.parse(lookbackViewSnapshotJson(vi, "ftp://x")))); assert.ok(!("view_url" in JSON.parse(lookbackViewSnapshotJson(vi, null)))); assert.ok(src2.includes("lookbackViewSnapshotJson(vi, cmpViewUrl())")); const ap = parseLookbackViewSnapshot(lookbackViewSnapshotJson({ ...vi, sort: "dphi" }, u)); assert.ok(ap.ok); console.log("ok: look-back ⧉ View view_url"); }
  console.log("ok: look-back ⧉ View snapshot");
}

{ // - presses ⧉ View
  assert.ok(lookbackCopyViewKey({ key: "-" })); assert.ok(!lookbackCopyViewKey({ key: "-", targetTag: "INPUT" })); assert.ok(!lookbackCopyViewKey({ key: "-", editable: true })); assert.ok(!lookbackCopyViewKey({ key: "-", ctrlKey: true })); assert.ok(!lookbackCopyViewKey({ key: "-", metaKey: true })); assert.ok(!lookbackCopyViewKey({ key: "-", altKey: true })); assert.ok(!lookbackCopyViewKey({ key: "0" })); assert.ok(!lookbackCopyViewKey(null));
  assert.ok(LOOKBACK_KEYMAP.some((r) => r.key === "-"));
  const src3 = readFileSync(new URL("../src/components/RoeLookbackNote.tsx", import.meta.url), "utf8"); assert.ok(src3.includes("lookbackCopyViewKey(") && src3.includes(`'[data-roe-summary-copy-view="1"]'`));
  console.log("ok: look-back - copies view");
}

// Apply view (clipboard → view.v1 snapshot)
{
  const snap = lookbackViewSnapshotJson({ show: "winners", sort: "dphi", packsOpen: true, jumpsOpen: false, expandAll: true, focusRunId: "r1", expandedRunId: "r1" });
  const p = parseLookbackViewSnapshot(snap); assert.ok(p.ok);
  if (p.ok) {
    const a = applyLookbackViewSnapshot(p.view, ["r0", "r1"]);
    assert.deepEqual(a, { show: "winners", sort: "dphi", packsOpen: true, jumpsOpen: false, expandAll: true, focusRunId: "r1", expandedRunId: "r1", focusDropped: false });
    const d = applyLookbackViewSnapshot(p.view, ["zz"]); assert.equal(d.focusRunId, null); assert.equal(d.expandedRunId, null); assert.ok(d.focusDropped);
    const t = lookbackApplyViewToast({ ok: true, applied: a }); assert.equal(t.tone, "emerald"); assert.ok(t.txt.includes("Applied view") && t.txt.includes("focus r1"));
    assert.ok(lookbackApplyViewToast({ ok: true, applied: d }).txt.includes("focus not found"));
  }
  const bad = parseLookbackViewSnapshot(JSON.stringify({ schema: "aethel.medicare.view.v1", rowFilter: null })); assert.ok(!bad.ok && bad.reason.startsWith("wrong schema"));
  if (!bad.ok) { const t = lookbackApplyViewToast(bad); assert.equal(t.tone, "amber"); assert.ok(t.txt.startsWith("⚠") && t.txt.includes("aethel.roe_lookback.view.v1")); }
  for (const x of [undefined, "", "nope", "[]", "null", JSON.stringify({ ...JSON.parse(snap), sort: "zzz" }), JSON.stringify({ ...JSON.parse(snap), show: 1 }), JSON.stringify({ ...JSON.parse(snap), packsOpen: "yes" }), JSON.stringify({ ...JSON.parse(snap), focus: null })]) assert.equal(parseLookbackViewSnapshot(x).ok, false);
  assert.ok(lookbackApplyViewKey({ key: "+" }) && !lookbackApplyViewKey({ key: "+", ctrlKey: true }) && !lookbackApplyViewKey({ key: "+", targetTag: "textarea" }) && !lookbackApplyViewKey(null));
  assert.ok(LOOKBACK_KEYMAP.some((k) => k.key === "+"));
  const srcA = readFileSync(new URL("../src/components/RoeLookbackNote.tsx", import.meta.url), "utf8");
  const iv = srcA.indexOf('data-roe-summary-copy-view="1"'), ia = srcA.indexOf('data-roe-summary-apply-view="1"'), ir = srcA.indexOf('<button type="button" data-roe-summary-reset-view');
  assert.ok(iv > 0 && iv < ia && ia < ir && srcA.includes("parseLookbackViewSnapshot(") && srcA.includes("lookbackApplyViewKey("));
  console.log("ok · apply view");
}

{
  assert.ok(lookbackApplyViewShouldPulse(false, true) && !lookbackApplyViewShouldPulse(true, true) && !lookbackApplyViewShouldPulse(false, false) && !lookbackApplyViewShouldPulse(false, undefined));
  assert.ok(lookbackApplyViewPulse(1000, 1500) && !lookbackApplyViewPulse(1000, 1000 + LOOKBACK_APPLY_VIEW_PULSE_MS) && !lookbackApplyViewPulse(null, 5) && !lookbackApplyViewPulse(1000, 900));
  const src = readFileSync(new URL("../src/components/RoeLookbackNote.tsx", import.meta.url), "utf8");
  assert.ok(src.includes("data-roe-apply-view-pulsing") && src.includes("lookbackApplyViewShouldPulse(avPulsedRef.current, true)"));
  console.log("ok · apply view pulse");
}

// Shareable view URL (lb_* query)
{
  const U = UrlView;
  assert.deepEqual(U.serializeLookbackUrlView({ show: "all", sort: "rank", packs: false, jumps: false }), {});
  assert.deepEqual(U.serializeLookbackUrlView({ show: "winners", sort: "dphi", packs: true, jumps: true }), { lb_show: "winners", lb_sort: "dphi", lb_packs: "1", lb_jumps: "1" });
  assert.deepEqual(U.parseLookbackUrlView("?lb_show=beaten&lb_sort=dphi&lb_packs=1&lb_jumps=0"), { show: "beaten", sort: "dphi", packs: true, jumps: false });
  assert.deepEqual(U.parseLookbackUrlView("?lb_show=zzz&lb_sort=1&lb_packs=yes&x=1"), {});
  assert.deepEqual(U.parseLookbackUrlView(""), {}); assert.deepEqual(U.parseLookbackUrlView(null), {});
  const v = { show: "agree", sort: "rank", packs: false, jumps: true } as const;
  const href = U.lookbackUrlWithView("https://x.test/workbench/status?foo=1&lb_sort=dphi#h", v);
  assert.equal(href, "https://x.test/workbench/status?foo=1&lb_show=agree&lb_jumps=1#h");
  assert.deepEqual(U.parseLookbackUrlView(new URL(href).search), { show: "agree", jumps: true });
  assert.equal(U.lookbackUrlWithView("https://x.test/a?lb_show=winners", { show: "all", sort: "rank", packs: false, jumps: false }), "https://x.test/a");
  assert.ok(U.lookbackCopyLinkToast(v).includes("2 params") && U.lookbackCopyLinkToast({ show: "all", sort: "rank", packs: false, jumps: false }).includes("default"));
  const src = readFileSync(new URL("../src/components/RoeLookbackNote.tsx", import.meta.url), "utf8");
  assert.ok(src.includes('data-roe-summary-copy-link="1"') && src.includes("history.replaceState") && !src.includes("history.pushState") && src.includes("parseLookbackUrlView(window.location.search)"));
  console.log("ok · view link URL");
}

{ // Reset view strips lb_* from URL
  const r = UrlView.stripLookbackUrlParams("https://x.test/workbench/status?a=1&lb_show=winners&lb_packs=1#h");
  assert.equal(r.removed, 2); assert.equal(r.href, "https://x.test/workbench/status?a=1#h");
  const d = UrlView.stripLookbackUrlParams("https://x.test/workbench/status?a=1"); assert.equal(d.removed, 0); assert.equal(d.href, "https://x.test/workbench/status?a=1");
  const src = readFileSync(new URL("../src/components/RoeLookbackNote.tsx", import.meta.url), "utf8");
  assert.ok(src.includes("stripLookbackUrlParams(window.location.href)") && src.includes("link cleared"));
  console.log("ok · reset view strips lb_* URL");
}
{
  const a = UrlView.lookbackApplyViewUrl("https://x.test/workbench/status?a=1&lb_show=beaten#h", { show: "winners", sort: "dphi", packsOpen: true, jumpsOpen: false });
  assert.ok(a.changed); const u = new URL(a.href);
  assert.equal(u.searchParams.get("lb_show"), "winners"); assert.equal(u.searchParams.get("lb_sort"), "dphi"); assert.equal(u.searchParams.get("lb_packs"), "1"); assert.equal(u.searchParams.get("lb_jumps"), null); assert.equal(u.searchParams.get("a"), "1"); assert.equal(u.hash, "#h");
  const d = UrlView.lookbackApplyViewUrl("https://x.test/s?a=1&lb_show=winners", { show: "all", sort: "rank", packsOpen: false, jumpsOpen: false });
  assert.equal(new URL(d.href).search, "?a=1");
  const same = UrlView.lookbackApplyViewUrl("https://x.test/s?lb_show=agree", { show: "agree", sort: "rank", packsOpen: false, jumpsOpen: false });
  assert.equal(same.changed, false);
  const src = readFileSync(new URL("../src/components/RoeLookbackNote.tsx", import.meta.url), "utf8");
  const i = src.indexOf("lookbackApplyViewUrl(window.location.href, a)"); assert.ok(i > 0 && i > src.indexOf("if (!p.ok) { say(lookbackApplyViewToast(p)); return; }"));
  console.log("ok · apply view syncs lb_* URL (rejects leave URL)");
}

{ // \\ copies ⧉ Link
  assert.ok(lookbackCopyLinkKey({ key: "\\" })); assert.ok(!lookbackCopyLinkKey({ key: "\\", targetTag: "INPUT" })); assert.ok(!lookbackCopyLinkKey({ key: "\\", editable: true })); assert.ok(!lookbackCopyLinkKey({ key: "\\", ctrlKey: true })); assert.ok(!lookbackCopyLinkKey({ key: "\\", metaKey: true })); assert.ok(!lookbackCopyLinkKey({ key: "\\", altKey: true })); assert.ok(!lookbackCopyLinkKey({ key: "|" })); assert.ok(!lookbackCopyLinkKey({ key: "-" })); assert.ok(!lookbackCopyLinkKey(null));
  assert.ok(!lookbackCopyViewKey({ key: "\\" }) && !lookbackApplyViewKey({ key: "\\" }) && !lookbackResetViewKey({ key: "\\" }));
  assert.ok(LOOKBACK_KEYMAP.some((r) => r.key === "\\" && r.does.includes("⧉ Link")));
  const srcL = readFileSync(new URL("../src/components/RoeLookbackNote.tsx", import.meta.url), "utf8"); assert.ok(srcL.includes("lookbackCopyLinkKey(") && srcL.includes(`'[data-roe-summary-copy-link="1"]'`));
  console.log("ok lookback \\\\ copy link key");
}

{ // ⇩ Apply link (clipboard URL → lb_*)
  const P = UrlView.parseLookbackLinkText;
  const ok = P("https://x.test/workbench/status?lb_show=beaten&lb_jumps=1&x=2");
  assert.ok(ok.ok && ok.n === 2 && ok.view.show === "beaten" && ok.view.jumps === true);
  assert.ok(P(" https://x.test/workbench/status/?lb_sort=dphi ").ok);
  for (const [t, r] of [["not a url", "not a URL"], ["javascript:alert(1)", "not a URL"], ["https://x.test/workbench/medicare?lb_show=all", "wrong path"], ["https://x.test/workbench/status?lb_show=zzz", "no valid lb_*"], ["", "clipboard empty"]] as const) { const x = P(t); assert.ok(!x.ok && x.reason.includes(r), t); }
  assert.ok(UrlView.lookbackApplyLinkToast(ok).includes("2 params") && UrlView.lookbackApplyLinkToast({ ok: false, reason: "not a URL" }).startsWith("⚠"));
  const src = readFileSync(new URL("../src/components/RoeLookbackNote.tsx", import.meta.url), "utf8");
  assert.ok(src.includes('data-roe-summary-apply-link="1"') && src.includes("parseLookbackLinkText(txt)"));
  console.log("ok · apply link");
}
{ // ⇩ Apply link first-use pulse
  const S = UrlView.lookbackApplyLinkShouldPulse, Pu = UrlView.lookbackApplyLinkPulse, MS = UrlView.LOOKBACK_APPLY_LINK_PULSE_MS;
  assert.ok(S(false, true) && !S(true, true) && !S(false, false) && !S(false, undefined));
  assert.ok(Pu(1000, 1500) && !Pu(1000, 1000 + MS) && !Pu(null, 5) && !Pu(1000, 900));
  const src = readFileSync(new URL("../src/components/RoeLookbackNote.tsx", import.meta.url), "utf8");
  assert.ok(src.includes("data-roe-apply-link-pulsing") && src.includes("lookbackApplyLinkShouldPulse(alPulsedRef.current, true)"));
  console.log("ok · apply link pulse");
}
{ // ↺ Reset view first-use pulse
  const S = UrlView.lookbackResetViewShouldPulse, Pu = UrlView.lookbackResetViewPulse, MS = UrlView.LOOKBACK_RESET_VIEW_PULSE_MS;
  assert.ok(S(false, 1) && S(false, 6) && !S(true, 3) && !S(false, 0) && !S(false, undefined) && !S(false, NaN) && !S(false, "2"));
  assert.ok(Pu(1000, 1500) && !Pu(1000, 1000 + MS) && !Pu(null, 5) && !Pu(1000, 900));
  const src = readFileSync(new URL("../src/components/RoeLookbackNote.tsx", import.meta.url), "utf8");
  assert.ok(src.includes("data-roe-reset-view-pulsing") && src.includes("lookbackResetViewShouldPulse(rvPulsedRef.current, rvCleared + lbStripped)"));
  console.log("ok · reset view pulse");
}
{ // ⧉ Link first-use pulse
  const S = UrlView.lookbackCopyLinkShouldPulse, Pu = UrlView.lookbackCopyLinkPulse, MS = UrlView.LOOKBACK_COPY_LINK_PULSE_MS;
  assert.ok(S(false, true) && !S(true, true) && !S(false, false) && !S(false, undefined));
  assert.ok(Pu(1000, 1500) && !Pu(1000, 1000 + MS) && !Pu(null, 5) && !Pu(1000, 900));
  const src = readFileSync(new URL("../src/components/RoeLookbackNote.tsx", import.meta.url), "utf8");
  assert.ok(src.includes("data-roe-copy-link-pulsing") && src.includes("lookbackCopyLinkShouldPulse(linkPulsedRef.current, true)"));
  console.log("ok · copy link pulse");
}
{ const U = UrlView; const base = { show: "all" as const, sort: "rank" as const, packs: false, jumps: false };
  assert.deepEqual(U.serializeLookbackUrlView({ ...base, focus: null, expand: false }), {});
  assert.deepEqual(U.serializeLookbackUrlView({ ...base, focus: "run-1", expand: true }), { lb_focus: "run-1", lb_expand: "1" });
  assert.deepEqual(U.serializeLookbackUrlView({ ...base, focus: "bad id<>" }), {});
  assert.deepEqual(U.parseLookbackUrlView("lb_focus=run-1&lb_expand=1"), { focus: "run-1", expand: true });
  assert.deepEqual(U.parseLookbackUrlView("lb_focus=%3Cx%3E&lb_expand=yes"), {});
  assert.equal(U.parseLookbackUrlView("lb_expand=0").expand, false);
  assert.equal(U.lookbackUrlWithView("https://x.test/workbench/status?lb_focus=old&lb_expand=1#h", base), "https://x.test/workbench/status#h");
  assert.equal(U.stripLookbackUrlParams("https://x.test/workbench/status?lb_focus=a&lb_expand=1&k=1").href, "https://x.test/workbench/status?k=1");
  assert.equal(U.lookbackApplyViewUrl("https://x.test/workbench/status", { show: "all", sort: "rank", packsOpen: false, jumpsOpen: false, focusRunId: "p1", expandAll: true }).href, "https://x.test/workbench/status?lb_focus=p1&lb_expand=1");
  const r = U.parseLookbackLinkText("https://x.test/workbench/status?lb_focus=p1"); assert.ok(r.ok && r.view.focus === "p1");
  assert.match(U.lookbackApplyLinkToast(r), /focus p1/);
  { const st = { show: "winners" as const, sort: "dphi" as const, packsOpen: true, jumpsOpen: false, focusRunId: "p1", expandAll: true };
    const su = U.lookbackShareableViewUrl("https://x.test/workbench/status?lb_focus=old&k=1#h", st)!; const sp = new URL(su).searchParams;
    assert.equal(sp.get("lb_focus"), "p1"); assert.equal(sp.get("lb_expand"), "1"); assert.equal(sp.get("lb_show"), "winners"); assert.equal(sp.get("lb_sort"), "dphi"); assert.equal(sp.get("lb_packs"), "1"); assert.equal(sp.get("k"), "1");
    assert.equal(U.lookbackShareableViewUrl("https://x.test/workbench/status", { ...st, focusRunId: "<x>", expandAll: false })!.includes("lb_focus"), false);
    assert.equal(U.lookbackShareableViewUrl("ftp://x/workbench/status", st), null); assert.equal(U.lookbackShareableViewUrl("nope", st), null);
    const nsrc = readFileSync(require("path").join(__dirname, "../src/components/RoeLookbackNote.tsx"), "utf8") as string; assert.ok(nsrc.includes("lookbackShareableViewUrl(window.location.href")); assert.ok(!/cmpViewUrl = \(\) => \{ try \{ return lookbackUrlWithView/.test(nsrc));
    console.log("ok: lookbackShareableViewUrl -> all look-back pack view_urls carry lb_focus / lb_expand"); }
  console.log("url focus   -> lb_focus / lb_expand optional; defaults + invalid omitted; link/apply/reset sync"); }
