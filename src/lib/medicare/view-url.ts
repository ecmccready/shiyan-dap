// Shareable Medicare view via URL query (display-only; no server writes, not Level 4).
import type { RowFilter } from "@/lib/medicare/investigation";

/** `target` (key-target item_id) is optional: absent → existing m_target in href is left untouched; null/"" → omitted. */
export type MedicareUrlView = { filter: RowFilter; packs: boolean; jumps: boolean; target?: string | null };
export const MEDICARE_URL_KEYS = ["m_filter", "m_packs", "m_jumps", "m_target"] as const;
const MAX_TARGET = 200;
/** Pure: valid m_target value (non-empty, ≤200 chars, trimmed) or null. Row existence is checked by the caller (soft). */
export function medicareUrlTarget(v: unknown): string | null { if (typeof v !== "string") return null; const t = v.trim(); return t && t.length <= MAX_TARGET ? t : null; }
const FILTERS: readonly string[] = ["needs_human_review", "cleared_pattern_only", "unreviewed", "has_note"];

/** Pure: compact params; defaults (All / closed) omitted. */
export function serializeMedicareUrlView(v: MedicareUrlView): Record<string, string> {
  const o: Record<string, string> = {};
  if (v.filter) o.m_filter = v.filter;
  if (v.packs) o.m_packs = "1";
  if (v.jumps) o.m_jumps = "1";
  const t = medicareUrlTarget(v.target); if (t) o.m_target = t;
  return o;
}

/** Pure: only valid m_* fields present; m_filter=all → filter null (explicit All). Invalid → omitted. */
export function parseMedicareUrlView(search: string | URLSearchParams | null | undefined): Partial<MedicareUrlView> {
  const p = typeof search === "string" ? new URLSearchParams(search) : search ?? new URLSearchParams();
  const o: Partial<MedicareUrlView> = {};
  const f = p.get("m_filter"); if (f === "all") o.filter = null; else if (f != null && FILTERS.includes(f)) o.filter = f as RowFilter;
  const pk = p.get("m_packs"); if (pk === "1" || pk === "0") o.packs = pk === "1";
  const j = p.get("m_jumps"); if (j === "1" || j === "0") o.jumps = j === "1";
  const t = medicareUrlTarget(p.get("m_target")); if (t) o.target = t;
  return o;
}

/** Pure: rewrite href with current view params (other params + hash kept; defaults dropped). */
export function medicareUrlWithView(href: string, v: MedicareUrlView): string {
  const u = new URL(href);
  const keepTarget = !("target" in v);
  for (const k of MEDICARE_URL_KEYS) if (!(keepTarget && k === "m_target")) u.searchParams.delete(k);
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
export function medicareApplyViewUrl(href: string, a: { rowFilter: RowFilter; packsOpen: boolean; jumpsOpen: boolean; keyTarget?: string | null }): { href: string; changed: boolean } {
  const next = medicareUrlWithView(href, "keyTarget" in a ? { filter: a.rowFilter, packs: a.packsOpen, jumps: a.jumpsOpen, target: a.keyTarget ?? null } : { filter: a.rowFilter, packs: a.packsOpen, jumps: a.jumpsOpen });
  return { href: next, changed: next !== href };
}

export const MEDICARE_LINK_PATH = "/workbench/medicare";
export type MedicareApplyLinkResult = { ok: true; view: Partial<MedicareUrlView>; n: number } | { ok: false; reason: string };

/** Pure: parse clipboard text as a ⧉ Link URL for /workbench/medicare and extract valid m_* fields. Rejects non-URL, wrong path, or no valid m_*. Never throws. */
export function parseMedicareLinkText(text: unknown, path: string = MEDICARE_LINK_PATH): MedicareApplyLinkResult {
  if (typeof text !== "string" || !text.trim()) return { ok: false, reason: "clipboard empty" };
  let u: URL;
  try { u = new URL(text.trim()); } catch { return { ok: false, reason: "not a URL" }; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return { ok: false, reason: "not a URL" };
  if (u.pathname.replace(/\/+$/, "") !== path) return { ok: false, reason: `wrong path ${u.pathname}` };
  const view = parseMedicareUrlView(u.searchParams);
  const n = Object.keys(view).length;
  if (!n) return { ok: false, reason: "no valid m_* params" };
  return { ok: true, view, n };
}

export function medicareApplyLinkToast(r: MedicareApplyLinkResult | { ok: false; reason: string }): string {
  if (!r.ok) return `⚠ Apply link rejected · ${r.reason} — expected ${MEDICARE_LINK_PATH}?m_*`;
  return `⇩ applied view link · ${r.n} param${r.n === 1 ? "" : "s"}${r.view.filter !== undefined ? ` · filter ${r.view.filter ?? "all"}` : ""}`;
}

/** ⇩ Apply link first-use pulse: once per page load, only after a successful apply (never on reject). */
export const MEDICARE_APPLY_LINK_PULSE_MS = 1200;
export function medicareApplyLinkShouldPulse(alreadyPulsed: boolean, ok: unknown): boolean { return !alreadyPulsed && ok === true; }
export function medicareApplyLinkPulse(at: number | null, now: number): boolean { return at != null && now - at >= 0 && now - at < MEDICARE_APPLY_LINK_PULSE_MS; }
/** ⧉ Link first-use pulse: once per page load, only after a successful URL copy (never on clipboard fail). */
export const MEDICARE_COPY_LINK_PULSE_MS = 1200;
export function medicareCopyLinkShouldPulse(alreadyPulsed: boolean, ok: unknown): boolean { return !alreadyPulsed && ok === true; }
export function medicareCopyLinkPulse(at: number | null, now: number): boolean { return at != null && now - at >= 0 && now - at < MEDICARE_COPY_LINK_PULSE_MS; }

/** Pure: href with only m_target set (item_id) or removed (null/invalid); other params + hash kept. */
export function medicareUrlWithTarget(href: string, target: string | null | undefined): string {
  const u = new URL(href); const t = medicareUrlTarget(target);
  if (t) u.searchParams.set("m_target", t); else u.searchParams.delete("m_target");
  const next = u.toString(); return next === new URL(href).toString() ? href : next;
}
/** Pure: URL target → focus id only when the row exists (soft: unknown/invalid → null, ignored). */
export function resolveMedicareUrlTarget(target: unknown, ids: readonly string[]): string | null { const t = medicareUrlTarget(target); return t && ids.includes(t) ? t : null; }
/** Event: ⇩ Apply link carried m_target → disposition list focuses it if the row exists. */
export const MEDICARE_URL_TARGET_EVENT = "medicare:url-target";
