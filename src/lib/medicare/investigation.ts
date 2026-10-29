/**
 * Medicare Do stage: investigation report with a review disposition stub (pure; never throws; medicare-labeled only).
 *
 * buildInvestigationReport takes an evidence pack (aethel.medicare.evidence.v1) and optional reviewer dispositions,
 * keyed by item_id. It links the report to the pack's pack_hash and records one status per item, from exactly three:
 * "unreviewed", "needs_human_review" or "cleared_pattern_only". No status asserts fraud, misconduct or clinical
 * misdiagnosis. Unknown statuses, unknown item ids and dispositions on a pack whose hash does not verify are rejected
 * and listed; the item stays "unreviewed". report_hash is sha256 of the canonical JSON of the report without report_hash.
 * Nothing is stored or sent: this is a stub that a qualified human reviewer would fill in.
 */
import { contentHash, MEDICARE_DOMAIN_LABEL, MEDICARE_NOTE } from "@/lib/medicare/provenance";
import { verifyPackHash, type EvidencePack } from "@/lib/medicare/evidence";

export const MEDICARE_INVESTIGATION_SCHEMA = "aethel.medicare.investigation.v1" as const;
export const DISPOSITION_STATUSES = ["unreviewed", "needs_human_review", "cleared_pattern_only"] as const;
export type DispositionStatus = (typeof DISPOSITION_STATUSES)[number];
export const INVESTIGATION_SCOPE_NOTE =
  "Dispositions record review state only. None asserts fraud, misconduct or clinical misdiagnosis; cleared_pattern_only means the reviewer found the pattern explained, not that anyone was cleared of wrongdoing.";

export type DispositionInput = Record<string, { status?: unknown; reviewer?: unknown; note?: unknown }>;
export type ReportEntry = {
  item_id: string; kind: string; transformation: string; row_index: number; provider_id: string | null;
  detail: string; row_hash: string | null; status: DispositionStatus; reviewer: string | null; note: string | null;
};
export type InvestigationReport = {
  schema_version: typeof MEDICARE_INVESTIGATION_SCHEMA;
  domain_label: typeof MEDICARE_DOMAIN_LABEL;
  evidence: { schema: string; pack_hash: string | null; pack_verified: boolean; source_content_hash: string | null };
  allowed_statuses: readonly DispositionStatus[];
  counts: Record<DispositionStatus, number> & { items: number; rejected: number };
  entries: ReportEntry[];
  rejected: { item_id: string; reason: string }[];
  scope_note: string;
  note: string;
  report_hash: string;
};

const str = (v: unknown, max = 200): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

export function buildInvestigationReport(input: { pack: unknown; dispositions?: unknown }): InvestigationReport {
  let verified = false, items: EvidencePack["items"] = [], packHash: string | null = null, schema = "", src: string | null = null;
  try {
    verified = verifyPackHash(input.pack);
    if (verified) {
      const p = input.pack as EvidencePack;
      items = Array.isArray(p.items) ? p.items : []; packHash = p.pack_hash; schema = String(p.schema_version); src = p.source?.content_hash ?? null;
    }
  } catch { verified = false; items = []; }
  const rejected: { item_id: string; reason: string }[] = [];
  let disp: DispositionInput = {};
  try {
    const d = input.dispositions;
    if (d && typeof d === "object" && !Array.isArray(d)) disp = d as DispositionInput;
    else if (d !== undefined && d !== null) rejected.push({ item_id: "*", reason: "dispositions must be an object keyed by item_id" });
  } catch { disp = {}; }
  let keys: string[] = [];
  try { keys = Object.keys(disp); } catch { keys = []; }
  const ids = new Set(items.map((i) => i.item_id));
  if (!verified && keys.length) for (const k of keys) rejected.push({ item_id: k, reason: "evidence pack hash does not verify" });
  else for (const k of keys) if (!ids.has(k)) rejected.push({ item_id: k, reason: "unknown item_id" });
  const entries: ReportEntry[] = items.map((it) => {
    let status: DispositionStatus = "unreviewed", reviewer: string | null = null, note: string | null = null;
    try {
      const d = Object.prototype.hasOwnProperty.call(disp, it.item_id) ? disp[it.item_id] : undefined;
      if (d !== undefined) {
        const s = d && typeof d === "object" ? d.status : undefined;
        if (typeof s === "string" && (DISPOSITION_STATUSES as readonly string[]).includes(s)) {
          status = s as DispositionStatus; reviewer = str(d.reviewer, 80); note = str(d.note);
        } else rejected.push({ item_id: it.item_id, reason: `status must be one of ${DISPOSITION_STATUSES.join(", ")}` });
      }
    } catch { rejected.push({ item_id: it.item_id, reason: "unreadable disposition" }); }
    return { item_id: it.item_id, kind: it.kind, transformation: it.transformation, row_index: it.row_index, provider_id: it.provider_id,
      detail: it.detail, row_hash: it.row_hash, status, reviewer, note };
  });
  const count = (s: DispositionStatus) => entries.filter((e) => e.status === s).length;
  const body: Omit<InvestigationReport, "report_hash"> = {
    schema_version: MEDICARE_INVESTIGATION_SCHEMA,
    domain_label: MEDICARE_DOMAIN_LABEL,
    evidence: { schema: schema || "unverified", pack_hash: packHash, pack_verified: verified, source_content_hash: src },
    allowed_statuses: DISPOSITION_STATUSES,
    counts: { items: entries.length, unreviewed: count("unreviewed"), needs_human_review: count("needs_human_review"),
      cleared_pattern_only: count("cleared_pattern_only"), rejected: rejected.length },
    entries, rejected, scope_note: INVESTIGATION_SCOPE_NOTE, note: MEDICARE_NOTE,
  };
  return { ...body, report_hash: contentHash(body) };
}

/** Recompute report_hash (pure). True when it matches; false on mismatch or unreadable input. */
export function verifyReportHash(report: unknown): boolean {
  try {
    if (typeof report !== "object" || report === null) return false;
    const { report_hash, ...body } = report as Record<string, unknown>;
    return typeof report_hash === "string" && report_hash === contentHash(body);
  } catch { return false; }
}

/**
 * Pure: returns a NEW dispositions object with item_id set to status (or removed when status is "unreviewed").
 * Statuses outside DISPOSITION_STATUSES and empty ids return the input unchanged; the input is never mutated.
 */
export function applyDisposition(current: unknown, item_id: unknown, status: unknown, reviewer?: unknown): DispositionInput {
  let base: DispositionInput = {};
  try { if (current && typeof current === "object" && !Array.isArray(current)) base = { ...(current as DispositionInput) }; } catch { base = {}; }
  if (typeof item_id !== "string" || !item_id || typeof status !== "string" || !(DISPOSITION_STATUSES as readonly string[]).includes(status)) return base;
  if (status === "unreviewed") { delete base[item_id]; return base; }
  const r = str(reviewer, 80);
  base[item_id] = r ? { status, reviewer: r } : { status };
  return base;
}

/** Pure review progress: reviewed = items not "unreviewed"; percent rounded; label "X of N reviewed". */
export function reviewProgress(report: unknown): { items: number; reviewed: number; percent: number; label: string; by_status: Record<DispositionStatus, number> } {
  const by_status: Record<DispositionStatus, number> = { unreviewed: 0, needs_human_review: 0, cleared_pattern_only: 0 };
  try {
    const entries = (report as InvestigationReport)?.entries;
    if (Array.isArray(entries)) for (const e of entries) if (e && (DISPOSITION_STATUSES as readonly string[]).includes(e.status)) by_status[e.status]++;
  } catch { /* empty */ }
  const items = by_status.unreviewed + by_status.needs_human_review + by_status.cleared_pattern_only;
  const reviewed = items - by_status.unreviewed;
  return { items, reviewed, percent: items ? Math.round((reviewed / items) * 100) : 0, label: `${reviewed} of ${items} reviewed`, by_status };
}

/** Browser event name the disposition stub emits with its current progress (tab-local; nothing leaves the page). */
export const MEDICARE_PROGRESS_EVENT = "medicare:review-progress";

/** Pure: complete when there is at least one item and none is unreviewed. Message keeps pattern ≠ conclusion. */
export function reviewCompletion(p: { items: number; reviewed: number; by_status: Record<DispositionStatus, number> } | null | undefined): { complete: boolean; message: string } {
  try {
    if (!p || !(p.items > 0) || p.reviewed !== p.items) return { complete: false, message: "" };
    return { complete: true, message: `Review complete: all ${p.items} items dispositioned (${p.by_status.needs_human_review} needs_human_review, ${p.by_status.cleared_pattern_only} cleared_pattern_only). Dispositions are review state only, not findings of fraud, misconduct or misdiagnosis.` };
  } catch { return { complete: false, message: "" }; }
}
