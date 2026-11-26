/** Reference Data Ledger. A record is evidence, not a product claim.
 * Labels are simulated, routed, or physically measured. They are not combined into one status.
 */
export const EVIDENCE_LABELS = ["simulated", "routed", "physically_measured"] as const;
export type EvidenceLabel = (typeof EVIDENCE_LABELS)[number];

export const VERDICTS = ["PASS", "STOP", "RECORDED"] as const;
export type LedgerVerdict = (typeof VERDICTS)[number];

/** A record becomes `verified` only when its evidence includes a physical board measurement. */
export const VERIFIED_STATUS = "verified" as const;
export const REFERENCE_STATUSES = [
  "reference (routed + simulated), physical verification pending",
  "stopped (simulated + routed), not a verified reference",
  "pass (simulated + routed), physical verification pending",
  VERIFIED_STATUS,
] as const;
export type ReferenceStatus = (typeof REFERENCE_STATUSES)[number];

export const PROMOTION_RULE =
  "A result is not a verified reference until evidence.labels includes physically_measured from a run on the supported board (ECP5 Versa, LFE5UM-45F). Simulated and routed results stay pending.";

export type LedgerText = {
  summary: string;
  source: string;
};

export type LedgerAudit = {
  pull_requests: string[];
  fixtures: string[];
  hashes: Record<string, string>;
};

export type LedgerRecord = {
  id: string;
  /** Not `verified` unless a physical measurement is recorded. */
  reference_status: ReferenceStatus;
  workload_identity: string;
  input_conditions: LedgerText;
  baseline: LedgerText;
  experiment: LedgerText;
  build_provenance: LedgerText;
  implementation: LedgerText;
  hardware_target: LedgerText;
  validation: LedgerText & { bit_exact: boolean | null };
  evidence: { labels: EvidenceLabel[]; sources: string[] };
  outcome: {
    verdict: LedgerVerdict;
    accepted: boolean;
    /** True when the recorded verdict is a stop or another kept negative result. */
    negative: boolean;
    summary: string;
  };
  audit: LedgerAudit;
  /** Exact figures copied from the cited fixtures. The check recomputes them from those files. */
  numbers: {
    fmax_mhz_median?: number;
    trellis_comb_used?: number;
    trellis_ff_used?: number;
    dp16kd_used?: number;
    routes?: string;
    design?: string;
    cycles?: { original?: Record<string, number>; high?: Record<string, number> };
    addr_w?: number;
    cfg_d?: number;
    full_loop_trellis_comb?: number;
    bit_sha256?: string;
    svf_sha256?: string;
    spi_bit_sha256?: string;
  };
};

export type LedgerFile = {
  format: "shiyan-reference-ledger";
  power: "needs real board";
  naming: string;
  records: LedgerRecord[];
};
