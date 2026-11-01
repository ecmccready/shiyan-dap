// Shareable Medicare view via URL query (display-only; no server writes, not Level 4).
import type { RowFilter } from "@/lib/medicare/investigation";

export type MedicareUrlView = { filter: RowFilter; packs: boolean; jumps: boolean };
export const MEDICARE_URL_KEYS = ["m_filter", "m_packs", "m_jumps"] as const;
const FILTERS: readonly string[] = ["needs_human_review", "cleared_pattern_only", "unreviewed", "has_note"];

/** Pure: compact params; defaults (All / closed) omitted. */
export function serializeMedicareUrlView(v: MedicareUrlView): Record<string, string> {
  const o: Record<string, string> = {};
  if (v.filter) o.m_filter = v.filter;
  if (v.packs) o.m_packs = "1";
  if (v.jumps) o.m_jumps = "1";
  return o;
}

/** Pure: only valid m_* fields present; m_filter=all → filter null (explicit All). Invalid → omitted. */
export function parseMedicareUrlView(search: string | URLSearchParams | null | undefined): Partial<MedicareUrlView> {
  const p = typeof search === "string" ? new URLSearchParams(search) : search ?? new URLSearchParams();
  const o: Partial<MedicareUrlView> = {};
  const f = p.get("m_filter"); if (f === "all") o.filter = null; else if (f != null && FILTERS.includes(f)) o.filter = f as RowFilter;
  const pk = p.get("m_packs"); if (pk === "1" || pk === "0") o.packs = pk === "1";
  const j = p.get("m_jumps"); if (j === "1" || j === "0") o.jumps = j === "1";
  return o;
}

/** Pure: rewrite href with current view params (other params + hash kept; defaults dropped). */
export function medicareUrlWithView(href: string, v: MedicareUrlView): string {
  const u = new URL(href);
  for (const k of MEDICARE_URL_KEYS) u.searchParams.delete(k);
  for (const [k, val] of Object.entries(serializeMedicareUrlView(v))) u.searchParams.set(k, val);
  return u.toString();
}

export function medicareCopyLinkToast(v: MedicareUrlView): string {
  const n = Object.keys(serializeMedicareUrlView(v)).length;
  return n ? `🔗 copied view link · ${n} param${n === 1 ? "" : "s"} · filter ${v.filter ?? "all"}` : "🔗 copied view link · default view (no params)";
}

/** Pure: href with every m_* key removed (other params + hash kept); `removed` = count stripped. */
export function stripMedicareUrlParams(href: string): { href: string; removed: number } {
  const u = new URL(href);
  let removed = 0;
  for (const k of MEDICARE_URL_KEYS) if (u.searchParams.has(k)) { removed++; u.searchParams.delete(k); }
  return { href: removed ? u.toString() : href, removed };
}

/** Pure: href to replaceState after a successful ⇩ Apply view (m_* = applied view, defaults omitted); `changed` false → leave URL alone. */
export function medicareApplyViewUrl(href: string, a: { rowFilter: RowFilter; packsOpen: boolean; jumpsOpen: boolean }): { href: string; changed: boolean } {
  const next = medicareUrlWithView(href, { filter: a.rowFilter, packs: a.packsOpen, jumps: a.jumpsOpen });
  return { href: next, changed: next !== href };
}
