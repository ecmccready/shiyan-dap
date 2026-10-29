/**
 * Medicare Show stage: evidence pack (pure; never throws; medicare-labeled only).
 *
 * buildEvidencePack links every data-quality finding and every rule candidate to its source: the provenance
 * content_hash of the dataset, the sha256 of the canonical JSON of the exact source row, and the transformation that
 * produced it (check or rule id and its schema). Every item starts as "unreviewed" and carries an uncertainty note.
 * pack_hash is sha256 of the canonical JSON of the pack without pack_hash, so anyone can recompute it.
 * An item is a pattern for human review, not a verified conclusion: it is not a claim of clinical misdiagnosis,
 * fraud or misconduct.
 */
import { contentHash, MEDICARE_DOMAIN_LABEL, MEDICARE_NOTE, type MedicareProvenance } from "@/lib/medicare/provenance";
import type { DqReport } from "@/lib/medicare/dq";
import type { BaselinesReport } from "@/lib/medicare/baselines";

export const MEDICARE_EVIDENCE_SCHEMA = "aethel.medicare.evidence.v1" as const;
export const UNCERTAINTY_NOTE =
  "Uncertainty: items come from deterministic checks on one synthetic release. A data-quality issue may be an entry or extraction error; a rule candidate may have a documented explanation. Nothing here is reviewed yet.";

export type EvidenceItem = {
  item_id: string;
  kind: "data_quality" | "rule_candidate";
  transformation: string;
  row_index: number;
  provider_id: string | null;
  field: string | null;
  detail: string;
  source_content_hash: string;
  row_hash: string | null;
  uncertainty: string;
  review_status: "unreviewed";
};

export type EvidencePack = {
  schema_version: typeof MEDICARE_EVIDENCE_SCHEMA;
  domain_label: typeof MEDICARE_DOMAIN_LABEL;
  source: { provenance_schema: string; source_id: string; release_id: string; retrieved_at: string; content_hash: string };
  transformations: { id: string; schema: string }[];
  counts: { items: number; data_quality: number; rule_candidates: number; unreviewed: number };
  items: EvidenceItem[];
  uncertainty_note: string;
  note: string;
  pack_hash: string;
};

function rowAt(rows: unknown, i: number): { hash: string | null; provider: string | null } {
  try {
    const r = Array.isArray(rows) ? rows[i] : undefined;
    if (r === undefined) return { hash: null, provider: null };
    const p = typeof r === "object" && r !== null && typeof (r as Record<string, unknown>).provider_id === "string" ? ((r as Record<string, unknown>).provider_id as string) : null;
    return { hash: contentHash(r), provider: p };
  } catch {
    return { hash: null, provider: null };
  }
}

export function buildEvidencePack(input: { provenance: MedicareProvenance; dq: DqReport; baselines: BaselinesReport; rows: unknown }): EvidencePack {
  const { provenance: pv, dq, baselines, rows } = input;
  const items: EvidenceItem[] = [];
  for (const f of dq.findings) {
    const r = rowAt(rows, f.row_index);
    items.push({
      item_id: `dq:${dq.check_id}:${f.row_index}:${f.field ?? "row"}`,
      kind: "data_quality", transformation: dq.check_id, row_index: f.row_index, provider_id: r.provider, field: f.field,
      detail: `${f.field ?? "row"} ${f.issue}`, source_content_hash: pv.content_hash, row_hash: r.hash,
      uncertainty: "may be an entry or extraction error in the source", review_status: "unreviewed",
    });
  }
  for (const rule of baselines.rules) {
    for (const c of rule.candidates) {
      const r = rowAt(rows, c.row_index);
      items.push({
        item_id: `rule:${rule.rule_id}:${c.row_index}`,
        kind: "rule_candidate", transformation: rule.rule_id, row_index: c.row_index, provider_id: c.provider_id ?? r.provider, field: null,
        detail: `payment ${c.payment} > charge ${c.charge} (ratio ${c.ratio ?? "n/a"})`, source_content_hash: pv.content_hash, row_hash: r.hash,
        uncertainty: "may have a documented explanation; needs a qualified reviewer", review_status: "unreviewed",
      });
    }
  }
  const body: Omit<EvidencePack, "pack_hash"> = {
    schema_version: MEDICARE_EVIDENCE_SCHEMA,
    domain_label: MEDICARE_DOMAIN_LABEL,
    source: { provenance_schema: pv.schema_version, source_id: pv.source_id, release_id: pv.release_id, retrieved_at: pv.retrieved_at, content_hash: pv.content_hash },
    transformations: [{ id: dq.check_id, schema: dq.schema_version }, ...baselines.rules.map((r) => ({ id: r.rule_id, schema: baselines.schema_version }))],
    counts: {
      items: items.length,
      data_quality: items.filter((i) => i.kind === "data_quality").length,
      rule_candidates: items.filter((i) => i.kind === "rule_candidate").length,
      unreviewed: items.length,
    },
    items,
    uncertainty_note: UNCERTAINTY_NOTE,
    note: MEDICARE_NOTE,
  };
  return { ...body, pack_hash: contentHash(body) };
}

/** Recompute pack_hash from the pack body (pure). True when it matches; false on any mismatch or unreadable input. */
export function verifyPackHash(pack: unknown): boolean {
  try {
    if (typeof pack !== "object" || pack === null) return false;
    const { pack_hash, ...body } = pack as Record<string, unknown>;
    return typeof pack_hash === "string" && pack_hash === contentHash(body);
  } catch {
    return false;
  }
}
