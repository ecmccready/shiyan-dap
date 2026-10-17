/**
 * Engine-backed measurement for Level 4 runs.
 *
 * Read-only use of the core closed loop (src/lib/closed-loop.ts): freshPlant,
 * stepLoop, Self. Nothing here changes W, measureE, Self() or the safety gate.
 * The controller stores only the applied actions; e is recomputed by replaying
 * them on a fresh plant, so a recovered run always reports the same e.
 */
import { freshPlant, stepLoop, type YAction } from "../closed-loop";

/** Default reference case. Same case as the first pack on /workbench/proof. */
export const LEVEL4_CASE = "case-incomplete-pack";

/**
 * Approved, reusable experience: the sealed sequence listed on
 * /workbench/marketplace ("Safety evidence gate"), verified on the plant.
 */
export const REUSE_SEQUENCE: YAction[] = [
  "mark_boundary",
  "complete_field",
  "request_independent_check",
  "seal_pack",
];

export type Measurement = {
  e0: number; // error before any action
  e: number; // error after the applied actions
  delta_e: number; // e0 - e  (reduction; higher is better)
};

export function measureActions(actions: YAction[], caseId = LEVEL4_CASE): Measurement {
  let plant = freshPlant(caseId);
  const e0 = plant.M.last_e;
  for (const y of actions) plant = stepLoop(plant, { y }).plant;
  const e = plant.M.last_e;
  return { e0, e, delta_e: Number((e0 - e).toFixed(3)) };
}

/** Cold baseline: Self() alone for the same number of steps (no experience). */
export function coldBaseline(steps: number, caseId = LEVEL4_CASE): number {
  let plant = freshPlant(caseId);
  for (let i = 0; i < steps; i++) plant = stepLoop(plant, { which: "self" }).plant;
  return plant.M.last_e;
}

/** Next action from reusable experience; "hold" once the sequence is spent. */
export function nextFromExperience(applied: YAction[]): YAction {
  return REUSE_SEQUENCE[applied.length] ?? "hold";
}

/** Client-safe proposer for autonomousStep (no KV access in the browser). */
export function experienceProposer(applied: YAction[]) {
  return async () => ({ y: nextFromExperience(applied) as string, source: "approved" as const });
}

/** Parses success conditions of the form "e < 0.16 ..." used by the demo goal. */
export function successThreshold(condition: string): number | null {
  const m = condition.match(/e\s*<\s*([0-9.]+)/);
  return m ? Number(m[1]) : null;
}
