export type ControllerState =
  | "READY"
  | "PLANNING"
  | "EXECUTING"
  | "VERIFYING"
  | "CONTINUE"
  | "COMPLETE"
  | "BLOCKED";

export type ControllerRecord = {
  goal_id: string;
  state: ControllerState;
  iteration: number;
  last_e: number | null;
  history: { state: ControllerState; at: string; note: string }[];
  blocked_reason?: string;
  /** Applied actions, in order. Replayed on the core plant to measure e. */
  actions?: string[];
  /** Error before the first action (from the core engine). */
  e0?: number | null;
};

export function transition(
  rec: ControllerRecord,
  next: ControllerState,
  note: string
): ControllerRecord {
  return {
    ...rec,
    state: next,
    history: [
      ...rec.history,
      { state: next, at: new Date().toISOString(), note },
    ],
  };
}

// Domain-agnostic view of a controller record (additive). See ./systemic.ts.
export { controllerToWorkbenchRun } from "./systemic";
export type { SystemicState, WorkbenchRun } from "./systemic";
