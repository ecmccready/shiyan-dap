/**
 * Opt-in cold run over MCP, for B1 only. Controller side: talks JSON-RPC through the host and imports nothing from Workbench B.
 *
 * "Cold" means this controller names every step with no memory of prior Runs: at each step it asks B1 to score each candidate
 * action appended to the actions chosen so far, takes the one with the lowest final e, and stops when no candidate lowers e
 * strictly. Scoring uses B1's stateless `score_sequence` dry run (one request replays the whole sequence on a fresh plant and
 * stores nothing), so the result is the same on every serverless instance and no earlier run can leak into it.
 * This is a greedy one-step-lookahead analogue of Self(), run over MCP. It is not the Safety-proof Self() in closed-loop.ts
 * (a different plant), and B2 has none (fixed fixture).
 */
import type { RpcTransport } from "./host";
import type { LoopObservation, YName } from "./schema";

export const COLD_CANDIDATES: YName[] = ["complete_field", "request_independent_check", "mark_boundary", "seal_pack"];
/** Same length as the sealed sequence, so the two runs are comparable. */
export const COLD_MAX_STEPS = 4;

export type ColdRun = {
  /** Actions the cold controller took, in order (may be shorter than COLD_MAX_STEPS). */
  sequence: YName[];
  steps: LoopObservation[];
  /** e before the first step. */
  e0: number;
  /** e after the last step. This is the cold final e. */
  coldFinalE: number;
};

type Scored = { start_e: number; final_e: number; steps: LoopObservation[] };

function needNumber(value: unknown, what: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`cold run: ${what} was not a number`);
  return value;
}

async function scoreSequence(rpc: RpcTransport, sequence: YName[]): Promise<Scored> {
  const result = (await rpc("tools/call", { name: "score_sequence", arguments: { sequence } })) as { structuredContent?: Scored };
  const body = result?.structuredContent;
  needNumber(body?.start_e, "start_e");
  needNumber(body?.final_e, "final_e");
  return body as Scored;
}

export async function coldSelfOverMcp(rpc: RpcTransport): Promise<ColdRun> {
  const start = await scoreSequence(rpc, []);
  const sequence: YName[] = [];
  let best: Scored = start;
  for (let i = 0; i < COLD_MAX_STEPS; i++) {
    const scored = await Promise.all(
      COLD_CANDIDATES.map(async (y) => ({ y, run: await scoreSequence(rpc, [...sequence, y]) }))
    );
    let pick = scored[0];
    for (const s of scored) if (s.run.final_e < pick.run.final_e) pick = s;
    if (!(pick.run.final_e < best.final_e)) break;
    sequence.push(pick.y);
    best = pick.run;
  }
  return { sequence, steps: best.steps, e0: start.start_e, coldFinalE: best.final_e };
}
