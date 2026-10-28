/**
 * One-click reuse hand-off (additive, read-only).
 *
 * /workbench/autonomous?reuse=<run id> asks the run page to use that verified run's ordered action
 * sequence as its durable plan. The plan goes through the same gates as the best-Φ durable feed:
 *   1. the run has a reusable record (eligible, COMPLETE, Φ > 0, tensor within ε, ROE-eligible),
 *   2. its sequence is contiguous and inside the goal's permitted actions,
 *   3. the client-side replay vet (durable-vet.ts) passes: replayed e is no worse than the built-in
 *      sequence and meets the goal threshold.
 * If any gate fails the caller falls back to the existing behavior (best durable plan, then the built-in
 * sequence) and is told why. Nothing is written; the Level 4 loop, controller and engine are untouched.
 */
import type { ExperienceEntry } from "./experience-client";
import { loadExperienceServer } from "./experience-client";
import { isReusable, planFromEntries, sequenceOf, type DurablePlan } from "./durable-self";
import { vetDurablePlan, type DurableVet } from "./durable-vet";

export type ReuseOutcome = { requested: string; status: "applied" | "fallback"; reason: string };

const RUN_ID_RE = /^[A-Za-z0-9_-]{1,80}$/;

export function planForRun(
  list: ExperienceEntry[],
  runId: string,
  permitted: string[],
  currentRunId?: string
): { plan: DurablePlan | null; reason: string } {
  if (!RUN_ID_RE.test(runId)) return { plan: null, reason: "not a valid run id" };
  if (runId === currentRunId) return { plan: null, reason: "a run cannot reuse itself" };
  const cands = list.filter((x) => x.run_id === runId && isReusable(x));
  if (cands.length === 0) return { plan: null, reason: "no eligible COMPLETE record with Φ > 0 for that run" };
  const best = cands.reduce((a, b) => ((a.phi as number) > (b.phi as number) ? a : b));
  const sequence = sequenceOf(list, runId);
  if (!sequence) return { plan: null, reason: "that run's steps are not a contiguous sequence" };
  if (!sequence.every((y) => permitted.includes(y))) return { plan: null, reason: "that run used actions this goal does not permit" };
  return {
    plan: { source: "durable", run_id: runId, phi: best.phi as number, e: best.e as number, sequence, candidates: cands.length },
    reason: "ok",
  };
}

/** Pure core of resolveDurableSource, so it can be checked without a network. */
export function chooseDurableSource(
  list: ExperienceEntry[],
  permitted: string[],
  currentRunId: string,
  threshold: number | null,
  reuseId: string | null
): { plan: DurablePlan | null; vet: DurableVet; reuse: ReuseOutcome | null } {
  let reuse: ReuseOutcome | null = null;
  if (reuseId) {
    const r = planForRun(list, reuseId, permitted, currentRunId);
    if (r.plan) {
      const v = vetDurablePlan(r.plan, threshold);
      if (v.ok) {
        return { plan: r.plan, vet: v, reuse: { requested: reuseId, status: "applied", reason: v.reason } };
      }
      reuse = { requested: reuseId, status: "fallback", reason: v.reason };
    } else {
      reuse = { requested: reuseId, status: "fallback", reason: r.reason };
    }
  }
  const p = planFromEntries(list, permitted, currentRunId);
  const v = vetDurablePlan(p, threshold);
  return { plan: v.ok ? p : null, vet: v, reuse };
}

export async function resolveDurableSource(
  permitted: string[],
  currentRunId: string,
  threshold: number | null,
  reuseId: string | null
) {
  return chooseDurableSource(await loadExperienceServer(), permitted, currentRunId, threshold, reuseId);
}
