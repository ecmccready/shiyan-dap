/** Reference Data Ledger. A record is evidence, not a product claim.
 * Labels are simulated, routed, or physically measured. They are not combined into one status.
 */
export const EVIDENCE_LABELS = ["simulated", "routed", "physically_measured"] as const;
export type EvidenceLabel = (typeof EVIDENCE_LABELS)[number];

export const VERDICTS = ["PASS", "STOP", "RECORDED"] as const;
export type LedgerVerdict = (typeof VERDICTS)[number];

export type LedgerText = {
  summary: string;
  source: string;
};

export type LedgerRecord = {
  id: string;
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
