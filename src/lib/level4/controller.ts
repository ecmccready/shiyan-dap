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