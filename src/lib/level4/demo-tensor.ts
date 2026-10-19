/**
 * Deterministic demo tensor for the Level 4 autonomous path (additive).
 *
 * This is a labeled DEMO sensor vector, not a hosted-model embedding. It is a
 * pure observation of the core plant: it replays the applied actions on a fresh
 * plant (read-only use of closed-loop.ts) and reads the four state components
 * that measureE compares to its reference. It never feeds back into measured e
 * or the proposer.
 *
 *   T_out = [completeness, contradiction, missing, independent_check]  (shape [4])
 *   T_ref = the same components of measureE's reference for the case:
 *           [max(ref.completeness, 0.9), ref contradiction target, 0, 1]
 *
 * Frobenius ‖T_out − T_ref‖ is therefore the distance term of measureE without
 * its gate penalty. ε = DEMO_TENSOR_EPSILON = 0.16, the same bound as the demo
 * goal (e < 0.16): the latent state must sit within the goal bound of the sealed
 * reference.
 */
import {
  REQUIRED_FIELDS,
  caseById,
  freshPlant,
  plantFromCase,
  stepLoop,
  type YAction,
} from "../closed-loop";
import { LEVEL4_CASE } from "./measured";
import { commitTensor, independentTensorCheck, type Tensor, type TensorCheck } from "./tensor";

export const DEMO_TENSOR_EPSILON = 0.16;

/** Steps at which the autonomous demo runs the tensor check. */
export const TENSOR_CHECK_STEPS: YAction[] = ["request_independent_check", "seal_pack"];

export function demoReferenceTensor(caseId = LEVEL4_CASE): Tensor {
  const c = caseById(caseId);
  const escalate = c.reference_gate === "ESCALATE";
  const ref = plantFromCase({
    ...c,
    available: [...REQUIRED_FIELDS],
    missing: [],
    contradictions: escalate ? c.contradictions : [],
  });
  return {
    shape: [4],
    data: [Math.max(ref.completeness, 0.9), escalate ? 0.2 : 0, 0, 1],
    kind: "sensor",
  } as Tensor;
}

export function demoStateTensor(actions: YAction[], caseId = LEVEL4_CASE): Tensor {
  let plant = freshPlant(caseId);
  for (const y of actions) plant = stepLoop(plant, { y }).plant;
  const B = plant.B;
  return {
    shape: [4],
    data: [B.completeness, B.contradiction, B.missing, B.independent_check],
    kind: "sensor",
  } as Tensor;
}

/**
 * Run the independent tensor check for the step just applied, or return null
 * when the step is not request_independent_check / seal_pack.
 */
export function demoTensorCheck(actions: YAction[], caseId = LEVEL4_CASE): TensorCheck | null {
  const last = actions[actions.length - 1];
  if (!last || !TENSOR_CHECK_STEPS.includes(last)) return null;
  const ref = demoReferenceTensor(caseId);
  return independentTensorCheck({
    out: demoStateTensor(actions, caseId),
    ref,
    refCommitment: commitTensor(ref),
    epsilon: DEMO_TENSOR_EPSILON,
    metric: "frobenius",
  });
}
