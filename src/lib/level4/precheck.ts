import type { GoalContract } from "./goal";
import type { ControllerRecord } from "./controller";

export type PrecheckResult =
  | { ok: true }
  | { ok: false; reason: string };

export function precheckAction(
  goal: GoalContract,
  rec: ControllerRecord,
  proposedAction: string,
  estimatedCost = 0
): PrecheckResult {
  if (rec.state === "COMPLETE" || rec.state === "BLOCKED") {
    return { ok: false, reason: `run already ${rec.state}` };
  }

  if (rec.iteration >= goal.max_iterations) {
    return { ok: false, reason: "max iterations reached" };
  }

  if (estimatedCost > goal.max_cost) {
    return { ok: false, reason: "estimated cost exceeds budget" };
  }

  if (!goal.permitted_actions.includes(proposedAction)) {
    return { ok: false, reason: `action not permitted: ${proposedAction}` };
  }

  if (goal.require_approval_for.includes(proposedAction)) {
    return { ok: false, reason: `action requires approval: ${proposedAction}` };
  }

  return { ok: true };
}