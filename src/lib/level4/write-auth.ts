import { createHash, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

/**
 * Optional write gate for Level 4 POST/PUT/DELETE endpoints.
 *
 * - LEVEL4_WRITE_TOKEN unset  -> allow (behavior unchanged).
 * - LEVEL4_WRITE_TOKEN set    -> allow if `Authorization: Bearer <token>` matches
 *   (constant-time compare), OR — unless LEVEL4_ALLOW_SAME_ORIGIN === "false" —
 *   if the Origin (or Referer) host matches the request host, VERCEL_URL, or an
 *   entry in LEVEL4_ALLOWED_ORIGINS (comma list of hosts or origins).
 *
 * The same-origin allowance is CSRF-style protection against cross-site or
 * scripted writes from other origins. It is NOT strong auth: a non-browser
 * client (curl) can forge Origin. Set LEVEL4_ALLOW_SAME_ORIGIN=false for strict
 * bearer-only writes.
 */

function safeEqual(a: string, b: string): boolean {
  // Hash both sides so lengths match, then compare in constant time.
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

function hostOf(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim();
  if (!v) return null;
  try {
    return new URL(v.includes("://") ? v : "https://" + v).host.toLowerCase();
  } catch {
    return null;
  }
}

function allowedHosts(req: Request): Set<string> {
  const hosts = new Set<string>();
  const add = (v: string | null | undefined) => {
    const h = hostOf(v);
    if (h) hosts.add(h);
  };
  add(req.headers.get("x-forwarded-host"));
  add(req.headers.get("host"));
  try {
    add(new URL(req.url).host);
  } catch {
    /* ignore */
  }
  add(process.env.VERCEL_URL);
  add(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  for (const o of (process.env.LEVEL4_ALLOWED_ORIGINS || "").split(",")) add(o);
  return hosts;
}

export function requireLevel4Write(req: Request): NextResponse | null {
  const token = process.env.LEVEL4_WRITE_TOKEN;
  if (!token) return null;

  const auth = req.headers.get("authorization") || "";
  const m = /^Bearer\s+(.+)$/i.exec(auth);
  if (m && safeEqual(m[1].trim(), token)) return null;

  if (process.env.LEVEL4_ALLOW_SAME_ORIGIN !== "false") {
    const src = hostOf(req.headers.get("origin")) ?? hostOf(req.headers.get("referer"));
    if (src && allowedHosts(req).has(src)) return null;
  }

  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}
