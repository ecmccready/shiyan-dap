import type { GoalContract } from "./goal";
import type { ControllerRecord } from "./controller";
import { transition } from "./controller";
import { checkSafety } from "./safety-gate";
import { SelfFromApproved } from "../approved-experience";

export async function autonomousStep(
  goal: GoalContract,
  rec: ControllerRecord,
  client_id: string,
  workflow_version: string,
  model_version: string,
  fallbackY: string,
  currentCost: number
): Promise<ControllerRecord> {
  if (rec.state === "COMPLETE" || rec.state === "BLOCKED") return rec;

  let next = transition(rec, "PLANNING", "planning next action");

  const proposal = await SelfFromApproved(
    client_id,
    workflow_version,
    model_version,
    fallbackY
  );

  const safety = checkSafety(goal, proposal.y, next.iteration, currentCost);
  if (!safety.allowed) {
    return transition(next, "BLOCKED", safety.reason ?? "safety gate");
  }

  next = transition(next, "EXECUTING", `executing ${proposal.y}`);
  // Workbench B would execute here and return z, e
  // For this slice the measurement is assumed to be supplied by the caller

  next = transition(
    { ...next, iteration: next.iteration + 1 },
    "VERIFYING",
    "verifying outcome"
  );

  // Caller decides CONTINUE | COMPLETE based on success_condition and Δe
  return next;
}