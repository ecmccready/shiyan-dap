// Shareable Medicare view via URL query (display-only; no server writes, not Level 4).
import type { RowFilter } from "@/lib/medicare/investigation";
import { readMedicareKeyTarget, MEDICARE_KEY_TARGET_KEY } from "@/lib/medicare/investigation";

/** `target` (key-target item_id) is optional: absent → existing m_target in href is left untouched; null/"" → omitted. */
export type MedicareUrlView = { filter: RowFilter; packs: boolean; jumps: boolean; target?: string | null; tone?: MedicareUrlTone };
export const MEDICARE_URL_KEYS = ["m_filter", "m_packs", "m_jumps", "m_target", "m_tone"] as const;
/** Recent toasts tone filter in the URL: m_tone=done|empty ↔ green|amber; missing / unknown = all (soft-compat). `tone` absent → existing m_tone kept. */
export type MedicareUrlTone = "all" | "green" | "amber";
const M_TONE_TO_URL: Record<string, string> = { green: "done", amber: "empty" };
const M_URL_TO_TONE: Record<string, MedicareUrlTone> = { done: "green", empty: "amber" };
export function medicareToneToUrl(t: unknown): string | null { return typeof t === "string" && Object.prototype.hasOwnProperty.call(M_TONE_TO_URL, t) ? M_TONE_TO_URL[t] : null; }
export function medicareToneFromUrl(v: unknown): MedicareUrlTone { return typeof v === "string" && Object.prototype.hasOwnProperty.call(M_URL_TO_TONE, v) ? M_URL_TO_TONE[v] : "all"; }
/** Event: Apply link / Apply view / Reset set the Recent tone filter (detail: MedicareUrlTone). */
export const MEDICARE_URL_TONE_EVENT = "medicare:url-tone";
/** Pure: href with only m_tone set (done|empty) or removed (all/unknown); other params + hash kept; unchanged → same href. */
export function medicareUrlWithTone(href: string, tone: unknown): string {
  const u = new URL(href); const t = medicareToneToUrl(tone);
  if (t) u.searchParams.set("m_tone", t); else u.searchParams.delete("m_tone");
  const next = u.toString(); return next === new URL(href).toString() ? href : next;
}
/** Pure: Recent tone carried by a ⧉ View snapshot's view_url (m_tone); missing / bad JSON → all. */
export function medicareToneFromSnapshotText(text: unknown): MedicareUrlTone { try { const j = JSON.parse(String(text)); return typeof j?.view_url === "string" ? medicareToneFromUrl(new URL(j.view_url).searchParams.get("m_tone")) : "all"; } catch { return "all"; } }
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
  const tn = medicareToneToUrl(v.tone); if (tn) o.m_tone = tn;
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
  const tn = p.get("m_tone"); if (tn != null && M_URL_TO_TONE[tn]) o.tone = M_URL_TO_TONE[tn];
  return o;
}

/** Pure: rewrite href with current view params (other params + hash kept; defaults dropped). */
export function medicareUrlWithView(href: string, v: MedicareUrlView): string {
  const u = new URL(href);
  const keepTarget = !("target" in v); const keepTone = !("tone" in v);
  for (const k of MEDICARE_URL_KEYS) if (!(keepTarget && k === "m_target") && !(keepTone && k === "m_tone")) u.searchParams.delete(k);
  for (const [k, val] of Object.entries(serializeMedicareUrlView(v))) u.searchParams.set(k, val);
  return u.toString();
}

export function medicareCopyLinkToast(v: MedicareUrlView): string {
  const n = Object.keys(serializeMedicareUrlView(v)).length;
  return n ? `🔗 copied view link · ${n} param${n === 1 ? "" : "s"} · filter ${v.filter ?? "all"}${medicareToneToUrl(v.tone) ? ` · recent ${medicareToneToUrl(v.tone)}` : ""}` : "🔗 copied view link · default view (no params)";
}

/** Pure: href with every m_* key removed (other params + hash kept); `removed` = count stripped. */
export function stripMedicareUrlParams(href: string): { href: string; removed: number } {
  const u = new URL(href);
  let removed = 0;
  for (const k of MEDICARE_URL_KEYS) if (u.searchParams.has(k)) { removed++; u.searchParams.delete(k); }
  return { href: removed ? u.toString() : href, removed };
}

/** Pure: href to replaceState after a successful ⇩ Apply view (m_* = applied view, defaults omitted); `changed` false → leave URL alone. */
export function medicareApplyViewUrl(href: string, a: { rowFilter: RowFilter; packsOpen: boolean; jumpsOpen: boolean; keyTarget?: string | null; recentTone?: string }): { href: string; changed: boolean } {
  const v: MedicareUrlView = "keyTarget" in a ? { filter: a.rowFilter, packs: a.packsOpen, jumps: a.jumpsOpen, target: a.keyTarget ?? null } : { filter: a.rowFilter, packs: a.packsOpen, jumps: a.jumpsOpen };
  if ("recentTone" in a) v.tone = medicareToneFromUrl(medicareToneToUrl(a.recentTone));
  const next = medicareUrlWithView(href, v);
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
  return `⇩ applied view link · ${r.n} param${r.n === 1 ? "" : "s"}${r.view.filter !== undefined ? ` · filter ${r.view.filter ?? "all"}` : ""}${r.view.tone ? ` · recent ${medicareToneToUrl(r.view.tone)}` : ""}`;
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

/** ↺ Reset view first-use pulse: once per page load, only after a reset that actually changed something (session keys cleared or m_* stripped). */
export const MEDICARE_RESET_VIEW_PULSE_MS = 1200;
export function medicareResetViewShouldPulse(alreadyPulsed: boolean, changed: unknown): boolean { return !alreadyPulsed && typeof changed === "number" && Number.isFinite(changed) && changed > 0; }
export function medicareResetViewPulse(at: number | null, now: number): boolean { return at != null && now - at >= 0 && now - at < MEDICARE_RESET_VIEW_PULSE_MS; }

/** Pure: full shareable /workbench/medicare URL from current view state — m_filter/m_packs/m_jumps parsed from href plus m_target = current key target
 *  (same as ⧉ Link / ⧉ View). `keyTarget` null/invalid → m_target dropped (never a stale URL target). Used by case brief, 📦 Hand-off, ⧉ Dispositions. m_tone (Recent tone) kept from href unless `recentTone` given. Never throws (bad href → null). */
export function medicareShareableViewUrl(href: string, keyTarget: string | null | undefined, recentTone?: string): string | null {
  try { const v = parseMedicareUrlView(new URL(href).search); const mv: MedicareUrlView = { filter: v.filter ?? null, packs: !!v.packs, jumps: !!v.jumps, target: keyTarget ?? null }; if (recentTone !== undefined) mv.tone = medicareToneFromUrl(medicareToneToUrl(recentTone)); return medicareUrlWithView(href, mv); } catch { return null; }
}

/** Pure: live key target for view_url — sessionStorage key target first, then valid URL m_target. With `ids` (report available) both must be a row in it;
 *  without ids (no report) the stored item_id / URL m_target are only shape-checked. Missing / malformed / throwing → null. Shared by CopyLiveInvestigation + CopyMedicareJson. */
export function resolveMedicareLiveKeyTarget(store: { getItem(k: string): string | null } | null | undefined, search: string | URLSearchParams | null | undefined, ids?: readonly string[] | null): string | null {
  try {
    const urlT = parseMedicareUrlView(search).target ?? null;
    if (ids) { const list = [...ids]; return readMedicareKeyTarget(store as never, list) ?? resolveMedicareUrlTarget(urlT, list); }
    let saved: string | null = null; try { const v = store?.getItem(MEDICARE_KEY_TARGET_KEY); if (typeof v === "string") { const o = JSON.parse(v) as { item_id?: unknown }; saved = medicareUrlTarget(o?.item_id); } } catch {}
    return saved ?? urlT;
  } catch { return null; }
}
