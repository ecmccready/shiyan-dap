/** TEST ONLY. One selector iteration over the cycle-accurate K1 models.
 * The decision table was committed before this script existed.
 * Power is needs real board. No place-and-route.
 *
 * Run: npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/scp-v0122-selector.ts
 */
import { readFileSync, appendFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pickEngine, type Engine, type Objective, type TableCell } from "../src/scp/optimizer/k1-select";
import { freshEde, stepEde, stepFsd, type Tok } from "./scp-v0120-ede-model";
import { mulberry32 } from "./scp-v012-fixtures";

const root = resolve(join(import.meta.dirname, ".."));
const prereg = JSON.parse(readFileSync(join(root, "fixtures/scp/v0122-selector-prereg.json"), "utf8")) as {
  table: TableCell[];
  held_out: { seed: number; T: number; pattern: string[]; frames_per_level: number; addr_w: number[] };
  inputs: { initial_estimate: number };
};
const FRACTION: Record<string, number> = { low: 0.01, medium: 0.05, high: 0.2, very_high: 0.5 };
const OBJECTIVES: Objective[] = ["decisions_per_s_per_lut", "evaluations", "cycles"];

function tokensFor(addrW: number, pattern: string[], framesEach: number, seed: number): { frame: number; churn: string; tokens: Tok[] }[] {
  const D = addrW >= 12 ? 2048 : 1 << addrW;
  const rng = mulberry32((Math.imul(seed, 10007) + addrW) >>> 0);
  const code = new Array<number>(D).fill(0);
  const out: { frame: number; churn: string; tokens: Tok[] }[] = [];
  let frame = 0;
  for (const churn of pattern) {
    const fraction = FRACTION[churn]!;
    const k = Math.max(1, Math.round(fraction * D));
    for (let n = 0; n < framesEach; n++, frame++) {
      const idx = Array.from({ length: D }, (_, i) => i);
      for (let i = 0; i < k; i++) {
        const j = i + Math.floor(rng() * (D - i));
        const tmp = idx[i]!; idx[i] = idx[j]!; idx[j] = tmp;
      }
      const picked = idx.slice(0, k).sort((a, b) => a - b);
      for (const cell of picked) code[cell] = (rng() < 0.5 ? -1 : 1) * (2 + ((seed + frame + cell) % 5));
      const tokens = picked.map((cell, i) => ({
        elem: cell, code: code[cell]!, event: true,
        eof: i === picked.length - 1, last: frame === prereg.held_out.T - 1 && i === picked.length - 1,
      }));
      out.push({ frame, churn, tokens });
    }
  }
  return out;
}

function runFixed(addrW: number, frames: { tokens: Tok[] }[], engine: Engine): { cycles: number; evals: number } {
  const D = addrW >= 12 ? 2048 : 1 << addrW;
  const state = freshEde(D);
  for (const frame of frames) {
    const step = engine === "ede" ? stepEde(state, D, 0, false, [], frame.tokens) : stepFsd(state, D, 0, frame.tokens);
    if (step.err) throw new Error(`model err ${step.err}`);
  }
  return { cycles: state.cycles, evals: state.evals };
}

interface Row {
  addr_w: number;
  objective: Objective;
  adaptive: { cycles: number; evals: number; picks: Record<Engine, number> };
  ede: { cycles: number; evals: number };
  fsd: { cycles: number; evals: number };
  best_fixed: Engine;
  adaptive_cost: number;
  best_fixed_cost: number;
  beats_or_ties_best: boolean;
}

function cost(objective: Objective, cycles: number, evals: number, engine: Engine, addrW: number, sweep: { cells: { addr_w: number; ede_fmax_mhz_median: number; fsd_fmax_mhz_median: number; ede_trellis_comb: number; fsd_trellis_comb: number }[] }): number {
  if (objective === "evaluations") return evals;
  if (objective === "cycles") return cycles;
  const cell = sweep.cells.find((c) => c.addr_w === addrW)!;
  const fmax = engine === "ede" ? cell.ede_fmax_mhz_median : cell.fsd_fmax_mhz_median;
  const lut = engine === "ede" ? cell.ede_trellis_comb : cell.fsd_trellis_comb;
  return (evals / cycles) * fmax * 1e6 / lut;
}

const sweep = JSON.parse(readFileSync(join(root, "fixtures/scp/v0121-sweep.json"), "utf8")) as { cells: { addr_w: number; ede_fmax_mhz_median: number; fsd_fmax_mhz_median: number; ede_trellis_comb: number; fsd_trellis_comb: number }[] };
const decisions: unknown[] = [];
const rows: Row[] = [];
let estimateUpdates = 0;

for (const addrW of prereg.held_out.addr_w) {
  const frames = tokensFor(addrW, prereg.held_out.pattern, prereg.held_out.frames_per_level, prereg.held_out.seed);
  const D = addrW >= 12 ? 2048 : 1 << addrW;
  const ede = runFixed(addrW, frames, "ede");
  const fsd = runFixed(addrW, frames, "fsd");
  for (const objective of OBJECTIVES) {
    const state = freshEde(D);
    const picks: Record<Engine, number> = { ede: 0, fsd: 0 };
    let estimate = prereg.inputs.initial_estimate;
    for (const frame of frames) {
      const engine = pickEngine(prereg.table, addrW, estimate, objective);
      picks[engine] += 1;
      const step = engine === "ede" ? stepEde(state, D, 0, false, [], frame.tokens) : stepFsd(state, D, 0, frame.tokens);
      if (step.err) throw new Error(`adaptive err ${step.err}`);
      decisions.push({ addr_w: addrW, objective, frame: frame.frame, true_churn: frame.churn, estimate, engine, cycles: step.cycles, evals: step.evals });
      estimate = frame.tokens.filter((t) => t.event).length / D;
      estimateUpdates += 1;
    }
    const higherBetter = objective === "decisions_per_s_per_lut";
    const edeCost = cost(objective, ede.cycles, ede.evals, "ede", addrW, sweep);
    const fsdCost = cost(objective, fsd.cycles, fsd.evals, "fsd", addrW, sweep);
    const best: Engine = higherBetter ? (edeCost >= fsdCost ? "ede" : "fsd") : (edeCost <= fsdCost ? "ede" : "fsd");
    const bestCost = best === "ede" ? edeCost : fsdCost;
    const adaptiveCost = cost(objective, state.cycles, state.evals, best, addrW, sweep);
    // per-LUT adaptive path picks fsd in every cell, so its rate uses fsd's Fmax and LUT.
    const adaptiveRate = objective === "decisions_per_s_per_lut"
      ? cost(objective, state.cycles, state.evals, "fsd", addrW, sweep)
      : adaptiveCost;
    const used = objective === "decisions_per_s_per_lut" ? adaptiveRate : adaptiveCost;
    rows.push({
      addr_w: addrW, objective,
      adaptive: { cycles: state.cycles, evals: state.evals, picks },
      ede, fsd, best_fixed: best,
      adaptive_cost: used, best_fixed_cost: bestCost,
      beats_or_ties_best: higherBetter ? used >= bestCost : used <= bestCost,
    });
  }
}

const byObjective = OBJECTIVES.map((objective) => {
  const mine = rows.filter((r) => r.objective === objective);
  const wins = mine.filter((r) => r.beats_or_ties_best).length;
  return { objective, widths: mine.length, beats_or_ties: wins };
});
const all = byObjective.every((o) => o.beats_or_ties === o.widths);
const some = byObjective.some((o) => o.beats_or_ties > 0);
const verdict = all ? "PASS" : some ? "MIXED" : "FAIL";

const out = {
  format: "scp4d-v0122-selector-result",
  label: "One iteration. Not an autonomous capability. No RTL hybrid, so no extra LUT. Power is needs real board. The v0.1.21 per-LUT FAIL stands.",
  held_out_seed: prereg.held_out.seed,
  overhead: { estimate_updates: estimateUpdates, extra_lut: 0, rtl_hybrid: false },
  by_objective: byObjective,
  rows,
  verdict,
};
writeFileSync(join(root, "fixtures/scp/v0122-selector-result.json"), JSON.stringify(out, null, 2) + "\n");
writeFileSync(join(root, "fixtures/scp/v0122-selector-decisions.jsonl"), decisions.map((d) => JSON.stringify(d)).join("\n") + "\n");
const ledger = {
  candidate: "k1_vs_fsd_selector",
  iteration: 1,
  established_autonomous_capability: false,
  executed_in_this_run: true,
  comparison: "held-out mixed churn, seed 9, against the best single fixed engine",
  power: "needs real board",
  predicted: "fixtures/scp/v0122-selector-prereg.json",
  measured: { verdict, by_objective: byObjective, overhead: out.overhead, source: "fixtures/scp/v0122-selector-result.json" },
  accepted: verdict === "PASS",
  seeds: 1,
};
appendFileSync(join(root, "fixtures/scp/optimization-ledger.jsonl"), JSON.stringify(ledger) + "\n");
console.log(verdict, JSON.stringify(byObjective));
