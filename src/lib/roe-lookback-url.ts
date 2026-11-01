// Shareable look-back view via URL query (display-only; no server writes, not Level 4).
import type { LookbackRoleFilter, LookbackSort } from "@/lib/level4/roe-lookback";

export type LookbackUrlView = { show: LookbackRoleFilter; sort: LookbackSort; packs: boolean; jumps: boolean };
export const LOOKBACK_URL_KEYS = ["lb_show", "lb_sort", "lb_packs", "lb_jumps"] as const;
const SHOWS: readonly string[] = ["all", "winners", "beaten", "agree"];
const SORTS: readonly string[] = ["rank", "dphi"];

/** Pure: compact params for a view; defaults (all / rank / closed) are omitted. */
export function serializeLookbackUrlView(v: LookbackUrlView): Record<string, string> {
  const o: Record<string, string> = {};
  if (v.show !== "all") o.lb_show = v.show;
  if (v.sort !== "rank") o.lb_sort = v.sort;
  if (v.packs) o.lb_packs = "1";
  if (v.jumps) o.lb_jumps = "1";
  return o;
}

/** Pure: only valid lb_* fields present in the query; invalid / absent → omitted (caller keeps its own value). */
export function parseLookbackUrlView(search: string | URLSearchParams | null | undefined): Partial<LookbackUrlView> {
  const p = typeof search === "string" ? new URLSearchParams(search) : search ?? new URLSearchParams();
  const o: Partial<LookbackUrlView> = {};
  const s = p.get("lb_show"); if (s != null && SHOWS.includes(s)) o.show = s as LookbackRoleFilter;
  const t = p.get("lb_sort"); if (t != null && SORTS.includes(t)) o.sort = t as LookbackSort;
  const pk = p.get("lb_packs"); if (pk === "1" || pk === "0") o.packs = pk === "1";
  const j = p.get("lb_jumps"); if (j === "1" || j === "0") o.jumps = j === "1";
  return o;
}

/** Pure: rewrite an href with current view params (other params + hash kept; lb_* defaults dropped). */
export function lookbackUrlWithView(href: string, v: LookbackUrlView): string {
  const u = new URL(href);
  for (const k of LOOKBACK_URL_KEYS) u.searchParams.delete(k);
  for (const [k, val] of Object.entries(serializeLookbackUrlView(v))) u.searchParams.set(k, val);
  return u.toString();
}

export function lookbackCopyLinkToast(v: LookbackUrlView): string {
  const n = Object.keys(serializeLookbackUrlView(v)).length;
  return n ? `🔗 copied view link · ${n} param${n === 1 ? "" : "s"} · show ${v.show} · sort ${v.sort}` : "🔗 copied view link · default view (no params)";
}
