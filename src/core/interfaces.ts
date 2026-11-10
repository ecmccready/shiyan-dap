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
  verification: VerificationResult;
  metamorphic: MetamorphicResult;
  provenance: { source: string; run_id: string; timestamp: string };
  reuse_eligibility: boolean;
  z_next_action: string;
  revision: number;
  /** Present only when a telemetry payload included a SelfEngine recovery record. */
  recovery?: Record<string, unknown>;
}

export type ContractVerdict = "PASS" | "FAIL" | "INCONCLUSIVE";

export interface VerificationResult {
  replay_verdict: "PASS" | "FAIL" | "SKIP";
  verifier_version: string;
  /** Contract responses only (not stored): computed server-side, never taken from the caller. */
  contract_version?: string;
  integrity?: "PASS";
  content_sha256?: string;
  stored_verdict?: ContractVerdict;
  recomputed_verdict?: ContractVerdict;
  consistent?: boolean;
  verdict?: ContractVerdict;
  reason?: string;
}

export interface MetamorphicResult {
  seed: number;
  transformation: string;
  expected_relation: string;
  result: string;
  converged: boolean;
  /** Contract responses only (not stored as separate fields): parsed deterministic proof detail. */
  verdict?: ContractVerdict;
  transformations?: { index: number; drift: number; phi_after: number; anchor_held: boolean; phi_stable: boolean }[];
  expected_relations?: string[];
}

export interface NextActionProposal {
  action: string;
  reason: string;
  experience_id?: string;
  evidence_used: string[];
  /** Descriptive only. The platform never executes a proposal. */
  executable?: false;
  contract_version?: string;
}
