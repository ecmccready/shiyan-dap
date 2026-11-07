// Thin, side-effect-free wrapper so API routes can call MetamorphicEngine.
// No I/O, no globals mutated; the engine itself is left unchanged.
import { MetamorphicEngine } from "./metamorphic";

export interface TelemetryInput { predicted: number; observed: number; step?: number; phi?: number; seed?: number }
export interface TelemetryFrame { step: number; observedValue: number; predictedValue: number; phi: number }
export interface TelemetryResult {
  frame: TelemetryFrame;
  emergentState: TelemetryFrame;
  converged: boolean;
  seed: number | null;
}

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export function parseTelemetryInput(value: unknown): TelemetryInput | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  if (!finite(v.predicted) || !finite(v.observed)) return null;
  for (const key of ["step", "phi", "seed"]) if (v[key] !== undefined && !finite(v[key])) return null;
  return { predicted: v.predicted, observed: v.observed, step: v.step as number | undefined, phi: v.phi as number | undefined, seed: v.seed as number | undefined };
}

export function toTelemetryFrame(input: TelemetryInput): TelemetryFrame {
  return { step: input.step ?? 0, observedValue: input.observed, predictedValue: input.predicted, phi: input.phi ?? 1 };
}

export function runTelemetry(input: TelemetryInput): TelemetryResult {
  const frame = toTelemetryFrame(input);
  const { emergentState, converged } = MetamorphicEngine.entangle({ ...frame });
  return { frame, emergentState, converged, seed: input.seed ?? null };
}
