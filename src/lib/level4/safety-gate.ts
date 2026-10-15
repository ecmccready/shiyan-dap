import type { GoalContract } from "./goal";

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