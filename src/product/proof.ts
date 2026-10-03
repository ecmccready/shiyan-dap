/**
 * Milestones 2–4 for one commercial B.
 * Does not edit src/lib/closed-loop.ts. Milestone 1 is that freeze.
 */
import {
  LoopPlant,
  Namer,
  StepRec,
  YAction,
  Y_ACTIONS,
  caseById,
  freshPlant,
  stepLoop,
} from "@/lib/closed-loop";

export const SAFETY_B = {
  id: "Safety",
  accepts: ["case_id from the Safety reference pack"],
  actions: Y_ACTIONS,
  z: "distance of B after y: completeness, contradiction, missing, uncertainty, independent check",
  e: "distance to the reference gate, plus 0.25 if the gate does not match",
  delta_e: "e at start minus e after the last reducing step",
  not: "a diagnosis, a model score, or PHI",
} as const;

export const PROOF_CASES = [
  "case-incomplete-pack",
  "case-missing-measurements",
  "case-provenance-gap",
] as const;

const MEASURED: YAction[] = [
  "mark_boundary",
  "complete_field",
  "request_independent_check",
  "seal_pack",
];

export type RunArtifact = {
  run_id: string;
  B: string;
  initial_state: string;
  action_y: string;
  result_z: string;
  reference: string;
  error_e: string;
  delta_e: number;
  experience: string;
  next_action: string;
};

export type Arm = {
  label: string;
  case_id: string;
  title: string;
  steps: StepRec[];
  e0: number;
  e1: number;
  delta_e: number;
  escalates: number;
  used_prior: boolean;
  artifact: RunArtifact;
};

export type Flywheel = {
  cold: Arm[];
  reuse: Arm[];
  case2_better: boolean;
  case3_better: boolean;
};

function artifactOf(plant: LoopPlant, steps: StepRec[], used: boolean): RunArtifact {
  const c = caseById(plant.case_id);
  const last = steps[steps.length - 1];
  const B = plant.B;
  const e0 = steps[0]?.e ?? plant.M.last_e;
  const e1 = last?.e_next ?? plant.M.last_e;
  return {
    run_id: `proof_${plant.case_id}`,
    B: "Safety",
    initial_state: `missing=${B.missing} contradiction=${B.contradiction} completeness=${B.completeness}`,
    action_y: steps.map((s) => s.y).join(" -> ") || "none",
    result_z: last?.z ?? "no measurement",
    reference: c.reference_note,
    error_e: last ? `${e0} -> ${e1}` : String(plant.M.last_e),
    delta_e: Number((e0 - e1).toFixed(3)),
    experience: used
      ? "mark_boundary → complete_field → request_independent_check → seal_pack"
      : "cold Self()",
    next_action: steps[0]?.y ?? "observe",
  };
}

function armFrom(label: string, plant: LoopPlant, namer: Namer): Arm {
  let cursor = plant;
  const steps: StepRec[] = [];
  for (let i = 0; i < 4; i++) {
    const out = stepLoop(cursor, { namer });
    steps.push(out.rec);
    cursor = out.plant;
    if (out.rec.reduced <= 0) break;
  }
  const last = steps[steps.length - 1];
  const e0 = steps[0]?.e ?? plant.M.last_e;
  const e1 = last?.e_next ?? plant.M.last_e;
  return {
    label,
    case_id: plant.case_id,
    title: caseById(plant.case_id).title,
    steps,
    e0,
    e1,
    delta_e: Number((e0 - e1).toFixed(3)),
    escalates: steps.filter((s) => s.gate === "ESCALATE").length,
    used_prior: false,
    artifact: artifactOf(cursor, steps, false),
  };
}

function rollMeasured(caseId: string): Arm {
  let cursor = freshPlant(caseId);
  const steps: StepRec[] = [];
  for (const y of MEASURED) {
    const out = stepLoop(cursor, { namer: "operator", y });
    steps.push(out.rec);
    cursor = out.plant;
  }
  const last = steps[steps.length - 1];
  const e0 = steps[0]?.e ?? cursor.M.last_e;
  const e1 = last?.e_next ?? cursor.M.last_e;
  return {
    label: "reuse",
    case_id: caseId,
    title: caseById(caseId).title,
    steps,
    e0,
    e1,
    delta_e: Number((e0 - e1).toFixed(3)),
    escalates: steps.filter((s) => s.gate === "ESCALATE").length,
    used_prior: true,
    artifact: artifactOf(cursor, steps, true),
  };
}

function better(next: Arm, cold: Arm) {
  return next.e1 < cold.e1;
}

export function safetyFlywheel(namer: Namer = "grok_bot"): Flywheel {
  const cold: Arm[] = [];
  const reuse: Arm[] = [];
  for (const id of PROOF_CASES) {
    cold.push(armFrom("cold", freshPlant(id), namer));
    reuse.push(rollMeasured(id));
  }
  return {
    cold,
    reuse,
    case2_better: better(reuse[1], cold[1]),
    case3_better: better(reuse[2], cold[2]),
  };
}

export function readReceipts(): { id: string; status: string }[] {
  return [];
}

export function recordOutcomeIntent(_arm: Arm) {
  return { id: "use-checkout", status: "unsettled" as const };
}