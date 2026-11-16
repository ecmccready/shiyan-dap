/**
 * 4D state compression (M2): local, read-only, per-tenant reader. OFF by default.
 * Reads one tenant's shiyan.experiences rows inside a READ ONLY transaction, compresses them with the
 * M1 core in memory, verifies the result losslessly, and prints only hashes, counts, the segment chain
 * root, exclusion counts and PASS/FAIL. Writes nothing to disk or to any database. Never prints row
 * payloads, URLs, passwords or error message text. Not wired into any route.
 *
 *   SHIYAN_STATE_COMPRESSION=1 npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/compress-tenant.ts \
 *     --tenant <tenant-id> --storage-file ~/.shiyan-storage-url
 *
 * The URL may instead come from SHIYAN_STORAGE_URL. Optional: --full-windows-only (do not seal the final
 * partial window in memory; it is then reported as pending and not verified).
 * Exit codes: 0 PASS, 1 FAIL or error, 2 refused (flag off) or usage.
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkDatabaseUrl, type CheckedDatabaseUrl } from "../src/core/neon-db";
import { diagnosticErrorClass, diagnosticErrorCode } from "../src/core/storage-diagnostics";
import { TENANT_ID_PATTERN } from "../src/core/tenant-auth";
import {
  DEFAULT_SEGMENT_SIZE, compressTenant, extractPoints, reconstruct, verifyChain, verifySegment, verifyTenant,
  type CompressOptions, type SourceRow, type StatePoint, type TenantCompression,
} from "../src/core/compression/index";
import { openStorageClient, readTenantRows, type ReadOnlyClient } from "../src/core/compression/source";

type Env = Record<string, string | undefined>;

export const FLAG = "SHIYAN_STATE_COMPRESSION";

export interface CompressTenantDeps {
  readTextFile: (path: string) => string;
  connect: (checked: CheckedDatabaseUrl) => Promise<{ client: ReadOnlyClient; close: () => Promise<void> }>;
  home: () => string;
}

export const defaultDeps: CompressTenantDeps = {
  readTextFile: (path) => readFileSync(path, "utf8"),
  connect: openStorageClient,
  home: homedir,
};

export interface CompressTenantOutcome {
  exitCode: 0 | 1 | 2;
  lines: string[];
}

function argValue(argv: readonly string[], flag: string): string | undefined {
  const i = argv.indexOf(flag);
  if (i === -1) return undefined;
  const v = argv[i + 1];
  return v && !v.startsWith("--") ? v : undefined;
}

function expandHome(path: string, home: () => string): string {
  if (path === "~") return home();
  if (path.startsWith("~/")) return resolve(home(), path.slice(2));
  return path;
}

const sameBits = (a: number, b: number) => Object.is(a, b);

/** Each sealed segment decodes back to exactly the included points it covers (bit-exact, incl. -0). */
function losslessErrors(result: TenantCompression, points: readonly StatePoint[], size: number): string[] {
  const errors: string[] = [];
  result.segments.forEach((s, i) => {
    const want = points.slice(i * size, i * size + size);
    let got: ReturnType<typeof reconstruct>;
    try { got = reconstruct(s.segment); } catch { errors.push(`seq ${i}: does not decode`); return; }
    if (got.length !== want.length) { errors.push(`seq ${i}: decoded ${got.length} points, expected ${want.length}`); return; }
    for (let k = 0; k < want.length; k++) {
      const g = got[k], w = want[k];
      if (g.t !== w.t || !sameBits(g.predicted, w.predicted) || !sameBits(g.observed, w.observed)
        || !sameBits(g.phi, w.phi) || !sameBits(g.step, w.step) || g.verdict !== w.verdict) {
        errors.push(`seq ${i}: point ${k} differs after decode`);
        return;
      }
    }
  });
  return errors;
}

/** Each segment re-verifies against exactly the source rows it covers (M1 verifySegment). */
function sourceErrors(result: TenantCompression, points: readonly StatePoint[], rows: readonly SourceRow[], size: number): string[] {
  const included = new Map(points.map((p) => [p.experience_id, p.content_sha256]));
  const byId = new Map<string, SourceRow>();
  for (const r of rows) {
    if (included.get(r.experience_id) === r.content_sha256 && !byId.has(r.experience_id)) byId.set(r.experience_id, r);
  }
  const errors: string[] = [];
  result.segments.forEach((s, i) => {
    const covered = points.slice(i * size, i * size + size).map((p) => byId.get(p.experience_id));
    if (covered.some((r) => r === undefined)) { errors.push(`seq ${i}: source rows missing`); return; }
    const v = verifySegment(s, covered as SourceRow[]);
    errors.push(...v.errors.map((e) => `seq ${i}: ${e}`));
  });
  return errors;
}

const byteLength = (s: unknown) => (typeof s === "string" ? Buffer.byteLength(s, "utf8") : 0);

/** Pure-ish entry point (all I/O through deps) so tests can run it with a mock client. Returns the lines to print. */
export async function runCompressTenant(argv: readonly string[], env: Env, deps: CompressTenantDeps = defaultDeps): Promise<CompressTenantOutcome> {
  const lines: string[] = [];
  if (env[FLAG] !== "1") {
    return { exitCode: 2, lines: [`REFUSED: state compression is off by default; set ${FLAG}=1 to run this local read-only reader`] };
  }
  const tenant = argValue(argv, "--tenant");
  if (!tenant || !TENANT_ID_PATTERN.test(tenant)) {
    return { exitCode: 2, lines: ["usage: compress-tenant.ts --tenant <tenant-id> [--storage-file <path>] [--full-windows-only]  (tenant must match TENANT_ID_PATTERN)"] };
  }
  let url: string | undefined;
  const file = argValue(argv, "--storage-file");
  if (argv.includes("--storage-file") && !file) return { exitCode: 2, lines: ["usage: --storage-file needs a path"] };
  if (file) {
    try { url = deps.readTextFile(expandHome(file, deps.home)).trim(); } catch { return { exitCode: 1, lines: ["FAIL storage.url: file could not be read"] }; }
    if (!url) return { exitCode: 1, lines: ["FAIL storage.url: file is empty"] };
  } else {
    url = env.SHIYAN_STORAGE_URL?.trim();
    if (!url) return { exitCode: 2, lines: ["usage: provide --storage-file <path> or SHIYAN_STORAGE_URL"] };
  }
  const checked = checkDatabaseUrl(url, env);
  url = undefined;
  if (!checked.ok) return { exitCode: 1, lines: [`FAIL storage.url: ${checked.reason}`] };

  const size = DEFAULT_SEGMENT_SIZE;
  const options: CompressOptions = { segmentSize: size, sealPartial: !argv.includes("--full-windows-only") };

  let rows: SourceRow[];
  let foreign = 0;
  try {
    const conn = await deps.connect(checked.value);
    try {
      const read = await readTenantRows(conn.client, tenant);
      rows = read.rows;
      foreign = read.foreign_dropped;
    } finally {
      await conn.close().catch(() => undefined);
    }
  } catch (error) {
    return { exitCode: 1, lines: [`FAIL storage.read: class=${diagnosticErrorClass(error) || "unknown"} code=${diagnosticErrorCode(error) || "none"}`] };
  }

  let result: TenantCompression;
  let points: StatePoint[];
  try {
    result = compressTenant(tenant, rows, options);
    points = extractPoints(tenant, rows).points;
  } catch {
    return { exitCode: 1, lines: ["FAIL compress: could not compress tenant rows"] };
  }

  const checks: [string, string[]][] = [
    ["chain", verifyChain(result.segments).errors],
    ["recompute", verifyTenant(tenant, result.segments, rows, options).errors],
    ["sources", sourceErrors(result, points, rows, size)],
    ["lossless", losslessErrors(result, points, size)],
  ];
  const reasons = Object.entries(result.excluded.reasons).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `${k}=${v}`);
  const segmentBytes = result.segments.reduce((n, s) => n + Buffer.byteLength(JSON.stringify(s.segment), "utf8"), 0);
  const sourceBytes = rows.reduce((n, r) => n + byteLength(r.record_json), 0);

  lines.push("state-compression M2: local read-only reader (nothing written)");
  lines.push(`tenant: ${tenant}`);
  lines.push(`rows_read: ${rows.length}`);
  lines.push(`foreign_rows_dropped: ${foreign}`);
  lines.push(`points_included: ${points.length}`);
  lines.push(`excluded: ${result.excluded.count}${reasons.length ? ` (${reasons.join(", ")})` : ""}`);
  lines.push(`segment_size: ${size}  final_partial_window: ${options.sealPartial ? "sealed in memory" : "left pending"}`);
  lines.push(`segments: ${result.segments.length}  pending: ${result.pending}`);
  for (const s of result.segments) {
    lines.push(`segment ${s.segment.seq}: count=${s.segment.count} sha256=${s.segment_sha256} source_ids_root=${s.segment.source_ids_root}`);
  }
  lines.push(`chain_root: ${result.head_sha256 ?? "none (no sealed segments)"}`);
  lines.push(`bytes: source_records=${sourceBytes} segments=${segmentBytes}`);
  let failed = false;
  for (const [name, errors] of checks) {
    if (errors.length) { failed = true; lines.push(`FAIL ${name}: ${errors.length} error(s)`); for (const e of errors.slice(0, 20)) lines.push(`  ${e}`); }
    else lines.push(`PASS ${name}`);
  }
  lines.push(`RESULT: ${failed ? "FAIL" : "PASS"}`);
  return { exitCode: failed ? 1 : 0, lines };
}

const isMain = (() => {
  try { return !!process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url); } catch { return false; }
})();

if (isMain) {
  runCompressTenant(process.argv.slice(2), process.env).then(
    ({ exitCode, lines }) => { for (const l of lines) console.log(l); process.exitCode = exitCode; },
    (error) => { console.error(`FAIL compress-tenant: class=${diagnosticErrorClass(error) || "unknown"}`); process.exitCode = 1; },
  );
}
