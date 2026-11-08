// Deterministic metamorphic proof: fixed seed + fixed inputs => same PASS / FAIL / INCONCLUSIVE verdict.
// Pure: no clock, no Math.random, no I/O, inputs never mutated. Transformations come from a seeded PRNG.
import { MetamorphicEngine } from "./metamorphic";

export type ProofVerdict = "PASS" | "FAIL" | "INCONCLUSIVE";
export const DETERMINISTIC_PROOF_VERSION = "deterministic-proof-v1";
export const TRANSFORMATION_COUNT = 8;
export const PHI_TOLERANCE = 0.05;
export const EXPECTED_RELATIONS = [
  "anchor: predictedValue unchanged under every drift",
  `phi-stability: |phi' - phi| < ${PHI_TOLERANCE} under every drift`,
] as const;

export interface ProofInput { predicted: number; observed: number; phi?: number; step?: number }
export interface ProofTransformation { index: number; drift: number; phi_after: number; anchor_held: boolean; phi_stable: boolean }
export interface DeterministicProof {
  version: typeof DETERMINISTIC_PROOF_VERSION;
  seed: number | null;
  inputs: { predicted: number; observed: number; phi: number; step: number } | null;
  transformations: ProofTransformation[];
  expected_relations: readonly string[];
  verdict: ProofVerdict;
  reason: string;
}

/** mulberry32: small, well-known 32-bit PRNG; identical sequence for identical seed on any JS runtime. */
export function seededDrifts(seed: number, count = TRANSFORMATION_COUNT): number[] {
  let a = seed >>> 0;
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const u = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    out.push(Number(((u - 0.5) * 0.1).toFixed(8)));
  }
  return out;
}

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const inconclusive = (seed: number | null, inputs: DeterministicProof["inputs"], reason: string): DeterministicProof =>
  ({ version: DETERMINISTIC_PROOF_VERSION, seed, inputs, transformations: [], expected_relations: EXPECTED_RELATIONS, verdict: "INCONCLUSIVE", reason });

export function evaluateDeterministicProof(input: ProofInput, seed: unknown): DeterministicProof {
  const s = Number.isSafeInteger(seed) && (seed as number) >= 0 && (seed as number) <= 0xffffffff ? (seed as number) : null;
  if (!input || !finite(input.predicted) || !finite(input.observed)
    || (input.phi !== undefined && !finite(input.phi)) || (input.step !== undefined && !finite(input.step))) {
    return inconclusive(s, null, "Inputs not evaluable: predicted/observed (and optional phi/step) must be finite numbers");
  }
  const inputs = { predicted: input.predicted, observed: input.observed, phi: input.phi ?? 1, step: input.step ?? 0 };
  if (s === null) return inconclusive(null, inputs, "No fixed seed: provide an integer seed in [0, 4294967295] for a reproducible verdict");
  const frame = { step: inputs.step, observedValue: inputs.observed, predictedValue: inputs.predicted, phi: inputs.phi };
  const transformations = seededDrifts(s).map((drift, index) => {
    const { emergentState } = MetamorphicEngine.entangleWithDrift({ ...frame }, drift);
    return { index, drift, phi_after: emergentState.phi,
      anchor_held: emergentState.predictedValue === frame.predictedValue,
      phi_stable: Math.abs(emergentState.phi - frame.phi) < PHI_TOLERANCE };
  });
  const failed = transformations.filter((t) => !t.anchor_held || !t.phi_stable);
  return { version: DETERMINISTIC_PROOF_VERSION, seed: s, inputs, transformations, expected_relations: EXPECTED_RELATIONS,
    verdict: failed.length ? "FAIL" : "PASS",
    reason: failed.length ? `${failed.length}/${transformations.length} transformations violated an expected relation`
      : `All ${transformations.length} seeded transformations satisfied every expected relation` };
}
