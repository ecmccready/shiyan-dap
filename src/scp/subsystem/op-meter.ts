/**
 * Instrumented agent counters next to the analytic formula.
 * Codec OpCounts4D stay with the compressor; this meter is the agent.
 * The gap is instrumented compute ops minus the analytic formula.
 */
import { addOps, zeroOps } from "./state-compressor";
import type { OpCounts4D } from "./types";

/** Sum of the compute fields. Bytes are not ops. */
export function computeOps(o: OpCounts4D): number {
  return o.fp_add + o.fp_mul + o.fp_div + o.round + o.int_ops + o.compare + o.sqrt;
}

export function addOpCounts(a: OpCounts4D, b: OpCounts4D): OpCounts4D {
  return addOps(a, b);
}

export function emptyOps(): OpCounts4D {
  return zeroOps();
}

/**
 * Closed form for one agent run.
 * Each evaluated cell is one compare and one 8-byte state read, and emits one decision byte.
 * Navigation adds one compare and one 8-byte read per neighbour inspected.
 */
export function analyticAgentOps(cellsEvaluated: number, navReads: number, navCompares: number): OpCounts4D {
  return addOps(zeroOps(), {
    compare: cellsEvaluated + navCompares,
    state_bytes_touched: 8 * (cellsEvaluated + navReads),
    bytes_out: cellsEvaluated,
  });
}

export interface AgentMeter {
  analytic: OpCounts4D;
  instrumented: OpCounts4D;
  cells_evaluated: number;
  /** instrumented compute ops − analytic compute ops. */
  gap_compute: number;
}

export function finishMeter(instrumented: OpCounts4D, cellsEvaluated: number, navReads: number, navCompares: number): AgentMeter {
  const analytic = analyticAgentOps(cellsEvaluated, navReads, navCompares);
  return {
    analytic,
    instrumented,
    cells_evaluated: cellsEvaluated,
    gap_compute: computeOps(instrumented) - computeOps(analytic),
  };
}
