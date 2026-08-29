/**
 * Top-down calibratable policy:
 * y(x) = (z / 2) * x + C
 *
 * z = founder-controlled intensity
 * x = cluster/user signal
 * C = baseline
 */
export function calibratePolicy(params: {
  x: number;
  z?: number;
  C?: number;
}) {
  const z = params.z ?? 1;
  const C = params.C ?? 0;
  const y = Number(((z / 2) * params.x + C).toFixed(3));

  return {
    y,
    z,
    x: params.x,
    C,
    formula: "y(x) = (z/2)x + C",
  };
}