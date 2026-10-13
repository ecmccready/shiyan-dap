export type CausalComparison = {
  case_id: string;
  cold_e: number;
  reuse_e: number;
  phi: number;
  metric: "final_e";
  safety_constraint_met: boolean;
  outcome: "improved" | "tied" | "regressed";
};

export function compareColdReuse(
  cold_e: number,
  reuse_e: number,
  safety_met: boolean
): CausalComparison {
  const phi = cold_e - reuse_e;
  let outcome: CausalComparison["outcome"] = "tied";
  if (phi > 0.001) outcome = "improved";
  else if (phi < -0.001) outcome = "regressed";
  return {
    case_id: `cmp_${Date.now()}`,
    cold_e,
    reuse_e,
    phi,
    metric: "final_e",
    safety_constraint_met: safety_met,
    outcome,
  };
}