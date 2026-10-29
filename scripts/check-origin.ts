// Run: npx tsx scripts/check-origin.ts <origin>      e.g. https://shiyan-dap.vercel.app  or  http://localhost:3000
// OPERATOR-RUN tool, not imported by the app. After a deploy it GETs exactly two fixed URLs on the origin you name
// (/api/marketplace/peers and /api/marketplace/listings) and checks each has its own route's shape.
// GET only, no custom auth headers, no cookies, no POST, redirects are NOT followed (a 3xx is a failure), 10 s timeout,
// 5 MB body cap. Writes no files. A pass is a shape check only, not verification or trust.
// Exit codes: 0 both contracts hold, 1 any HTTP or contract failure, 2 usage or origin error.
import {
  parseOperatorOrigin, routeUrls, formatOriginReport, safeSnippet,
  FETCH_TIMEOUT_MS, MAX_BODY_BYTES, SNIPPET_MAX, type RouteProbe,
} from "../src/lib/marketplace/origin-check";
import type { RouteName } from "../src/lib/marketplace/route-contract";

const USAGE = "Usage: npx tsx scripts/check-origin.ts <origin>   (https://host, or http://localhost[:port] / http://127.0.0.1[:port]; no path, query or credentials)";

async function readCapped(res: Response): Promise<{ text: string } | { tooLarge: true }> {
  const declared = Number(res.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) { await res.body?.cancel(); return { tooLarge: true }; }
  if (!res.body) return { text: "" };
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) { await reader.cancel(); return { tooLarge: true }; }
    chunks.push(value);
  }
  return { text: Buffer.concat(chunks).toString("utf8") };
}

async function probe(route: RouteName, url: string): Promise<RouteProbe> {
  let res: Response;
  try {
    res = await fetch(url, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), headers: { accept: "application/json" } });
  } catch (e) {
    const name = e instanceof Error ? e.name : "";
    return { route, status: null, failure: name === "TimeoutError" || name === "AbortError" ? `timed out after ${FETCH_TIMEOUT_MS / 1000}s` : `network error: ${safeSnippet(e instanceof Error ? (e.cause instanceof Error ? e.cause.message : e.message) : "unknown", 120)}` };
  }
  try {
    if (res.status >= 300 && res.status < 400) {
      await res.body?.cancel();
      const loc = safeSnippet(res.headers.get("location") ?? "", 120);
      return { route, status: res.status, failure: `redirect not followed${loc ? ` (Location: ${loc})` : ""}; the route must answer directly` };
    }
    const body = await readCapped(res);
    if ("tooLarge" in body) return { route, status: res.status, failure: `response body is larger than ${MAX_BODY_BYTES} bytes (5 MB cap)` };
    if (res.status !== 200) return { route, status: res.status, failure: "expected HTTP 200", snippet: safeSnippet(body.text, SNIPPET_MAX) };
    try {
      return { route, status: res.status, json: JSON.parse(body.text) };
    } catch {
      return { route, status: res.status, failure: "body is not valid JSON", snippet: safeSnippet(body.text, SNIPPET_MAX) };
    }
  } catch (e) {
    const name = e instanceof Error ? e.name : "";
    return { route, status: res.status, failure: name === "TimeoutError" || name === "AbortError" ? `timed out after ${FETCH_TIMEOUT_MS / 1000}s` : "could not read the response body" };
  }
}

async function main(args: string[]): Promise<number> {
  if (args.length !== 1) { console.error(USAGE); return 2; }
  const origin = parseOperatorOrigin(args[0]);
  if (!origin) { console.error(`error: not an accepted origin: ${safeSnippet(args[0], 120)}\n${USAGE}`); return 2; }
  const urls = routeUrls(origin);
  const probes: RouteProbe[] = [await probe("peers", urls.peers), await probe("listings", urls.listings)];
  const { lines, exitCode } = formatOriginReport(origin, probes);
  for (const line of lines) console.log(line);
  return exitCode;
}

main(process.argv.slice(2)).then((code) => process.exit(code), () => { console.error("error: unexpected failure"); process.exit(1); });
