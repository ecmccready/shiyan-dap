/**
 * B2. Not the Safety plant. Controller A must not import this file.
 * Self() is not here. Prior Runs are not here.
 */
import { SEALED_SEQUENCE, phiOf, isErrorWin, type LoopObservation, type YName } from "./schema";

export const INDEPENDENT_B = {
  id: "B2",
  contract: "aethel.loop.v1",
  domain: "partner-fixture",
  not: "Not Safety. Not a diagnosis. No PHI. No settled payment.",
} as const;

function step(y: YName, e: number, eNext: number, gate: LoopObservation["gate"]): LoopObservation {
  return {
    y,
    z: `B2:${y}`,
    z_value: Number((1 - eNext).toFixed(3)),
    e,
    e_next: eNext,
    delta_e: Number((e - eNext).toFixed(3)),
    gate,
    phi: null,
  };
}

export function coldOnIndependentB(): LoopObservation {
  return step("observe", 1, 0.42, "ESCALATE");
}

export function sealedOnIndependentB(coldFinal: number) {
  const steps = [
    step("mark_boundary", 1, 1, "ESCALATE"),
    step("complete_field", 1, 0.64, "HOLD"),
    step("request_independent_check", 0.64, 0.38, "HOLD"),
    step("seal_pack", 0.38, 0.24, "HOLD"),
  ];
  const finalE = steps[steps.length - 1].e_next;
  const phi = phiOf(coldFinal, finalE);
  return {
    b: "B2",
    sequence: SEALED_SEQUENCE,
    steps,
    z: steps[steps.length - 1].z,
    final_e: finalE,
    delta_e: Number((1 - finalE).toFixed(3)),
    phi,
    better: isErrorWin(phi),
  };
}