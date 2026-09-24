export type Check = {
  consistent: boolean;
  sufficient: boolean;
  contradictory: boolean;
  missingEvidence: boolean;
  escalationRequired: boolean;
};

export type DiagnosticState = {
  domain: "music" | "safety";
  candidate: string | null;
  status: "validated" | "unresolved";
  required: string[];
  available: string[];
  contradictions: { source: string; note: string }[];
  secondOrder: string[];
  checks: Check;
  y: "HOLD" | "CLINICIAN_REVIEW" | "ESCALATE";
  e: string;
  limitation: string;
};

export function evaluate(input: {
  available: string[];
  contradictions: { source: string; note: string }[];
  candidate: string | null;
}): DiagnosticState {
  const required = [
    "patient-evidence",
    "measurements",
    "history",
    "provenance",
    "independent-check",
  ];
  const available = input.available;
  const missing = required.filter((k) => !available.includes(k));
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
    required,
    available,
    contradictions: input.contradictions,
    secondOrder: [
      "What evidence is absent?",
      "What independent source conflicts?",
      "What would make this candidate wrong?",
    ],
    checks: {
      consistent: !contradictory,
      sufficient,
      contradictory,
      missingEvidence: missing.length > 0,
      escalationRequired,
    },
    y,
    e: contradictory
      ? "CONFLICT → unresolved"
      : missing.length
        ? "MISSING_EVIDENCE → unresolved"
        : "open for clinician review",
    limitation:
      "Detects, exposes, constrains, and escalates risk. Does not eliminate misdiagnosis. Not a medical device claim.",
  };
}

export function demoUnresolved(): DiagnosticState {
  return evaluate({
    available: ["patient-evidence", "history"],
    contradictions: [
      { source: "agent-1", note: "supports X" },
      { source: "lab", note: "conflicts with X" },
    ],
    candidate: null,
  });
}