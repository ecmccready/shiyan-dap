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
  currentCost: number,
  /**
   * Optional proposer. Defaults to SelfFromApproved (server-side KV).
   * Client pages pass a browser-safe proposer, since @vercel/kv cannot run in the browser.
   */
  propose: () => Promise<{ y: string; source?: string }> = () =>
    SelfFromApproved(client_id, workflow_version, model_version, fallbackY)
): Promise<ControllerRecord> {
  if (rec.state === "COMPLETE" || rec.state === "BLOCKED") return rec;

  let next = transition(rec, "PLANNING", "planning next action");

  let proposal: { y: string; source?: string };
  try {
    proposal = await propose();
  } catch {
    proposal = { y: fallbackY, source: "fallback" };
  }

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