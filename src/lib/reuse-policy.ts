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
  hint: YAction | null;
};

function roll(caseId: string, hint: YAction | null, max = 4): Roll {
  let plant = freshPlant(caseId);
  const steps: StepRec[] = [];
  for (let i = 0; i < max; i++) {
    const y = i === 0 && hint ? hint : undefined;
    const out = stepLoop(plant, { namer: "operator", y });
    steps.push(out.rec);
    plant = out.plant;
    if (out.rec.reduced <= 0) break;
  }
  return {
    steps,
    e0: steps[0]?.e ?? plant.M.last_e,
    eFinal: steps.at(-1)?.e_next ?? plant.M.last_e,
    escalates: steps.filter((s) => s.gate === "ESCALATE").length,
    hint,
  };
}

export function coldRoll(caseId: string) {
  return roll(caseId, null);
}

/** Outside Self(). A first-y search. Kept only if final e falls. */
export function reuseRoll(caseId: string, cold: Roll) {
  const failed = new Set(cold.steps.filter((s) => s.reduced <= 0).map((s) => s.y));
  let best = cold;
  for (const y of Y_ACTIONS) {
    if (failed.has(y) || y === "clinician_review") continue;
    const next = roll(caseId, y);
    const lower = next.eFinal < best.eFinal;
    const tieSafer =
      next.eFinal === best.eFinal && next.escalates < best.escalates;
    if (lower || tieSafer) best = next;
  }
  const used = best.hint !== null && best.eFinal < cold.eFinal;
  return used ? best : { ...cold, hint: null };
}

export function phi(cold: Roll, reuse: Roll) {
  return Number((cold.eFinal - reuse.eFinal).toFixed(3));
}