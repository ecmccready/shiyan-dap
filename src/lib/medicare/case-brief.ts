/**
 * Medicare chosen case and reviewer hand-off (pure; never throws; medicare-labeled only).
 * The case is documented product copy over a SYNTHETIC fixture; nothing is fetched from CMS.
 */
import type { InvestigationReport } from "@/lib/medicare/investigation";
import type { EvidencePack } from "@/lib/medicare/evidence";
import type { MedicareProvenance } from "@/lib/medicare/provenance";

export const MEDICARE_CASE = {
  case_id: "medicare.case.payment_vs_charge.v1",
  domain_label: "medicare",
  dataset: "CMS Medicare Physician & Other Practitioners — by Provider and Service (public use file, utilization and payment)",
  dataset_note: "Demo runs on a synthetic fixture shaped like this file; no live CMS fetch, no real providers, no PHI.",
  anomaly_class: "payment_vs_charge.v1: average Medicare payment exceeds average submitted charge when both are present; plus required_nonnegative.v1 data-quality findings.",
  why: [
    "Deterministic: same input, same findings and hashes.",
    "Explainable: one documented comparison per row.",
    "Human-reviewable: each item links to the dataset hash, its row hash and the check.",
    "No PHI: provider-level aggregate fields; the demo is synthetic.",
    "Uses the existing baseline and data-quality checks.",
  ],
  hitl: [
    "SI runs the checks and builds the evidence pack (aethel.medicare.evidence.v1).",
    "A qualified human reviewer sets each item to needs_human_review or cleared_pattern_only, or leaves it unreviewed.",
    "The investigation report (aethel.medicare.investigation.v1) records the dispositions with a recomputable report_hash.",
    "Any action beyond review stays with the reviewer's organization.",
  ],
  metrics: [
    "Median reviewer time per item (minutes)",
    "Precision: share of surfaced items the reviewer keeps as needs_human_review",
    "False positives: items cleared_pattern_only",
    "Reproducibility: pack and report hashes recompute identically",
  ],
  metrics_note: "Display only: no pilot data yet.",
  guardrail: "Detected pattern ≠ verified conclusion. Nothing here asserts fraud, misconduct or clinical misdiagnosis.",
} as const;

/** Plain markdown hand-off for a reviewer. Pure; tolerates partial input. */
export function formatInvestigationCaseBrief(report: InvestigationReport, evidence: EvidencePack, provenance: MedicareProvenance): string {
  try {
    const L: string[] = [];
    L.push(`# Medicare case brief — ${MEDICARE_CASE.case_id}`, "");
    L.push(`Domain: ${MEDICARE_CASE.domain_label}`, `Dataset: ${MEDICARE_CASE.dataset}`, `Note: ${MEDICARE_CASE.dataset_note}`);
    L.push(`Anomaly class: ${MEDICARE_CASE.anomaly_class}`, "");
    L.push("## Source", `- ${provenance.source_name} (${provenance.source_id}), release ${provenance.release_id}, retrieved ${provenance.retrieved_at}`);
    L.push(`- dataset sha256 ${provenance.content_hash}`);
    L.push(`- evidence pack sha256 ${evidence.pack_hash} (${evidence.schema_version})`);
    L.push(`- report sha256 ${report.report_hash} (${report.schema_version}); pack verified: ${report.evidence.pack_verified ? "yes" : "no"}`);
    L.push(`- checks: ${evidence.transformations.map((t) => t.id).join(", ")}`, "");
    const c = report.counts;
    L.push("## Items", `${c.items} items: ${c.unreviewed} unreviewed, ${c.needs_human_review} needs_human_review, ${c.cleared_pattern_only} cleared_pattern_only.`, "");
    for (const e of report.entries) {
      L.push(`- [${e.status}] ${e.item_id} — provider ${e.provider_id ?? "n/a"}, row ${e.row_index}: ${e.detail}; row sha256 ${e.row_hash ?? "n/a"}${e.reviewer ? `; reviewer ${e.reviewer}` : ""}${e.note ? `; note: ${e.note}` : ""}`);
    }
    if (report.rejected.length) { L.push("", "## Rejected dispositions"); for (const r of report.rejected) L.push(`- ${r.item_id}: ${r.reason}`); }
    L.push("", "## Uncertainty", evidence.uncertainty_note, "", "## Guardrail", MEDICARE_CASE.guardrail, report.scope_note);
    return L.join("\n") + "\n";
  } catch {
    return `# Medicare case brief — ${MEDICARE_CASE.case_id}\n\nInput could not be read.\n\n${MEDICARE_CASE.guardrail}\n`;
  }
}
