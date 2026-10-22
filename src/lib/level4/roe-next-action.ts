/**
 * ROE next-action objective (inspect-only).
 *
 *   a* = argmax_{a ∈ A_safe} [ E(e_t − e_{t+1} | s_t, a) − λ·C(a) − μ·R(a) ]
 *
 * A_safe: the distinct actions `y` of every step of a reusable run — a run with
 *   at least one entry passing isReusable (durable-self.ts, ROE-enforced). All of
 *   that run's steps contribute samples. No action is invented.
 *   gate_failures per candidate = samples whose roeForEntry G is false.
 * E[Δe|a]: mean per-step error reduction over those entries for action a:
 *   e_prev − e, where e_prev is the stored `e` of the same run's iteration − 1;
 *   for iteration 1, e0 − e; if neither is available, the stored cumulative
 *   delta_e (= e0 − e) is used and counted in `fallback_samples`.
 * C(a): no cost/budget field is stored on experience entries → 0 for every action.
 * R(a): mean of tensor_distance / tensor_epsilon (ε default 0.16, read from
 *   demo-tensor) over samples that carry a tensor; 0 when none do.
 * λ, μ default 0 (pure expected-improvement ranking); override via query.
 * Ties go to the later action in A_safe order (first-seen order of entries).
 *
 * live_selected is read through the existing planFromEntries / nextFromPlan,
 * unchanged. Nothing here feeds the autonomous loop.
 */
import type { ExperienceEntry } from "./experience-client";
import { isReusable, planFromEntries, nextFromPlan } from "./durable-self";
import { DEMO_TENSOR_EPSILON } from "./demo-tensor";
import { roeForEntry } from "./roe";

export type NextActionCandidate = {
  action: string;
  expected_delta_e: number;
  cost: number;
  risk: number;
  score: number;
  samples: number;
  fallback_samples: number;
  gate_failures: number;
};

export type RoeNextAction = {
  objective: "argmax E[de] - lambda*C - mu*R";
  lambda: number;
  mu: number;
  safe_set_rule: "all steps of runs with >=1 isReusable entry";
  reusable_runs: string[];
  proxies: { expected_delta_e: string; cost: string; risk: string };
  state: { run_id: string | null; applied: number };
  candidates: NextActionCandidate[];
  selected: string | null;
  live_selected: string | null;
  live_plan_run_id: string | null;
  agrees: boolean;
  note: "inspect-only; live loop unchanged";
};

const fin = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const r4 = (x: number) => Math.round(x * 1e4) / 1e4;

/** Per-step reduction e_{t-1} − e_t for a stored entry (see header). */
export function stepReduction(list: ExperienceEntry[], x: ExperienceEntry): { value: number | null; fallback: boolean } {
  if (!fin(x.e)) return { value: null, fallback: false };
  if (x.iteration === 1 && fin(x.e0)) return { value: x.e0 - x.e, fallback: false };
  const prev = list.find((p) => p.run_id === x.run_id && p.iteration === x.iteration - 1);
  if (prev && fin(prev.e)) return { value: prev.e - x.e, fallback: false };
  if (fin(x.delta_e)) return { value: x.delta_e, fallback: true };
  return { value: null, fallback: false };
}

export function roeNextAction(
  list: ExperienceEntry[],
  opts: { lambda?: number; mu?: number; run_id?: string | null; applied?: number; permitted?: string[] } = {}
): RoeNextAction {
  const lambda = fin(opts.lambda) ? opts.lambda : 0;
  const mu = fin(opts.mu) ? opts.mu : 0;
  const applied = fin(opts.applied) && opts.applied >= 0 ? Math.floor(opts.applied) : 0;
  const run_id = opts.run_id ?? null;
  const reusable_runs: string[] = [];
  for (const x of list) if ((!run_id || x.run_id === run_id) && isReusable(x) && !reusable_runs.includes(x.run_id)) reusable_runs.push(x.run_id);
  const reusable = list.filter((x) => reusable_runs.includes(x.run_id) && typeof x.y === "string");
  const order: string[] = [];
  for (const x of reusable) if (!order.includes(x.y as string)) order.push(x.y as string);
  const candidates = order.map((action) => {
    const xs = reusable.filter((x) => x.y === action);
    const red = xs.map((x) => stepReduction(list, x)).filter((r) => r.value != null);
    const E = red.length ? red.reduce((s, r) => s + (r.value as number), 0) / red.length : 0;
    const risks = xs.filter((x) => fin(x.tensor_distance)).map((x) => {
      const eps = fin((x as Record<string, unknown>).tensor_epsilon) ? ((x as Record<string, unknown>).tensor_epsilon as number) : DEMO_TENSOR_EPSILON;
      return (x.tensor_distance as number) / eps;
    });
    const R = risks.length ? risks.reduce((s, v) => s + v, 0) / risks.length : 0;
    const C = 0;
    return { action, expected_delta_e: r4(E), cost: C, risk: r4(R), score: r4(E - lambda * C - mu * R), samples: red.length, fallback_samples: red.filter((r) => r.fallback).length, gate_failures: xs.filter((x) => roeForEntry(x).G === false).length };
  });
  const best = candidates.reduce<NextActionCandidate | null>((a, b) => (a && a.score > b.score ? a : b), null);
  const plan = opts.permitted ? planFromEntries(list, opts.permitted) : null;
  const live_selected = plan ? nextFromPlan(plan, applied) : null;
  const selected = best ? best.action : null;
  return {
    objective: "argmax E[de] - lambda*C - mu*R",
    lambda, mu,
    safe_set_rule: "all steps of runs with >=1 isReusable entry",
    reusable_runs,
    proxies: {
      expected_delta_e: "mean(e_prev - e) over steps with y=a in reusable runs (iteration 1: e0 - e; else stored delta_e, counted as fallback)",
      cost: "0 (no cost/budget field stored on experience entries)",
      risk: "mean(tensor_distance / tensor_epsilon, eps default 0.16) over samples with a tensor; 0 if none",
    },
    state: { run_id, applied },
    candidates, selected, live_selected,
    live_plan_run_id: plan ? plan.run_id : null,
    agrees: selected != null && selected === live_selected,
    note: "inspect-only; live loop unchanged",
  };
}
