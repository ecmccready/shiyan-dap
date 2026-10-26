/** Production domain of the live app. The default binding for SIWE messages when SIWE_ALLOWED_DOMAINS is not set. */
const DEFAULT_SIWE_DOMAINS = ['shiyan-dap.vercel.app'];

/**
 * Domains a SIWE message may name, independent of the request's Host header:
 * 1. SIWE_ALLOWED_DOMAINS (comma separated, host[:port]) when set.
 * 2. Otherwise a fixed list: shiyan-dap.vercel.app plus VERCEL_PROJECT_PRODUCTION_URL (set by the platform, not by the client).
 * Opt-ins that do read the request: SIWE_TRUST_REQUEST_HOST=1 adds the request host (the old default, for previews and custom
 * domains), and outside NODE_ENV=production the request host is added so local development works. A direct client controls
 * its own Host header, so never enable SIWE_TRUST_REQUEST_HOST where the domain is a security boundary.
 */
export function siweExpectedDomains(req: Request): string[] {
  const configured = (process.env.SIWE_ALLOWED_DOMAINS ?? '').split(',').map((d) => d.trim()).filter(Boolean);
  if (configured.length) return configured;
  const fixed = [...DEFAULT_SIWE_DOMAINS, process.env.VERCEL_PROJECT_PRODUCTION_URL];
  const trustHost = process.env.SIWE_TRUST_REQUEST_HOST === '1' || process.env.NODE_ENV !== 'production';
  const fromRequest = trustHost ? [req.headers.get('x-forwarded-host')?.split(',')[0], req.headers.get('host')] : [];
  return [...new Set([...fixed, ...fromRequest].filter((h): h is string => Boolean(h)).map((h) => h.trim()))];
}
