/**
 * 4D state compression (M4): persist one tenant's sealed segments to shiyan.state_segments (migration 004),
 * extending the stored chain from its head. OFF by default. Local only; not wired into any route.
 *
 *   dry run (default, READ ONLY, writes nothing):
 *     SHIYAN_STATE_COMPRESSION=1 npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/persist-tenant-segments.ts \
 *       --tenant <tenant-id> --storage-file ~/.shiyan-storage-url [--anchor-file ~/.shiyan-anchor-url]
 *   append (needs --write as well as the flag):            ... --write
 *   verify what is stored (READ ONLY, writes nothing):     ... --verify-stored
 *
 * Same sealing/loss flags as scripts/compress-tenant.ts (--loss/--eps, --cutoff-hours, --grace-minutes,
 * --full-windows-only, --as-of). They must match the stored chain, or the run is refused and nothing is written.
 * Prints only hashes, ids and counts; never payloads, URLs or error text.
 * Exit codes: 0 PASS (or nothing to do), 1 FAIL / REFUSED / error, 2 refused by gate or usage.
 */
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { independentDatabases, type CheckedDatabaseUrl } from "../src/core/neon-db";
import { diagnosticErrorClass, diagnosticErrorCode } from "../src/core/storage-diagnostics";
import { TENANT_ID_PATTERN } from "../src/core/tenant-auth";
import { formatPendingWindow, type AnchorSource } from "../src/core/compression/index";
import { readTenantAnchors } from "../src/core/compression/source";
import { persistTenantSegments, type PersistMode, type PersistResult } from "../src/core/compression/store";
import { FLAG, argValue, defaultDeps, parseOptions, readUrl, type CompressTenantDeps, type CompressTenantOutcome } from "./compress-tenant";

type Env = Record<string, string | undefined>;

export async function runPersistTenant(argv: readonly string[], env: Env, deps: CompressTenantDeps = defaultDeps): Promise<CompressTenantOutcome> {
  if (env[FLAG] !== "1") {
    return { exitCode: 2, lines: [`REFUSED: state compression is off by default; set ${FLAG}=1 (and pass --write to append)`] };
  }
  const tenant = argValue(argv, "--tenant");
  if (!tenant || !TENANT_ID_PATTERN.test(tenant)) {
    return { exitCode: 2, lines: ["usage: persist-tenant-segments.ts --tenant <tenant-id> [--storage-file <path>] [--anchor-file <path>] [--write | --verify-stored] [sealing/loss flags as compress-tenant.ts]"] };
  }
  if (argv.includes("--write") && argv.includes("--verify-stored")) return { exitCode: 2, lines: ["usage: --write and --verify-stored are exclusive"] };
  for (const f of ["--storage-file", "--anchor-file"]) {
    if (argv.includes(f) && !argValue(argv, f)) return { exitCode: 2, lines: [`usage: ${f} needs a path`] };
  }
  const mode: PersistMode = argv.includes("--write") ? "write" : argv.includes("--verify-stored") ? "verify" : "dry-run";
  const parsed = parseOptions(argv, (deps.now ?? (() => Date.now()))());
  if (!parsed.ok) return { exitCode: 2, lines: [parsed.line] };
  const { lossLabel, ...options } = parsed.value;

  const storage = readUrl("storage", argValue(argv, "--storage-file"), env.SHIYAN_STORAGE_URL, env, deps);
  if (!storage.ok) return { exitCode: storage.exitCode, lines: [storage.line] };
  let anchorsChecked: CheckedDatabaseUrl | null = null;
  const anchorFile = argValue(argv, "--anchor-file");
  if (anchorFile) {
    const a = readUrl("anchors", anchorFile, undefined, env, deps);
    if (!a.ok) return { exitCode: a.exitCode, lines: [a.line] };
    if (!independentDatabases(storage.checked, a.checked)) {
      return { exitCode: 1, lines: ["FAIL anchors.url: must point at a different database with a different role than storage"] };
    }
    anchorsChecked = a.checked;
  }
  let anchors: AnchorSource | undefined;
  if (anchorsChecked) {
    try {
      const conn = await deps.connect(anchorsChecked, "anchors");
      try { anchors = await readTenantAnchors(conn.client, tenant); } finally { await conn.close().catch(() => undefined); }
    } catch (error) {
      return { exitCode: 1, lines: [`FAIL anchors.read: class=${diagnosticErrorClass(error) || "unknown"} code=${diagnosticErrorCode(error) || "none"}`] };
    }
  }

  let r: PersistResult;
  try {
    const conn = await deps.connect(storage.checked, "storage");
    try { r = await persistTenantSegments(conn.client, tenant, mode, { ...options, anchors }); } finally { await conn.close().catch(() => undefined); }
  } catch (error) {
    const code = diagnosticErrorCode(error) || "none";
    const lines = [`FAIL storage.${mode}: class=${diagnosticErrorClass(error) || "unknown"} code=${code}`];
    if (code === "42P01") lines.push("hint: shiyan.state_segments is missing; apply db/migrations/004_shiyan_state_segments.sql (nothing was written)");
    if (code === "42501") lines.push("hint: the storage role lacks a privilege on shiyan.state_segments; see migration 004 grants (nothing was written)");
    if (code === "23505" || code === "23503") lines.push("hint: another append for this tenant won the race; rerun to extend from the new head (nothing was written)");
    return { exitCode: 1, lines };
  }

  const e = r.extension;
  const label = mode === "write" ? "write (appends sealed segments only)" : mode === "verify" ? "verify-stored (READ ONLY, nothing written)" : "dry-run (READ ONLY, nothing written)";
  const reasons = Object.entries(e.excluded.reasons).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `${k}=${v}`);
  const lines: string[] = [];
  lines.push(`state-compression M4: ${label}`);
  lines.push(`tenant: ${tenant}`);
  lines.push(`rows_read: ${r.rows_read}`);
  lines.push(`foreign_rows_dropped: ${r.foreign_rows_dropped}`);
  lines.push(`points_included: ${e.included}`);
  lines.push(`excluded: ${e.excluded.count}${reasons.length ? ` (${reasons.join(", ")})` : ""}`);
  const cutoff = e.params.cutoffMs === Infinity ? "none" : String(e.params.cutoffMs / 3_600_000);
  lines.push(`sealing: size=${e.params.segmentSize} cutoff_hours=${cutoff} grace_minutes=${e.params.graceMs / 60_000} as_of=${new Date(options.asOfMs).toISOString()}${mode === "verify" ? " (stored parameters)" : ""}`);
  lines.push(`loss: ${mode === "verify" ? "as stored" : lossLabel}`);
  lines.push(`context: ${anchors ? "anchors=read" : "no --anchor-file"}`);
  lines.push(`stored_before: ${r.stored_before}`);
  if (e.refused.length) {
    lines.push(`refused: ${e.refused.length} reason(s)`);
    for (const x of e.refused.slice(0, 20)) lines.push(`  ${x}`);
  }
  if (mode !== "verify") {
    lines.push(`${mode === "write" ? "appended" : "would_append"}: ${mode === "write" ? r.inserted : e.refused.length ? 0 : r.appended}`);
    if (!e.refused.length) {
      e.appended.forEach((s, i) => lines.push(`segment ${s.segment.seq}: count=${s.segment.count} closed_by=${e.windows[i].closed_by} sha256=${s.segment_sha256}`));
    }
    lines.push(`pending: ${e.pending}  late_records: ${e.late}  ${formatPendingWindow(e.pending_window)}`);
  }
  lines.push(`chain_head: ${(mode === "write" ? r.stored_head_after : mode === "dry-run" && !e.refused.length ? e.head_sha256 : r.stored_head_after) ?? "none"}${mode === "dry-run" ? " (after the would-be append)" : ""}`);

  let failed = e.refused.length > 0;
  if (mode === "verify") {
    failed = r.invalid_stored.length > 0;
    const c = r.stored_checks!;
    const named: [string, { errors: string[] }][] = [["chain", c.chain], ["sources", c.sources], ["reconstruction", c.reconstruction], ["context", c.context]];
    for (const [n, v] of named) {
      if (v.errors.length) { failed = true; lines.push(`FAIL stored ${n}: ${v.errors.length} error(s)`); for (const x of v.errors.slice(0, 20)) lines.push(`  ${x}`); }
      else lines.push(`PASS stored ${n}`);
    }
    lines.push(`context_rederived: ${anchors && r.stored_before ? "yes" : "no"}`);
    lines.push(`from_scratch_prefix: ${r.from_scratch_prefix === undefined ? "not computed (stored context needs --anchor-file)" : r.from_scratch_prefix ? "yes" : "no (late commits were placed after the stored head)"}`);
    lines.push(`sealable_not_yet_stored: ${e.refused.length ? "unknown" : e.appended.length}`);
    lines.push(`RESULT: ${failed ? "FAIL" : "PASS"}`);
  } else {
    lines.push(`RESULT: ${failed ? "REFUSED (nothing written)" : "PASS"}`);
  }
  return { exitCode: failed ? 1 : 0, lines };
}

const isMain = (() => {
  try { return !!process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url); } catch { return false; }
})();

if (isMain) {
  runPersistTenant(process.argv.slice(2), process.env).then(
    ({ exitCode, lines }) => { for (const l of lines) console.log(l); process.exitCode = exitCode; },
    (error) => { console.error(`FAIL persist-tenant-segments: class=${diagnosticErrorClass(error) || "unknown"}`); process.exitCode = 1; },
  );
}
