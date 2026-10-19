/**
 * Vetting for the Self() durable feed (additive).
 *
 * Before /workbench/autonomous reuses a durable plan it replays the plan's
 * action sequence on a fresh plant with the measured helpers (core engine,
 * read-only). The plan is used only if its replayed final e is ≤ the built-in
 * REUSE_SEQUENCE's final e AND it meets the goal threshold (e < threshold).
 * Otherwise callers fall back to the built-in sequence.
 */
import type { YAction } from "../closed-loop";
import { measureActions, REUSE_SEQUENCE } from "./measured";
import type { DurablePlan } from "./durable-self";

export type DurableVet = {
  ok: boolean;
  reason: string;
  replay_e: number | null;
  builtin_e: number;
  threshold: number | null;
};

export function vetDurablePlan(plan: DurablePlan | null, threshold: number | null): DurableVet {
  const builtin_e = measureActions(REUSE_SEQUENCE).e;
  if (!plan) return { ok: false, reason: "no usable durable experience in the store", replay_e: null, builtin_e, threshold };
  let replay_e: number;
  try {
    replay_e = measureActions(plan.sequence as YAction[]).e;
  } catch {
    return { ok: false, reason: "durable sequence could not be replayed", replay_e: null, builtin_e, threshold };
  }
  if (replay_e > builtin_e)
    return { ok: false, reason: `replayed e ${replay_e.toFixed(3)} > built-in e ${builtin_e.toFixed(3)}`, replay_e, builtin_e, threshold };
  if (threshold != null && !(replay_e < threshold))
    return { ok: false, reason: `replayed e ${replay_e.toFixed(3)} does not meet goal e < ${threshold}`, replay_e, builtin_e, threshold };
  return { ok: true, reason: "replay meets goal and is no worse than built-in", replay_e, builtin_e, threshold };
}
