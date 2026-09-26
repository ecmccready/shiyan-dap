export const ACTIONS_1D = [10, 5, -5, -10] as const;
export type Action1D = (typeof ACTIONS_1D)[number];

export const QUALITY_ACTIONS = [
  "observe",
  "complete_field",
  "resolve_contradiction",
  "fill_missing",
  "reduce_uncertainty",
  "execute_task",
  "hold",
] as const;
export type QualityAction = (typeof QUALITY_ACTIONS)[number];

export type BQuality = {
  completeness: number;
  contradiction: number;
  missing: number;
  uncertainty: number;
  useful: number;
};

export type Mode = "scalar" | "quality";

export type StepRecord = {
  t: number;
  mode: Mode;
  y: string;
  B: number | BQuality;
  B_next: number | BQuality;
  z: string;
  z_value: number;
  e: number;
  V: number;
  operator_chose_action: boolean;
  locked: boolean;
  dominant: string;
  confidence: number;
};

export type Memory = {
  ledger: StepRecord[];
  last_z: string | null;
  last_err: number;
  last_dominant: string | null;
};

export type ControllerA = {
  role: "controller";
  y: string;
  confidence: number;
  candidates: { action: string; score: number; locked: boolean }[];
  locked: boolean;
};

export type SafetyY = "HOLD" | "CLINICIAN_REVIEW" | "ESCALATE";

export type SafetyState = {
  domain: "safety";
  candidate: string | null;
  status: "validated" | "unresolved";
  required: string[];
  available: string[];
  contradictions: { source: string; note: string }[];
  y: SafetyY;
  e: string;
  limitation: string;
};