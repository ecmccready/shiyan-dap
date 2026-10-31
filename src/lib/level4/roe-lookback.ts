/**
 * ROE look-back (retrospective, inspect-only; pure; never throws; no network, no writes).
 *
 * Scores sealed experience paths after the fact and compares two choices:
 *   greedy   = the path with the largest single myopic step I_t = max(0, e_{t-1} − e_t)
 *   lookback = the path with the largest cumulative Δe = e0 − e_final (ties: higher final Φ, then fewer steps, then run_id)
 * A path is sealed when it has an eligible / COMPLETE entry. Entries labeled with a non-generic domain
 * (e.g. system "medicare") are excluded so domain work never enters this comparison.
 *
 * Informational only: not used by eligibility, next-action selection, the loop, the controller, verify or the anchor.
 */
import type { ExperienceEntry } from "./experience-client";

export const ROE_LOOKBACK_SCHEMA = "aethel.roe.lookback.v1" as const;
export const ROE_LOOKBACK_NOTE =
  "Inspect-only look-back over sealed paths. It does not change eligibility, action selection, the loop or any record.";

export type LookbackPath = {
  run_id: string; steps: number; e0: number; e_final: number;
  cumulative_delta_e: number; max_step_i: number; final_phi: number | null; actions: string[];
  /** e at start then after each step (e0, e_1 … e_final); additive, display only. */
  e_series?: number[];
};
export type LookbackCompare = {
  schema: typeof ROE_LOOKBACK_SCHEMA;
  paths_considered: number;
  excluded_domain_entries: number;
  greedy: { run_id: string; max_step_i: number; cumulative_delta_e: number } | null;
  lookback: { run_id: string; cumulative_delta_e: number; final_phi: number | null } | null;
  winner: "agree" | "lookback" | "none";
  delta_e_gain: number;
  paths: LookbackPath[];
  note: string;
};

const fin = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const r4 = (n: number) => Number(n.toFixed(4));

export function scoreSealedPaths(entries: unknown): LookbackCompare {
  const empty = (excluded = 0): LookbackCompare => ({ schema: ROE_LOOKBACK_SCHEMA, paths_considered: 0, excluded_domain_entries: excluded,
    greedy: null, lookback: null, winner: "none", delta_e_gain: 0, paths: [], note: ROE_LOOKBACK_NOTE });
  try {
    if (!Array.isArray(entries)) return empty();
    const runs = new Map<string, ExperienceEntry[]>();
    let excluded = 0;
    for (const raw of entries) {
      if (!raw || typeof raw !== "object") continue;
      const x = raw as ExperienceEntry;
      if (typeof x.run_id !== "string" || !fin(x.iteration) || !fin(x.e)) continue;
      if (typeof x.system === "string" && x.system !== "" && x.system !== "generic") { excluded++; continue; }
      const list = runs.get(x.run_id) ?? []; list.push(x); runs.set(x.run_id, list);
    }
    const paths: LookbackPath[] = [];
    for (const [run_id, list] of runs) {
      const s = [...list].sort((a, b) => a.iteration - b.iteration);
      if (!s.some((x) => x.eligible === true || x.state === "COMPLETE")) continue;
      const e0 = fin(s[0].e0) ? s[0].e0 : (s[0].e as number);
      let prev = e0, maxI = 0;
      for (const x of s) { maxI = Math.max(maxI, prev - (x.e as number)); prev = x.e as number; }
      const last = s[s.length - 1];
      paths.push({ run_id, steps: s.length, e0: r4(e0), e_final: r4(last.e as number), cumulative_delta_e: r4(e0 - (last.e as number)),
        max_step_i: r4(Math.max(0, maxI)), final_phi: fin(last.phi) ? r4(last.phi) : null, actions: s.map((x) => (typeof x.y === "string" ? x.y : "?")),
        e_series: [r4(e0), ...s.map((x) => r4(x.e as number))] });
    }
    if (!paths.length) return empty(excluded);
    paths.sort((a, b) => a.run_id < b.run_id ? -1 : a.run_id > b.run_id ? 1 : 0);
    const g = [...paths].sort((a, b) => b.max_step_i - a.max_step_i || (a.run_id < b.run_id ? -1 : 1))[0];
    const l = [...paths].sort((a, b) => b.cumulative_delta_e - a.cumulative_delta_e || (b.final_phi ?? -Infinity) - (a.final_phi ?? -Infinity) || a.steps - b.steps || (a.run_id < b.run_id ? -1 : 1))[0];
    const gain = r4(l.cumulative_delta_e - g.cumulative_delta_e);
    return {
      schema: ROE_LOOKBACK_SCHEMA, paths_considered: paths.length, excluded_domain_entries: excluded,
      greedy: { run_id: g.run_id, max_step_i: g.max_step_i, cumulative_delta_e: g.cumulative_delta_e },
      lookback: { run_id: l.run_id, cumulative_delta_e: l.cumulative_delta_e, final_phi: l.final_phi },
      winner: g.run_id === l.run_id || gain === 0 ? "agree" : "lookback", delta_e_gain: gain, paths, note: ROE_LOOKBACK_NOTE,
    };
  } catch { return empty(); }
}

/** Pure display verdict for the look-back note. */
export function lookbackVerdict(c: LookbackCompare | null | undefined): { tone: "win" | "agree" | "none"; label: string; detail: string } {
  try {
    if (!c || c.winner === "none" || !c.greedy || !c.lookback) return { tone: "none", label: "No sealed paths", detail: "" };
    if (c.winner === "agree") return { tone: "agree", label: "Agree", detail: `greedy and look-back both pick ${c.lookback.run_id}` };
    return { tone: "win", label: "Look-back beats greedy", detail: `+Δe ${c.delta_e_gain}: ${c.lookback.run_id} (Δe ${c.lookback.cumulative_delta_e}) over greedy ${c.greedy.run_id} (Δe ${c.greedy.cumulative_delta_e})` };
  } catch { return { tone: "none", label: "No sealed paths", detail: "" }; }
}

/** Pure: sealed paths ranked by the look-back order (cumulative Δe, then Φ, steps, run_id), with greedy / look-back flags. */
export function rankedLookbackRows(c: LookbackCompare | null | undefined): (LookbackPath & { rank: number; is_greedy: boolean; is_lookback: boolean; delta_phi_vs_greedy: number | null })[] {
  try {
    if (!c || !Array.isArray(c.paths)) return [];
    const gp = c.paths.find((p) => p.run_id === c.greedy?.run_id);
    const gphi = gp && typeof gp.final_phi === "number" ? gp.final_phi : null;
    return [...c.paths]
      .sort((a, b) => b.cumulative_delta_e - a.cumulative_delta_e || (b.final_phi ?? -Infinity) - (a.final_phi ?? -Infinity) || a.steps - b.steps || (a.run_id < b.run_id ? -1 : 1))
      .map((p, i) => ({ ...p, rank: i + 1, is_greedy: p.run_id === c.greedy?.run_id, is_lookback: p.run_id === c.lookback?.run_id,
        delta_phi_vs_greedy: gphi !== null && typeof p.final_phi === "number" ? r4(p.final_phi - gphi) : null }));
  } catch { return []; }
}

/** Pure: row emphasis. Rank 1 gets "top_win" when look-back beats greedy, "top_agree" otherwise; others "plain". */
export function lookbackRowEmphasis(rank: number, winner: LookbackCompare["winner"] | undefined): "top_win" | "top_agree" | "plain" {
  return rank === 1 && (winner === "lookback" || winner === "agree") ? (winner === "lookback" ? "top_win" : "top_agree") : "plain";
}

/** Pure: display text for ΔΦ vs greedy ("+0.12", "−0.05", "0", "n/a"). */
export function fmtDeltaPhi(d: number | null | undefined): string {
  if (typeof d !== "number" || !Number.isFinite(d)) return "n/a";
  return d === 0 ? "0" : d > 0 ? `+${d}` : `−${Math.abs(d)}`;
}

export type LookbackSort = "rank" | "dphi";
/** Pure: reorder ranked rows. "rank" keeps look-back rank; "dphi" sorts by ΔΦ vs greedy desc (n/a last, then rank). Ranks are kept. */
export function sortLookbackRows<T extends { rank: number; delta_phi_vs_greedy: number | null }>(rows: T[], by: LookbackSort): T[] {
  try {
    if (!Array.isArray(rows)) return [];
    const r = [...rows];
    if (by !== "dphi") return r.sort((a, b) => a.rank - b.rank);
    const v = (x: T) => (typeof x.delta_phi_vs_greedy === "number" ? x.delta_phi_vs_greedy : -Infinity);
    return r.sort((a, b) => v(b) - v(a) || a.rank - b.rank);
  } catch { return []; }
}

/** Pure: one ranked row as a self-describing JSON object (schema, path fields, ΔΦ vs greedy, badges). */
export function lookbackPathJson(row: (LookbackPath & { rank: number; is_greedy: boolean; is_lookback: boolean; delta_phi_vs_greedy: number | null }) | null | undefined, winner?: LookbackCompare["winner"]): string {
  try {
    if (!row || typeof row.run_id !== "string") return "";
    const badges = [row.rank === 1 ? "top" : null, row.is_lookback ? "look-back" : null, row.is_greedy ? "greedy" : null].filter(Boolean);
    return JSON.stringify({
      schema: ROE_LOOKBACK_SCHEMA, kind: "path", rank: row.rank, run_id: row.run_id, steps: row.steps, e0: row.e0, e_final: row.e_final,
      best_step_i: row.max_step_i, cumulative_delta_e: row.cumulative_delta_e, final_phi: row.final_phi, delta_phi_vs_greedy: row.delta_phi_vs_greedy,
      badges, winner: winner ?? null, actions: row.actions, note: ROE_LOOKBACK_NOTE,
    }, null, 2);
  } catch { return ""; }
}

export type LookbackRowRole = "winner_lookback" | "agree_both" | "greedy_beaten" | "other";
/** Pure: a row's role in the comparison, independent of sort order. */
export function lookbackRowRole(row: { is_greedy: boolean; is_lookback: boolean } | null | undefined, winner: LookbackCompare["winner"] | undefined): LookbackRowRole {
  if (!row) return "other";
  if (row.is_lookback && row.is_greedy) return winner === "none" ? "other" : "agree_both";
  if (row.is_lookback) return winner === "lookback" ? "winner_lookback" : "other";
  if (row.is_greedy) return winner === "lookback" ? "greedy_beaten" : "other";
  return "other";
}

export type LookbackRoleFilter = "all" | "winners" | "beaten" | "agree";
const ROLE_FOR: Record<Exclude<LookbackRoleFilter, "all">, LookbackRowRole> = { winners: "winner_lookback", beaten: "greedy_beaten", agree: "agree_both" };
/** Pure: keep rows whose lookbackRowRole matches the filter ("all" keeps every row); order preserved. */
export function filterLookbackRows<T extends { is_greedy: boolean; is_lookback: boolean }>(rows: T[], f: LookbackRoleFilter, winner: LookbackCompare["winner"] | undefined): T[] {
  try {
    if (!Array.isArray(rows)) return [];
    if (f === "all" || !(f in ROLE_FOR)) return [...rows];
    return rows.filter((r) => lookbackRowRole(r, winner) === ROLE_FOR[f as Exclude<LookbackRoleFilter, "all">]);
  } catch { return []; }
}

/** Pure compare pack: look-back pick vs greedy pick (full path rows), verdict, Δe gain and ΔΦ. "" when nothing to compare. */
export function lookbackComparePack(c: LookbackCompare | null | undefined): string {
  try {
    if (!c || !c.greedy || !c.lookback) return "";
    const rows = rankedLookbackRows(c);
    const pick = (id: string) => { const r = rows.find((x) => x.run_id === id); return r ? { rank: r.rank, run_id: r.run_id, steps: r.steps, e0: r.e0, e_final: r.e_final, best_step_i: r.max_step_i, cumulative_delta_e: r.cumulative_delta_e, final_phi: r.final_phi, actions: r.actions } : null; };
    const lb = pick(c.lookback.run_id), gr = pick(c.greedy.run_id);
    if (!lb || !gr) return "";
    const v = lookbackVerdict(c);
    const dphi = typeof lb.final_phi === "number" && typeof gr.final_phi === "number" ? Number((lb.final_phi - gr.final_phi).toFixed(4)) : null;
    return JSON.stringify({ schema: ROE_LOOKBACK_SCHEMA, kind: "compare", winner: c.winner, verdict: v.label, verdict_detail: v.detail,
      delta_e_gain: c.delta_e_gain, delta_phi_lookback_vs_greedy: dphi, same_path: lb.run_id === gr.run_id, paths_considered: c.paths_considered,
      lookback: lb, greedy: gr, note: c.note }, null, 2);
  } catch { return ""; }
}

/** Pure: SVG polyline points for an e series in a w×h box (higher e at top; shared scale via max). "" when fewer than 2 points. */
export function sparklinePoints(series: unknown, w = 64, h = 16, max?: number): string {
  try {
    if (!Array.isArray(series)) return "";
    const v = series.filter((x): x is number => typeof x === "number" && Number.isFinite(x));
    if (v.length < 2) return "";
    const top = typeof max === "number" && Number.isFinite(max) && max > 0 ? max : Math.max(...v, 1e-9);
    const dx = w / (v.length - 1);
    return v.map((y, i) => `${Number((i * dx).toFixed(2))},${Number((h - (Math.max(0, Math.min(y, top)) / top) * h).toFixed(2))}`).join(" ");
  } catch { return ""; }
}
/** Pure: per-step gains I_t = max(0, e_{t-1} − e_t) from an e series. */
export function stepGains(series: unknown): number[] {
  if (!Array.isArray(series)) return [];
  const v = series.filter((x): x is number => typeof x === "number" && Number.isFinite(x));
  return v.slice(1).map((y, i) => r4(Math.max(0, v[i] - y)));
}

/** Pure: per-step detail for one path (action, e before/after, gain I_t, best-step flag). Uses e_series when present. */
export function pathStepsDetail(row: { actions?: unknown; e_series?: unknown; max_step_i?: unknown } | null | undefined): { step: number; action: string; e_before: number | null; e_after: number | null; gain: number | null; best: boolean }[] {
  try {
    if (!row || !Array.isArray(row.actions)) return [];
    const es = Array.isArray(row.e_series) ? row.e_series : [];
    const ok = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
    return row.actions.map((a, i) => {
      const b = ok(es[i]) ? es[i] : null, f = ok(es[i + 1]) ? es[i + 1] : null;
      const gain = b !== null && f !== null ? r4(Math.max(0, b - f)) : null;
      return { step: i + 1, action: typeof a === "string" ? a : "?", e_before: b, e_after: f, gain, best: gain !== null && ok(row.max_step_i) && gain === row.max_step_i && gain > 0 };
    });
  } catch { return []; }
}

/** Pure: one path's step detail as JSON (schema, kind "steps", run_id, rank, steps). "" for unreadable rows. */
export function pathStepsJson(row: { run_id?: unknown; rank?: unknown; actions?: unknown; e_series?: unknown; max_step_i?: unknown } | null | undefined): string {
  try {
    if (!row || typeof row.run_id !== "string") return "";
    return JSON.stringify({ schema: ROE_LOOKBACK_SCHEMA, kind: "steps", run_id: row.run_id, rank: typeof row.rank === "number" ? row.rank : null,
      best_step_i: typeof row.max_step_i === "number" ? row.max_step_i : null, steps: pathStepsDetail(row), note: ROE_LOOKBACK_NOTE }, null, 2);
  } catch { return ""; }
}

/** Pure summary strip: verdict, Δe gain, ΔΦ (look-back − greedy) and path counts by role. */
export function lookbackSummary(c: LookbackCompare | null | undefined): { tone: "win" | "agree" | "none"; verdict: string; delta_e_gain: number; delta_phi: number | null; paths: number; winners: number; beaten: number; agree: number; excluded: number } {
  const none = { tone: "none" as const, verdict: "No sealed paths", delta_e_gain: 0, delta_phi: null, paths: 0, winners: 0, beaten: 0, agree: 0, excluded: 0 };
  try {
    if (!c) return none;
    const v = lookbackVerdict(c); const rows = rankedLookbackRows(c);
    const lb = rows.find((r) => r.is_lookback), gr = rows.find((r) => r.is_greedy);
    const dphi = lb && gr && typeof lb.final_phi === "number" && typeof gr.final_phi === "number" ? r4(lb.final_phi - gr.final_phi) : null;
    const n = (f: LookbackRoleFilter) => filterLookbackRows(rows, f, c.winner).length;
    return { tone: v.tone, verdict: v.label, delta_e_gain: c.delta_e_gain, delta_phi: dphi, paths: c.paths_considered, winners: n("winners"), beaten: n("beaten"), agree: n("agree"), excluded: c.excluded_domain_entries };
  } catch { return none; }
}

/** Pure: the summary strip as JSON (schema, kind "summary", fields of lookbackSummary, note). "" when no sealed paths. */
export function lookbackSummaryJson(c: LookbackCompare | null | undefined): string {
  try {
    const m = lookbackSummary(c);
    if (m.tone === "none") return "";
    return JSON.stringify({ schema: ROE_LOOKBACK_SCHEMA, kind: "summary", ...m, note: ROE_LOOKBACK_NOTE }, null, 2);
  } catch { return ""; }
}

/** Pure: clicking a role count sets that Show filter; clicking the active one (or anything invalid) returns "all". */
export const LOOKBACK_TOAST_MS = 1600;
/** Pure: short toast text for a look-back key on the focused run id; null for ? / bad input. */
export function lookbackToastText(k: LookbackKey, runId: unknown): string | null {
  const on = typeof runId === "string" && runId ? ` · ${runId}` : "";
  switch (k) {
    case "next": return "↓ row"; case "prev": return "↑ row";
    case "toggle": return `expand / collapse${on}`; case "close": return "close";
    case "copy": return `copy path JSON${on}`; case "steps": return `copy steps JSON${on}`;
    case "compare": return "⚖ copy compare pack"; case "summary": return "copy summary JSON";
    case "filter": return "Show →"; case "sort": return "Sort ↔";
    default: return null;
  }
}
/** What the look-back key handler knows when a shortcut fires (display only). */
export type LookbackKeyContext = { visible?: unknown; focus?: string | null; open?: string | null; button_ready?: boolean };
/** Pure: true only when the look-back key will change state or copy; gates the ⌨ toast. */
export function lookbackKeyChanges(k: LookbackKey, c: LookbackKeyContext | null | undefined): boolean {
  try {
    if (!k || !c) return false;
    const vis = Array.isArray(c.visible) ? c.visible.filter((x): x is string => typeof x === "string") : [];
    const focused = !!c.focus && vis.includes(c.focus);
    switch (k) {
      case "next": case "prev": { const nx = moveLookbackFocus(vis, c.focus ?? null, k); return !!nx && nx !== c.focus; }
      case "toggle": return focused;
      case "close": return !!c.open;
      case "copy": case "steps": return focused;
      case "compare": case "summary": return !!c.button_ready;
      case "filter": case "sort": return true;
      default: return false;
    }
  } catch { return false; }
}
export const EMPTY_FILTER_TOAST_MS = 3000;
const ROLE_LABEL: Record<string, string> = { winners: "★ Winners", beaten: "Beaten", agree: "= Agree" };
/** Pure: toast text when a non-All Show filter leaves 0 of N paths visible; null otherwise. */
export function emptyFilterToast(filter: unknown, shown: unknown, total: unknown): string | null {
  if (typeof filter !== "string" || !(filter in ROLE_LABEL) || shown !== 0 || typeof total !== "number" || !(total > 0)) return null;
  return `Show ${ROLE_LABEL[filter]}: 0 of ${total} paths match · press f or click All to show all`;
}
/** Pure: what clicking a stacked top toast does. The amber empty-filter toast resets Show to All (and still copies its text); others copy and dismiss. */
export type LookbackToastClickAction = "reset_filter" | "copy";
export function lookbackToastClickAction(id: unknown): LookbackToastClickAction { return id === "empty_filter" ? "reset_filter" : "copy"; }
export const WIN_TOAST_MS = 3500;
/** Pure: toast text when look-back beats greedy (shown once per load); null on agree / none / bad input. */
export function lookbackWinToast(c: { winner?: unknown; delta_e_gain?: unknown; lookback?: { run_id?: unknown } | null; greedy?: { run_id?: unknown } | null } | null | undefined): string | null {
  try {
    if (!c || c.winner !== "lookback" || typeof c.delta_e_gain !== "number" || !(c.delta_e_gain > 0)) return null;
    const lb = typeof c.lookback?.run_id === "string" ? c.lookback.run_id : "look-back"; const gr = typeof c.greedy?.run_id === "string" ? c.greedy.run_id : "greedy";
    return `★ Look-back beats greedy · +Δe ${Number(c.delta_e_gain.toFixed(3))} · ${lb} over ${gr} · press m for ⚖ compare pack`;
  } catch { return null; }
}
/** Pure: toast text when look-back and greedy agree (shown once per load); null otherwise. */
export function lookbackAgreeToast(c: { winner?: unknown; paths_considered?: unknown; greedy?: { run_id?: unknown; cumulative_delta_e?: unknown } | null } | null | undefined): string | null {
  try {
    if (!c || c.winner !== "agree") return null;
    const n = typeof c.paths_considered === "number" ? c.paths_considered : 0; if (!(n > 0)) return null;
    const de = typeof c.greedy?.cumulative_delta_e === "number" ? ` · Δe ${Number(c.greedy.cumulative_delta_e.toFixed(3))}` : "";
    return `= Look-back and greedy agree · ${n} sealed path${n === 1 ? "" : "s"}${de} · greedy was already best`;
  } catch { return null; }
}
export type LookbackToastId = "win" | "agree" | "empty_filter";
/** Fixed top-to-bottom order of the stacked top toasts (the ⌨ key toast sits at the bottom edge on its own). */
export const LOOKBACK_TOAST_ORDER: readonly LookbackToastId[] = ["win", "agree", "empty_filter"];
/** Pure: the visible top toasts in stack order, so they render in one column and never overlap. */
export function lookbackToastStack(t: Partial<Record<LookbackToastId, unknown>> | null | undefined): { id: LookbackToastId; text: string; tone: "green" | "blue" | "amber" }[] {
  if (!t) return [];
  const tone = { win: "green", agree: "blue", empty_filter: "amber" } as const;
  return LOOKBACK_TOAST_ORDER.flatMap((id) => { const x = t[id]; return typeof x === "string" && x ? [{ id, text: x, tone: tone[id] }] : []; });
}
/** Pure: the stack after clicking one toast — only that toast goes; the rest keep their order. */
export function dismissLookbackToast<T extends { id: LookbackToastId }>(stack: readonly T[] | null | undefined, id: unknown): T[] {
  return Array.isArray(stack) ? stack.filter((t) => t.id !== id) : [];
}
/** Pure: Clear all — dismiss every live stacked look-back top toast at once; returns ids cleared (stack order) and an empty stack. Recent history untouched. */
export function clearAllLookbackToasts<T extends { id: LookbackToastId }>(stack: readonly T[] | null | undefined): { cleared: LookbackToastId[]; stack: T[] } {
  return { cleared: Array.isArray(stack) ? stack.map((t) => t.id) : [], stack: [] };
}
/** Pure: the Clear all control shows only when 2+ top toasts are stacked. */
export function showClearAllLookbackToasts(stack: readonly unknown[] | null | undefined): boolean { return Array.isArray(stack) && stack.length >= 2; }

export const LOOKBACK_TOAST_LEAVE_GRACE_MS = 1200;
/** Pure: on a toast's timer, defer while the pointer is over the stack, else dismiss. */
export function lookbackToastExpiry(hovered: unknown): "defer" | "dismiss" { return hovered === true ? "defer" : "dismiss"; }
/** Pure: toasts to dismiss after the pointer leaves — the deferred ones still showing, in stack order. */
export function lookbackToastsAfterLeave(deferred: Iterable<LookbackToastId> | null | undefined, showing: readonly { id: LookbackToastId }[] | null | undefined): LookbackToastId[] {
  const d = new Set(deferred ?? []); return (showing ?? []).map((t) => t.id).filter((id) => d.has(id));
}
/** Pure: each stacked top toast's auto-dismiss time, for its time-left bar. */
export function lookbackToastDurationMs(id: unknown): number {
  return id === "win" || id === "agree" ? WIN_TOAST_MS : id === "empty_filter" ? EMPTY_FILTER_TOAST_MS : 0;
}
/** Pure: plain text copied when a stacked toast is clicked (amber keeps its ⚠); "" for bad input. */
export function lookbackToastCopyText(t: { text?: unknown; tone?: unknown } | null | undefined): string {
  if (!t || typeof t.text !== "string" || !t.text.trim()) return "";
  return `${t.tone === "amber" ? "⚠ " : ""}${t.text.trim()}`;
}
export const LOOKBACK_TOAST_HISTORY_MAX = 5;
export type LookbackToastHistoryEntry = { id: LookbackToastId; text: string; tone: "green" | "blue" | "amber" };
/** Pure: add shown toasts to the tab-local history, newest first, de-duplicated by copy text, capped. */
export function pushLookbackToastHistory(hist: readonly LookbackToastHistoryEntry[] | null | undefined, shown: readonly LookbackToastHistoryEntry[] | null | undefined, max: number = LOOKBACK_TOAST_HISTORY_MAX): LookbackToastHistoryEntry[] {
  const out: LookbackToastHistoryEntry[] = [];
  const add = (t: LookbackToastHistoryEntry) => { const k = lookbackToastCopyText(t); if (k && !out.some((x) => lookbackToastCopyText(x) === k)) out.push({ id: t.id, text: t.text, tone: t.tone }); };
  for (const t of shown ?? []) add(t);
  for (const t of hist ?? []) add(t);
  return out.slice(0, Math.max(0, max));
}
/** Pure: history entries not currently on screen (the dismissed / expired ones). */
export function dismissedLookbackToastHistory(hist: readonly LookbackToastHistoryEntry[] | null | undefined, showing: readonly { text: string; tone: unknown }[] | null | undefined): LookbackToastHistoryEntry[] {
  const on = new Set((showing ?? []).map((t) => lookbackToastCopyText(t)));
  return (hist ?? []).filter((h) => !on.has(lookbackToastCopyText(h)));
}
/** Pure: Clear on the Recent toasts strip — drops every gone toast; ones still on screen stay so they show up after they go. */
export const LOOKBACK_TOAST_PILL_COPIED_MS = 1500;
/** Label for a look-back Recent toasts pill: "✓ Copied" for ~1.5 s after it was clicked, else "⧉ <text>". Pure; tab-local. */
export function lookbackToastPillLabel(h: { text?: unknown; tone?: unknown } | null | undefined, copied: { key: string; at: number } | null | undefined, now: number): string {
  const txt = lookbackToastCopyText(h);
  if (!txt) return "";
  if (copied && copied.key === txt && Number.isFinite(copied.at) && now >= copied.at && now - copied.at < LOOKBACK_TOAST_PILL_COPIED_MS) return "✓ Copied";
  return `⧉ ${txt}`;
}

export function clearLookbackToastHistory(hist: readonly LookbackToastHistoryEntry[] | null | undefined, showing: readonly { text: string; tone: unknown }[] | null | undefined): LookbackToastHistoryEntry[] {
  const on = new Set((showing ?? []).map((t) => lookbackToastCopyText(t)));
  return (hist ?? []).filter((h) => on.has(lookbackToastCopyText(h)));
}
/** Pure: ✕ on one look-back Recent toasts pill — drops just that entry (matched by copy text); everything else stays in order. Bad input returns a copy unchanged. Tab-local. */
export function removeLookbackToastHistoryEntry(hist: readonly LookbackToastHistoryEntry[] | null | undefined, entry: { text?: unknown; tone?: unknown } | null | undefined): LookbackToastHistoryEntry[] {
  const k = entry && typeof entry.text === "string" ? lookbackToastCopyText(entry) : "";
  return (hist ?? []).filter((h) => !k || lookbackToastCopyText(h) !== k);
}

/** Pure: 📌 Restore on a look-back Recent toasts pill — the toast to re-show as a live top toast ({ id, text }, same slot and timer), or null for bad input or when that exact toast is already on screen. Tab-local. */
export function restoreLookbackToast(entry: { id?: unknown; text?: unknown; tone?: unknown } | null | undefined, showing: readonly { id: LookbackToastId; text: string }[] | null | undefined): { id: LookbackToastId; text: string } | null {
  if (!entry || typeof entry.text !== "string" || !entry.text.trim() || !LOOKBACK_TOAST_ORDER.includes(entry.id as LookbackToastId)) return null;
  const id = entry.id as LookbackToastId;
  if ((showing ?? []).some((t) => t.id === id && t.text === entry.text)) return null;
  return { id, text: entry.text };
}
/** Pure: what one Esc closes, in priority: the cheat sheet, then the stacked top toasts, then the expanded row. */
export function lookbackEscTarget(helpOpen: unknown, toastCount: unknown, openRow: unknown): "help" | "toasts" | "row" | null {
  if (helpOpen === true) return "help";
  if (typeof toastCount === "number" && toastCount > 0) return "toasts";
  return typeof openRow === "string" && openRow ? "row" : null;
}
/** Keyboard cheat sheet for the ? overlay (display only; every key here maps in lookbackKey). */
export const LOOKBACK_KEYMAP: readonly { key: string; does: string }[] = [
  { key: "j / k", does: "move the row focus down / up" },
  { key: "Enter", does: "expand / collapse the focused row's steps" },
  { key: "Escape", does: "close this sheet, then the top toasts, then the expanded row" },
  { key: "c", does: "copy the focused row's path JSON" },
  { key: "s", does: "expand and copy the focused row's steps JSON" },
  { key: "m", does: "copy ⚖ compare pack" },
  { key: "g", does: "copy summary JSON" },
  { key: "f", does: "cycle Show: All → ★ Winners → Beaten → = Agree" },
  { key: "o", does: "toggle Sort: look-back rank ↔ ΔΦ vs greedy" },
  { key: "1", does: "focus, expand and scroll to the TOP path (#1), Show → All, re-flashes the TOP badge — mirrors 2" },
  { key: "2", does: "focus, expand and scroll to the runner-up (#2), Show → All — same as the sticky lead chip; no-op with <2 paths" },
  { key: "v", does: "toggle Show to the verdict rows (★ Winners / = Agree) ↔ All — only when a verdict exists" },
  { key: "?", does: "show / hide this sheet" },
];
/** Pure: key o flips Sort between look-back rank and ΔΦ vs greedy; unknown input goes to "dphi". */
export function toggleLookbackSort(current: unknown): LookbackSort { return current === "dphi" ? "rank" : "dphi"; }
/** Order for key f: All → ★ Winners → Beaten → = Agree → All. */
export const ROLE_FILTER_CYCLE: readonly LookbackRoleFilter[] = ["all", "winners", "beaten", "agree"];
/** Pure: next Show filter in ROLE_FILTER_CYCLE; unknown input restarts at All → winners. */
export function cycleRoleFilter(current: unknown): LookbackRoleFilter {
  const i = ROLE_FILTER_CYCLE.indexOf(current as LookbackRoleFilter);
  return ROLE_FILTER_CYCLE[(Math.max(0, i) + 1) % ROLE_FILTER_CYCLE.length];
}
export function toggleRoleFilter(current: unknown, clicked: unknown): LookbackRoleFilter {
  if (clicked !== "winners" && clicked !== "beaten" && clicked !== "agree") return "all";
  return current === clicked ? "all" : clicked;
}

export type LookbackKey = "next" | "prev" | "toggle" | "close" | "copy" | "steps" | "compare" | "summary" | "filter" | "sort" | "help" | null;
/** Pure: j next, k prev, Enter toggle, Escape close, c copy focused path JSON, s copy its steps JSON, m copy compare pack, g copy summary JSON, f cycle Show filter, o toggle Sort, ? toggle cheat sheet; ignored with modifiers or while typing. */
export function lookbackKey(ev: { key?: unknown; ctrlKey?: unknown; metaKey?: unknown; altKey?: unknown; targetTag?: unknown; editable?: unknown } | null | undefined): LookbackKey {
  try {
    if (!ev || ev.ctrlKey || ev.metaKey || ev.altKey || ev.editable) return null;
    const tag = typeof ev.targetTag === "string" ? ev.targetTag.toUpperCase() : "";
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return null;
    if (ev.key === "j" || ev.key === "J") return "next";
    if (ev.key === "k" || ev.key === "K") return "prev";
    if (ev.key === "Enter") return tag === "BUTTON" || tag === "A" ? null : "toggle";
    if (ev.key === "Escape") return "close";
    if (ev.key === "c" || ev.key === "C") return "copy";
    if (ev.key === "s" || ev.key === "S") return "steps";
    if (ev.key === "m" || ev.key === "M") return "compare";
    if (ev.key === "g" || ev.key === "G") return "summary";
    if (ev.key === "f" || ev.key === "F") return "filter";
    if (ev.key === "o" || ev.key === "O") return "sort";
    if (ev.key === "?") return "help";
    return null;
  } catch { return null; }
}
/** Pure: move focus through visible row ids (clamped at the ends; starts at the first row). */
export function moveLookbackFocus(ids: unknown, current: unknown, dir: "next" | "prev"): string | null {
  if (!Array.isArray(ids) || !ids.length) return null;
  const list = ids.filter((x): x is string => typeof x === "string");
  if (!list.length) return null;
  const i = typeof current === "string" ? list.indexOf(current) : -1;
  if (i < 0) return list[0];
  return list[Math.max(0, Math.min(list.length - 1, i + (dir === "next" ? 1 : -1)))];
}

export const LOOKBACK_TOAST_HISTORY_SCHEMA = "aethel.roe.lookback.toast_history.v1";
/** Pure: ⧉ Copy all on the look-back Recent toasts strip — shown history (newest first) as one JSON pack { schema, count, entries: [{ kind, text, tone }] }. Bad entries skipped; input not mutated. Tab-local, nothing sent. */
export function lookbackToastHistoryJson(hist: readonly ({ id?: unknown; text?: unknown; tone?: unknown } | null)[] | null | undefined): string {
  const entries = (hist ?? []).filter((h) => h && typeof h.text === "string" && h.text.trim()).map((h) => ({ kind: String(h!.id ?? ""), text: h!.text as string, tone: h!.tone === "amber" ? "amber" : h!.tone === "blue" ? "blue" : "green" }));
  return JSON.stringify({ schema: LOOKBACK_TOAST_HISTORY_SCHEMA, count: entries.length, entries }, null, 2);
}

/** Pure: look-back ⧉ Copy all button label — "✓ Copied" for ~1.5 s after a successful copy, else "⧉ Copy all". Tab-local, nothing sent. */
export function lookbackCopyAllLabel(copiedAt: number | null | undefined, now: number): string {
  if (typeof copiedAt !== "number" || !Number.isFinite(copiedAt) || !Number.isFinite(now)) return "⧉ Copy all";
  const d = now - copiedAt; return d >= 0 && d < LOOKBACK_TOAST_PILL_COPIED_MS ? "✓ Copied" : "⧉ Copy all";
}

export const LOOKBACK_WIN_PULSE_MS = 2400;
/** Pure: true while the sticky summary strip should pulse — once after look-back first shows "beats greedy" in this tab (`startedAt` set when tone first becomes win, incl. first data load), for LOOKBACK_WIN_PULSE_MS. Display only. */
export function lookbackWinPulse(startedAt: unknown, now: unknown, tone: unknown): boolean {
  if (tone !== "win" || typeof startedAt !== "number" || typeof now !== "number" || !Number.isFinite(startedAt) || !Number.isFinite(now)) return false;
  return now >= startedAt && now - startedAt < LOOKBACK_WIN_PULSE_MS;
}

export const LOOKBACK_TOP_PULSE_MS = 2400;
/** Pure: true while the TOP badge should pulse — once per tab after look-back data first shows (`startedAt` set when ranked rows first exist), for LOOKBACK_TOP_PULSE_MS. Display only. */
export function lookbackTopPulse(startedAt: unknown, now: unknown, rowCount: unknown): boolean {
  if (typeof rowCount !== "number" || !(rowCount > 0) || typeof startedAt !== "number" || typeof now !== "number" || !Number.isFinite(startedAt) || !Number.isFinite(now)) return false;
  return now >= startedAt && now - startedAt < LOOKBACK_TOP_PULSE_MS;
}

export const LOOKBACK_COMPARE_PULSE_MS = 2400;
/** Pure: true while the ⚖ Copy compare pack button should pulse — once per tab after look-back first beats greedy (`startedAt` set when winner first becomes "lookback"), for LOOKBACK_COMPARE_PULSE_MS. Display only. */
export function lookbackComparePulse(startedAt: unknown, now: unknown, winner: unknown): boolean {
  if (winner !== "lookback" || typeof startedAt !== "number" || typeof now !== "number" || !Number.isFinite(startedAt) || !Number.isFinite(now)) return false;
  return now >= startedAt && now - startedAt < LOOKBACK_COMPARE_PULSE_MS;
}

export const LOOKBACK_COMPARE_COPY_PULSE_MS = 2400;
/** Pure: true while the ⚖ Copy compare pack button should pulse after the first successful user-initiated compare copy (m, click, or verdict) — once per tab (`startedAt` set on first "copied"), for LOOKBACK_COMPARE_COPY_PULSE_MS. Distinct from the beats-greedy mount pulse. Display only. */
export function lookbackCompareCopyPulse(startedAt: unknown, now: unknown): boolean {
  if (typeof startedAt !== "number" || typeof now !== "number" || !Number.isFinite(startedAt) || !Number.isFinite(now)) return false;
  return now >= startedAt && now - startedAt < LOOKBACK_COMPARE_COPY_PULSE_MS;
}

export const LOOKBACK_PATH_COPIED_PULSE_MS = 2400;
/** Pure: true while row `runId`'s Copy path JSON button should pulse after the first successful path copy in the tab (`c` on the focused row or the per-row button) — `pulse` is `{ runId, at }` set once on first copy, for LOOKBACK_PATH_COPIED_PULSE_MS. Display only. */
export function lookbackPathCopiedPulse(pulse: unknown, runId: unknown, now: unknown): boolean {
  if (!pulse || typeof pulse !== "object") return false;
  const { runId: id, at } = pulse as { runId?: unknown; at?: unknown };
  if (typeof id !== "string" || !id || id !== runId) return false;
  if (typeof at !== "number" || typeof now !== "number" || !Number.isFinite(at) || !Number.isFinite(now)) return false;
  return now >= at && now - at < LOOKBACK_PATH_COPIED_PULSE_MS;
}

export const LOOKBACK_STEPS_COPIED_PULSE_MS = 2400;
/** Pure: true while row `runId`'s Copy steps JSON button should pulse after the first successful steps copy in the tab (`s` on the focused row or the expanded-row button) — `pulse` is `{ runId, at }` set once on first copy, for LOOKBACK_STEPS_COPIED_PULSE_MS. Display only. */
export function lookbackStepsCopiedPulse(pulse: unknown, runId: unknown, now: unknown): boolean {
  if (!pulse || typeof pulse !== "object") return false;
  const { runId: id, at } = pulse as { runId?: unknown; at?: unknown };
  if (typeof id !== "string" || !id || id !== runId) return false;
  if (typeof at !== "number" || typeof now !== "number" || !Number.isFinite(at) || !Number.isFinite(now)) return false;
  return now >= at && now - at < LOOKBACK_STEPS_COPIED_PULSE_MS;
}

export const LOOKBACK_SUMMARY_COPIED_PULSE_MS = 2400;
/** Pure: true while the sticky Copy summary JSON button should pulse after the first successful user-initiated summary copy (g, +Δe click, or button) — once per tab (`startedAt` set on first "copied"), for LOOKBACK_SUMMARY_COPIED_PULSE_MS. Distinct from the first-data mount pulse. Display only. */
export function lookbackSummaryCopiedPulse(startedAt: unknown, now: unknown): boolean {
  if (typeof startedAt !== "number" || typeof now !== "number" || !Number.isFinite(startedAt) || !Number.isFinite(now)) return false;
  return now >= startedAt && now - startedAt < LOOKBACK_SUMMARY_COPIED_PULSE_MS;
}

export const LOOKBACK_SUMMARY_COPY_PULSE_MS = 2400;
/** Pure: true while the sticky strip's Copy summary JSON button should pulse — once per tab after the strip first has data (`startedAt` set when lookbackSummaryJson first returns non-empty), for LOOKBACK_SUMMARY_COPY_PULSE_MS. Display only. */
export function lookbackSummaryCopyPulse(startedAt: unknown, now: unknown, hasData: unknown): boolean {
  if (hasData !== true || typeof startedAt !== "number" || typeof now !== "number" || !Number.isFinite(startedAt) || !Number.isFinite(now)) return false;
  return now >= startedAt && now - startedAt < LOOKBACK_SUMMARY_COPY_PULSE_MS;
}

export const LOOKBACK_FILTER_PULSE_MS = 2400;
/** Pure: true while the Show filter control should pulse — once per tab after the filter first leaves "all" (`startedAt` set then), for LOOKBACK_FILTER_PULSE_MS. Display only. */
export function lookbackFilterPulse(startedAt: unknown, now: unknown, filter: unknown): boolean {
  if (typeof filter !== "string" || filter === "all" || typeof startedAt !== "number" || typeof now !== "number" || !Number.isFinite(startedAt) || !Number.isFinite(now)) return false;
  return now >= startedAt && now - startedAt < LOOKBACK_FILTER_PULSE_MS;
}

export const LOOKBACK_SORT_PULSE_MS = 2400;
/** Pure: true while the Sort control should pulse — once per tab after sort first leaves look-back "rank" (`startedAt` set then), for LOOKBACK_SORT_PULSE_MS. Display only. */
export function lookbackSortPulse(startedAt: unknown, now: unknown, sort: unknown): boolean {
  if (typeof sort !== "string" || sort === "rank" || typeof startedAt !== "number" || typeof now !== "number" || !Number.isFinite(startedAt) || !Number.isFinite(now)) return false;
  return now >= startedAt && now - startedAt < LOOKBACK_SORT_PULSE_MS;
}

export const LOOKBACK_EXPAND_PULSE_MS = 2400;
/** Pure: true while the expanded path panel should pulse — once per tab after the first row expand (`startedAt` set then), for LOOKBACK_EXPAND_PULSE_MS. Display only. */
export function lookbackExpandPulse(startedAt: unknown, now: unknown, openId: unknown): boolean {
  if (typeof openId !== "string" || openId === "" || typeof startedAt !== "number" || typeof now !== "number" || !Number.isFinite(startedAt) || !Number.isFinite(now)) return false;
  return now >= startedAt && now - startedAt < LOOKBACK_EXPAND_PULSE_MS;
}

export const LOOKBACK_FOCUS_PULSE_MS = 2400;
/** Pure: true while the focused row should pulse — once per tab after the first j/k focus move (`startedAt` set then), for LOOKBACK_FOCUS_PULSE_MS. Display only. */
export function lookbackFocusPulse(startedAt: unknown, now: unknown, focusId: unknown): boolean {
  if (typeof focusId !== "string" || focusId === "" || typeof startedAt !== "number" || typeof now !== "number" || !Number.isFinite(startedAt) || !Number.isFinite(now)) return false;
  return now >= startedAt && now - startedAt < LOOKBACK_FOCUS_PULSE_MS;
}

export const LOOKBACK_HELP_PULSE_MS = 2400;
/** Pure: true while the keyboard cheat sheet should pulse — once per tab after it first opens (`startedAt` set then), for LOOKBACK_HELP_PULSE_MS, only while open. Display only. */
export function lookbackHelpPulse(startedAt: unknown, now: unknown, open: unknown): boolean {
  if (open !== true || typeof startedAt !== "number" || typeof now !== "number" || !Number.isFinite(startedAt) || !Number.isFinite(now)) return false;
  return now >= startedAt && now - startedAt < LOOKBACK_HELP_PULSE_MS;
}

/** Pure: the top-ranked (look-back) path's step count and its label ("1 step" / "N steps"); null when no sealed paths. Display only. */
export function lookbackTopSteps(c: LookbackCompare | null | undefined): { run_id: string; steps: number; label: string } | null {
  try {
    const top = rankedLookbackRows(c)[0];
    if (!top || typeof top.steps !== "number" || !Number.isFinite(top.steps)) return null;
    return { run_id: top.run_id, steps: top.steps, label: `${top.steps} step${top.steps === 1 ? "" : "s"}` };
  } catch { return null; }
}

/** Pure: greedy path step count for the sticky strip; null when no greedy path or it is the same run as the top path. */
export function lookbackGreedySteps(c: LookbackCompare | null | undefined): { run_id: string; steps: number; label: string } | null {
  try {
    const gid = c?.greedy?.run_id; if (!c || !gid) return null;
    const top = rankedLookbackRows(c)[0]; if (!top || top.run_id === gid) return null;
    const g = c.paths.find((p) => p.run_id === gid);
    if (!g || typeof g.steps !== "number" || !Number.isFinite(g.steps)) return null;
    return { run_id: g.run_id, steps: g.steps, label: `${g.steps} step${g.steps === 1 ? "" : "s"}` };
  } catch { return null; }
}

/** Pure: Δsteps of top vs greedy for the sticky strip; null when either count is missing or they are equal. */
export function lookbackStepsDelta(c: LookbackCompare | null | undefined): { delta: number; label: string } | null {
  try {
    const t = lookbackTopSteps(c), g = lookbackGreedySteps(c); if (!t || !g) return null;
    const d = t.steps - g.steps; if (!Number.isFinite(d) || d === 0) return null;
    return { delta: d, label: `${d > 0 ? "+" : "−"}${Math.abs(d)} step${Math.abs(d) === 1 ? "" : "s"} vs greedy` };
  } catch { return null; }
}

/** Click target for sticky "top N steps": the TOP ranked run id (null when none). */
export function lookbackTopFocusTarget(c: LookbackCompare | null | undefined): string | null {
  return lookbackTopSteps(c)?.run_id ?? null;
}

/** Click target for sticky "greedy M steps": the greedy run id (null when none / same as top). */
export function lookbackGreedyFocusTarget(c: LookbackCompare | null | undefined): string | null {
  return lookbackGreedySteps(c)?.run_id ?? null;
}

/** Click targets for sticky Δsteps chip: focus+expand TOP, then scroll greedy into view when it differs. */
export function lookbackStepsDeltaTargets(c: LookbackCompare | null | undefined): { top: string; greedy: string | null } | null {
  const top = lookbackTopFocusTarget(c);
  if (!top) return null;
  const g = lookbackGreedyFocusTarget(c);
  return { top, greedy: g && g !== top ? g : null };
}
export const LOOKBACK_DELTA_GREEDY_SCROLL_MS = 900;

/** Pure: sticky Φ-gap chip vs greedy (reuses fmtDeltaPhi). null when ΔΦ is missing or 0. Click sets sort to "dphi" (next is unchanged when already dphi). */
export function lookbackPhiGapChip(deltaPhi: number | null | undefined, sort: LookbackSort): { delta: number; label: string; tone: "up" | "down"; nextSort: LookbackSort; changes: boolean } | null {
  if (typeof deltaPhi !== "number" || !Number.isFinite(deltaPhi) || deltaPhi === 0) return null;
  return { delta: deltaPhi, label: `Φ ${fmtDeltaPhi(deltaPhi)} vs greedy`, tone: deltaPhi > 0 ? "up" : "down", nextSort: "dphi", changes: sort !== "dphi" };
}

/** Pure: whether clicking the sticky verdict should copy the ⚖ compare pack (same as m). False when nothing to compare. */
export function lookbackVerdictCopiesCompare(c: LookbackCompare | null | undefined): boolean {
  return lookbackComparePack(c) !== "";
}

/** Pure: whether clicking the sticky +Δe chip copies the summary JSON (same as g) — true iff there is a summary to copy. */
export function lookbackDeltaECopiesSummary(c: Parameters<typeof lookbackSummaryJson>[0]): boolean {
  return lookbackSummaryJson(c) !== "";
}

/** Pure: sticky "N sealed paths" chip from lookbackSummary path count; null when 0. Click resets Show to All. */
export function lookbackSealedPathsChip(paths: unknown): { count: number; label: string } | null {
  const n = typeof paths === "number" && Number.isFinite(paths) ? Math.floor(paths) : 0;
  if (n <= 0) return null;
  return { count: n, label: `${n} sealed path${n === 1 ? "" : "s"}` };
}

/** Pure: sticky "K of N shown" chip when Show is not All; null on All, unknown filter or N<=0. Click resets Show to All. */
export function lookbackShownChip(filter: unknown, shown: unknown, total: unknown): { shown: number; total: number; label: string } | null {
  if (filter !== "winners" && filter !== "beaten" && filter !== "agree") return null;
  const n = typeof total === "number" && Number.isFinite(total) ? Math.floor(total) : 0;
  if (n <= 0) return null;
  const k = typeof shown === "number" && Number.isFinite(shown) ? Math.max(0, Math.min(n, Math.floor(shown))) : 0;
  return { shown: k, total: n, label: `${k} of ${n} shown` };
}

/** Pure: sticky current-sort chip ("sort: rank" / "sort: ΔΦ"); next = toggleLookbackSort (same as o). Unknown → rank. */
export function lookbackSortChip(sort: unknown): { sort: LookbackSort; label: string; next: LookbackSort } {
  const s: LookbackSort = sort === "dphi" ? "dphi" : "rank";
  return { sort: s, label: `sort: ${s === "dphi" ? "ΔΦ" : "rank"}`, next: toggleLookbackSort(s) };
}

/** Pure: sticky current Show-filter chip ("show: All/Winners/Beaten/Agree"); next = cycleRoleFilter (same as f). Unknown → all. */
export function lookbackShowChip(filter: unknown): { filter: LookbackRoleFilter; label: string; next: LookbackRoleFilter } {
  const f: LookbackRoleFilter = filter === "winners" || filter === "beaten" || filter === "agree" ? filter : "all";
  const name = { all: "All", winners: "Winners", beaten: "Beaten", agree: "Agree" }[f];
  return { filter: f, label: `show: ${name}`, next: cycleRoleFilter(f) };
}

/** Pure: sticky focused-row chip ("focus: #rank run_id ↓"); jump = focused id, else first ranked row (like j). Hidden with no rows. */
export function lookbackFocusChip(rows: unknown, focus: unknown): { show: boolean; label: string; id: string | null; jump: string | null } {
  try {
    const list = Array.isArray(rows) ? rows.filter((r): r is { run_id: string; rank?: unknown } => !!r && typeof r === "object" && typeof (r as { run_id?: unknown }).run_id === "string") : [];
    if (!list.length) return { show: false, label: "", id: null, jump: null };
    const hit = typeof focus === "string" ? list.find((r) => r.run_id === focus) : undefined;
    if (!hit) return { show: true, label: "focus: — (j) ↓", id: null, jump: list[0].run_id };
    const rank = typeof hit.rank === "number" ? hit.rank : list.indexOf(hit) + 1;
    return { show: true, label: `focus: #${rank} ${hit.run_id} ↓`, id: hit.run_id, jump: hit.run_id };
  } catch { return { show: false, label: "", id: null, jump: null }; }
}

/** Pure: sticky expanded-row chip ("expanded: #rank run_id ✕"); click collapses (same as Esc on an open row). Hidden when nothing expanded or id unknown. */
export function lookbackExpandedChip(rows: unknown, open: unknown): { show: boolean; label: string; id: string | null } {
  try {
    if (typeof open !== "string" || !open) return { show: false, label: "", id: null };
    const list = Array.isArray(rows) ? rows.filter((r): r is { run_id: string; rank?: unknown } => !!r && typeof r === "object" && typeof (r as { run_id?: unknown }).run_id === "string") : [];
    const hit = list.find((r) => r.run_id === open);
    if (!hit) return { show: false, label: "", id: null };
    const rank = typeof hit.rank === "number" ? hit.rank : list.indexOf(hit) + 1;
    return { show: true, label: `expanded: #${rank} ${hit.run_id} ✕`, id: hit.run_id };
  } catch { return { show: false, label: "", id: null }; }
}

/** Pure: sticky chip while the ? cheat sheet is open ("keys open ✕"); click closes it. Never throws. */
export function lookbackCheatsheetChip(open: unknown): { show: boolean; label: string } {
  const show = open === true;
  return { show, label: show ? "keys open ✕" : "" };
}

/** Pure: sticky "N toasts" chip while ≥1 top toast shows; clickable (Clear all) only when ≥2. Never throws. */
export function lookbackToastsChip(stack: readonly unknown[] | null | undefined): { show: boolean; label: string; clearable: boolean } {
  const n = Array.isArray(stack) ? stack.length : 0;
  if (n < 1) return { show: false, label: "", clearable: false };
  const clearable = n >= 2;
  return { show: true, label: `${n} toast${n === 1 ? "" : "s"}${clearable ? " ✕" : ""}`, clearable };
}

/** Pure: sticky "N recent ✕" chip while the Recent toasts strip has entries; click = Clear (same as the strip's Clear button). Tab-local. */
export function lookbackRecentChip(history: readonly unknown[] | null | undefined): { show: boolean; label: string } {
  const n = Array.isArray(history) ? history.length : 0;
  return n < 1 ? { show: false, label: "" } : { show: true, label: `${n} recent ✕` };
}

/** Pure: sticky "⧉ Copy recent" chip while Recent toasts has ≥1 entry; click copies the same JSON as strip ⧉ Copy all and flashes "✓ Copied" for LOOKBACK_TOAST_PILL_COPIED_MS. Never throws. */
export function lookbackCopyRecentChip(history: readonly unknown[] | null | undefined, copiedAt: number | null | undefined, now: number): { show: boolean; label: string; copied: boolean } {
  const n = Array.isArray(history) ? history.length : 0;
  if (n < 1) return { show: false, label: "", copied: false };
  const copied = typeof copiedAt === "number" && Number.isFinite(copiedAt) && Number.isFinite(now) && now >= copiedAt && now - copiedAt < LOOKBACK_TOAST_PILL_COPIED_MS;
  return { show: true, label: copied ? "✓ Copied" : "⧉ Copy recent", copied };
}

export const LOOKBACK_COPY_RECENT_PULSE_MS = 2400;
/** Pure: true while the sticky "⧉ Copy recent" chip should glow/pulse after the first successful Recent-toasts copy in the tab (`startedAt` set once per session on first success), for LOOKBACK_COPY_RECENT_PULSE_MS. Display only. Never throws. */
export function lookbackCopyRecentPulse(startedAt: unknown, now: unknown): boolean {
  if (typeof startedAt !== "number" || typeof now !== "number" || !Number.isFinite(startedAt) || !Number.isFinite(now)) return false;
  return now >= startedAt && now - startedAt < LOOKBACK_COPY_RECENT_PULSE_MS;
}

/** Pure: sticky verdict-filter chip. lookback win → "look-back wins → ★" sets Show to winners; agree → "agree → =" sets agree. Active (already set) → click returns to all. none/unknown → hidden. */
export function lookbackVerdictFilterChip(winner: unknown, filter: unknown): { show: boolean; label: string; target: LookbackRoleFilter; active: boolean; next: LookbackRoleFilter } {
  const cur: LookbackRoleFilter = filter === "winners" || filter === "beaten" || filter === "agree" ? filter : "all";
  if (winner !== "lookback" && winner !== "agree") return { show: false, label: "", target: "all", active: false, next: cur };
  const target: LookbackRoleFilter = winner === "lookback" ? "winners" : "agree";
  const active = cur === target;
  return { show: true, label: winner === "lookback" ? `look-back wins → ★${active ? " ✓" : ""}` : `agree → =${active ? " ✓" : ""}`, target, active, next: active ? "all" : target };
}

export const LOOKBACK_VERDICT_FILTER_PULSE_MS = 2400;
/** Pure: true while the sticky verdict→Show chip should glow/pulse after the first click in the tab that actually changed the Show filter (`startedAt` set once per session), for LOOKBACK_VERDICT_FILTER_PULSE_MS. Display only. Never throws. */
export function lookbackVerdictFilterPulse(startedAt: unknown, now: unknown): boolean {
  if (typeof startedAt !== "number" || typeof now !== "number" || !Number.isFinite(startedAt) || !Number.isFinite(now)) return false;
  return now >= startedAt && now - startedAt < LOOKBACK_VERDICT_FILTER_PULSE_MS;
}
/** Pure: whether a verdict-chip click should start the once-per-session pulse: only when not yet pulsed and next filter differs from current. */
export function lookbackVerdictFilterShouldPulse(alreadyPulsed: unknown, cur: unknown, next: unknown): boolean {
  return alreadyPulsed !== true && typeof next === "string" && next !== cur;
}

export const LOOKBACK_RUNNER_UP_PULSE_MS = 2400;
/** Pure: true while the sticky runner-up lead chip glows/pulses after its first click in the tab (session once), for LOOKBACK_RUNNER_UP_PULSE_MS. Display only. Never throws. */
export function lookbackRunnerUpPulse(startedAt: unknown, now: unknown): boolean {
  if (typeof startedAt !== "number" || typeof now !== "number" || !Number.isFinite(startedAt) || !Number.isFinite(now)) return false;
  return now >= startedAt && now - startedAt < LOOKBACK_RUNNER_UP_PULSE_MS;
}
/** Pure: whether a runner-up chip click should start the once-per-session pulse (not yet pulsed and a #2 id exists). */
export function lookbackRunnerUpShouldPulse(alreadyPulsed: unknown, runnerUp: unknown): boolean {
  return alreadyPulsed !== true && typeof runnerUp === "string" && runnerUp.length > 0;
}

/** Pure: key v mirrors the sticky verdict→Show chip. Returns null when not v, modified, typing, or no verdict (none/unknown). `changed` false when next equals current; `toast` only when effective. Never throws. */
export function lookbackVerdictKey(ev: { key?: unknown; ctrlKey?: unknown; metaKey?: unknown; altKey?: unknown; targetTag?: unknown; editable?: unknown } | null | undefined, winner: unknown, filter: unknown): { next: LookbackRoleFilter; changed: boolean; toast: string | null } | null {
  try {
    if (!ev || (ev.key !== "v" && ev.key !== "V") || ev.ctrlKey || ev.metaKey || ev.altKey || ev.editable) return null;
    const tag = typeof ev.targetTag === "string" ? ev.targetTag.toUpperCase() : "";
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return null;
    const vf = lookbackVerdictFilterChip(winner, filter);
    if (!vf.show) return null;
    const cur = filter === "winners" || filter === "beaten" || filter === "agree" ? filter : "all";
    const changed = vf.next !== cur;
    const toast = !changed ? null : vf.next === "all" ? "v → Show: All" : vf.next === "winners" ? "v → Show: ★ Winners (look-back wins)" : "v → Show: = Agree";
    return { next: vf.next, changed, toast };
  } catch { return null; }
}

/** Pure: sticky "lead +Δe over #2" chip — TOP path's cumulative Δe margin over rank #2. Null when <2 paths. Click target = #2 run id. */
export function lookbackRunnerUpLeadChip(c: LookbackCompare | null | undefined): { delta: number; label: string; runner_up: string; tie: boolean } | null {
  try {
    const r = rankedLookbackRows(c);
    if (r.length < 2) return null;
    const d = Math.round((r[0].cumulative_delta_e - r[1].cumulative_delta_e) * 1e4) / 1e4;
    if (!Number.isFinite(d)) return null;
    return { delta: d, label: d === 0 ? "tie with #2" : `lead +${d} over #2`, runner_up: r[1].run_id, tie: d === 0 };
  } catch { return null; }
}

/** Pure: key 2 mirrors the sticky "lead over #2" chip. Null when not 2, modified, typing, or <2 paths (no runner-up). `changed` false when Show is All and #2 is already focused+expanded; `toast` only when effective. Never throws. */
export function lookbackRunnerUpKey(ev: { key?: unknown; ctrlKey?: unknown; metaKey?: unknown; altKey?: unknown; targetTag?: unknown; editable?: unknown } | null | undefined, runnerUp: unknown, state: { filter?: unknown; focus?: unknown; open?: unknown } | null | undefined): { target: string; changed: boolean; toast: string | null } | null {
  try {
    if (!ev || ev.key !== "2" || ev.ctrlKey || ev.metaKey || ev.altKey || ev.editable) return null;
    const tag = typeof ev.targetTag === "string" ? ev.targetTag.toUpperCase() : "";
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return null;
    if (typeof runnerUp !== "string" || !runnerUp) return null;
    const st = state ?? {};
    const changed = !((st.filter ?? "all") === "all" && st.focus === runnerUp && st.open === runnerUp);
    return { target: runnerUp, changed, toast: changed ? "2 → runner-up (#2)" : null };
  } catch { return null; }
}

/** Pure: key 1 mirrors key 2 for the TOP path (#1, via lookbackTopFocusTarget). Null when not 1, modified, typing, or no TOP. `changed` false when Show is All and TOP is already focused+expanded; `toast` only when effective. Never throws. */
export function lookbackTopKey(ev: { key?: unknown; ctrlKey?: unknown; metaKey?: unknown; altKey?: unknown; targetTag?: unknown; editable?: unknown } | null | undefined, top: unknown, state: { filter?: unknown; focus?: unknown; open?: unknown } | null | undefined): { target: string; changed: boolean; toast: string | null } | null {
  try {
    if (!ev || ev.key !== "1" || ev.ctrlKey || ev.metaKey || ev.altKey || ev.editable) return null;
    const tag = typeof ev.targetTag === "string" ? ev.targetTag.toUpperCase() : "";
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return null;
    if (typeof top !== "string" || !top) return null;
    const st = state ?? {};
    const changed = !((st.filter ?? "all") === "all" && st.focus === top && st.open === top);
    return { target: top, changed, toast: changed ? "1 → TOP (#1)" : null };
  } catch { return null; }
}
