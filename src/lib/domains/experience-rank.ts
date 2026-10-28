/**
 * Adaptive Domains dropdown: client-side join and rank (pure, read-only).
 *
 * Joins the static Know / Know How / Show / Do items to the verified-experience records returned by
 * GET /api/level4/experience, keeps the best eligible Φ per item, annotates the item with it and sorts
 * annotated items ahead of the rest inside each group. Nothing here writes to the store or touches the
 * Level 4 loop; the four group names and their order never change.
 *
 * "Eligible" is exactly the durable feed's reuse filter (isReusable in level4/durable-self.ts): eligible,
 * state COMPLETE, Φ > 0, tensor distance within ε, ROE-eligible. Φ is each run's own value against its
 * recorded cold baseline.
 */
import type { ExperienceEntry } from "@/lib/level4/experience-client";
import { isReusable } from "@/lib/level4/durable-self";

export type DomainGroupName = "Know" | "Know How" | "Show" | "Do";

/** Which experience records back an item. `{}` = every reusable record. */
export type DomainExperienceScope = {
  /** Only records whose `system` label is in this list. */
  systems?: string[];
  /** Only records written by this selector (ROE drive). */
  selector?: "roe_step_aware";
  /** The destination accepts `?reuse=<run id>` (the Level 4 run page). */
  reuse?: boolean;
};

export type DomainItem = { label: string; href: string; experience?: DomainExperienceScope };
export type DomainGroup = { label: DomainGroupName; items: DomainItem[] };

export type RankedDomainItem = DomainItem & {
  /** Best eligible Φ (> 0) among the item's records, or null when none. */
  phi: number | null;
  /** run_id of the record that gave `phi`. */
  sourceRunId: string | null;
  verifiedAt: string | null;
  /** run_id to hand off as ?reuse=, only for items that accept it. */
  reuseRunId: string | null;
};
export type RankedDomainGroup = { label: DomainGroupName; items: RankedDomainItem[] };

function inScope(x: ExperienceEntry, s: DomainExperienceScope): boolean {
  if (s.systems && !(typeof x.system === "string" && s.systems.includes(x.system))) return false;
  if (s.selector && x.selector !== s.selector) return false;
  return true;
}

/** Highest Φ wins; on a tie the later record wins (same rule as selectBest in durable-self.ts). */
export function bestEligible(list: ExperienceEntry[], scope: DomainExperienceScope): ExperienceEntry | null {
  let best: ExperienceEntry | null = null;
  for (const x of list) {
    if (!isReusable(x) || !inScope(x, scope)) continue;
    if (best === null || (x.phi as number) >= (best.phi as number)) best = x;
  }
  return best;
}

export function annotateItem(item: DomainItem, list: ExperienceEntry[]): RankedDomainItem {
  const best = item.experience ? bestEligible(list, item.experience) : null;
  return {
    ...item,
    phi: best ? (best.phi as number) : null,
    sourceRunId: best ? best.run_id : null,
    verifiedAt: best ? best.verified_at : null,
    reuseRunId: best && item.experience?.reuse ? best.run_id : null,
  };
}

/**
 * Join and rank. Items with Φ > 0 come first, highest Φ first; every other item keeps its static order
 * after them. The sort is stable, so equal Φ keeps the static order. Pure: same input, same output.
 */
export function rankDomainGroups(groups: DomainGroup[], list: ExperienceEntry[]): RankedDomainGroup[] {
  return groups.map((g) => {
    const annotated = g.items.map((i, idx) => ({ i: annotateItem(i, list), idx }));
    annotated.sort((a, b) => {
      const pa = a.i.phi ?? -Infinity;
      const pb = b.i.phi ?? -Infinity;
      if (pa !== pb) return pb - pa;
      return a.idx - b.idx;
    });
    return { label: g.label, items: annotated.map((x) => x.i) };
  });
}

export function phiSuffix(i: Pick<RankedDomainItem, "phi">): string {
  return typeof i.phi === "number" ? ` · Φ ${i.phi.toFixed(3)}` : "";
}

/** Destination for a selected item: adds `reuse=<run id>` only when the item can hand off a sequence. */
export function hrefFor(i: RankedDomainItem): string {
  if (!i.reuseRunId) return i.href;
  const [path, query = ""] = i.href.split("?");
  const p = new URLSearchParams(query);
  p.set("reuse", i.reuseRunId);
  return `${path}?${p.toString()}`;
}
