// Thin, side-effect-free wrapper so API routes can call MetamorphicEngine.
// No I/O, no globals mutated; the engine itself is left unchanged.
import { MetamorphicEngine } from "./metamorphic";
import { evaluateDeterministicProof, seededDrifts, type DeterministicProof } from "./deterministic-proof";

export interface TelemetryInput { predicted: number; observed: number; step?: number; phi?: number; seed?: number }
export interface TelemetryFrame { step: number; observedValue: number; predictedValue: number; phi: number }
export interface TelemetryResult {
  frame: TelemetryFrame;
  emergentState: TelemetryFrame;
  converged: boolean;
  seed: number | null;
  proof: DeterministicProof;
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
  const proof = evaluateDeterministicProof(input, input.seed);
  if (proof.seed !== null && proof.verdict !== "INCONCLUSIVE") {
    // Seeded: emergent state uses the first seeded drift; converged mirrors the deterministic verdict.
    const { emergentState } = MetamorphicEngine.entangleWithDrift({ ...frame }, seededDrifts(proof.seed, 1)[0]);
    return { frame, emergentState, converged: proof.verdict === "PASS", seed: proof.seed, proof };
  }
  // Unseeded (or invalid seed): legacy stochastic step; the proof verdict is INCONCLUSIVE.
  const { emergentState, converged } = MetamorphicEngine.entangle({ ...frame });
  return { frame, emergentState, converged, seed: input.seed ?? null, proof };
}
