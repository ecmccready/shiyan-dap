export type Bit = 0 | 1;

export type YVector = {
  settlement: Bit;
  acquisition: Bit;
  audience_response: Bit;
  conversion: Bit;
  revenue: Bit;
  retention: Bit;
};

export type TransitionClass = "positive" | "negative" | "no_movement" | "maintained";

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

function delta(before: YVector, after: YVector) {
  return {
    settlement: after.settlement - before.settlement,
    acquisition: after.acquisition - before.acquisition,
    audience_response: after.audience_response - before.audience_response,
    conversion: after.conversion - before.conversion,
    revenue: after.revenue - before.revenue,
    retention: after.retention - before.retention,
  };
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
  const last = outcomes[outcomes.length - 1];
  if (!last) return "Create, then Prove.";
  if (last.transition_class === "negative") {
    return "Do not repeat " + last.action + " in " + last.vertical + ".";
  }
  if (last.transition_class === "positive") {
    return "Repeat " + last.action + " on the next " + last.vertical + " asset.";
  }
  if (last.transition_class === "maintained") {
    return "Hold. Measure " + last.vertical + " again after Act.";
  }
  return "Act on Prove. Settlement is y.settlement = 1.";
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
    transition_class: classify(input.y_before.settlement, input.y_after.settlement),
    confidence: 1,
    causal_confidence: input.simulated ? 0.1 : 0.2,
    measurement_window: "session",
    baseline: "previous_session",
    timestamp: new Date().toISOString(),
  };
  const all = [...readOutcomes(), row];
  window.localStorage.setItem(KEY, JSON.stringify(all));
  window.localStorage.setItem(LAST, nextAction(all));
  return row;
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