export interface ExperienceRecord {
  experience_id: string;
  tenant_id?: string;
  repo: string;
  commit_sha: string;
  goal: string;
  baseline: string;
  action: string;
  predicted_outcome: string;
  observed_outcome: string;
  delta_e: number;
  metrics: Record<string, number>;
  verification: {
    replay_verdict: "PASS" | "FAIL" | "SKIP";
    verifier_version: string;
  };
  metamorphic: {
    seed: number;
    transformation: string;
    expected_relation: string;
    result: string;
    converged?: boolean; // v1 records remain readable; v1.1 requires explicit convergence.
  };
  provenance: {
    source: string;
    run_id: string;
    timestamp: string;
  };
  reuse_eligibility: boolean;
  z_next_action: string;
  data_classification?: string;
  consent_policy?: string;
  revision: number;
  /** Present only when a telemetry payload included a SelfEngine recovery record. */
  recovery?: Record<string, unknown>;
}

const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

/** Pure runtime guard for records read from local JSON, including safe filename IDs. */
export function validateExperienceRecord(value: unknown): value is ExperienceRecord {
  if (!object(value)) return false;
  const requiredText = ["experience_id", "repo", "commit_sha", "goal", "baseline", "action",
    "predicted_outcome", "observed_outcome", "z_next_action"];
  if (!requiredText.every((key) => text(value[key]))) return false;
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,159}$/.test(value.experience_id as string)) return false;
  if (!["tenant_id", "data_classification", "consent_policy"].every((key) =>
    value[key] === undefined || text(value[key]))) return false;
  if (!finite(value.delta_e) || !object(value.metrics) || !Object.values(value.metrics).every(finite)) return false;
  if (typeof value.reuse_eligibility !== "boolean" || !Number.isSafeInteger(value.revision) || (value.revision as number) < 1) return false;
  const { verification: v, metamorphic: m, provenance: p } = value;
  return object(v) && ["PASS", "FAIL", "SKIP"].includes(v.replay_verdict as string) && text(v.verifier_version)
    && object(m) && finite(m.seed) && text(m.transformation) && text(m.expected_relation) && text(m.result)
    && (m.converged === undefined || typeof m.converged === "boolean")
    && object(p) && text(p.source) && text(p.run_id) && text(p.timestamp) && Number.isFinite(Date.parse(p.timestamp))
    && (value.recovery === undefined || object(value.recovery));
}
