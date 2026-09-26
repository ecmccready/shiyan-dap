import { BQuality, QualityAction } from "./types";

export function clip01(n: number) {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export function clipQuality(B: BQuality): BQuality {
  return {
    completeness: clip01(B.completeness),
    contradiction: clip01(B.contradiction),
    missing: clip01(B.missing),
    uncertainty: Math.max(0.01, Math.min(1, B.uncertainty)),
    useful: clip01(B.useful),
  };
}

export function W_scalar(B: number, y: number) {
  return B + y;
}

const EFFECT: Record<QualityAction, BQuality> = {
  observe: {
    completeness: 0.015,
    contradiction: 0.005,
    missing: 0,
    uncertainty: -0.035,
    useful: 0,
  },
  complete_field: {
    completeness: 0.07,
    contradiction: 0.015,
    missing: -0.015,
    uncertainty: -0.01,
    useful: 0.025,
  },
  resolve_contradiction: {
    completeness: 0.025,
    contradiction: -0.11,
    missing: 0.01,
    uncertainty: -0.015,
    useful: 0.015,
  },
  fill_missing: {
    completeness: 0.03,
    contradiction: 0.01,
    missing: -0.1,
    uncertainty: 0,
    useful: 0.02,
  },
  reduce_uncertainty: {
    completeness: 0.02,
    contradiction: 0,
    missing: 0,
    uncertainty: -0.09,
    useful: 0.01,
  },
  execute_task: {
    completeness: 0.05,
    contradiction: 0.02,
    missing: -0.01,
    uncertainty: 0.02,
    useful: 0.12,
  },
  hold: {
    completeness: 0,
    contradiction: 0,
    missing: 0,
    uncertainty: 0.01,
    useful: 0,
  },
};

export function W_quality(B: BQuality, y: QualityAction, t: number): BQuality {
  const d = EFFECT[y];
  const noise = ((t * 17) % 7) / 200 - 0.015;
  return clipQuality({
    completeness: B.completeness + d.completeness + noise,
    contradiction: B.contradiction + d.contradiction,
    missing: B.missing + d.missing,
    uncertainty: B.uncertainty + d.uncertainty,
    useful: B.useful + d.useful + noise * 0.3,
  });
}

export const GOAL: BQuality = {
  completeness: 1,
  contradiction: 0,
  missing: 0,
  uncertainty: 0.05,
  useful: 0.85,
};

export const B0_SCALAR = 100;
export const B0_QUALITY: BQuality = {
  completeness: 0.35,
  contradiction: 0.28,
  missing: 0.4,
  uncertainty: 0.42,
  useful: 0.2,
};