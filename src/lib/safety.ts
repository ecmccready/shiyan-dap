import { SafetyState } from "./types";

const REQUIRED = [
  "patient-evidence",
  "measurements",
  "history",
  "provenance",
  "independent-check",
];

export function evaluateSafety(input: {
  available: string[];
  contradictions: { source: string; note: string }[];
  candidate: string | null;
}): SafetyState {
  const missing = REQUIRED.filter((k) => !input.available.includes(k));
  const contradictory = input.contradictions.length > 0;
  const sufficient = missing.length === 0 && !contradictory;
  const escalationRequired = contradictory || missing.length > 0;
  const status = sufficient && !escalationRequired ? "validated" : "unresolved";
  const y = escalationRequired
    ? "ESCALATE"
    : status === "validated"
      ? "CLINICIAN_REVIEW"
      : "HOLD";

  return {
    domain: "safety",
    candidate: input.candidate,
    status,
    required: REQUIRED,
    available: input.available,
    contradictions: input.contradictions,
    y,
    e:
      status === "validated"
        ? "Evidence complete and consistent. Route to clinician review. Not a diagnosis."
        : `Unresolved. Missing=[${missing.join(", ")}] contradictions=${input.contradictions.length}.`,
    limitation:
      "Evidence gate only. Does not emit a diagnosis, does not eliminate misdiagnosis, makes no device claim.",
  };
}

export function demoUnresolved(): SafetyState {
  return evaluateSafety({
    available: ["patient-evidence", "history"],
    contradictions: [
      { source: "note-a", note: "supports candidate" },
      { source: "note-b", note: "conflicts with candidate" },
    ],
    candidate: null,
  });
}