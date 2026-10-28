/**
 * Multi-dimensional error surface (stub, display only, pure).
 *
 * Φ stays the primary and only ranking key. This module adds a vector note beside the scalar so readers can
 * see which other dimensions exist and which are genuinely measured today. It fills ONLY values already
 * present in the stored record (final e, tensor distance); latency, cost and safety are null placeholders
 * until something measures them. It never invents a number, never feeds Level 4 measurement or ROE
 * eligibility, and does not change listing order.
 *
 *   rankKey(listing) is the future ranking hook: today it returns Φ, so buildListings() orders exactly as before.
 */
export const ERROR_SURFACE_SCHEMA = "aethel.error_surface.v1";

export type ErrorAxis = "accuracy" | "tensor_distance" | "latency" | "cost" | "safety";
export type AxisStatus = "measured" | "placeholder";

export type ErrorSurfaceAxis = {
  axis: ErrorAxis;
  value: number | null;
  status: AxisStatus;
  note: string;
};

export type ErrorSurface = {
  schema_version: typeof ERROR_SURFACE_SCHEMA;
  primary: { axis: "phi"; value: number };
  axes: ErrorSurfaceAxis[];
  ranking_key: "phi";
  note: string;
};

/** Fields of a listing the surface reads. Structural, so this file has no runtime dependency on listings.ts. */
export type SurfaceInput = { phi: number; final_e: number; tensor_distance?: number | null };

export const PLACEHOLDER_NOTE = "placeholder — not measured yet";
export const SURFACE_CAVEAT = "Display only; Φ is the only ranking key; other axes are placeholders.";

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export function errorSurfaceFor(l: SurfaceInput): ErrorSurface {
  const td = finite(l.tensor_distance) ? l.tensor_distance : null;
  const axes: ErrorSurfaceAxis[] = [
    {
      axis: "accuracy",
      value: finite(l.final_e) ? l.final_e : null,
      status: finite(l.final_e) ? "measured" : "placeholder",
      note: finite(l.final_e) ? "final e of the listed iteration; lower is better" : PLACEHOLDER_NOTE,
    },
    {
      axis: "tensor_distance",
      value: td,
      status: td !== null ? "measured" : "placeholder",
      note: td !== null
        ? "recorded tensor-check distance against its bound; not a safety score"
        : "not recorded on this entry — placeholder",
    },
    { axis: "latency", value: null, status: "placeholder", note: PLACEHOLDER_NOTE },
    { axis: "cost", value: null, status: "placeholder", note: PLACEHOLDER_NOTE },
    { axis: "safety", value: null, status: "placeholder", note: PLACEHOLDER_NOTE },
  ];
  return {
    schema_version: ERROR_SURFACE_SCHEMA,
    primary: { axis: "phi", value: l.phi },
    axes,
    ranking_key: "phi",
    note: SURFACE_CAVEAT,
  };
}

/** Future ranking hook. Today the only key is Φ; a later multi-dimensional rule would change this one function. */
export function rankKey(l: Pick<SurfaceInput, "phi">): number {
  return l.phi;
}

const SHORT: Record<ErrorAxis, string> = {
  accuracy: "e",
  tensor_distance: "tensor",
  latency: "latency",
  cost: "cost",
  safety: "safety",
};

/** Compact vector note, e.g. `[Φ 0.014 · e 0.151 · tensor 0.100 · latency — · cost — · safety —]`. */
export function surfaceNote(s: ErrorSurface): string {
  const parts = [`Φ ${s.primary.value.toFixed(3)}`];
  for (const a of s.axes) parts.push(`${SHORT[a.axis]} ${a.value === null ? "—" : a.value.toFixed(3)}`);
  return `[${parts.join(" · ")}]`;
}
