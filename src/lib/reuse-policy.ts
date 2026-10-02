import {
  Y_ACTIONS,
  freshPlant,
  stepLoop,
  type StepRec,
  type YAction,
} from "./closed-loop";

export type Roll = {
  steps: StepRec[];
  e0: number;
  eFinal: number;
  escalates: number;
  sequence: YAction[];
};

const SEARCH: YAction[] = Y_ACTIONS.filter((y) => y !== "clinician_review");

const MEASURED: YAction[] = [
  "mark_boundary",
  "complete_field",
  "request_independent_check",
  "seal_pack",
];

function rollSequence(caseId: string, sequence: YAction[], max = 4): Roll {
  let plant = freshPlant(caseId);
  const steps: StepRec[] = [];
  for (let i = 0; i < max; i++) {
    const planned = sequence[i];
    const out = stepLoop(plant, { namer: "operator", y: planned });
    steps.push(out.rec);
    plant = out.plant;
    const explicitLeft = i < sequence.length - 1;
    if (!explicitLeft && out.rec.reduced <= 0) break;
  }
  return {
    steps,
    e0: steps[0]?.e ?? plant.M.last_e,
    eFinal: steps.at(-1)?.e_next ?? plant.M.last_e,
    escalates: steps.filter((s) => s.gate === "ESCALATE").length,
    sequence: steps.map((s) => s.y),
  };
}

export function coldRoll(caseId: string) {
  return rollSequence(caseId, []);
}

function sequences(length: number): YAction[][] {
  if (length === 1) return SEARCH.map((y) => [y]);
  const out: YAction[][] = [];
  for (const head of sequences(length - 1)) {
    for (const y of SEARCH) out.push([...head, y]);
  }
  return out;
}

function better(next: Roll, best: Roll | null, cold: Roll) {
  if (next.eFinal >= cold.eFinal) return false;
  if (!best) return true;
  return next.eFinal < best.eFinal;
}

/** Outside Self(). A pack lists only when its own final e is strictly lower. */
export function reuseRoll(caseId: string, cold: Roll): Roll {
  let best: Roll | null = null;
  const measured = rollSequence(caseId, MEASURED);
  if (better(measured, best, cold)) best = measured;
  for (const length of [2, 3]) {
    for (const sequence of sequences(length)) {
      const next = rollSequence(caseId, sequence);
      if (better(next, best, cold)) best = next;
    }
  }
  return best ?? { ...cold, sequence: [] };
}

export function phi(cold: Roll, reuse: Roll) {
  return Number((cold.eFinal - reuse.eFinal).toFixed(3));
}

export function usedExperience(cold: Roll, reuse: Roll) {
  return reuse.sequence.length > 0 && phi(cold, reuse) > 0;
}