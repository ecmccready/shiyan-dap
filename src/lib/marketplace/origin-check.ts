/**
 * Pure helpers for the operator-run script scripts/check-origin.ts (no I/O here: no fetch, no files, no env).
 * Nothing in the app imports this; no route or page calls it. The script is run by hand after a deploy.
 *
 * parseOperatorOrigin() deliberately does NOT reuse isValidPeerUrl(). That gate exists for future entries pointing at
 * OTHER nodes and rejects localhost and plain http on purpose. Here the operator names their own node, which is often
 * http://localhost:3000 during development, so the rule is different and narrower in other ways:
 *   - only an origin: http(s), no credentials, no path (or "/" only), no query, no fragment, no whitespace;
 *   - https is accepted for any host (https://localhost is fine, an operator may front a dev server with TLS);
 *   - plain http is accepted only for localhost and 127.0.0.1 (the operator's own machine).
 * The returned string is the normalised origin without a trailing slash.
 */
import { checkRouteContract, type RouteName } from "@/lib/marketplace/route-contract";

export const ORIGIN_NOTE =
  "Shape check only: a passing route contract means well-formed and the right route's content, not verified, attested or trusted. GET only, two fixed paths, no redirects followed.";
export const FETCH_TIMEOUT_MS = 10_000;
export const MAX_BODY_BYTES = 5 * 1024 * 1024;
export const SNIPPET_MAX = 200;

export function parseOperatorOrigin(arg: unknown): string | null {
  if (typeof arg !== "string" || arg.length === 0 || arg.length > 2048 || /\s/.test(arg)) return null;
  if (arg.includes("?") || arg.includes("#")) return null;
  let u: URL;
  try { u = new URL(arg); } catch { return null; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  if (u.username || u.password || !u.hostname) return null;
  if (u.pathname !== "/" && u.pathname !== "") return null;
  if (u.protocol === "http:" && u.hostname !== "localhost" && u.hostname !== "127.0.0.1") return null;
  return u.origin;
}

/** The only two URLs the script ever requests. */
export function routeUrls(origin: string): { peers: string; listings: string } {
  return { peers: `${origin}/api/marketplace/peers`, listings: `${origin}/api/marketplace/listings` };
}

/** Remote text made safe to print: control characters become spaces, then it is cut to `max` characters. */
export function safeSnippet(text: unknown, max: number = SNIPPET_MAX): string {
  if (typeof text !== "string") return "";
  // eslint-disable-next-line no-control-regex
  const s = text.replace(/[\u0000-\u001f\u007f]+/g, " ").trim();
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

/** What the script observed for one route. `failure` is set when no usable 200 JSON body was obtained. */
export type RouteProbe = {
  route: RouteName;
  status: number | null;
  json?: unknown;
  failure?: string;
  snippet?: string;
};

const ROUTES: RouteName[] = ["peers", "listings"];

/** Plain-text report for the two probes (pure). Exit 0 only when both contracts hold, else 1. */
export function formatOriginReport(origin: string, probes: RouteProbe[]): { lines: string[]; exitCode: 0 | 1 } {
  const lines: string[] = [ORIGIN_NOTE, `Origin: ${origin}`];
  let failed = 0;
  for (const route of ROUTES) {
    const p = probes.find((x) => x.route === route);
    const http = p && p.status !== null ? `HTTP ${p.status}` : "no HTTP response";
    if (!p) { failed++; lines.push(`${route}: ${http} — failed`, "  error: no result recorded"); continue; }
    if (p.failure) {
      failed++;
      lines.push(`${route}: ${http} — failed`, `  error: ${safeSnippet(p.failure, 300)}`);
      if (p.snippet) lines.push(`  body: ${safeSnippet(p.snippet)}`);
      continue;
    }
    if (p.status !== 200) {
      failed++;
      lines.push(`${route}: ${http} — failed`, "  error: expected HTTP 200");
      if (p.snippet) lines.push(`  body: ${safeSnippet(p.snippet)}`);
      continue;
    }
    const r = checkRouteContract(route, p.json);
    if (r.ok) {
      lines.push(`${route}: ${http} — OK: ${route} contract holds`);
      for (const w of r.warnings) lines.push(`  warning: ${w}`);
    } else {
      failed++;
      lines.push(`${route}: ${http} — contract failed`);
      for (const e of r.errors) lines.push(`  error: ${e}`);
    }
  }
  lines.push(failed === 0 ? `Summary: both route contracts hold at ${origin}` : `Summary: ${failed} of ${ROUTES.length} routes failed at ${origin}`);
  return { lines, exitCode: failed === 0 ? 0 : 1 };
}
