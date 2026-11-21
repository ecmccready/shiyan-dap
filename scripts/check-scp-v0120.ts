/** TEST ONLY. v0.1.20 proof-path check.
 * Counted checks recompute E1–E5 from the pre-registration and require the committed report
 * to match, the pre-registration hash to match, and the pre-registration commit to be an
 * ancestor of HEAD. A hypothesis verdict of MIXED or FAIL still passes the check: the check
 * fails only if the stored verdict is not the one the measurements produce, or a locked
 * threshold was edited.
 *
 * Run: npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-scp-v0120.ts
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { canonicalJson } from "../src/scp/measurement";
import { runAgent } from "../src/scp/subsystem";
import { makeGridworld } from "./scp-v0120-gridworld";
import { runProof, type V0120Prereg } from "./scp-v0120-proof";
import { runSelection } from "./scp-v0120-select-next";

const root = resolve(join(import.meta.dirname, ".."));
const PREREG = "fixtures/scp/v0120-prereg.json";
const REPORT = "fixtures/scp/v0120-proof-report.json";

let passed = 0;
const failures: string[] = [];
function check(name: string, cond: boolean, detail?: string): void {
  if (cond) { passed++; console.log(`ok   ${name}${detail ? ` — ${detail}` : ""}`); }
  else { failures.push(name); console.log(`FAIL ${name}${detail ? ` — ${detail}` : ""}`); }
}

const preregBytes = readFileSync(join(root, PREREG));
const prereg = JSON.parse(preregBytes.toString("utf8")) as V0120Prereg & {
  hypotheses: {
    H1: { pass: string; mixed: string; fail: string };
    H2: { retention_min: number; safe_disagree_max: number; pass: string };
    H3: { ratio_min: number; seeds_holding_min: number; seeds: number; pass: string };
    H4: { pass: string };
    H5: { fail: string };
  };
  locked_decisions: { hardware_default: string; power: string; energy_numeric_estimates: boolean };
  system_model: { decoder_cycle_tolerance_cycles: number; k1_cycle_tolerance_cycles: number };
  k1: { analytic_code_bits: number; declared_code_bits: number; default_mode: string };
  churn_levels: { id: string; fraction: number }[];
  seeds: number[];
  h3_h4_churns: string[];
  energy: string;
};
const preregSha = createHash("sha256").update(preregBytes).digest("hex");

check("prereg names the five locked hypotheses", ["H1", "H2", "H3", "H4", "H5"].every((id) => id in prereg.hypotheses));
check("H2 retention threshold is 0.99", prereg.hypotheses.H2.retention_min === 0.99 && prereg.hypotheses.H2.safe_disagree_max === 0);
check("H3 ratio threshold is 1.5, median of 5, holding in at least 4", prereg.hypotheses.H3.ratio_min === 1.5 && prereg.hypotheses.H3.seeds === 5 && prereg.hypotheses.H3.seeds_holding_min === 4);
check("H1 has no mixed band and H4/H5 sentences are the locked ones",
  prereg.hypotheses.H1.mixed === "none: this is a hard gate"
  && prereg.hypotheses.H4.pass.startsWith("scp4d bytes moved")
  && prereg.hypotheses.H5.fail.startsWith("no flip found"));
check("seeds are 1..5 and churn is 1%, 5%, 20%, 50%",
  JSON.stringify(prereg.seeds) === JSON.stringify([1, 2, 3, 4, 5])
  && prereg.churn_levels.map((c) => c.fraction).join(",") === "0.01,0.05,0.2,0.5"
  && prereg.h3_h4_churns.join(",") === "low,medium");
check("hardware default is temporal-only and energy estimates are off",
  prereg.locked_decisions.hardware_default === "temporal-only"
  && prereg.locked_decisions.power === "needs real board"
  && prereg.locked_decisions.energy_numeric_estimates === false
  && prereg.energy.startsWith("needs real board")
  && prereg.k1.default_mode === "temporal"
  && prereg.k1.analytic_code_bits === 16
  && prereg.k1.declared_code_bits === 32
  && prereg.system_model.decoder_cycle_tolerance_cycles === 0
  && prereg.system_model.k1_cycle_tolerance_cycles === 0);

const report = JSON.parse(readFileSync(join(root, REPORT), "utf8")) as {
  prereg_sha256: string;
  prereg_commit: string;
  body: { hypotheses: { id: string; verdict: string; reason: string }[]; agent_gap_max: number; e1: { verify_ok: boolean; deterministic: boolean }[] };
  reported_not_asserted: { energy: string; power: string };
};
check("report prereg sha256 matches the file", report.prereg_sha256 === preregSha, preregSha.slice(0, 12));
const commit = spawnSync("git", ["merge-base", "--is-ancestor", report.prereg_commit, "HEAD"], { cwd: root, encoding: "utf8" });
check("prereg commit is an ancestor of HEAD", commit.status === 0, report.prereg_commit.slice(0, 12));
const shown = spawnSync("git", ["show", `${report.prereg_commit}:${PREREG}`], { cwd: root });
const shownSha = shown.status === 0 ? createHash("sha256").update(shown.stdout).digest("hex") : "";
check("prereg commit blob matches the working file", shownSha === preregSha);

const a = runProof(prereg);
const b = runProof(prereg);
check("two proof runs are identical", canonicalJson(a) === canonicalJson(b));
check("committed report body matches a fresh run", canonicalJson(report.body) === canonicalJson(a));
check("agent analytic/instrumented gap is 0", a.agent_gap_max === 0 && report.body.agent_gap_max === 0);
check("E1 engine chains verify and repeat", a.e1.length === 2 && (a.e1 as { verify_ok: boolean; deterministic: boolean }[]).every((r) => r.verify_ok && r.deterministic));

for (const h of a.hypotheses) {
  const stored = report.body.hypotheses.find((x) => x.id === h.id);
  check(`hypothesis ${h.id} stored as measured (${h.verdict})`, stored?.verdict === h.verdict && stored?.reason === h.reason, h.reason);
}

const low = makeGridworld({ nx: 8, ny: 8, nz: 1, T: 16, seed: 1, episode: 0, churn: 0.01 });
const full = runAgent(low.surface.frames, low.surface.shape, low.surface.relations, "full_scan", false);
const event = runAgent(low.surface.frames, low.surface.shape, low.surface.relations, "event_driven", false);
check("event-driven agent evaluates fewer cells than full-scan at 1% churn", event.cells_evaluated < full.cells_evaluated && event.meter.gap_compute === 0 && full.meter.gap_compute === 0,
  `${event.cells_evaluated} < ${full.cells_evaluated}`);

const sel = runSelection();
const bench = JSON.parse(readFileSync(join(root, "fixtures/scp/v0119-industry-benchmark.json"), "utf8")) as {
  designs: Record<string, { fmax_mhz: { median: number } }>;
};
const splitGain = bench.designs["tdec-s-w4"].fmax_mhz.median / bench.designs["tdec-r-w4"].fmax_mhz.median - 1;
check("selector records a retrospective five-seed Fmax comparison and does not place-and-route",
  sel.pending_v0119 === false && sel.live.executed_in_this_run === false && sel.power === "needs real board"
  && sel.live.measured?.comparison === "retrospective"
  && sel.live.measured?.relative_gain === splitGain && sel.live.I === splitGain && splitGain > 0);
check("back-test as of v0.1.16 proposes the historical decoder issue-path split", sel.backtest.matches_historical_split && sel.backtest.top === "decoder_variant", sel.backtest.bottleneck);
check("five-seed ledger picks w_change next; the v0.1.17 recording still moves decoder_variant to pipeline_split",
  sel.live.chosen === "w_change" && sel.historical.ranking_changed && sel.historical.chosen === "pipeline_split" && sel.historical.ranking_before[0] === "decoder_variant");

const text = readFileSync(join(root, REPORT), "utf8");
check("report energy is needs real board and contains no numeric energy",
  report.reported_not_asserted.energy === "needs real board"
  && report.reported_not_asserted.power === "needs real board"
  && !/pJ|energy_pj|microwatt/i.test(text));

if (failures.length) {
  console.error(`FAIL check-scp-v0120 (${passed} passed, ${failures.length} failed)`);
  process.exit(1);
}
console.log(`PASS check-scp-v0120 (${passed} checks)`);
