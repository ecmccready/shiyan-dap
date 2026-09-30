/**
 * Sovereign orchestration hook.
 * Pass an environment schema + error function. That is a new workbench.
 * Music / safety / compliance are schemas, not engine branches.
 */
import {
  Gate,
  LoopPlant,
  Namer,
  PlantB,
  StepRec,
  YAction,
  Y_ACTIONS,
  W,
  clamp01,
  dominantOf,
  gateOf,
  measureZ,
  stepLoop,
} from "@/lib/closed-loop";

export type EnvironmentSchema = {
  id: string;
  domain: string;
  label: string;
  required_fields: string[];
  reference_gate: Gate;
};

export type ErrorFn = (B: PlantB, schema: EnvironmentSchema) => number;

export type WorkbenchSpec = {
  schema: EnvironmentSchema;
  error: ErrorFn;
  transition?: (B: PlantB, y: YAction) => PlantB;
};

export const safetySchema: EnvironmentSchema = {
  id: "wb-safety",
  domain: "safety",
  label: "Diagnostic Validation Workbench",
  required_fields: [
    "patient-evidence",
    "measurements",
    "history",
    "provenance",
    "independent-check",
  ],
  reference_gate: "HOLD",
};

export const nodeSchema: EnvironmentSchema = {
  id: "wb-node",
  domain: "node",
  label: "Node Workbench",
  required_fields: ["objective", "measurement", "reference"],
  reference_gate: "HOLD",
};

export function defaultError(B: PlantB, schema: EnvironmentSchema): number {
  const dist = Math.sqrt(
    Math.pow(1 - B.completeness, 2) +
      Math.pow(B.contradiction, 2) +
      Math.pow(B.missing, 2) +
      Math.pow(1 - B.independent_check, 2)
  );
  const gatePenalty = gateOf(B) === schema.reference_gate ? 0 : 0.25;
  return Number((dist + gatePenalty).toFixed(3));
}

export function selfWithSpec(plant: LoopPlant, spec: WorkbenchSpec): YAction {
  const transition = spec.transition || W;
  let best: YAction = "observe";
  let bestE = Number.POSITIVE_INFINITY;
  for (const y of Y_ACTIONS) {
    const pred = transition(plant.B, y);
    const e = spec.error(pred, spec.schema);
    if (e < bestE) {
      bestE = e;
      best = y;
    }
  }
  return best;
}

export function stepWithSpec(
  plant: LoopPlant,
  spec: WorkbenchSpec,
  opts?: { y?: YAction; namer?: Namer }
): { plant: LoopPlant; rec: StepRec } {
  const y = opts?.y ?? selfWithSpec(plant, spec);
  if (spec.transition) {
    const B_next = spec.transition(plant.B, y);
    const meas = measureZ(B_next, y);
    const e = spec.error(plant.B, spec.schema);
    const e_next = spec.error(B_next, spec.schema);
    const rec: StepRec = {
      t: plant.t,
      case_id: plant.case_id,
      namer: opts?.namer ?? "grok_bot",
      y,
      gate: gateOf(B_next),
      B: plant.B,
      B_next,
      z: meas.z,
      z_value: meas.z_value,
      e,
      e_next,
      reduced: Number((e - e_next).toFixed(3)),
      dominant: dominantOf(B_next),
    };
    return {
      rec,
      plant: {
        ...plant,
        domain: spec.schema.domain,
        t: plant.t + 1,
        B: B_next,
        M: {
          ledger: [rec, ...plant.M.ledger].slice(0, 48),
          last_z: rec.z,
          last_e: e_next,
          last_y: y,
          last_dominant: rec.dominant,
        },
      },
    };
  }
  return stepLoop(plant, opts);
}

export function defineWorkbench(spec: WorkbenchSpec) {
  return {
    spec,
    step(plant: LoopPlant, opts?: { y?: YAction; namer?: Namer }) {
      return stepWithSpec(plant, spec, opts);
    },
    self(plant: LoopPlant) {
      return selfWithSpec(plant, spec);
    },
    score(B: PlantB) {
      return spec.error(B, spec.schema);
    },
    clamp: clamp01,
  };
}

export const SafetyWorkbench = defineWorkbench({
  schema: safetySchema,
  error: defaultError,
});