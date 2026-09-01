export type Axis = "x" | "y" | "z";

export interface EmergenceState {
  x: number; // Social Transmedia — acquisition
  y: number; // Marketplace — retention / exchange
  z: number; // Playlist — transfer / settlement rail
  attention: number;
  value: number;
  accumulated: number;
}

/**
 * y(x) = (z/2)x + C
 * ∫y(x)dx = (z/4)x² + Cx + C'
 *
 * Product rule:
 * x = Social Transmedia (acquisition)
 * y = Marketplace (retention)
 * z = Playlist settlement rail (transfer)
 */
export function computeEmergence(params: {
  attention?: number;
  z?: number;
  C?: number;
}): EmergenceState {
  const attention = params.attention ?? 0.8;
  const z = params.z ?? 1.2;
  const C = params.C ?? 0.05;
  const x = attention;
  const y = Number(((z / 2) * x + C).toFixed(3));
  const accumulated = Number(((z / 4) * x * x + C * x).toFixed(3));

  return {
    x,
    y,
    z,
    attention,
    value: y,
    accumulated,
  };
}

export function setLocalAttention(value: number) {
  if (typeof document === "undefined") return;
  document.cookie = `sy_attention=${value}; path=/; max-age=31536000`;
}

export function getLocalAttention(): number | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|; )sy_attention=([^;]+)/);
  return match ? Number(match[1]) : null;
}