import type { GoalContract } from "./goal";
import type { ControllerRecord } from "./controller";
import { precheckAction } from "./precheck";
import { alreadyApplied } from "./idempotency";
import type { SystemDomain } from "./systemic";

export function checkSafety(
  goal: GoalContract,
  proposedAction: string,
  currentIteration: number,
  currentCost: number
): { allowed: boolean; reason?: string } {
  if (!goal.permitted_actions.includes(proposedAction)) {
    return { allowed: false, reason: "action not permitted" };
  }
  if (currentIteration >= goal.max_iterations) {
    return { allowed: false, reason: "iteration budget exhausted" };
  }
  if (currentCost >= goal.max_cost) {
    return { allowed: false, reason: "cost budget exhausted" };
  }
  if (goal.require_approval_for.includes(proposedAction)) {
    return { allowed: false, reason: "requires human approval" };
  }
  return { allowed: true };
}

/* ------------------------------------------------------------------------ */
/* Domain-agnostic pre-action gate (additive; checkSafety is unchanged).    */
/* ------------------------------------------------------------------------ */


export type GateStage = "idempotency" | "precheck" | "safety";

export type GateDecision = {
  /** True only when every check passed and the action may run. */
  allowed: boolean;
  /** True when the action was already applied; the caller should skip (no-op), not block. */
  duplicate: boolean;
  /** Which check stopped the action, if any. */
  stage?: GateStage;
  reason?: string;
  /** Carried through unchanged; the gate never branches on it. */
  system: SystemDomain;
  actionKey: string;
};

/**
 * One gate for every domain. Composes, in order, the existing checks:
 *   1. idempotency  — alreadyApplied(actionKey) (or an injected isApplied)
 *   2. precheck     — precheckAction(goal, rec, action, cost)
 *   3. safety       — checkSafety(goal, action, rec.iteration, cost)
 * `budget` optionally overrides goal.max_cost for this decision only.
 * `system` is carried through for audit and is never used in a decision, so
 * the same inputs give the same decision for software, logistics, clinical
 * or any other domain.
 */
export function preCheckGate({
  system,
  actionKey,
  action,
  goal,
  rec,
  cost = 0,
  budget,
  isApplied = alreadyApplied,
}: {
  system: SystemDomain;
  actionKey: string;
  action: string;
  goal: GoalContract;
  rec: ControllerRecord;
  cost?: number;
  budget?: number;
  isApplied?: (key: string) => boolean;
}): GateDecision {
  const base = { system, actionKey };
  const g: GoalContract = typeof budget === "number" ? { ...goal, max_cost: budget } : goal;

  if (isApplied(actionKey)) {
    return { ...base, allowed: false, duplicate: true, stage: "idempotency", reason: "already applied" };
  }

  const pre = precheckAction(g, rec, action, cost);
  if (!pre.ok) {
    return { ...base, allowed: false, duplicate: false, stage: "precheck", reason: pre.reason };
  }

  const safe = checkSafety(g, action, rec.iteration, cost);
  if (!safe.allowed) {
    return { ...base, allowed: false, duplicate: false, stage: "safety", reason: safe.reason ?? "safety gate" };
  }

  return { ...base, allowed: true, duplicate: false };
}
