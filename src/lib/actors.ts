import {
  computeB,
  recordOutcome,
  Self,
  yFromAsset,
  type OutcomeTransition,
  type YVector,
} from "@/lib/outcomes";

export type Actor = "A" | "B";

export type ProposeAction = "PROPOSE" | "LIST_INTENT" | "REQUEST_RESPONSE";
export type RespondAction = "ACK" | "DECLINE" | "REQUEST" | "RETURN";
export type ABAction = ProposeAction | RespondAction;

export const AGENT_A = "Agent A · ECMcCready";
export const AGENT_B = "Agent B · counterparty";

const LAST_Y = "shiyan-ab-y";

function readLastY(): YVector {
  if (typeof window === "undefined") return yFromAsset("listed");
  try {
    const raw = window.localStorage.getItem(LAST_Y);
    if (raw) return JSON.parse(raw) as YVector;
  } catch {
    /* empty */
  }
  return yFromAsset("listed");
}

function writeLastY(y: YVector) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LAST_Y, JSON.stringify(y));
}

export function runAB(input: {
  actor: Actor;
  action: ABAction;
  asset_id?: string;
}) {
  const before = readLastY();
  const after: YVector = { ...before };
  const actor = input.actor;
  const action = input.action;

  if (actor === "A" && !["PROPOSE", "LIST_INTENT", "REQUEST_RESPONSE"].includes(action)) {
    throw new Error("A may only propose");
  }
  if (actor === "B" && !["ACK", "DECLINE", "REQUEST", "RETURN"].includes(action)) {
    throw new Error("B may only respond");
  }

  const row: OutcomeTransition = recordOutcome({
    asset_id: input.asset_id || "ab_loop",
    action,
    y_before: before,
    y_after: after,
    vertical: "music",
    agent: actor === "A" ? AGENT_A : AGENT_B,
    simulated: false,
  });

  writeLastY(after);

  const self = Self();
  const b = computeB();

  return {
    protocol: "slice_v7",
    actor,
    action,
    settlement_written: false,
    row,
    self,
    computed_b: b,
    z: self.z,
    note: "Architecture proof. Settlement unchanged. Not Level 3.",
  };
}