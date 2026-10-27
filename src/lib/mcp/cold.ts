/**
 * Opt-in cold run over MCP, for B1 only. Controller side: talks JSON-RPC through the host and imports nothing from Workbench B.
 *
 * "Cold" means this controller names every step with no memory of prior Runs: at each step it asks the plant to score each
 * candidate action, takes the one with the lowest e_next, and stops when no candidate lowers e strictly. Scoring uses throwaway
 * case_ids: each candidate is replayed on a fresh scratch case (the same actions taken so far, then the candidate), so the real
 * case only ever receives the chosen actions. This is a greedy one-step-lookahead analogue of Self(), run over MCP.
 * It is not the Safety-proof Self() in closed-loop.ts (different plant), and B2 has none (fixed fixture).
 */
import { act, freshCaseId, type RpcTransport } from "./host";
import type { LoopObservation, YName } from "./schema";

export const COLD_CANDIDATES: YName[] = ["complete_field", "request_independent_check", "mark_boundary", "seal_pack"];
/** Same length as the sealed sequence, so the two runs are comparable. */
export const COLD_MAX_STEPS = 4;

export type ColdRun = {
  /** Actions the cold controller took, in order (may be shorter than COLD_MAX_STEPS). */
  sequence: YName[];
  steps: LoopObservation[];
  /** e before the first step (read-only observe). */
  e0: number;
  /** e after the last step. This is the cold final e. */
  coldFinalE: number;
};

function needNumber(value: unknown, what: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`cold run: ${what} was not a number`);
  return value;
}

async function scoreCandidate(rpc: RpcTransport, caseId: string, taken: YName[], y: YName): Promise<number> {
  const scratch = freshCaseId(`${caseId}-p`);
  for (const prior of taken) await act(rpc, prior, scratch);
  const obs = await act(rpc, y, scratch);
  return needNumber(obs?.e_next, `e_next for ${y}`);
}

export async function coldSelfOverMcp(rpc: RpcTransport, caseId: string): Promise<ColdRun> {
  const first = await act(rpc, "observe", caseId);
  const e0 = needNumber(first?.e, "starting e");
  const sequence: YName[] = [];
  const steps: LoopObservation[] = [];
  let current = e0;
  for (let i = 0; i < COLD_MAX_STEPS; i++) {
    const scored = await Promise.all(
      COLD_CANDIDATES.map(async (y) => ({ y, e: await scoreCandidate(rpc, caseId, sequence, y) }))
    );
    let best = scored[0];
    for (const s of scored) if (s.e < best.e) best = s;
    if (!(best.e < current)) break;
    const obs = await act(rpc, best.y, caseId);
    steps.push(obs as LoopObservation);
    sequence.push(best.y);
    current = needNumber(obs?.e_next, `e_next for ${best.y}`);
  }
  return { sequence, steps, e0, coldFinalE: current };
}
