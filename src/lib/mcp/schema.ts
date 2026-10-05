/**
 * Open loop contract.
 * A partner Workbench B implements this. Controller A does not import B.
 * Self() is not in this file. Prior Runs are not in this file.
 */
export const MCP_PROTOCOL = "2024-11-05" as const;
export const AETHEL_CONTRACT = "aethel.loop.v1" as const;

export type LoopVarName = "y" | "z" | "e" | "delta_e" | "phi";

export type YName =
  | "observe"
  | "complete_field"
  | "resolve_contradiction"
  | "fill_missing"
  | "request_independent_check"
  | "hold"
  | "escalate"
  | "clinician_review"
  | "mark_boundary"
  | "seal_pack";

/** Outside Self(). The only sequence Proof and the flywheel are allowed to claim. */
export const SEALED_SEQUENCE: YName[] = [
  "mark_boundary",
  "complete_field",
  "request_independent_check",
  "seal_pack",
];

export type LoopObservation = {
  y: YName;
  z: string;
  z_value: number;
  e: number;
  e_next: number;
  delta_e: number;
  gate: "HOLD" | "CLINICIAN_REVIEW" | "ESCALATE";
  phi: number | null;
};

export type ReferenceTruth = {
  uri: "aethel://reference_truth";
  domain: string;
  required_fields: string[];
  reference_gate: "HOLD";
  rule: "final e is the win. a shorter path is a note. a tie is not a win.";
};

export type DiagnosticCase = {
  id: string;
  label: string;
  cold_final_e: number;
  reuse_final_e: number;
  phi: number;
  sequence: YName[];
  note: string;
};

/** Recorded 2026-10-03, commit cbb3391e. Not recomputed here. */
export const RECORDED_PACKS: DiagnosticCase[] = [
  {
    id: "incomplete-evidence",
    label: "Incomplete evidence pack",
    cold_final_e: 0.165,
    reuse_final_e: 0.151,
    phi: 0.014,
    sequence: SEALED_SEQUENCE,
    note: "Cold Self() 1.561 → 0.165. Reuse final 0.151.",
  },
  {
    id: "missing-measurements",
    label: "Missing measurements",
    cold_final_e: 0.216,
    reuse_final_e: 0.151,
    phi: 0.065,
    sequence: SEALED_SEQUENCE,
    note: "Cold Self() 1.399 → 0.216. Reuse final 0.151.",
  },
  {
    id: "provenance-gap",
    label: "Provenance gap",
    cold_final_e: 0.216,
    reuse_final_e: 0.151,
    phi: 0.065,
    sequence: SEALED_SEQUENCE,
    note: "Cold Self() 1.399 → 0.216. Reuse final 0.151.",
  },
];

export type McpTool = {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, { type: string; description?: string }>;
    required?: string[];
  };
};

export const MCP_TOOLS: McpTool[] = [
  {
    name: "mark_boundary",
    description: "Mark the pack boundary. Does not change e. First step of the sealed sequence, outside Self().",
    inputSchema: { type: "object", properties: { case_id: { type: "string" } } },
  },
  {
    name: "complete_field",
    description: "Fill a required field on Workbench B and rescore e.",
    inputSchema: { type: "object", properties: { case_id: { type: "string" } } },
  },
  {
    name: "request_independent_check",
    description: "Request the independent check. Rescore e. Does not settle.",
    inputSchema: { type: "object", properties: { case_id: { type: "string" } } },
  },
  {
    name: "seal_pack",
    description: "Seal the pack. The seal is the drop. Returns z and scored e.",
    inputSchema: { type: "object", properties: { case_id: { type: "string" } } },
  },
  {
    name: "score_error",
    description: "Score the current plant against reference truth. Returns e. Does not read prior Runs.",
    inputSchema: { type: "object", properties: { case_id: { type: "string" } } },
  },
  {
    name: "run_sealed_sequence",
    description: "Run the sealed sequence outside Self(). Phi is computed only against the cold final e supplied by the caller.",
    inputSchema: {
      type: "object",
      properties: {
        case_id: { type: "string" },
        cold_final_e: { type: "number", description: "Caller-supplied cold final. The server does not look it up in M." },
      },
      required: ["cold_final_e"],
    },
  },
];

export const MCP_RESOURCES = [
  { uri: "aethel://reference_truth", name: "reference_truth", mimeType: "application/json" },
  { uri: "aethel://diagnostic_cases", name: "diagnostic_cases", mimeType: "application/json" },
] as const;

export function phiOf(coldFinal: number, reuseFinal: number): number {
  return Number((coldFinal - reuseFinal).toFixed(3));
}

export function isErrorWin(phi: number): boolean {
  return phi > 0;
}