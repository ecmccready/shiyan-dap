import {
  SAFETY_PACK,
  Y_ACTIONS,
  caseById,
  freshPlant,
  measureE,
  stepLoop,
  type LoopPlant,
  type Namer,
  type StepRec,
  type YAction,
} from "./closed-loop";

/** A, B, z compared on the only axis the plant measures. */
export type Triad = {
  axis: "e";
  A: number;
  B: number;
  Z: number;
  delta: number;
  claimMatchesMeasure: boolean;
};

export type Rollout = {
  label: "cold" | "cognitive";
  namer: Namer;
  plant: LoopPlant;
  ledger: StepRec[];
  e0: number;
  eFinal: number;
  steps: number;
  escalateCount: number;
};

export function projectTriad(rec: StepRec): Triad {
  const A = rec.e_next;
  const B = rec.e;
  const Z = rec.e_next;
  return {
    axis: "e",
    A,
    B,
    Z,
    delta: Number((B - Z).toFixed(3)),
    claimMatchesMeasure: A === Z,
  };
}

/** Φ > 0 is the only error win. Path length is not in this formula. */
export function phi(coldFinal: number, nextFinal: number) {
  return Number((coldFinal - nextFinal).toFixed(3));
}

export function rollout(caseId: string, namer: Namer, max = 6): Rollout {
  let plant = freshPlant(caseId);
  const c = caseById(caseId);
  const e0 = measureE(plant.B, c);
  const ledger: StepRec[] = [];
  for (let i = 0; i < max; i++) {
    const before = measureE(plant.B, c);
    const stepped = stepLoop(plant, { namer });
    ledger.push(stepped.rec);
    plant = stepped.plant;
    if (measureE(plant.B, c) >= before && i > 0) break;
  }
  return {
    label: namer === "operator" ? "cold" : "cognitive",
    namer,
    plant,
    ledger,
    e0,
    eFinal: measureE(plant.B, c),
    steps: ledger.length,
    escalateCount: ledger.filter((s) => s.gate === "ESCALATE").length,
  };
}

/**
 * SIMA-shaped namer: language may rank Y, the plant still accepts
 * only a legal y, and e still comes from measureE after W.
 * priorY is an outside-loop hint. It is not read by Self().
 */
export function acceptY(proposed: string, priorY: YAction | null): YAction {
  if (Y_ACTIONS.includes(proposed as YAction)) return proposed as YAction;
  return priorY ?? "observe";
}

export function safetyBoard() {
  return SAFETY_PACK.map((c) => {
    const cold = rollout(c.id, "operator");
    const cognitive = rollout(c.id, "grok_fast");
    const gain = phi(cold.eFinal, cognitive.eFinal);
    return {
      id: c.id,
      title: c.title,
      reference: c.reference_gate,
      cold: cold.eFinal,
      cognitive: cognitive.eFinal,
      phi: gain,
      emergent: gain > 0,
      note: gain > 0 ? "error win" : "path rewrite is not a win",
    };
  });
}