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
}

export interface VerificationResult {
  replay_verdict: "PASS" | "FAIL" | "SKIP";
  verifier_version: string;
}

export interface MetamorphicResult {
  seed: number;
  transformation: string;
  expected_relation: string;
  result: string;
  converged: boolean;
}

export interface NextActionProposal {
  action: string;
  reason: string;
  experience_id?: string;
  evidence_used: string[];
}
