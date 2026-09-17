import { computeB, Self, type ComputedB } from "@/lib/outcomes";

export type ExternalEvent =
  | "audience_listen"
  | "checkout_opened"
  | "checkout_abandoned"
  | "stripe_settled"
  | "bounce";

export type ValidationRecord = {
  validation_id: string;
  asset_id: string;
  action_id: string;
  b: ComputedB["action"];
  expected: string;
  external_event: ExternalEvent;
  observed: string;
  error: 0 | 1;
  z_before: string;
  z_after: string;
  next_b: ComputedB["action"];
  source: "external-sensor";
  level3: false;
  settlement_written: false;
  at: string;
};

const KEY = "shiyan-validation-v1";

export const EVENT_EXPECT = {
  audience_listen: "audience_response=1",
  checkout_opened: "checkout_session_created",
  checkout_abandoned: "checkout_not_settled",
  stripe_settled: "stripe_status=settled",
  bounce: "no_conversion",
} as const;

export function readValidations(): ValidationRecord[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

function writeValidations(rows: ValidationRecord[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(rows));
}

export function scoreError(expected: string, observed: string): 0 | 1 {
  return expected.trim() === observed.trim() ? 0 : 1;
}

export function recordValidation(input: {
  asset_id: string;
  external_event: ExternalEvent;
  observed: string;
  expected?: string;
}): ValidationRecord {
  const before = computeB();
  const selfBefore = Self();
  const expected = input.expected || EVENT_EXPECT[input.external_event];
  const error = scoreError(expected, input.observed);
  const after = computeB();
  const selfAfter = Self();

  const row: ValidationRecord = {
    validation_id: "v_" + Date.now(),
    asset_id: input.asset_id,
    action_id: before.action + ":" + input.external_event,
    b: before.action,
    expected,
    external_event: input.external_event,
    observed: input.observed,
    error,
    z_before: selfBefore.z,
    z_after: selfAfter.z,
    next_b: after.action,
    source: "external-sensor",
    level3: false,
    settlement_written: false,
    at: new Date().toISOString(),
  };

  writeValidations([row, ...readValidations()].slice(0, 40));

  if (typeof window !== "undefined") {
    fetch("/api/memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "validation", z: row.z_after, ...row }),
    }).catch(() => {});
  }

  return row;
}

export function trialStats(rows: ValidationRecord[] = readValidations()) {
  const n = rows.length;
  const wrong = rows.filter((row) => row.error === 1).length;
  return {
    trials: n,
    matches: n - wrong,
    errors: wrong,
    rate: n === 0 ? 0 : (n - wrong) / n,
    note: "Match rate is not Level 3 and not improvement of B.",
  };
}