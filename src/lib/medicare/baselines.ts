/**
 * Medicare Know How stub: documented rules over rows (pure; never throws; medicare-labeled only).
 *
 * Rule payment_vs_charge.v1: when both avg_submitted_charge and avg_medicare_payment are finite, non-negative numbers,
 * avg_medicare_payment should not exceed avg_submitted_charge. Rows where either value is missing, not a number or
 * negative are skipped (the data-quality check already reports those). Candidates are ranked by payment / charge,
 * highest first (ties keep row order). A candidate is a pattern for human review, not a verified conclusion: it is
 * not a claim of fraud, misconduct or clinical misdiagnosis.
 */
import { MEDICARE_DOMAIN_LABEL, MEDICARE_NOTE } from "@/lib/medicare/provenance";

export const MEDICARE_BASELINES_SCHEMA = "aethel.medicare.baselines.v1" as const;
export const PAYMENT_VS_CHARGE_RULE = "payment_vs_charge.v1" as const;
export const PAYMENT_VS_CHARGE_DESCRIPTION =
  "avg_medicare_payment <= avg_submitted_charge when both are present, finite and non-negative";
const MAX_CANDIDATES = 200;

export type RuleCandidate = { row_index: number; provider_id: string | null; charge: number; payment: number; ratio: number | null };
export type RuleResult = {
  rule_id: typeof PAYMENT_VS_CHARGE_RULE;
  description: string;
  rows_evaluated: number;
  rows_skipped: number;
  candidates: RuleCandidate[];
};
export type BaselinesReport = {
  schema_version: typeof MEDICARE_BASELINES_SCHEMA;
  domain_label: typeof MEDICARE_DOMAIN_LABEL;
  rules: RuleResult[];
  note: string;
};

const okAmount = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;

export function paymentVsCharge(rows: unknown): RuleResult {
  const candidates: RuleCandidate[] = [];
  let evaluated = 0;
  let skipped = 0;
  try {
    const list = Array.isArray(rows) ? rows : [];
    list.forEach((r, i) => {
      if (typeof r !== "object" || r === null || Array.isArray(r)) { skipped++; return; }
      const o = r as Record<string, unknown>;
      const charge = o.avg_submitted_charge;
      const payment = o.avg_medicare_payment;
      if (!okAmount(charge) || !okAmount(payment)) { skipped++; return; }
      evaluated++;
      if (payment > charge) {
        candidates.push({ row_index: i, provider_id: typeof o.provider_id === "string" ? o.provider_id : null, charge, payment, ratio: charge > 0 ? Number((payment / charge).toFixed(4)) : null });
      }
    });
  } catch {
    /* unreadable input: report what was counted so far */
  }
  const rank = (c: RuleCandidate) => (c.ratio === null ? Infinity : c.ratio);
  candidates.sort((a, b) => (rank(b) !== rank(a) ? rank(b) - rank(a) : a.row_index - b.row_index));
  return { rule_id: PAYMENT_VS_CHARGE_RULE, description: PAYMENT_VS_CHARGE_DESCRIPTION, rows_evaluated: evaluated, rows_skipped: skipped, candidates: candidates.slice(0, MAX_CANDIDATES) };
}

export function runBaselines(rows: unknown): BaselinesReport {
  return { schema_version: MEDICARE_BASELINES_SCHEMA, domain_label: MEDICARE_DOMAIN_LABEL, rules: [paymentVsCharge(rows)], note: MEDICARE_NOTE };
}
