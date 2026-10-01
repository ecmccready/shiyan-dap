/**
 * Proof object for Workbench B · Safety.
 * Additive. Does not edit src/lib/closed-loop.ts.
 *
 * Customer record:
 *   Workbench → y → B changed → z → e/Δe → experience → next Run used it.
 */
import {
  LoopPlant,
  Namer,
  StepRec,
  YAction,
  caseById,
  dominantOf,
  freshPlant,
  loadCase,
  stepLoop,
} from "@/lib/closed-loop";

export const PROOF_CASES = [
  "case-incomplete-pack",
  "case-missing-measurements",
  "case-provenance-gap",
] as const;

export type ProofLine = { k: string; v: string };

export type RunArtifact = {
  run_id: string;
  B: string;
  case_id: string;
  reference: string;
  initial_state: string;
  action_y: string;
  result_z: string;
  e: string;
  delta_e: number;
  experience: string;
  next_action: string;
  used_prior: boolean;
};

export type Arm = {
  label: string;
  case_id: string;
  title: string;
  steps: StepRec[];
  e0: number;
  e1: number;
  delta_e: number;
  used_prior: boolean;
  first_y: YAction | null;
  artifact: RunArtifact;
};

export type Flywheel = {
  arms: Arm[];
  cold: Arm[];
  reuse: Arm[];
  case2_better: boolean;
  case3_better: boolean;
};

/** Outside the loop. Prefer a prior y that already reduced this defect. */
export function yFromExperience(prior: StepRec[], dominant: string): YAction | null {
  const hit = prior.find((s) => s.dominant === dominant && s.reduced > 0);
  return hit?.y ?? null;
}

function stateOf(plant: LoopPlant) {
  const B = plant.B;
  return `missing=${B.missing} contradiction=${B.contradiction} completeness=${B.completeness} gate-input=${B.independent_check}`;
}

function toArtifact(label: string, plant: LoopPlant, steps: StepRec[], used: boolean, first: YAction | null): RunArtifact {
  const c = caseById(plant.case_id);
  const last = steps[steps.length - 1];
  const e0 = plant.M.last_e;
  const e1 = last ? last.e_next : e0;
  return {
    run_id: `proof_${plant.case_id}_${label.replace(/\s+/g, "_")}`,
    B: "Safety",
    case_id: plant.case_id,
    reference: c.reference_note,
    initial_state: stateOf(plant),
    action_y: steps.map((s) => s.y).join(" → ") || "none",
    result_z: last?.z ?? "no measurement",
    e: last ? `${last.e} → ${last.e_next}` : String(e0),
    delta_e: Number((e0 - e1).toFixed(3)),
    experience: used ? "prior validated y loaded" : "cold Self()",
    next_action: first ?? last?.y ?? "observe",
    used_prior: used,
  };
}

function armFrom(
  label: string,
  plant: LoopPlant,
  namer: Namer,
  prior: StepRec[]
): Arm {
  const e0 = plant.M.last_e;
  let cursor = plant;
  const taken: StepRec[] = [];
  let used = false;
  let first: YAction | null = null;
  for (let i = 0; i < 4; i++) {
    const priorY = i === 0 ? yFromExperience(prior, dominantOf(cursor.B)) : null;
    if (priorY) used = true;
    if (i === 0) first = priorY;
    const out = stepLoop(cursor, { namer, y: priorY ?? undefined });
    taken.push(out.rec);
    cursor = out.plant;
    if (out.rec.reduced <= 0) break;
  }
  const e1 = taken.length ? taken[taken.length - 1].e_next : e0;
  return {
    label,
    case_id: plant.case_id,
    title: caseById(plant.case_id).title,
    steps: taken,
    e0,
    e1,
    delta_e: Number((e0 - e1).toFixed(3)),
    used_prior: used,
    first_y: first,
    artifact: toArtifact(label, plant, taken, used, first),
  };
}

function play(caseId: string, namer: Namer, prior: StepRec[]) {
  const plant = prior.length ? loadCase({ ...freshPlant(prior[0].case_id), M: { ...freshPlant().M, ledger: prior } }, caseId) : freshPlant(caseId);
  const arm = armFrom(prior.length ? "reuse" : "cold", plant, namer, prior);
  let memory = freshPlant(caseId);
  for (const rec of [...arm.steps].reverse()) {
    memory = stepLoop(memory, { namer, y: rec.y }).plant;
  }
  return { arm, ledger: [...prior, ...memory.M.ledger] };
}

/** Case 1 → experience → Case 2. Case 2 → experience → Case 3. Cold arms sit beside them. */
export function safetyFlywheel(namer: Namer = "grok_bot"): Flywheel {
  const cold: Arm[] = [];
  const reuse: Arm[] = [];
  let ledger: StepRec[] = [];
  for (const id of PROOF_CASES) {
    cold.push(armFrom("cold", freshPlant(id), namer, []));
    const played = play(id, namer, ledger);
    reuse.push(played.arm);
    ledger = played.ledger;
  }
  return {
    arms: reuse,
    cold,
    reuse,
    case2_better: reuse[1].delta_e > cold[1].delta_e || reuse[1].steps.length < cold[1].steps.length,
    case3_better: reuse[2].delta_e > cold[2].delta_e || reuse[2].steps.length < cold[2].steps.length,
  };
}

export function proofLines(arm: Arm): ProofLine[] {
  const s = arm.steps[0];
  return [
    { k: "I gave A this Workbench", v: `Safety · ${arm.title}` },
    { k: "A took this action", v: s ? `${s.namer} named y=${s.y}` : "no action" },
    { k: "B changed this way", v: s ? `${s.dominant} · gate ${s.gate}` : "no transition" },
    { k: "The measured result was this", v: s?.z ?? "—" },
    { k: "Error changed by this amount", v: `Δe ${arm.delta_e} · e ${arm.e0} → ${arm.e1}` },
    { k: "Therefore this experience was created", v: arm.artifact.experience },
    { k: "On the next Run, A used that experience", v: arm.used_prior ? `yes · first y=${arm.first_y}` : "no · cold Self()" },
  ];
}

const RECEIPT_KEY = "aethel-safety-receipts";

export type Receipt = {
  id: string;
  workbench: "Safety";
  run_id: string;
  delta_e: number;
  amount_usd: number;
  status: "unsettled";
  created_at: string;
};

export function readReceipts(): Receipt[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(RECEIPT_KEY) || "[]") as Receipt[];
  } catch {
    return [];
  }
}

/** Not a charge. A local intent until Stripe settles it. */
export function recordOutcomeIntent(arm: Arm, amount = 49): Receipt {
  const receipt: Receipt = {
    id: `rcpt_${Date.now().toString(36)}`,
    workbench: "Safety",
    run_id: arm.artifact.run_id,
    delta_e: arm.delta_e,
    amount_usd: amount,
    status: "unsettled",
    created_at: new Date().toISOString(),
  };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(RECEIPT_KEY, JSON.stringify([receipt, ...readReceipts()].slice(0, 24)));
  }
  return receipt;
}