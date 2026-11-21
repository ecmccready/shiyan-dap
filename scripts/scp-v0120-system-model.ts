/** TEST ONLY. Cycle-approximate system model for v0.1.20 (spec §16.11 step 4, increment I1).
 * The decoder term is the existing exact cycle model. The K1 term is the exact K1 model.
 * Both tolerances are 0, pre-registered in fixtures/scp/v0120-prereg.json.
 * A closed form for K1 memory traffic is reported beside the cycle count.
 * Pure: no I/O, no clocks, no randomness.
 */
import { tdecSCycleModel } from "./scp-v0118-rtl-model";
import { runEde, type FanSlot, type Tok } from "./scp-v0120-ede-model";

export const DECODER_CYCLE_TOLERANCE = 0;
export const K1_CYCLE_TOLERANCE = 0;

export function decoderCycles(buf: Uint8Array, W: number): number {
  return tdecSCycleModel(buf, W).cycles;
}

export function k1Cycles(D: number, threshold: number, relations: boolean, fan: readonly (readonly FanSlot[])[], tokens: readonly Tok[]): number {
  return runEde(D, threshold, relations, fan, tokens).cycles;
}

/** Bytes of code/decision state moved for one transition's events and evaluations. */
export function k1MemoryBytes(events: number, evals: number): number {
  return events * (2 + 4) + evals * (4 + 1);
}
