import type { LoopPlant, YAction } from "./closed-loop";
import { Y_ACTIONS, W, caseById, measureE, gateOf } from "./closed-loop";

export type AttemptSource = "memory" | "search" | "hold";

export type Attempt = {
  y: YAction;
  e_before: number;
  e_pred: number;
  accepted: boolean;
  source: AttemptSource;
};

export function legal(plant: LoopPlant, y: YAction): boolean {
  if (y === "clinician_review" && gateOf(plant.B) !== "CLINICIAN_REVIEW") return false;
  if (y === "seal_pack" && plant.B.boundary_ready < 1) return false;
  return true;
}

export function nameYFromExperience(plant: LoopPlant): YAction {
  return attempt(plant).y;
}

export function attempt(plant: LoopPlant): Attempt {
  const c = caseById(plant.case_id);
  const e0 = measureE(plant.B, c);
  const failed = new Set(
    plant.M.ledger.filter((s) => s.reduced <= 0).map((s) => s.y)
  );
  const helped = plant.M.ledger
    .filter((s) => s.reduced > 0 && s.dominant === plant.M.last_dominant)
    .sort((a, b) => b.reduced - a.reduced);

  for (const prior of helped) {
    if (!legal(plant, prior.y) || failed.has(prior.y)) continue;
    const e = measureE(W(plant.B, prior.y), c);
    if (e < e0) {
      return { y: prior.y, e_before: e0, e_pred: e, accepted: true, source: "memory" };
    }
  }

  let best: YAction = "observe";
  let bestE = e0;
  for (const y of Y_ACTIONS) {
    if (!legal(plant, y) || failed.has(y)) continue;
    const e = measureE(W(plant.B, y), c);
    if (e < bestE) {
      bestE = e;
      best = y;
    }
  }
  if (bestE < e0) {
    return { y: best, e_before: e0, e_pred: bestE, accepted: true, source: "search" };
  }
  return { y: "observe", e_before: e0, e_pred: e0, accepted: false, source: "hold" };
}