/**
 * B2 Operations. Not Safety. Controller A must not import this file.
 * Self() is not here. Prior Runs are not here.
 * Same contract, different plant: z and e are operational distance.
 */
import { SEALED_SEQUENCE, phiOf, isErrorWin, type LoopObservation, type YName } from "./schema";

export const OPERATIONS_B = {
  id: "B2",
  contract: "aethel.loop.v1",
  domain: "operations",
  accepts: "an incident id and an operational reference gate",
  z: "distance after y: owner, runbook step, rollback proof, alert freshness",
  e: "distance to the operations reference gate, plus 0.25 if the gate does not match",
  not: "Not Safety. Not a diagnosis. No PHI. Not a customer. No settled payment.",
} as const;

function step(y: YName, e: number, eNext: number, gate: LoopObservation["gate"]): LoopObservation {
  return {
    y,
    z: `ops:${y}:owner=${y === "observe" || y === "mark_boundary" ? "missing" : "set"}`,
    z_value: Number((1 - eNext).toFixed(3)),
    e,
    e_next: eNext,
    delta_e: Number((e - eNext).toFixed(3)),
    gate,
    phi: null,
  };
}

export function coldOnOperationsB(): LoopObservation {
  return step("observe", 1, 0.48, "ESCALATE");
}

export function sealedOnOperationsB(coldFinal: number) {
  const steps = [
    step("mark_boundary", 1, 1, "ESCALATE"),
    step("complete_field", 1, 0.61, "HOLD"),
    step("request_independent_check", 0.61, 0.34, "HOLD"),
    step("seal_pack", 0.34, 0.19, "HOLD"),
  ];
  const finalE = steps[steps.length - 1].e_next;
  const phi = phiOf(coldFinal, finalE);
  return {
    b: "B2",
    domain: OPERATIONS_B.domain,
    sequence: SEALED_SEQUENCE,
    steps,
    z: steps[steps.length - 1].z,
    final_e: finalE,
    delta_e: Number((1 - finalE).toFixed(3)),
    phi,
    better: isErrorWin(phi),
    peer_note: "B2 beating B1 is not an error win. Phi is per plant.",
  };
}