/**
 * Commercial diagnostic primitive.
 * Maps closed-loop (y, z, e, Δe) onto a validation case.
 * Not a medical device. No PHI. No unsupervised diagnosis.
 */
import type { Gate, YAction } from "@/lib/closed-loop";

export type ReferenceKind =
  | "clinical_guideline"
  | "regulatory_ruleset"
  | "historical_outcome"
  | "process_gate";

export type SubjectKind =
  | "patient_process"
  | "compliance_process"
  | "ops_process";

export type DiagnosticFactor = {
  id: string;
  label: string;
  present: boolean;
  required: boolean;
  confidence: number;
  source?: string;
};

export type DiagnosticCaseInput = {
  case_id: string;
  domain: string;
  subject_kind: SubjectKind;
  presentation: string;
  factors: DiagnosticFactor[];
  symptoms: string[];
  vitals: Record<string, number | string>;
  risk_factors: string[];
  hypothesis: string | null;
  hypothesis_confidence: number;
  recommended_pathway: string | null;
  contradictions: { source: string; note: string }[];
};

export type ReferenceFramework = {
  id: string;
  kind: ReferenceKind;
  label: string;
  ruleset_id: string;
  required_prerequisites: string[];
  forbidden_without: string[];
  target_gate: Gate | "COMPLIANCE_REVIEW";
  notes: string;
};

export type MeasurementZ = {
  z: string;
  z_value: number;
  completeness: number;
  contradiction: number;
  missing: number;
  uncertainty: number;
  independent_check: number;
};

export type ErrorBreakdown = {
  e: number;
  missing_prereq: number;
  contradiction: number;
  confidence_mismatch: number;
  pathway_violation: number;
  spikes: string[];
};

export type DiagnosticRecord = {
  input: DiagnosticCaseInput;
  reference: ReferenceFramework;
  y: YAction | "pathway_select";
  action_label: string;
  z: MeasurementZ;
  error: ErrorBreakdown;
  gate: Gate;
  confidence: number;
};

export type DiagnosticRunState = {
  run_id: string;
  t: number;
  record: DiagnosticRecord;
  e0: number;
  e_now: number;
  delta_e: number;
  history: DiagnosticRecord[];
  frozen: boolean;
};

export const DEFAULT_REFERENCE: ReferenceFramework = {
  id: "ref-evidence-gate-v1",
  kind: "process_gate",
  label: "Evidence completeness gate",
  ruleset_id: "aethel.process.evidence.v1",
  required_prerequisites: [
    "patient-evidence",
    "measurements",
    "history",
    "provenance",
    "independent-check",
  ],
  forbidden_without: ["independent-check"],
  target_gate: "HOLD",
  notes:
    "Hold until required fields exist and contradictions are resolved. Route complete packs to review. Never emit a diagnosis.",
};

export const COMPLIANCE_REFERENCE: ReferenceFramework = {
  id: "ref-regulatory-checklist-v1",
  kind: "regulatory_ruleset",
  label: "Regulatory checklist gate",
  ruleset_id: "aethel.compliance.checklist.v1",
  required_prerequisites: [
    "source-document",
    "control-owner",
    "exception-log",
    "independent-check",
  ],
  forbidden_without: ["control-owner", "independent-check"],
  target_gate: "HOLD",
  notes:
    "Reject a pathway that skips control ownership or an independent check.",
};

export function factorsFromLists(available: string[], missing: string[]): DiagnosticFactor[] {
  return [
    ...available.map((id) => ({
      id,
      label: id,
      present: true,
      required: true,
      confidence: 0.8,
    })),
    ...missing.map((id) => ({
      id,
      label: id,
      present: false,
      required: true,
      confidence: 0,
    })),
  ];
}

export function emptyVitals(): Record<string, number | string> {
  return {};
}

export function createCaseInput(partial: Partial<DiagnosticCaseInput> & { case_id: string }): DiagnosticCaseInput {
  return {
    domain: "safety",
    subject_kind: "patient_process",
    presentation: "",
    factors: [],
    symptoms: [],
    vitals: emptyVitals(),
    risk_factors: [],
    hypothesis: null,
    hypothesis_confidence: 0,
    recommended_pathway: null,
    contradictions: [],
    ...partial,
  };
}