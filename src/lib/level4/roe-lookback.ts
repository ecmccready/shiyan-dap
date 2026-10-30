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

export type LookbackKey = "next" | "prev" | "toggle" | "close" | "copy" | "steps" | "compare" | "summary" | "filter" | null;
/** Pure: j next, k prev, Enter toggle, Escape close, c copy focused path JSON, s copy its steps JSON, m copy compare pack, g copy summary JSON, f cycle Show filter; ignored with modifiers or while typing. */
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
