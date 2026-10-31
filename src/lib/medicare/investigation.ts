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
  const keepNote = base[item_id] && typeof base[item_id] === "object" ? str((base[item_id] as { note?: unknown }).note) : null;
  base[item_id] = { status, ...(r ? { reviewer: r } : {}), ...(keepNote ? { note: keepNote } : {}) };
  return base;
}

/** Reviewer note limit (characters); matches the report's note cap. */
export const DISPOSITION_NOTE_MAX = 200;
/** Pure: set or clear the note on an item that already has a review status; unreviewed items carry no note. Input never mutated. */
export function applyDispositionNote(current: unknown, item_id: unknown, note: unknown): DispositionInput {
  let base: DispositionInput = {};
  try { if (current && typeof current === "object" && !Array.isArray(current)) base = { ...(current as DispositionInput) }; } catch { base = {}; }
  if (typeof item_id !== "string" || !item_id) return base;
  const d = base[item_id];
  if (!d || typeof d !== "object" || typeof d.status !== "string" || !(DISPOSITION_STATUSES as readonly string[]).includes(d.status) || d.status === "unreviewed") return base;
  const n = str(note, DISPOSITION_NOTE_MAX);
  const { note: _old, ...rest } = d as Record<string, unknown>;
  void _old;
  base[item_id] = n ? { ...rest, note: n } : rest;
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

/** Browser event carrying the live investigation report from the disposition stub (tab-local). */
export const MEDICARE_REPORT_EVENT = "medicare:investigation-report";

/** Pure: pretty JSON of the current report; returns "" when the report hash does not verify. */
export function currentDispositionsJson(report: unknown): string {
  try { return verifyReportHash(report) ? JSON.stringify(report, null, 2) : ""; } catch { return ""; }
}

/** Pure: one chip per report entry (item, provider, status, short label). Statuses only from DISPOSITION_STATUSES. */
export function statusChips(report: unknown): { item_id: string; provider_id: string | null; status: DispositionStatus; label: string }[] {
  try {
    const entries = (report as InvestigationReport)?.entries;
    if (!Array.isArray(entries)) return [];
    const short: Record<DispositionStatus, string> = { unreviewed: "unreviewed", needs_human_review: "needs review", cleared_pattern_only: "cleared (pattern only)" };
    return entries.filter((e) => e && (DISPOSITION_STATUSES as readonly string[]).includes(e.status))
      .map((e) => ({ item_id: e.item_id, provider_id: e.provider_id ?? null, status: e.status, label: `${e.provider_id ?? e.item_id} · ${short[e.status]}` }));
  } catch { return []; }
}

/** Browser event carrying the Win-strip status filter (a DispositionStatus or null for All); tab-local. */
export const MEDICARE_FILTER_EVENT = "medicare:status-filter";

/** Pure: clicking the active status (or anything invalid) clears to null; otherwise selects it. */
export function toggleStatusFilter(current: unknown, clicked: unknown): DispositionStatus | null {
  if (typeof clicked !== "string" || !(DISPOSITION_STATUSES as readonly string[]).includes(clicked)) return null;
  return current === clicked ? null : (clicked as DispositionStatus);
}

/** Pure: row emphasis under a filter: "all" with no filter, "match" or "dim". */
export function filterEmphasis(status: unknown, filter: DispositionStatus | null): "all" | "match" | "dim" {
  return filter === null ? "all" : status === filter ? "match" : "dim";
}

/** Pure: apply one review status to many items (same rules as applyDisposition); input never mutated. */
export function applyBulkDisposition(current: unknown, item_ids: unknown, status: unknown): DispositionInput {
  let out = applyDisposition(current, "", "unreviewed");
  if (!Array.isArray(item_ids) || typeof status !== "string" || !(DISPOSITION_STATUSES as readonly string[]).includes(status)) return out;
  for (const id of item_ids) out = applyDisposition(out, id, status);
  return out;
}

/** Undo history for tab-local dispositions: snapshots of prior states, newest last, capped. */
export const DISPOSITION_HISTORY_LIMIT = 20;
export type DispositionHistory = { past: DispositionInput[]; present: DispositionInput; last_action: string | null; future?: DispositionInput[] };

/** Pure: record a change. No-op (same object back) when next equals present. */
export function commitDisposition(h: DispositionHistory, next: DispositionInput, action: string): DispositionHistory {
  try {
    if (JSON.stringify(next) === JSON.stringify(h.present)) return h;
    return { past: [...h.past, h.present].slice(-DISPOSITION_HISTORY_LIMIT), present: next, last_action: action, future: [] };
  } catch { return h; }
}

/** Pure: step back one change; unchanged when there is nothing to undo. */
export function undoDisposition(h: DispositionHistory): DispositionHistory {
  if (!h.past.length) return h;
  return { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], last_action: null, future: [...(h.future ?? []), h.present].slice(-DISPOSITION_HISTORY_LIMIT) };
}

/** Pure: re-apply the most recently undone change; unchanged when there is nothing to redo. A new commit clears redo. */
export function redoDisposition(h: DispositionHistory): DispositionHistory {
  const f = h.future ?? [];
  if (!f.length) return h;
  return { past: [...h.past, h.present].slice(-DISPOSITION_HISTORY_LIMIT), present: f[f.length - 1], last_action: null, future: f.slice(0, -1) };
}

export type DispositionShortcut = { kind: "set"; status: DispositionStatus } | { kind: "undo" } | { kind: "redo" } | { kind: "move"; dir: 1 | -1 } | { kind: "note" } | { kind: "handoff" } | { kind: "dispositions" } | { kind: "filter" } | { kind: "template" } | { kind: "help" } | { kind: "help_close" } | null;
/** Pure keyboard map: 1 needs_human_review, 2 cleared_pattern_only, 3 unreviewed, u undo, r redo, j/k move target, n focus note, h copy hand-off pack, y copy dispositions JSON, f cycle row filter, t apply first unused note template, ? toggle cheat sheet, Esc close it. Modifiers or typing targets → null. */
export function dispositionShortcut(ev: { key?: unknown; ctrlKey?: unknown; metaKey?: unknown; altKey?: unknown; targetTag?: unknown; editable?: unknown } | null | undefined): DispositionShortcut {
  try {
    if (!ev || ev.ctrlKey || ev.metaKey || ev.altKey || ev.editable) return null;
    const tag = typeof ev.targetTag === "string" ? ev.targetTag.toUpperCase() : "";
    if (tag === "INPUT" || tag === "TEXTAREA") return null;
    switch (ev.key) {
      case "?": return { kind: "help" };
      case "Escape": return { kind: "help_close" };
      case "1": return { kind: "set", status: "needs_human_review" };
      case "2": return { kind: "set", status: "cleared_pattern_only" };
      case "3": return { kind: "set", status: "unreviewed" };
      case "u": case "U": return { kind: "undo" };
      case "r": case "R": return { kind: "redo" };
      case "j": case "J": return { kind: "move", dir: 1 };
      case "k": case "K": return { kind: "move", dir: -1 };
      case "n": case "N": return { kind: "note" };
      case "h": case "H": return { kind: "handoff" };
      case "y": case "Y": return { kind: "dispositions" };
      case "f": case "F": return { kind: "filter" };
      case "t": case "T": return { kind: "template" };
      default: return null;
    }
  } catch { return null; }
}

/** Pure: next disposition target for j (+1) / k (-1); clamps at the ends, starts at the first (j) or last (k) row when none is targeted. */
export function moveDispositionTarget(ids: unknown, current: unknown, dir: unknown): string | null {
  try {
    if (!Array.isArray(ids)) return null;
    const list = ids.filter((x): x is string => typeof x === "string");
    if (!list.length || (dir !== 1 && dir !== -1)) return null;
    const i = typeof current === "string" ? list.indexOf(current) : -1;
    if (i < 0) return dir === 1 ? list[0] : list[list.length - 1];
    return list[Math.min(list.length - 1, Math.max(0, i + dir))];
  } catch { return null; }
}

export const KEY_TOAST_MS = 1600;
/** Pure: short toast text for a keyboard action on the target label; null for the cheat-sheet keys or bad input. */
export function keyToastText(a: DispositionShortcut, label: unknown): string | null {
  try {
    if (!a) return null;
    const on = typeof label === "string" && label ? ` · ${label}` : "";
    switch (a.kind) {
      case "set": return `${a.status}${on}`;
      case "undo": return "↶ undo";
      case "redo": return "↷ redo";
      case "move": return `${a.dir === 1 ? "↓" : "↑"} target`;
      case "note": return `✎ note${on}`;
      case "template": return `✎ quick note${on}`;
      case "filter": return "filter →";
      case "dispositions": return "copy dispositions JSON";
      case "handoff": return "📦 copy hand-off pack";
      default: return null;
    }
  } catch { return null; }
}

/** What the key handler knows when a shortcut fires (display only). */
export type KeyActionContext = { target_id?: string | null; target_status?: unknown; target_kind?: unknown; target_note?: unknown; can_undo?: boolean; can_redo?: boolean; ids?: unknown; button_ready?: boolean };
/** Pure: true only when the shortcut will actually change state (or copy); gates the ⌨ toast. */
export function keyActionChanges(a: DispositionShortcut, c: KeyActionContext | null | undefined): boolean {
  try {
    if (!a || !c) return false;
    switch (a.kind) {
      case "set": return !!c.target_id && c.target_status !== a.status;
      case "undo": return !!c.can_undo;
      case "redo": return !!c.can_redo;
      case "move": { const nx = moveDispositionTarget(c.ids, c.target_id ?? null, a.dir); return !!nx && nx !== c.target_id; }
      case "note": return !!c.target_id && c.target_status !== "unreviewed" && DISPOSITION_STATUSES.includes(c.target_status as DispositionStatus);
      case "template": return !!c.target_id && firstAvailableTemplate(c.target_status, c.target_kind, c.target_note) !== null;
      case "filter": return true;
      case "dispositions": case "handoff": return !!c.button_ready;
      default: return false;
    }
  } catch { return false; }
}

export const COMPLETE_TOAST_MS = 3200;
/** Pure: toast text when review moves from incomplete to complete (not on load, not when already complete); else null. */
export function reviewCompleteToast(prevComplete: unknown, p: { items: number; reviewed: number; by_status: Record<DispositionStatus, number> } | null | undefined): string | null {
  try {
    if (prevComplete !== false || !reviewCompletion(p).complete || !p) return null;
    return `✅ Review complete · ${p.reviewed} of ${p.items} · ${p.by_status.needs_human_review} needs review · ${p.by_status.cleared_pattern_only} cleared (pattern only) · press h for 📦 hand-off`;
  } catch { return null; }
}

export const EMPTY_ROW_FILTER_TOAST_MS = 3000;
/** Pure: toast text when an active row filter matches 0 of N items; null otherwise. */
export function emptyRowFilterToast(filter: unknown, entries: unknown): string | null {
  try {
    if (typeof filter !== "string" || !ROW_FILTER_CYCLE.includes(filter as RowFilter) || !Array.isArray(entries) || !entries.length) return null;
    if (entries.some((e) => rowMatchesFilter(e, filter as RowFilter))) return null;
    return `Filter ${filter}: 0 of ${entries.length} items match · press f or click All to show all`;
  } catch { return null; }
}

export const HANDOFF_READY_TOAST_MS = 3500;
/** Pure: toast text when Hand-off ready flips false → true (not on load, not while already ready); else null. */
export function handoffReadyToast(prevReady: unknown, report: unknown): string | null {
  try {
    if (prevReady !== false) return null;
    const h = handoffReadyAnnotated(report);
    return h.ready ? `✅ ${h.label} · press h to copy the 📦 hand-off pack` : null;
  } catch { return null; }
}

export type MedicareToastId = "complete" | "handoff_ready" | "empty_filter";
/** Fixed top-to-bottom order of the stacked top toasts (the ⌨ key toast sits at the bottom edge on its own). */
export const MEDICARE_TOAST_ORDER: readonly MedicareToastId[] = ["complete", "handoff_ready", "empty_filter"];
/** Pure: the visible top toasts in stack order, so they render in one column and never overlap. */
export function medicareToastStack(t: Partial<Record<MedicareToastId, unknown>> | null | undefined): { id: MedicareToastId; text: string; tone: "green" | "amber" }[] {
  if (!t) return [];
  return MEDICARE_TOAST_ORDER.flatMap((id) => { const x = t[id]; return typeof x === "string" && x ? [{ id, text: x, tone: id === "empty_filter" ? "amber" as const : "green" as const }] : []; });
}

/** Pure: the stack after clicking one toast — only that toast goes; the rest keep their order. */
export function dismissMedicareToast<T extends { id: MedicareToastId }>(stack: readonly T[] | null | undefined, id: unknown): T[] {
  return Array.isArray(stack) ? stack.filter((t) => t.id !== id) : [];
}

/** Pure: Clear all — dismiss every live stacked top toast in one shot; returns the ids cleared (stack order) and an empty stack. Recent history is untouched. */
export function clearAllMedicareToasts<T extends { id: MedicareToastId }>(stack: readonly T[] | null | undefined): { cleared: MedicareToastId[]; stack: T[] } {
  return { cleared: Array.isArray(stack) ? stack.map((t) => t.id) : [], stack: [] };
}
/** Pure: the Clear all control shows only when 2+ top toasts are stacked. */
export function showClearAllToasts(stack: readonly unknown[] | null | undefined): boolean { return Array.isArray(stack) && stack.length >= 2; }

export const TOAST_LEAVE_GRACE_MS = 1200;
/** Pure: on a toast's timer, defer while the pointer is over the stack, else dismiss. */
export function toastExpiry(hovered: unknown): "defer" | "dismiss" { return hovered === true ? "defer" : "dismiss"; }
/** Pure: toasts to dismiss after the pointer leaves — the deferred ones still showing. */
export function toastsAfterLeave(deferred: Iterable<MedicareToastId> | null | undefined, showing: readonly { id: MedicareToastId }[] | null | undefined): MedicareToastId[] {
  const d = new Set(deferred ?? []); return (showing ?? []).map((t) => t.id).filter((id) => d.has(id));
}

/** Pure: each stacked top toast's auto-dismiss time, for its time-left bar. */
export function medicareToastDurationMs(id: unknown): number {
  return id === "complete" ? COMPLETE_TOAST_MS : id === "handoff_ready" ? HANDOFF_READY_TOAST_MS : id === "empty_filter" ? EMPTY_ROW_FILTER_TOAST_MS : 0;
}

/** Pure: plain text copied when a stacked toast is clicked (amber keeps its ⚠); "" for bad input. */
export function medicareToastCopyText(t: { text?: unknown; tone?: unknown } | null | undefined): string {
  if (!t || typeof t.text !== "string" || !t.text.trim()) return "";
  return `${t.tone === "amber" ? "⚠ " : ""}${t.text.trim()}`;
}

export const TOAST_PILL_COPIED_MS = 1500;
/** Label for a Recent toasts pill: "✓ Copied" for ~1.5 s after it was clicked, else "⧉ <text>". Pure; tab-local. */
export function medicareToastPillLabel(h: { text?: unknown; tone?: unknown } | null | undefined, copied: { key: string; at: number } | null | undefined, now: number): string {
  const txt = medicareToastCopyText(h);
  if (!txt) return "";
  if (copied && copied.key === txt && Number.isFinite(copied.at) && now >= copied.at && now - copied.at < TOAST_PILL_COPIED_MS) return "✓ Copied";
  return `⧉ ${txt}`;
}

export const TOAST_HISTORY_MAX = 5;
export type ToastHistoryEntry = { id: MedicareToastId; text: string; tone: "green" | "amber" };
/** Pure: add shown toasts to the tab-local history, newest first, de-duplicated by copy text, capped at TOAST_HISTORY_MAX. */
export function pushToastHistory(hist: readonly ToastHistoryEntry[] | null | undefined, shown: readonly { id: MedicareToastId; text: string; tone: "green" | "amber" }[] | null | undefined, max: number = TOAST_HISTORY_MAX): ToastHistoryEntry[] {
  const out: ToastHistoryEntry[] = [];
  const add = (t: ToastHistoryEntry) => { const k = medicareToastCopyText(t); if (k && !out.some((x) => medicareToastCopyText(x) === k)) out.push({ id: t.id, text: t.text, tone: t.tone }); };
  for (const t of shown ?? []) add(t);
  for (const t of hist ?? []) add(t);
  return out.slice(0, Math.max(0, max));
}
/** Pure: history entries that are not currently on screen (those are the dismissed / expired ones). */
export function dismissedToastHistory(hist: readonly ToastHistoryEntry[] | null | undefined, showing: readonly { text: string; tone: "green" | "amber" }[] | null | undefined): ToastHistoryEntry[] {
  const on = new Set((showing ?? []).map((t) => medicareToastCopyText(t)));
  return (hist ?? []).filter((h) => !on.has(medicareToastCopyText(h)));
}

/** Pure: Clear on the Recent toasts strip — drops every gone toast; ones still on screen stay so they show up after they go. */
export function clearToastHistory(hist: readonly ToastHistoryEntry[] | null | undefined, showing: readonly { text: string; tone: "green" | "amber" }[] | null | undefined): ToastHistoryEntry[] {
  const on = new Set((showing ?? []).map((t) => medicareToastCopyText(t)));
  return (hist ?? []).filter((h) => on.has(medicareToastCopyText(h)));
}

/** Pure: ✕ on one Recent toasts pill — drops just that entry (matched by copy text); everything else stays in order. Bad input returns a copy unchanged. Tab-local. */
export function removeToastHistoryEntry(hist: readonly ToastHistoryEntry[] | null | undefined, entry: { text?: unknown; tone?: unknown } | null | undefined): ToastHistoryEntry[] {
  const k = entry && typeof entry.text === "string" ? medicareToastCopyText(entry) : "";
  return (hist ?? []).filter((h) => !k || medicareToastCopyText(h) !== k);
}

export const MEDICARE_TOAST_HISTORY_SCHEMA = "aethel.medicare.toast_history.v1";
/** Pure: Copy all on the Recent toasts strip — the shown history (newest first) as one JSON pack { schema, domain_label, count, entries: [{ kind, text, tone }] }. Bad entries are skipped; input not mutated. Tab-local, nothing sent. */
export function medicareToastHistoryJson(hist: readonly { id?: unknown; text?: unknown; tone?: unknown }[] | null | undefined): string {
  const entries = (hist ?? []).filter((h) => h && typeof h.text === "string" && h.text.trim()).map((h) => ({ kind: String(h.id ?? ""), text: h.text as string, tone: h.tone === "amber" ? "amber" : "green" }));
  return JSON.stringify({ schema: MEDICARE_TOAST_HISTORY_SCHEMA, domain_label: "medicare", count: entries.length, entries }, null, 2);
}

/** Pure: 📌 Restore on a Recent toasts pill — the toast to re-show as a live top toast ({ id, text }, same slot and timer as before), or null for bad input or when that exact toast is already on screen. A different toast in the same slot is replaced (it is already in history). Tab-local. */
export function restoreMedicareToast(entry: { id?: unknown; text?: unknown; tone?: unknown } | null | undefined, showing: readonly { id: MedicareToastId; text: string; tone: "green" | "amber" }[] | null | undefined): { id: MedicareToastId; text: string } | null {
  if (!entry || typeof entry.text !== "string" || !entry.text.trim() || !MEDICARE_TOAST_ORDER.includes(entry.id as MedicareToastId)) return null;
  const id = entry.id as MedicareToastId;
  if ((showing ?? []).some((t) => t.id === id && t.text === entry.text)) return null;
  return { id, text: entry.text };
}

/** Pure: what Esc closes — the cheat sheet first if open, else the stacked top toasts if any, else nothing. */
export function medicareEscTarget(helpOpen: unknown, toastCount: unknown): "help" | "toasts" | null {
  if (helpOpen === true) return "help";
  return typeof toastCount === "number" && toastCount > 0 ? "toasts" : null;
}

/** Keyboard cheat sheet for the ? overlay (display only; every key here maps in dispositionShortcut). */
export const MEDICARE_KEYMAP: readonly { key: string; does: string }[] = [
  { key: "j / k", does: "move the target row down / up" },
  { key: "1", does: "needs_human_review on the target" },
  { key: "2", does: "cleared_pattern_only on the target" },
  { key: "3", does: "back to unreviewed" },
  { key: "u / r", does: "undo / redo" },
  { key: "n", does: "type a note on the target (after a status)" },
  { key: "t", does: "add the next quick note on the target" },
  { key: "f", does: "cycle filter: All → unreviewed → needs review → cleared → has note" },
  { key: "y", does: "copy current dispositions JSON" },
  { key: "h", does: "copy 📦 hand-off pack" },
  { key: "?", does: "show / hide this sheet (Esc closes)" },
];

/** Review-session timer state (tab-local, display only). */
export type ReviewTimer = { started_at: number | null; frozen_at: number | null };
/** Pure: starts at the first disposition, freezes at review complete, resumes if completion is undone, clears at 0 reviewed. */
export function nextReviewTimer(t: ReviewTimer, p: { reviewed: number; items: number } | null | undefined, now: number): ReviewTimer {
  try {
    if (!p || !(p.reviewed > 0)) return t.started_at === null && t.frozen_at === null ? t : { started_at: null, frozen_at: null };
    const started_at = t.started_at ?? now;
    const complete = p.items > 0 && p.reviewed === p.items;
    const frozen_at = complete ? (t.frozen_at ?? now) : null;
    return started_at === t.started_at && frozen_at === t.frozen_at ? t : { started_at, frozen_at };
  } catch { return t; }
}
/** Pure: elapsed ms for a timer at `now` (frozen value when frozen); 0 when not started. */
export function reviewElapsedMs(t: ReviewTimer, now: number): number {
  return t.started_at === null ? 0 : Math.max(0, (t.frozen_at ?? now) - t.started_at);
}
/** Pure: m:ss under an hour, h:mm:ss above. */
export function formatElapsed(ms: unknown): string {
  const n = typeof ms === "number" && Number.isFinite(ms) && ms > 0 ? Math.floor(ms / 1000) : 0;
  const h = Math.floor(n / 3600), m = Math.floor((n % 3600) / 60), s = n % 60;
  const ss = String(s).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** Browser event carrying the review timer ({ elapsed_ms, frozen }) from the Win-strip timer; tab-local. */
export const MEDICARE_TIMER_EVENT = "medicare:review-timer";

/** Pure: how many report entries carry a non-empty reviewer note, and the label for the Win-strip chip. */
export function notesCount(report: unknown): { count: number; label: string } {
  try {
    const entries = (report as InvestigationReport)?.entries;
    const n = Array.isArray(entries) ? entries.filter((e) => e && typeof e.note === "string" && e.note.trim() !== "").length : 0;
    return { count: n, label: `${n} note${n === 1 ? "" : "s"}` };
  } catch { return { count: 0, label: "0 notes" }; }
}

/** Pure: note coverage over report items, e.g. "notes on 2 of 3"; show only when ≥1 note. */
export function notesCoverage(report: unknown): { noted: number; total: number; label: string; show: boolean } {
  try {
    const entries = (report as InvestigationReport)?.entries;
    if (!Array.isArray(entries)) return { noted: 0, total: 0, label: "", show: false };
    const total = entries.length;
    const noted = entries.filter((e) => e && typeof e.note === "string" && e.note.trim() !== "").length;
    return { noted, total, label: noted ? `notes on ${noted} of ${total}` : "", show: noted > 0 };
  } catch { return { noted: 0, total: 0, label: "", show: false }; }
}

/** Pure: "N unreviewed left" chip; show only when 0 < reviewed-or-not and some items remain unreviewed (M < total). */
export function unreviewedLeftChip(report: unknown): { left: number; total: number; label: string; show: boolean } {
  try {
    const entries = (report as InvestigationReport)?.entries;
    if (!Array.isArray(entries) || !entries.length) return { left: 0, total: 0, label: "", show: false };
    const left = entries.filter((e) => !e || e.status === "unreviewed" || typeof e.status !== "string").length;
    return { left, total: entries.length, label: left ? `${left} unreviewed left` : "", show: left > 0 };
  } catch { return { left: 0, total: 0, label: "", show: false }; }
}

/** Row filter: a review status, "has_note" (rows with a reviewer note), or null for All. */
export type RowFilter = DispositionStatus | "has_note" | null;
/** Pure: toggle a row filter (statuses or "has_note"); re-click or anything invalid clears to null. */
/** Order for key f: All → unreviewed → needs_human_review → cleared_pattern_only → has_note → All. */
export const ROW_FILTER_CYCLE: readonly RowFilter[] = [null, "unreviewed", "needs_human_review", "cleared_pattern_only", "has_note"];
/** Pure: next filter in ROW_FILTER_CYCLE; unknown input restarts at All → unreviewed. */
export function cycleRowFilter(current: unknown): RowFilter {
  const i = ROW_FILTER_CYCLE.indexOf((typeof current === "string" ? current : null) as RowFilter);
  return ROW_FILTER_CYCLE[(Math.max(0, i) + 1) % ROW_FILTER_CYCLE.length];
}
/** Pure: Win-strip label for the current row filter, plus what clicking (cycle like f) moves to. */
export function rowFilterLabelChip(current: unknown): { label: string; value: string; next: string } {
  const name = (f: RowFilter) => f === null ? "All" : f === "has_note" ? "notes" : f === "needs_human_review" ? "needs review" : f === "cleared_pattern_only" ? "cleared" : "unreviewed";
  const i = ROW_FILTER_CYCLE.indexOf((typeof current === "string" ? current : null) as RowFilter);
  const cur = i < 0 ? null : ROW_FILTER_CYCLE[i];
  return { label: `filter: ${name(cur)} ⟳`, value: cur ?? "all", next: name(cycleRowFilter(cur)) };
}
export function toggleRowFilter(current: unknown, clicked: unknown): RowFilter {
  if (clicked === "has_note") return current === "has_note" ? null : "has_note";
  return toggleStatusFilter(current, clicked);
}
/** Pure: does an entry match a row filter? */
export function rowMatchesFilter(entry: { status?: unknown; note?: unknown } | null | undefined, filter: RowFilter): boolean {
  if (filter === null) return true;
  if (!entry) return false;
  if (filter === "has_note") return typeof entry.note === "string" && entry.note.trim() !== "";
  return entry.status === filter;
}
/** Pure: "K of N shown" chip when a row filter is active (not All); click resets to All. */
export function filterShownChip(report: unknown, filter: RowFilter): { shown: number; total: number; label: string; show: boolean } {
  try {
    const entries = (report as InvestigationReport)?.entries;
    if (filter === null || filter === undefined || !Array.isArray(entries) || !entries.length) return { shown: 0, total: 0, label: "", show: false };
    const shown = entries.filter((e) => rowMatchesFilter(e as { status?: unknown; note?: unknown }, filter)).length;
    return { shown, total: entries.length, label: `${shown} of ${entries.length} shown`, show: true };
  } catch { return { shown: 0, total: 0, label: "", show: false }; }
}
/** Pure: row emphasis under a row filter: "all", "match" or "dim". */
export function rowFilterEmphasis(entry: { status?: unknown; note?: unknown } | null | undefined, filter: RowFilter): "all" | "match" | "dim" {
  return filter === null ? "all" : rowMatchesFilter(entry, filter) ? "match" : "dim";
}

/** Pure: nudge to add optional notes when review is complete and no item has a note. Never blocks hand-off. */
export function notesNudge(report: unknown): { show: boolean; message: string } {
  try {
    if (!reviewCompletion(reviewProgress(report)).complete || notesCount(report).count > 0) return { show: false, message: "" };
    return { show: true, message: "Review complete with no reviewer notes. Optional: add a short note on any item (why it needs review or why the pattern is explained) before copying the hand-off pack." };
  } catch { return { show: false, message: "" }; }
}

/** Pure: first reviewed entry with no note — target for the ✎ Add notes? nudge jump. */
export function firstRowWithoutNote(report: unknown): { item_id: string | null } {
  try {
    const es = (report as { entries?: unknown })?.entries;
    if (!Array.isArray(es)) return { item_id: null };
    for (const e of es) {
      const x = e as { item_id?: unknown; status?: unknown; note?: unknown };
      if (typeof x?.item_id !== "string" || x.status === "unreviewed") continue;
      if (typeof x.note === "string" && x.note.trim()) continue;
      return { item_id: x.item_id };
    }
    return { item_id: null };
  } catch { return { item_id: null }; }
}

/** Pure: annotated hand-off ready = review complete and at least one reviewer note. */
export function handoffReadyAnnotated(report: unknown): { ready: boolean; label: string } {
  try {
    const n = notesCount(report).count;
    if (!reviewCompletion(reviewProgress(report)).complete || n < 1) return { ready: false, label: "" };
    return { ready: true, label: `Hand-off ready · reviewed with ${n} note${n === 1 ? "" : "s"}` };
  } catch { return { ready: false, label: "" }; }
}

/** Browser event asking the hand-off pack button(s) to pulse; tab-local. */
export const MEDICARE_HANDOFF_FOCUS_EVENT = "medicare:handoff-focus";
/** How long the hand-off button stays highlighted after the chip is clicked. */
export const HANDOFF_PULSE_MS = 2400;
/** Pure: is the pulse still active at `now` for a pulse that started at `since`? */
export function handoffPulseActive(since: unknown, now: unknown): boolean {
  return typeof since === "number" && typeof now === "number" && Number.isFinite(since) && Number.isFinite(now) && now >= since && now - since < HANDOFF_PULSE_MS;
}

/** Pure: 2–3 neutral quick-note templates for a status and item kind. Review language only; never a finding of wrongdoing. */
export function noteTemplates(status: unknown, kind: unknown): string[] {
  if (status === "needs_human_review") return kind === "data_quality"
    ? ["Confirm the source value with the data steward", "Possible entry or extraction error", "Re-check after the next release"]
    : ["Request supporting documentation", "Compare with peer providers for this code", "Check billing modifier or bundling"];
  if (status === "cleared_pattern_only") return kind === "data_quality"
    ? ["Known source formatting issue", "Value corrected in a later release"]
    : ["Documented explanation on file", "Pattern explained by payment policy"];
  return [];
}
/** Pure: add a template to an existing note ("; " joined, no duplicates), capped at DISPOSITION_NOTE_MAX. */
/** Pure: first template for this status/kind not already in the note; null when none apply or all are used. */
export function firstAvailableTemplate(status: unknown, kind: unknown, note: unknown): string | null {
  const used = typeof note === "string" ? note.split(";").map((x) => x.trim()) : [];
  return noteTemplates(status, kind).find((t) => !used.includes(t)) ?? null;
}
export function appendNoteTemplate(existing: unknown, template: unknown): string {
  const t = typeof template === "string" ? template.trim() : "";
  const e = typeof existing === "string" ? existing.trim() : "";
  if (!t) return e.slice(0, DISPOSITION_NOTE_MAX);
  if (e.split(";").map((x) => x.trim()).includes(t)) return e.slice(0, DISPOSITION_NOTE_MAX);
  return (e ? `${e}; ${t}` : t).slice(0, DISPOSITION_NOTE_MAX);
}

/** Pure: ⧉ Copy all button label — "✓ Copied" for ~1.5 s after a successful copy, else "⧉ Copy all". Tab-local, nothing sent. */
export function medicareCopyAllLabel(copiedAt: number | null | undefined, now: number): string {
  if (typeof copiedAt !== "number" || !Number.isFinite(copiedAt) || !Number.isFinite(now)) return "⧉ Copy all";
  const d = now - copiedAt; return d >= 0 && d < TOAST_PILL_COPIED_MS ? "✓ Copied" : "⧉ Copy all";
}

export const COMPLETE_PULSE_MS = 2400;
/** Pure: true while the Review complete banner should pulse — only after a seen false→true transition (`startedAt` set), for COMPLETE_PULSE_MS. Display only. */
export function reviewCompletePulse(startedAt: unknown, now: unknown, complete: unknown): boolean {
  if (complete !== true || typeof startedAt !== "number" || typeof now !== "number" || !Number.isFinite(startedAt) || !Number.isFinite(now)) return false;
  return now >= startedAt && now - startedAt < COMPLETE_PULSE_MS;
}

export const HANDOFF_READY_PULSE_MS = 2400;
/** Pure: true while the ✅ Hand-off ready chip should pulse — only after a seen not-ready→ready transition (`startedAt` set, first time in the tab), for HANDOFF_READY_PULSE_MS. Display only. */
export function handoffReadyChipPulse(startedAt: unknown, now: unknown, ready: unknown): boolean {
  if (ready !== true || typeof startedAt !== "number" || typeof now !== "number" || !Number.isFinite(startedAt) || !Number.isFinite(now)) return false;
  return now >= startedAt && now - startedAt < HANDOFF_READY_PULSE_MS;
}

export const HANDOFF_PACK_READY_PULSE_MS = 2400;
/** Pure: true while the 📦 Copy hand-off pack button should pulse after Hand-off ready first turns on in the tab (`startedAt` set on a seen not-ready→ready transition), for HANDOFF_PACK_READY_PULSE_MS. Display only. */
export function handoffPackReadyPulse(startedAt: unknown, now: unknown, ready: unknown): boolean {
  if (ready !== true || typeof startedAt !== "number" || typeof now !== "number" || !Number.isFinite(startedAt) || !Number.isFinite(now)) return false;
  return now >= startedAt && now - startedAt < HANDOFF_PACK_READY_PULSE_MS;
}

export const NOTES_CHIP_PULSE_MS = 2400;
/** Pure: true while the ✎ N notes chip should pulse — only after a seen 0→≥1 notes transition (`startedAt` set, first time in the tab), for NOTES_CHIP_PULSE_MS. Display only. */
export function notesChipPulse(startedAt: unknown, now: unknown, count: unknown): boolean {
  if (typeof count !== "number" || !Number.isFinite(count) || count < 1 || typeof startedAt !== "number" || typeof now !== "number" || !Number.isFinite(startedAt) || !Number.isFinite(now)) return false;
  return now >= startedAt && now - startedAt < NOTES_CHIP_PULSE_MS;
}

export const PROGRESS_START_PULSE_MS = 2400;
/** Pure: true while the review progress ("X of N reviewed") should pulse — only after a seen 0→≥1 reviewed transition (`startedAt` set, first time in the tab), for PROGRESS_START_PULSE_MS. Display only. */
export function reviewProgressStartPulse(startedAt: unknown, now: unknown, reviewed: unknown): boolean {
  if (typeof reviewed !== "number" || !Number.isFinite(reviewed) || reviewed < 1 || typeof startedAt !== "number" || typeof now !== "number" || !Number.isFinite(startedAt) || !Number.isFinite(now)) return false;
  return now >= startedAt && now - startedAt < PROGRESS_START_PULSE_MS;
}

export const ROW_FILTER_PULSE_MS = 2400;
/** Pure: true while the disposition row filter note should pulse — once per tab after the row filter first leaves All (null), for ROW_FILTER_PULSE_MS. Display only. */
export function rowFilterPulse(startedAt: unknown, now: unknown, filter: unknown): boolean {
  if (typeof filter !== "string" || filter === "" || typeof startedAt !== "number" || typeof now !== "number" || !Number.isFinite(startedAt) || !Number.isFinite(now)) return false;
  return now >= startedAt && now - startedAt < ROW_FILTER_PULSE_MS;
}

export const BULK_SET_PULSE_MS = 2400;
/** Pure: true while the "Set all N shown" bulk control should pulse — once per tab after the first bulk disposition, for BULK_SET_PULSE_MS. Display only. */
export function bulkSetPulse(startedAt: unknown, now: unknown, fired: unknown): boolean {
  if (fired !== true || typeof startedAt !== "number" || typeof now !== "number" || !Number.isFinite(startedAt) || !Number.isFinite(now)) return false;
  return now >= startedAt && now - startedAt < BULK_SET_PULSE_MS;
}

export const UNDO_PULSE_MS = 2400;
/** Pure: true while the ↶ Undo button should pulse — once per tab after the first successful undo (u or click with history), for UNDO_PULSE_MS. Display only. */
export function undoPulse(startedAt: unknown, now: unknown, fired: unknown): boolean {
  if (fired !== true || typeof startedAt !== "number" || typeof now !== "number" || !Number.isFinite(startedAt) || !Number.isFinite(now)) return false;
  return now >= startedAt && now - startedAt < UNDO_PULSE_MS;
}

export const REDO_PULSE_MS = 2400;
/** Pure: true while the ↷ Redo button should pulse — once per tab after the first successful redo (r or click with future), for REDO_PULSE_MS. Display only. */
export function redoPulse(startedAt: unknown, now: unknown, fired: unknown): boolean {
  if (fired !== true || typeof startedAt !== "number" || typeof now !== "number" || !Number.isFinite(startedAt) || !Number.isFinite(now)) return false;
  return now >= startedAt && now - startedAt < REDO_PULSE_MS;
}

export const DISPOSITIONS_COPY_PULSE_MS = 2400;
/** Pure: true while the Copy dispositions JSON button should pulse — once per tab after the first successful dispositions copy (y, banner, or click), for DISPOSITIONS_COPY_PULSE_MS. Display only. */
export function dispositionsCopyPulse(startedAt: unknown, now: unknown, fired: unknown): boolean {
  if (fired !== true || typeof startedAt !== "number" || typeof now !== "number" || !Number.isFinite(startedAt) || !Number.isFinite(now)) return false;
  return now >= startedAt && now - startedAt < DISPOSITIONS_COPY_PULSE_MS;
}

export const HANDOFF_COPY_PULSE_MS = 2400;
/** Pure: true while 📦 Copy hand-off pack should pulse — once per tab after the first successful user hand-off copy (h, timer when ready, or click), for HANDOFF_COPY_PULSE_MS. Distinct from handoffPackReadyPulse. Display only. */
export function handoffCopyPulse(startedAt: unknown, now: unknown, fired: unknown): boolean {
  if (fired !== true || typeof startedAt !== "number" || typeof now !== "number" || !Number.isFinite(startedAt) || !Number.isFinite(now)) return false;
  return now >= startedAt && now - startedAt < HANDOFF_COPY_PULSE_MS;
}

export const NOTE_FOCUS_PULSE_MS = 2400;
/** Pure: true while the focused note field should pulse — once per tab on the first note focus (key n or click), for NOTE_FOCUS_PULSE_MS, only for the row that fired. Display only. */
export function noteFocusPulse(startedAt: unknown, now: unknown, pulsedId: unknown, rowId: unknown): boolean {
  if (typeof pulsedId !== "string" || pulsedId === "" || pulsedId !== rowId || typeof startedAt !== "number" || typeof now !== "number" || !Number.isFinite(startedAt) || !Number.isFinite(now)) return false;
  return now >= startedAt && now - startedAt < NOTE_FOCUS_PULSE_MS;
}

export const QUICK_NOTE_PULSE_MS = 2400;
/** Pure: true while the note field should pulse after the first successful `t` quick-note append in the tab — for QUICK_NOTE_PULSE_MS, only the appended row. Distinct from noteFocusPulse. Display only. */
export function quickNotePulse(startedAt: unknown, now: unknown, pulsedId: unknown, rowId: unknown): boolean {
  if (typeof pulsedId !== "string" || pulsedId === "" || pulsedId !== rowId || typeof startedAt !== "number" || typeof now !== "number" || !Number.isFinite(startedAt) || !Number.isFinite(now)) return false;
  return now >= startedAt && now - startedAt < QUICK_NOTE_PULSE_MS;
}

export const KEY_TARGET_PULSE_MS = 2400;
/** Pure: true while the key-target disposition row should pulse — once per tab after the first j/k move (`startedAt` set then), for KEY_TARGET_PULSE_MS. Display only. */
export function keyTargetPulse(startedAt: unknown, now: unknown, targetId: unknown): boolean {
  if (typeof targetId !== "string" || targetId === "" || typeof startedAt !== "number" || typeof now !== "number" || !Number.isFinite(startedAt) || !Number.isFinite(now)) return false;
  return now >= startedAt && now - startedAt < KEY_TARGET_PULSE_MS;
}

export const CHEATSHEET_PULSE_MS = 2400;
/** Pure: true while the keyboard cheat sheet panel should pulse — once per tab after the first ? open (`startedAt` set then), only while open, for CHEATSHEET_PULSE_MS. Display only. */
export function cheatsheetPulse(startedAt: unknown, now: unknown, open: unknown): boolean {
  if (open !== true || typeof startedAt !== "number" || typeof now !== "number" || !Number.isFinite(startedAt) || !Number.isFinite(now)) return false;
  return now >= startedAt && now - startedAt < CHEATSHEET_PULSE_MS;
}

/** Pure: compact status mix over report items, e.g. "1 needs_human_review · 1 cleared_pattern_only · 1 unreviewed"; zero counts omitted; show only when ≥1 item. */
export function statusMix(report: unknown): { counts: Record<DispositionStatus, number>; label: string; show: boolean } {
  const counts = { unreviewed: 0, needs_human_review: 0, cleared_pattern_only: 0 } as Record<DispositionStatus, number>;
  try {
    const entries = (report as InvestigationReport)?.entries;
    if (Array.isArray(entries)) for (const e of entries) { const s = (e as { status?: unknown })?.status; if (typeof s === "string" && s in counts) counts[s as DispositionStatus]++; }
  } catch { /* fallthrough */ }
  const order: DispositionStatus[] = ["needs_human_review", "cleared_pattern_only", "unreviewed"];
  const label = order.filter((s) => counts[s] > 0).map((s) => `${counts[s]} ${s}`).join(" · ");
  return { counts, label, show: label !== "" };
}

/** Browser event the review progress block emits on click; the disposition stub jumps its target (tab-local; nothing leaves the page). */
export const MEDICARE_PROGRESS_JUMP_EVENT = "medicare:progress-jump";
/** Pure: item_id the progress block click should jump to — the first `unreviewed` entry, else (review complete) the first entry; null when there are none. */
export function firstIncompleteDispositionTarget(entries: unknown): string | null {
  if (!Array.isArray(entries)) return null;
  const ok = entries.filter((e): e is { item_id: string; status?: unknown } => !!e && typeof (e as { item_id?: unknown }).item_id === "string" && (e as { item_id: string }).item_id !== "");
  const un = ok.find((e) => e.status === "unreviewed");
  return (un ?? ok[0])?.item_id ?? null;
}

/** Click on a stacked Medicare top toast: the amber empty-filter toast resets the row filter to All (text still copied); others just copy. */
export type MedicareToastClickAction = "reset_filter" | "copy";
export function medicareToastClickAction(id: unknown): MedicareToastClickAction { return id === "empty_filter" ? "reset_filter" : "copy"; }

/** ⏱ review timer click: copy the 📦 hand-off pack when Hand-off ready (complete + ≥1 note), else jump like the progress block. Pure. */
export type ReviewTimerClickAction = "copy_handoff" | "jump_progress";
export function reviewTimerClickAction(report: unknown): ReviewTimerClickAction { return handoffReadyAnnotated(report).ready ? "copy_handoff" : "jump_progress"; }

/** Review complete banner click: copies current dispositions JSON (same button as y) when complete; otherwise nothing. */
export type ReviewCompleteBannerAction = "copy_dispositions" | "none";
export function reviewCompleteBannerClickAction(complete: boolean): ReviewCompleteBannerAction { return complete ? "copy_dispositions" : "none"; }

export const MEDICARE_TARGET_EVENT = "medicare:key-target";
export const MEDICARE_TARGET_JUMP_EVENT = "medicare:key-target-jump";
/** Pure: Win-strip chip for the current key target (j/k). Click focuses `jump` (the target, or the first row like j when none). Never throws. */
export function keyTargetChip(entries: unknown, target: unknown): { show: boolean; label: string; id: string | null; jump: string | null } {
  try {
    const list = Array.isArray(entries) ? entries.filter((e): e is { item_id: string; row_index?: unknown; kind?: unknown } => !!e && typeof (e as { item_id?: unknown }).item_id === "string") : [];
    if (!list.length) return { show: false, label: "", id: null, jump: null };
    const hit = typeof target === "string" ? list.find((e) => e.item_id === target) : undefined;
    if (!hit) return { show: true, label: "target: — (j) ↓", id: null, jump: list[0].item_id };
    const pos = list.indexOf(hit) + 1;
    const kind = typeof hit.kind === "string" && hit.kind ? ` · ${hit.kind}` : "";
    return { show: true, label: `target: ${pos}/${list.length} ${hit.item_id}${kind} ↓`, id: hit.item_id, jump: hit.item_id };
  } catch { return { show: false, label: "", id: null, jump: null }; }
}

export const MEDICARE_UNDO_DEPTH_EVENT = "medicare:undo-depth";
export const MEDICARE_UNDO_REQUEST_EVENT = "medicare:undo-request";
/** Pure: Win-strip chip for undo stack depth. Click undoes (like u) only when depth > 0. Never throws. */
export function undoDepthChip(depth: unknown): { depth: number; label: string; can_undo: boolean } {
  const n = typeof depth === "number" && Number.isFinite(depth) && depth > 0 ? Math.floor(depth) : 0;
  return { depth: n, label: n > 0 ? `undo ${n} ↶` : "undo 0", can_undo: n > 0 };
}

export const MEDICARE_REDO_DEPTH_EVENT = "medicare:redo-depth";
export const MEDICARE_REDO_REQUEST_EVENT = "medicare:redo-request";
/** Pure: Win-strip chip for redo stack depth. Click redoes (like Redo) only when depth > 0. Never throws. */
export function redoDepthChip(depth: unknown): { depth: number; label: string; can_redo: boolean } {
  const n = typeof depth === "number" && Number.isFinite(depth) && depth > 0 ? Math.floor(depth) : 0;
  return { depth: n, label: n > 0 ? `redo ${n} ↷` : "redo 0", can_redo: n > 0 };
}

export const MEDICARE_HELP_STATE_EVENT = "medicare:help-state";
export const MEDICARE_HELP_CLOSE_EVENT = "medicare:help-close";
/** Pure: Win-strip chip while the ? cheat sheet is open. Click closes the sheet. Never throws. */
export function cheatsheetOpenChip(open: unknown): { show: boolean; label: string } {
  const show = open === true;
  return { show, label: show ? "keys open ✕" : "" };
}

export const MEDICARE_TOASTS_STATE_EVENT = "medicare:toasts-state";
export const MEDICARE_TOASTS_CLEAR_EVENT = "medicare:toasts-clear";
/** Pure: Win-strip "N toasts" chip while ≥1 top toast shows; clickable (Clear all) only when ≥2. Mirrors lookbackToastsChip. Never throws. */
export function medicareToastsChip(stack: readonly unknown[] | number | null | undefined): { show: boolean; label: string; clearable: boolean } {
  const n = Array.isArray(stack) ? stack.length : typeof stack === "number" && Number.isFinite(stack) && stack > 0 ? Math.floor(stack) : 0;
  if (n < 1) return { show: false, label: "", clearable: false };
  const clearable = n >= 2;
  return { show: true, label: `${n} toast${n === 1 ? "" : "s"}${clearable ? " ✕" : ""}`, clearable };
}
