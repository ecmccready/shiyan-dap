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
        max_step_i: r4(Math.max(0, maxI)), final_phi: fin(last.phi) ? r4(last.phi) : null, actions: s.map((x) => (typeof x.y === "string" ? x.y : "?")) });
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
