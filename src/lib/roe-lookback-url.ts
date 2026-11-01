// Shareable look-back view via URL query (display-only; no server writes, not Level 4).
import type { LookbackRoleFilter, LookbackSort } from "@/lib/level4/roe-lookback";

export type LookbackUrlView = { show: LookbackRoleFilter; sort: LookbackSort; packs: boolean; jumps: boolean; focus?: string | null; expand?: boolean; tone?: LookbackUrlTone };
export const LOOKBACK_URL_KEYS = ["lb_show", "lb_sort", "lb_packs", "lb_jumps", "lb_focus", "lb_expand", "lb_tone"] as const;
/** Recent toasts tone filter in the URL: lb_tone=win|agree|empty ↔ green|blue|amber; missing / unknown = all (soft-compat). */
export type LookbackUrlTone = "all" | "green" | "blue" | "amber";
const TONE_TO_URL: Record<string, string> = { green: "win", blue: "agree", amber: "empty" };
const URL_TO_TONE: Record<string, LookbackUrlTone> = { win: "green", agree: "blue", empty: "amber" };
export function lookbackToneToUrl(t: unknown): string | null { return typeof t === "string" && Object.prototype.hasOwnProperty.call(TONE_TO_URL, t) ? TONE_TO_URL[t] : null; }
export function lookbackToneFromUrl(v: unknown): LookbackUrlTone { return typeof v === "string" && Object.prototype.hasOwnProperty.call(URL_TO_TONE, v) ? URL_TO_TONE[v] : "all"; }
/** lb_focus must look like a run id (1–128 of [A-Za-z0-9._:-]); anything else is ignored. Row membership is checked by the caller. */
export function isLookbackUrlFocus(v: unknown): v is string { return typeof v === "string" && /^[A-Za-z0-9._:-]{1,128}$/.test(v); }
const SHOWS: readonly string[] = ["all", "winners", "beaten", "agree"];
const SORTS: readonly string[] = ["rank", "dphi"];

/** Pure: compact params for a view; defaults (all / rank / closed) are omitted. */
export function serializeLookbackUrlView(v: LookbackUrlView): Record<string, string> {
  const o: Record<string, string> = {};
  if (v.show !== "all") o.lb_show = v.show;
  if (v.sort !== "rank") o.lb_sort = v.sort;
  if (v.packs) o.lb_packs = "1";
  if (v.jumps) o.lb_jumps = "1";
  if (isLookbackUrlFocus(v.focus)) o.lb_focus = v.focus;
  if (v.expand) o.lb_expand = "1";
  const tn = lookbackToneToUrl(v.tone); if (tn) o.lb_tone = tn;
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
  const f = p.get("lb_focus"); if (isLookbackUrlFocus(f)) o.focus = f;
  const e = p.get("lb_expand"); if (e === "1" || e === "0") o.expand = e === "1";
  const tn = p.get("lb_tone"); if (tn != null && URL_TO_TONE[tn]) o.tone = URL_TO_TONE[tn];
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

/** Pure: href with every lb_* key removed (other params + hash kept); `removed` = count stripped. */
export function stripLookbackUrlParams(href: string): { href: string; removed: number } {
  const u = new URL(href);
  let removed = 0;
  for (const k of LOOKBACK_URL_KEYS) if (u.searchParams.has(k)) { removed++; u.searchParams.delete(k); }
  return { href: removed ? u.toString() : href, removed };
}

/** Pure: href to replaceState after a successful ⇩ Apply view (lb_* = applied view, defaults omitted); `changed` false → leave URL alone. */
export function lookbackApplyViewUrl(href: string, a: { show: LookbackRoleFilter; sort: LookbackSort; packsOpen: boolean; jumpsOpen: boolean; focusRunId?: string | null; expandAll?: boolean; recentTone?: string }): { href: string; changed: boolean } {
  const next = lookbackUrlWithView(href, { show: a.show, sort: a.sort, packs: a.packsOpen, jumps: a.jumpsOpen, focus: a.focusRunId, expand: a.expandAll, tone: a.recentTone as LookbackUrlTone });
  return { href: next, changed: next !== href };
}

export const LOOKBACK_LINK_PATH = "/workbench/status";
export type LookbackApplyLinkResult = { ok: true; view: Partial<LookbackUrlView>; n: number } | { ok: false; reason: string };

/** Pure: parse clipboard text as a ⧉ Link URL for /workbench/status and extract valid lb_* fields. Rejects non-URL, wrong path, or no valid lb_*. Never throws. */
export function parseLookbackLinkText(text: unknown, path: string = LOOKBACK_LINK_PATH): LookbackApplyLinkResult {
  if (typeof text !== "string" || !text.trim()) return { ok: false, reason: "clipboard empty" };
  let u: URL;
  try { u = new URL(text.trim()); } catch { return { ok: false, reason: "not a URL" }; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return { ok: false, reason: "not a URL" };
  if (u.pathname.replace(/\/+$/, "") !== path) return { ok: false, reason: `wrong path ${u.pathname}` };
  const view = parseLookbackUrlView(u.searchParams);
  const n = Object.keys(view).length;
  if (!n) return { ok: false, reason: "no valid lb_* params" };
  return { ok: true, view, n };
}

export function lookbackApplyLinkToast(r: LookbackApplyLinkResult | { ok: false; reason: string }): string {
  if (!r.ok) return `⚠ Apply link rejected · ${r.reason} — expected ${LOOKBACK_LINK_PATH}?lb_*`;
  return `⇩ applied view link · ${r.n} param${r.n === 1 ? "" : "s"}${r.view.show ? ` · show ${r.view.show}` : ""}${r.view.sort ? ` · sort ${r.view.sort}` : ""}${r.view.focus ? ` · focus ${r.view.focus}` : ""}${r.view.expand ? " · expand all" : ""}${r.view.tone ? ` · recent ${lookbackToneToUrl(r.view.tone)}` : ""}`;
}

/** ⇩ Apply link first-use pulse: once per page load, only after a successful apply (never on reject). */
export const LOOKBACK_APPLY_LINK_PULSE_MS = 1200;
export function lookbackApplyLinkShouldPulse(alreadyPulsed: boolean, ok: unknown): boolean { return !alreadyPulsed && ok === true; }
export const LOOKBACK_COPY_LINK_PULSE_MS = 1200;
export function lookbackCopyLinkShouldPulse(alreadyPulsed: boolean, ok: unknown): boolean { return !alreadyPulsed && ok === true; }
export function lookbackCopyLinkPulse(at: number | null, now: number): boolean { return at != null && now - at >= 0 && now - at < LOOKBACK_COPY_LINK_PULSE_MS; }
export function lookbackApplyLinkPulse(at: number | null, now: number): boolean { return at != null && now - at >= 0 && now - at < LOOKBACK_APPLY_LINK_PULSE_MS; }

/** ↺ Reset view first-use pulse: once per page load, only after a reset that actually changed something (session keys cleared or lb_* stripped). */
export const LOOKBACK_RESET_VIEW_PULSE_MS = 1200;
export function lookbackResetViewShouldPulse(alreadyPulsed: boolean, changed: unknown): boolean { return !alreadyPulsed && typeof changed === "number" && Number.isFinite(changed) && changed > 0; }
export function lookbackResetViewPulse(at: number | null, now: number): boolean { return at != null && now - at >= 0 && now - at < LOOKBACK_RESET_VIEW_PULSE_MS; }

/** Pure: full shareable /workbench/status URL from current look-back state (parity with medicareShareableViewUrl) — lb_show/lb_sort/lb_packs/lb_jumps
 *  plus lb_focus (focusRunId, invalid dropped) and lb_expand (expandAll). Single builder for ⧉ Link and every pack view_url
 *  (Compare/Summary/Verdict/Gaps/Roles/All paths/All steps/⧉ View). Non-http(s) or bad href → null. Never throws. */
export function lookbackShareableViewUrl(href: string, s: { show: LookbackRoleFilter; sort: LookbackSort; packsOpen: boolean; jumpsOpen: boolean; focusRunId?: string | null; expandAll?: boolean; recentTone?: string }): string | null {
  try { const u = new URL(href); if (u.protocol !== "http:" && u.protocol !== "https:") return null; return lookbackUrlWithView(href, { show: s.show, sort: s.sort, packs: !!s.packsOpen, jumps: !!s.jumpsOpen, focus: s.focusRunId ?? null, expand: !!s.expandAll, tone: s.recentTone as LookbackUrlTone }); } catch { return null; }
}
