import { BQuality, GOAL } from "./workbench";

export function z_scalar(Bnext: number) {
  const value = Math.abs(Bnext);
  return {
    z: `z=${value}`,
    z_value: value,
    dominant: value === 0 ? "goal" : "magnitude",
  };
}

export function defects(B: BQuality) {
  return {
    completeness: Math.max(0, GOAL.completeness - B.completeness),
    contradiction: B.contradiction,
    missing: B.missing,
    uncertainty: B.uncertainty,
    useful: Math.max(0, GOAL.useful - B.useful),
  };
}

export function dominantOf(B: BQuality) {
  const d = defects(B);
  return (Object.entries(d).sort((a, b) => b[1] - a[1])[0] || [
    "none",
    0,
  ])[0];
}

export function z_quality(B: BQuality, y: string, e_norm: number) {
  const dominant = dominantOf(B);
  const z_value = Number(
    Math.sqrt(
      Object.values(defects(B)).reduce((s, v) => s + v * v, 0)
    ).toFixed(3)
  );
  return {
    z: `z: e=${e_norm.toFixed(3)} after ${y}; dominate=${dominant}; next=correct ${dominant}`,
    z_value,
    dominant,
  };
}

export function lyapunov(B: BQuality, e_norm: number) {
  return (
    e_norm * e_norm +
    1.2 * B.contradiction +
    1.1 * B.missing +
    B.uncertainty +
    (1 - B.completeness) +
    (1 - B.useful)
  );
}