/**
 * Safety flywheel. Additive. Does not edit src/lib/closed-loop.ts.
 * Improvement is fewer steps to the same e, or fewer ESCALATE gates.
 * A tie on Δe is not a win.
 */
import {
  LoopPlant,
  Namer,
  StepRec,
  YAction,
  caseById,
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
  escalates: number;
  used_prior: boolean;
  first_y: YAction | null;
  artifact: RunArtifact;
};

export type Flywheel = {
  cold: Arm[];
  reuse: Arm[];
  case2_better: boolean;
  case3_better: boolean;
};

function useless(prior: StepRec[]): Set<YAction> {
  return new Set(prior.filter((s) => s.reduced <= 0).map((s) => s.y));
}

function usefulOrder(prior: StepRec[]): YAction[] {
  const seen = new Set<YAction>();
  const ys: YAction[] = [];
  const safe = prior.filter((s) => s.reduced > 0 && s.gate !== "ESCALATE");
  const rest = prior.filter((s) => s.reduced > 0 && s.gate === "ESCALATE");
  for (const s of [...safe, ...rest]) {
    if (seen.has(s.y)) continue;
    seen.add(s.y);
    ys.push(s.y);
  }
  return ys;
}

function stateOf(plant: LoopPlant) {
  const B = plant.B;
  return `missing=${B.missing} contradiction=${B.contradiction} completeness=${B.completeness}`;
}

function toArtifact(plant: LoopPlant, steps: StepRec[], used: boolean, first: YAction | null): RunArtifact {
  const c = caseById(plant.case_id);
  const last = steps[steps.length - 1];
  const e0 = plant.M.last_e;
  const e1 = last ? last.e_next : e0;
  return {
    run_id: `proof_${plant.case_id}`,
    B: "Safety",
    case_id: plant.case_id,
    reference: c.reference_note,
    initial_state: stateOf(plant),
    action_y: steps.map((s) => s.y).join(" -> ") || "none",
    result_z: last?.z ?? "no measurement",
    e: last ? `${last.e} -> ${last.e_next}` : String(e0),
    delta_e: Number((e0 - e1).toFixed(3)),
    experience: used ? "skipped a y that did not reduce e" : "cold Self()",
    next_action: first ?? last?.y ?? "observe",
    used_prior: used,
  };
}

function armFrom(label: string, plant: LoopPlant, namer: Namer, prior: StepRec[]): Arm {
  const e0 = plant.M.last_e;
  const skip = useless(prior);
  const order = usefulOrder(prior);
  let cursor = plant;
  const taken: StepRec[] = [];
  let used = false;
  let first: YAction | null = null;
  for (let i = 0; i < 4; i++) {
    const priorY = order[i];
    if (priorY && skip.has(priorY)) break;
    if (priorY) used = true;
    if (i === 0) first = priorY ?? null;
    const out = stepLoop(cursor, { namer, y: priorY });
    if (prior.length && out.rec.reduced <= 0) break;
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
    escalates: taken.filter((s) => s.gate === "ESCALATE").length,
    used_prior: used,
    first_y: first,
    artifact: toArtifact(plant, taken, used, first),
  };
}

function plantWith(prior: StepRec[], caseId: string): LoopPlant {
  const carrier = freshPlant(prior[0]?.case_id ?? caseId);
  carrier.M.ledger = prior;
  return loadCase(carrier, caseId);
}

function better(next: Arm, cold: Arm) {
  return next.steps.length < cold.steps.length || next.escalates < cold.escalates || next.e1 < cold.e1;
}

export function safetyFlywheel(namer: Namer = "grok_bot"): Flywheel {
  const cold: Arm[] = [];
  const reuse: Arm[] = [];
  let prior: StepRec[] = [];
  for (const id of PROOF_CASES) {
    cold.push(armFrom("cold", freshPlant(id), namer, []));
    const arm = armFrom("reuse", prior.length ? plantWith(prior, id) : freshPlant(id), namer, prior);
    reuse.push(arm);
    prior = [...arm.steps, ...prior];
  }
  return {
    cold,
    reuse,
    case2_better: better(reuse[1], cold[1]),
    case3_better: better(reuse[2], cold[2]),
  };
}

export function proofLines(arm: Arm): ProofLine[] {
  const s = arm.steps[0];
  return [
    { k: "I gave A this Workbench", v: `Safety · ${arm.title}` },
    { k: "A took this action", v: s ? `${s.namer} named y=${s.y}` : "no action" },
    { k: "B changed this way", v: s ? `${s.dominant} · gate ${s.gate}` : "no transition" },
    { k: "The measured result was this", v: s?.z ?? "—" },
    { k: "Error changed by this amount", v: `delta-e ${arm.delta_e} · e ${arm.e0} -> ${arm.e1}` },
    { k: "Therefore this experience was created", v: arm.artifact.experience },
    {
      k: "On the next Run, A used that experience",
      v: arm.used_prior ? `yes · first y=${arm.first_y}` : "no · cold Self()",
    },
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