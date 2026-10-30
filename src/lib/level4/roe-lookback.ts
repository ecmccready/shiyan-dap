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
