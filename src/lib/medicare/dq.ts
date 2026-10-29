/**
 * Deterministic Medicare data-quality check (pure; never throws). Check "required_nonnegative.v1":
 * every row must be an object with non-empty string provider_id and hcpcs_code, and finite, non-negative numbers for
 * service_count, avg_submitted_charge and avg_medicare_payment. Each issue is an investigation input for human review,
 * not a conclusion: a negative amount is a data-quality pattern, not evidence of fraud or misconduct.
 */
import { MEDICARE_DOMAIN_LABEL, MEDICARE_NOTE } from "@/lib/medicare/provenance";

export const MEDICARE_DQ_SCHEMA = "aethel.medicare.dq.v1" as const;
export const DQ_CHECK_ID = "required_nonnegative.v1" as const;
export const DQ_STRING_FIELDS = ["provider_id", "hcpcs_code"] as const;
export const DQ_AMOUNT_FIELDS = ["service_count", "avg_submitted_charge", "avg_medicare_payment"] as const;
const MAX_FINDINGS = 200;

export type DqIssue = "not_an_object" | "missing" | "not_a_number" | "negative";
export type DqFinding = { row_index: number; field: string | null; issue: DqIssue };
export type DqReport = {
  schema_version: typeof MEDICARE_DQ_SCHEMA;
  check_id: typeof DQ_CHECK_ID;
  domain_label: typeof MEDICARE_DOMAIN_LABEL;
  rows_checked: number;
  rows_with_issues: number;
  findings: DqFinding[];
  truncated: boolean;
  note: string;
};

export function checkRequiredNonNegative(rows: unknown): DqReport {
  const findings: DqFinding[] = [];
  const bad = new Set<number>();
  let n = 0;
  const add = (f: DqFinding) => { bad.add(f.row_index); if (findings.length < MAX_FINDINGS) findings.push(f); };
  try {
    const list = Array.isArray(rows) ? rows : [];
    n = list.length;
    list.forEach((r, i) => {
      if (typeof r !== "object" || r === null || Array.isArray(r)) { add({ row_index: i, field: null, issue: "not_an_object" }); return; }
      const o = r as Record<string, unknown>;
      for (const f of DQ_STRING_FIELDS) if (typeof o[f] !== "string" || (o[f] as string).trim() === "") add({ row_index: i, field: f, issue: "missing" });
      for (const f of DQ_AMOUNT_FIELDS) {
        const v = o[f];
        if (v === undefined || v === null) add({ row_index: i, field: f, issue: "missing" });
        else if (typeof v !== "number" || !Number.isFinite(v)) add({ row_index: i, field: f, issue: "not_a_number" });
        else if (v < 0) add({ row_index: i, field: f, issue: "negative" });
      }
    });
  } catch {
    add({ row_index: -1, field: null, issue: "not_an_object" });
  }
  return {
    schema_version: MEDICARE_DQ_SCHEMA,
    check_id: DQ_CHECK_ID,
    domain_label: MEDICARE_DOMAIN_LABEL,
    rows_checked: n,
    rows_with_issues: bad.size,
    findings,
    truncated: bad.size > 0 && findings.length >= MAX_FINDINGS,
    note: MEDICARE_NOTE,
  };
}
