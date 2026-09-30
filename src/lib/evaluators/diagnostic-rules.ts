/**
 * Hard rules. No model opinion.
 * If a pathway contradicts constraints or skips prerequisites, spike e.
 */
import type { Gate } from "@/lib/closed-loop";
import type {
  DiagnosticCaseInput,
  DiagnosticRecord,
  ErrorBreakdown,
  MeasurementZ,
  ReferenceFramework,
} from "@/product/diagnostic";
import { DEFAULT_REFERENCE } from "@/product/diagnostic";

export const SPIKE = 0.35;

export function presentIds(input: DiagnosticCaseInput): string[] {
  return input.factors.filter((f) => f.present).map((f) => f.id);
}

export function missingRequired(input: DiagnosticCaseInput, ref: ReferenceFramework): string[] {
  const present = new Set(presentIds(input));
  return ref.required_prerequisites.filter((id) => !present.has(id));
}

export function measureZFromCase(input: DiagnosticCaseInput, ref: ReferenceFramework): MeasurementZ {
  const required = ref.required_prerequisites;
  const present = new Set(presentIds(input));
  const missing = required.filter((id) => !present.has(id)).length / Math.max(1, required.length);
  const contradiction = Math.min(1, input.contradictions.length * 0.45);
  const independent = present.has("independent-check") ? 1 : 0;
  const completeness = 1 - missing;
  const uncertainty = Math.min(
    1,
    0.2 + missing * 0.5 + contradiction * 0.35 + (1 - input.hypothesis_confidence) * 0.15
  );
  const z_value = Number(
    Math.sqrt(
      Math.pow(1 - completeness, 2) +
        Math.pow(contradiction, 2) +
        Math.pow(missing, 2) +
        Math.pow(uncertainty, 2) +
        Math.pow(1 - independent, 2)
    ).toFixed(3)
  );
  return {
    z: `z=${z_value} completeness=${completeness.toFixed(2)} missing=${missing.toFixed(2)} contradiction=${contradiction.toFixed(2)}`,
    z_value,
    completeness: Number(completeness.toFixed(3)),
    contradiction: Number(contradiction.toFixed(3)),
    missing: Number(missing.toFixed(3)),
    uncertainty: Number(uncertainty.toFixed(3)),
    independent_check: independent,
  };
}

export function scoreError(
  input: DiagnosticCaseInput,
  ref: ReferenceFramework,
  z: MeasurementZ
): ErrorBreakdown {
  const spikes: string[] = [];
  const missing = missingRequired(input, ref);

  const missing_prereq = Number((missing.length / Math.max(1, ref.required_prerequisites.length)).toFixed(3));
  if (missing.length) spikes.push(`missing:${missing.join(",")}`);

  const contradiction = Number(Math.min(1, input.contradictions.length * 0.45).toFixed(3));
  if (input.contradictions.length) spikes.push("contradiction");

  let confidence_mismatch = 0;
  if (input.hypothesis && input.hypothesis_confidence >= 0.7 && missing.length > 0) {
    confidence_mismatch = SPIKE;
    spikes.push("high-confidence-on-incomplete-pack");
  }

  let pathway_violation = 0;
  const pathway = input.recommended_pathway;
  if (pathway && pathway !== "hold" && pathway !== "observe") {
    const blocked = ref.forbidden_without.filter((id) => !presentIds(input).includes(id));
    if (blocked.length) {
      pathway_violation = SPIKE;
      spikes.push(`pathway-without:${blocked.join(",")}`);
    }
  }

  const base = Number(
    Math.sqrt(
      Math.pow(1 - z.completeness, 2) +
        Math.pow(z.contradiction, 2) +
        Math.pow(z.missing, 2) +
        Math.pow(1 - z.independent_check, 2)
    ).toFixed(3)
  );

  const e = Number(
    Math.min(2, base + confidence_mismatch + pathway_violation).toFixed(3)
  );

  return {
    e,
    missing_prereq,
    contradiction,
    confidence_mismatch,
    pathway_violation,
    spikes,
  };
}

export function gateFromScore(input: DiagnosticCaseInput, z: MeasurementZ, error: ErrorBreakdown): Gate {
  if (error.pathway_violation > 0 || z.contradiction >= 0.2 || z.missing >= 0.35) {
    return "ESCALATE";
  }
  if (z.completeness >= 0.85 && z.contradiction < 0.1 && z.independent_check === 1 && error.spikes.length === 0) {
    return "CLINICIAN_REVIEW";
  }
  return "HOLD";
}

export function evaluateDiagnostic(
  input: DiagnosticCaseInput,
  ref: ReferenceFramework = DEFAULT_REFERENCE
): DiagnosticRecord {
  const z = measureZFromCase(input, ref);
  const error = scoreError(input, ref, z);
  const gate = gateFromScore(input, z, error);
  return {
    input,
    reference: ref,
    y: input.recommended_pathway === "clinician_review" ? "clinician_review" : "observe",
    action_label: input.recommended_pathway || input.hypothesis || "observe",
    z,
    error,
    gate,
    confidence: input.hypothesis_confidence,
  };
}