/** Pure table lookup. The table is the committed v0.1.21 sweep, not a new measurement.
 * decisions/s per LUT picks fsd in every cell. There is no K1 region for that objective.
 */

export type Churn = "low" | "medium" | "high" | "very_high";
export type Objective = "decisions_per_s_per_lut" | "evaluations" | "cycles";
export type Engine = "ede" | "fsd";

export interface TableCell {
  addr_w: number;
  churn: Churn;
  decisions_per_s_per_lut: Engine;
  evaluations: Engine;
  cycles: Engine;
}

export function churnBin(fraction: number): Churn {
  if (fraction < 0.03) return "low";
  if (fraction < 0.1) return "medium";
  if (fraction < 0.35) return "high";
  return "very_high";
}

export function pickEngine(table: readonly TableCell[], addrW: number, fraction: number, objective: Objective): Engine {
  const churn = churnBin(fraction);
  const cell = table.find((c) => c.addr_w === addrW && c.churn === churn);
  if (!cell) throw new Error(`no selector cell for ADDR_W ${addrW} ${churn}`);
  return cell[objective];
}
