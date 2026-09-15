export type Bit = 0 | 1;
export type AgentX = "A" | "B";
export type BResolution = "resolved" | "unresolved" | "positive" | "negative" | "unknown";
export type TransitionClass = "positive" | "negative" | "no_movement" | "maintained";

export type YVector = {
  settlement: Bit;
  acquisition: Bit;
  audience_response: Bit;
  conversion: Bit;
  revenue: Bit;
  retention: Bit;
};

export type BState = {
  returned: boolean;
  settlement: Bit;
  class: TransitionClass | "none";
  resolution: BResolution;
  z: string;
};

export type ComputedB = {
  step: "B1" | "B2";
  action: "HOLD" | "MEASURE" | "PROVE" | "WAIT_EXTERNAL";
  e: Bit;
  z: string;
  source: string;
};

export type OutcomeTransition = {
  measurement_id: string;
  asset_id: string;
  action: string;
  vertical: string;
  agent: string;
  simulated: boolean;
  y_before: YVector;
  y_after: YVector;
  delta_y: Record<keyof YVector, number>;
  transition_class: TransitionClass;
  confidence: number;
  causal_confidence: number;
  measurement_window: string;
  baseline: string;
  timestamp: string;
};

const KEY = "shiyan-outcomes-v1";
const LAST = "shiyan-z";

const ZERO: YVector = {
  settlement: 0,
  acquisition: 0,
  audience_response: 0,
  conversion: 0,
  revenue: 0,
  retention: 0,
};

export function yFromAsset(state: string): YVector {
  const settled = state === "settled";
  const acquired = state === "escrow" || settled;
  return {
    settlement: settled ? 1 : 0,
    acquisition: acquired ? 1 : 0,
    audience_response: 0,
    conversion: 0,
    revenue: 0,
    retention: settled ? 1 : 0,
  };
}

export function classify(before: Bit, after: Bit): TransitionClass {
  if (before === 0 && after === 1) return "positive";
  if (before === 1 && after === 0) return "negative";
  if (before === 0 && after === 0) return "no_movement";
  return "maintained";
}

export function classifyVector(before: YVector, after: YVector): TransitionClass {
  const settle = classify(before.settlement, after.settlement);
  if (settle === "positive" || settle === "negative") return settle;
  if (before.audience_response === 0 && after.audience_response === 1) return "positive";
  if (before.audience_response === 1 && after.audience_response === 0) return "negative";
  if (after.settlement === 1) return "maintained";
  return "no_movement";
}

export function delta(before: YVector, after: YVector) {
  return {
    settlement: after.settlement - before.settlement,
    acquisition: after.acquisition - before.acquisition,
    audience_response: after.audience_response - before.audience_response,
    conversion: after.conversion - before.conversion,
    revenue: after.revenue - before.revenue,
    retention: after.retention - before.retention,
  };
}

export function f(y: YVector): Bit {
  return y.settlement;
}

export function gapToOne(y: YVector): Bit {
  return f(y) === 1 ? 0 : 1;
}

export function errorSignal(y: YVector, reference: Bit = 1): Bit {
  return (reference - f(y) === 0 ? 0 : 1) as Bit;
}

export function resolveB(outcomes: OutcomeTransition[] = readOutcomes()): BState {
  const live = outcomes.filter((row) => row.agent.includes("Agent B") && !row.simulated);
  const returned =
    live.some((row) => row.action === "RETURN") ||
    (typeof window !== "undefined" && window.localStorage.getItem("shiyan-b-return") === "1");
  const last = live[live.length - 1];

  if (!last) {
    return { returned: false, settlement: 0, class: "none", resolution: "unknown", z: "Observe." };
  }

  const settlement = last.y_after.settlement;
  const cls = last.transition_class;

  if (returned && settlement === 1 && cls === "maintained") {
    return { returned: true, settlement, class: cls, resolution: "resolved", z: "Hold." };
  }
  if (returned && cls === "positive") {
    return { returned: true, settlement, class: cls, resolution: "positive", z: "Continue." };
  }
  if (returned && cls === "negative") {
    return { returned: true, settlement, class: cls, resolution: "negative", z: "Correct." };
  }
  if (returned) {
    return { returned: true, settlement, class: cls, resolution: "unresolved", z: "Measure." };
  }
  if (settlement === 1) {
    return { returned: false, settlement, class: cls, resolution: "unresolved", z: "Measure." };
  }
  return { returned: false, settlement, class: cls, resolution: "unknown", z: "Observe." };
}

export function pairZ(yA: YVector, yB: YVector, returned = false): string {
  const b = resolveB();
  if (b.resolution === "resolved") return "B returned. Hold.";
  if (b.resolution === "positive") return "B improving. Continue.";
  if (b.resolution === "negative") return "B deteriorating. Correct.";
  if (b.resolution === "unresolved") return "B returned. Measure.";
  const a = f(yA);
  const liveB = f(yB);
  if (a === 1 && liveB === 1 && returned) return "B returned. Hold.";
  if (a === 1 && liveB === 1) return "Both at 1. Measure B from existing evidence.";
  if (a === 1 && liveB === 0) return "A is 1. Next best action is a real B payment.";
  if (a === 0 && liveB === 1) return "B is 1. Measure A again.";
  return "Neither is 1. Prove, then Buy.";
}

export function Self(outcomes: OutcomeTransition[] = readOutcomes()) {
  const b = resolveB(outcomes);
  const liveA = outcomes.filter((row) => row.agent.includes("Agent A") && !row.simulated).pop();
  const liveB = outcomes
    .filter((row) => row.agent.includes("Agent B") && !row.simulated && row.y_after.settlement === 1)
    .pop();
  const yA = liveA?.y_after || ZERO;
  const yB = liveB?.y_after || ZERO;
  return {
    yA: f(yA),
    eA: errorSignal(yA),
    yB: f(yB),
    eB: errorSignal(yB),
    audience: yA.audience_response,
    B: b.resolution,
    z: b.resolution === "resolved" ? "B returned. Hold." : pairZ(yA, yB, b.returned),
  };
}

export function computeB(outcomes: OutcomeTransition[] = readOutcomes()): ComputedB {
  const self = Self(outcomes);
  const audience = outcomes.some((row) => !row.simulated && row.action === "OBSERVE_AUDIENCE");
  const step: "B1" | "B2" = audience ? "B2" : "B1";

  if (self.B === "resolved" && self.eA === 0) {
    return { step, action: "HOLD", e: self.eA, z: self.z, source: "Self() + resolveB" };
  }
  if (self.eA === 0 && self.yB === 0) {
    return { step, action: "WAIT_EXTERNAL", e: self.eA, z: self.z, source: "A=1 B unset" };
  }
  if (self.eA === 1) {
    return { step, action: "PROVE", e: self.eA, z: self.z, source: "settlement off reference" };
  }
  return { step, action: "MEASURE", e: self.eA, z: self.z, source: "state incomplete" };
}

export function recordSelf() {
  const self = Self();
  const settled = yFromAsset("settled");
  const row = recordOutcome({
    asset_id: "self_loop",
    action: "SELF",
    y_before: settled,
    y_after: settled,
    vertical: "music",
    agent: "Self()",
    simulated: false,
  });
  if (typeof window !== "undefined") {
    window.localStorage.setItem(LAST, self.z);
  }
  persistOutcome(row, self.z);
  return self;
}

export function recordAudience(asset_id: string) {
  const prior = readOutcomes()
    .filter((row) => row.asset_id === asset_id && !row.simulated)
    .pop();
  const before = prior?.y_after || yFromAsset("settled");
  const after: YVector = { ...before, audience_response: 1 };
  return recordOutcome({
    asset_id,
    action: "OBSERVE_AUDIENCE",
    y_before: before,
    y_after: after,
    vertical: "music",
    agent: "Agent A · ECMcCready",
    simulated: false,
  });
}

export function readOutcomes(): OutcomeTransition[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function nextAction(outcomes: OutcomeTransition[]): string {
  return Self(outcomes).z;
}

export function persistOutcome(row: OutcomeTransition, z = "") {
  if (typeof window === "undefined") return;
  fetch("/api/memory", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "outcome", z, ...row }),
  }).catch(() => {});
}

export function recordOutcome(input: {
  asset_id: string;
  action: string;
  y_before: YVector;
  y_after: YVector;
  vertical?: string;
  agent?: string;
  simulated?: boolean;
}): OutcomeTransition {
  const row: OutcomeTransition = {
    measurement_id: "m_" + Date.now(),
    asset_id: input.asset_id,
    action: input.action,
    vertical: input.vertical || "music",
    agent: input.agent || "Agent B · this session",
    simulated: input.simulated ?? false,
    y_before: input.y_before,
    y_after: input.y_after,
    delta_y: delta(input.y_before, input.y_after),
    transition_class: classifyVector(input.y_before, input.y_after),
    confidence: 1,
    causal_confidence: input.simulated ? 0.1 : 0.2,
    measurement_window: "session",
    baseline: "previous_session",
    timestamp: new Date().toISOString(),
  };
  const all = [...readOutcomes(), row];
  const z = Self(all).z;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(KEY, JSON.stringify(all));
    window.localStorage.setItem(LAST, z);
  }
  persistOutcome(row, z);
  return row;
}

export function recordBReturn() {
  const settled = yFromAsset("settled");
  const row = recordOutcome({
    asset_id: "cl_sleep_terrors_001",
    action: "RETURN",
    y_before: settled,
    y_after: settled,
    vertical: "music",
    agent: "Agent B · potential customer",
    simulated: false,
  });
  if (typeof window !== "undefined") {
    window.localStorage.setItem("shiyan-b-return", "1");
    window.localStorage.setItem(LAST, "B returned. Hold.");
  }
  persistOutcome(row, "B returned. Hold.");
}

export function readZ() {
  if (typeof window === "undefined") return "Measure an asset.";
  return window.localStorage.getItem(LAST) || "Measure an asset.";
}

export function simulatePair(vertical: string, action: string, assetId: string) {
  const afterA: YVector = { ...ZERO, acquisition: 1 };
  const afterB: YVector = { ...afterA, settlement: 1 };
  recordOutcome({
    asset_id: assetId + ":a",
    action,
    y_before: ZERO,
    y_after: afterA,
    vertical,
    agent: "Agent A · ECMcCready",
    simulated: true,
  });
  recordOutcome({
    asset_id: assetId + ":b",
    action,
    y_before: afterA,
    y_after: afterB,
    vertical,
    agent: "Agent B · this session",
    simulated: true,
  });
}

export function getSelfImprovementMetrics() {
  const rows = readOutcomes();
  const self = Self(rows);
  const b = computeB(rows);
  return {
    count: rows.length,
    positive: rows.filter((r) => r.transition_class === "positive").length,
    negative: rows.filter((r) => r.transition_class === "negative").length,
    maintained: rows.filter((r) => r.transition_class === "maintained").length,
    no_movement: rows.filter((r) => r.transition_class === "no_movement").length,
    b_resolution: self.B,
    computed_b: b.action,
    z: self.z,
  };
}