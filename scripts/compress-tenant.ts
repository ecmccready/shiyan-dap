/**
 * 4D state compression (M2-M3): local, read-only, per-tenant reader. OFF by default.
 * Reads one tenant's shiyan.experiences rows inside a READ ONLY transaction (and, with --anchor-file, the
 * tenant's reference anchors and recovery records from the separate anchors DB, also READ ONLY), seals
 * windows, compresses in memory, verifies, and prints only hashes, ids, counts, the chain root, exclusion
 * counts and PASS/FAIL. Writes nothing to disk or to any database. Never prints row payloads, URLs,
 * passwords or error message text. Not wired into any route.
 *
 *   SHIYAN_STATE_COMPRESSION=1 npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/compress-tenant.ts \
 *     --tenant <tenant-id> --storage-file ~/.shiyan-storage-url [--anchor-file ~/.shiyan-anchor-url] \
 *     [--loss bounded --eps <predicted>,<observed>,<phi>] [--cutoff-hours 24] [--grace-minutes 10] [--as-of <ISO>]
 *
 * The storage URL may instead come from SHIYAN_STORAGE_URL. The anchors URL is read only from --anchor-file.
 * --full-windows-only: no time cutoff (windows seal at 256 runs only).
 * Exit codes: 0 PASS, 1 FAIL or error, 2 refused (flag off) or usage.
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkDatabaseUrl, independentDatabases, type CheckedDatabaseUrl } from "../src/core/neon-db";
import { diagnosticErrorClass, diagnosticErrorCode } from "../src/core/storage-diagnostics";
import { TENANT_ID_PATTERN } from "../src/core/tenant-auth";
import {
  DEFAULT_CUTOFF_MS, DEFAULT_GRACE_MS, DEFAULT_SEGMENT_SIZE, buildTenantChain, checkEps, verifyTenantChain,
  type AnchorSource, type ChainOptions, type LossOption, type SourceRow, type TenantChain,
} from "../src/core/compression/index";
import { openStorageClient, readTenantAnchors, readTenantRows, type ReadOnlyClient } from "../src/core/compression/source";
import { encodeWindowScp4d } from "./scp4d-segment-codec";

type Env = Record<string, string | undefined>;

export const FLAG = "SHIYAN_STATE_COMPRESSION";

export interface CompressTenantDeps {
  readTextFile: (path: string) => string;
  connect: (checked: CheckedDatabaseUrl, purpose: "storage" | "anchors") => Promise<{ client: ReadOnlyClient; close: () => Promise<void> }>;
  home: () => string;
  /** Clock for the default --as-of. Optional so tests can pin it. */
  now?: () => number;
}

export const defaultDeps: CompressTenantDeps = {
  readTextFile: (path) => readFileSync(path, "utf8"),
  connect: openStorageClient,
  home: homedir,
  now: () => Date.now(),
};

export interface CompressTenantOutcome {
  exitCode: 0 | 1 | 2;
  lines: string[];
}

export function argValue(argv: readonly string[], flag: string): string | undefined {
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

export type Parsed = { ok: true; value: ChainOptions & { lossLabel: string } } | { ok: false; line: string };

export function parseOptions(argv: readonly string[], now: number): Parsed {
  const usage = (m: string): Parsed => ({ ok: false, line: `usage: ${m}` });
  let loss: LossOption = { mode: "lossless" };
  let lossLabel = "lossless";
  const mode = argValue(argv, "--loss");
  if (argv.includes("--loss") && mode !== "lossless" && mode !== "bounded") return usage("--loss must be lossless or bounded");
  if (mode === "bounded") {
    const raw = argValue(argv, "--eps");
    const parts = raw?.split(",").map((x) => Number(x.trim())) ?? [];
    if (parts.length !== 3) return usage("--loss bounded needs --eps <predicted>,<observed>,<phi> (each finite and > 0)");
    const eps = { predicted: parts[0], observed: parts[1], phi: parts[2] };
    try { checkEps(eps); } catch { return usage("--eps values must each be finite and > 0"); }
    loss = { mode: "bounded", eps };
    lossLabel = `bounded eps_predicted=${eps.predicted} eps_observed=${eps.observed} eps_phi=${eps.phi}`;
  } else if (argv.includes("--eps")) {
    return usage("--eps is only valid with --loss bounded");
  }
  let cutoffMs = DEFAULT_CUTOFF_MS;
  if (argv.includes("--full-windows-only")) cutoffMs = Infinity;
  if (argv.includes("--cutoff-hours")) {
    const h = Number(argValue(argv, "--cutoff-hours"));
    if (cutoffMs === Infinity) return usage("--cutoff-hours and --full-windows-only are exclusive");
    if (!Number.isFinite(h) || h <= 0 || !Number.isSafeInteger(Math.round(h * 3_600_000))) return usage("--cutoff-hours must be a positive number");
    cutoffMs = Math.round(h * 3_600_000);
  }
  let graceMs = DEFAULT_GRACE_MS;
  if (argv.includes("--grace-minutes")) {
    const m = Number(argValue(argv, "--grace-minutes"));
    if (!Number.isFinite(m) || m < 0) return usage("--grace-minutes must be a non-negative number");
    graceMs = Math.round(m * 60_000);
  }
  let asOfMs = now;
  if (argv.includes("--as-of")) {
    const t = Date.parse(argValue(argv, "--as-of") ?? "");
    if (!Number.isSafeInteger(t)) return usage("--as-of must be an ISO date-time");
    asOfMs = t;
  }
  return { ok: true, value: { segmentSize: DEFAULT_SEGMENT_SIZE, cutoffMs, graceMs, asOfMs, loss, lossLabel } };
}

export type UrlRead = { ok: true; checked: CheckedDatabaseUrl } | { ok: false; exitCode: 1 | 2; line: string };
export function readUrl(label: string, file: string | undefined, fallback: string | undefined, env: Env, deps: CompressTenantDeps): UrlRead {
  let url: string | undefined;
  if (file) {
    try { url = deps.readTextFile(expandHome(file, deps.home)).trim(); } catch { return { ok: false, exitCode: 1, line: `FAIL ${label}.url: file could not be read` }; }
    if (!url) return { ok: false, exitCode: 1, line: `FAIL ${label}.url: file is empty` };
  } else {
    url = fallback?.trim();
    if (!url) return { ok: false, exitCode: 2, line: "usage: provide --storage-file <path> or SHIYAN_STORAGE_URL" };
  }
  const checked = checkDatabaseUrl(url, env);
  url = undefined;
  if (!checked.ok) return { ok: false, exitCode: 1, line: `FAIL ${label}.url: ${checked.reason}` };
  return { ok: true, checked: checked.value };
}

export function codecChoice(argv: readonly string[], env: Env): { ok: true; codec: "off" | "scp4d" } | { ok: false; line: string } {
  const fromArg = argv.includes("--codec") ? argValue(argv, "--codec") : undefined;
  if (argv.includes("--codec") && !fromArg) return { ok: false, line: "usage: --codec needs off or scp4d" };
  const name = fromArg ?? (env.SCP_CODEC && env.SCP_CODEC.length > 0 ? env.SCP_CODEC : "off");
  if (name === "off") return { ok: true, codec: "off" };
  if (name === "scp4d") return { ok: true, codec: "scp4d" };
  return { ok: false, line: "usage: --codec must be off or scp4d (or set SCP_CODEC)" };
}

export const dbFail = (label: string, error: unknown) =>
  `FAIL ${label}.read: class=${diagnosticErrorClass(error) || "unknown"} code=${diagnosticErrorCode(error) || "none"}`;
const iso = (ms: number) => new Date(ms).toISOString();
const byteLength = (s: unknown) => (typeof s === "string" ? Buffer.byteLength(s, "utf8") : 0);

/** All I/O goes through deps so tests can run it with mock clients. Returns the lines to print. */
export async function runCompressTenant(argv: readonly string[], env: Env, deps: CompressTenantDeps = defaultDeps): Promise<CompressTenantOutcome> {
  if (env[FLAG] !== "1") {
    return { exitCode: 2, lines: [`REFUSED: state compression is off by default; set ${FLAG}=1 to run this local read-only reader`] };
  }
  const codec = codecChoice(argv, env);
  if (!codec.ok) return { exitCode: 2, lines: [codec.line] };
  const tenant = argValue(argv, "--tenant");
  if (!tenant || !TENANT_ID_PATTERN.test(tenant)) {
    return { exitCode: 2, lines: ["usage: compress-tenant.ts --tenant <tenant-id> [--storage-file <path>] [--anchor-file <path>] [--loss lossless|bounded --eps p,o,phi] [--cutoff-hours h | --full-windows-only] [--grace-minutes m] [--as-of ISO]  (tenant must match TENANT_ID_PATTERN)"] };
  }
  for (const f of ["--storage-file", "--anchor-file"]) {
    if (argv.includes(f) && !argValue(argv, f)) return { exitCode: 2, lines: [`usage: ${f} needs a path`] };
  }
  const parsed = parseOptions(argv, (deps.now ?? (() => Date.now()))());
  if (!parsed.ok) return { exitCode: 2, lines: [parsed.line] };
  const { lossLabel, ...options } = parsed.value;

  const storage = readUrl("storage", argValue(argv, "--storage-file"), env.SHIYAN_STORAGE_URL, env, deps);
  if (!storage.ok) return { exitCode: storage.exitCode, lines: [storage.line] };
  const anchorFile = argValue(argv, "--anchor-file");
  let anchorsChecked: CheckedDatabaseUrl | null = null;
  if (anchorFile) {
    const a = readUrl("anchors", anchorFile, undefined, env, deps);
    if (!a.ok) return { exitCode: a.exitCode, lines: [a.line] };
    if (!independentDatabases(storage.checked, a.checked)) {
      return { exitCode: 1, lines: ["FAIL anchors.url: must point at a different database with a different role than storage"] };
    }
    anchorsChecked = a.checked;
  }

  let rows: SourceRow[];
  let foreign = 0;
  try {
    const conn = await deps.connect(storage.checked, "storage");
    try {
      const read = await readTenantRows(conn.client, tenant);
      rows = read.rows;
      foreign = read.foreign_dropped;
    } finally {
      await conn.close().catch(() => undefined);
    }
  } catch (error) {
    return { exitCode: 1, lines: [dbFail("storage", error)] };
  }
  let anchors: AnchorSource | undefined;
  if (anchorsChecked) {
    try {
      const conn = await deps.connect(anchorsChecked, "anchors");
      try { anchors = await readTenantAnchors(conn.client, tenant); } finally { await conn.close().catch(() => undefined); }
    } catch (error) {
      return { exitCode: 1, lines: [dbFail("anchors", error)] };
    }
  }
  const chainOptions: ChainOptions = { ...options, anchors };

  let result: TenantChain;
  try { result = buildTenantChain(tenant, rows, chainOptions); } catch (e) {
    const why = e instanceof RangeError && /eps/.test(e.message) ? `: ${e.message}` : "";
    return { exitCode: 1, lines: [`FAIL compress: could not compress tenant rows${why}`] };
  }
  const checks = verifyTenantChain(tenant, result.segments, rows, chainOptions);
  const reasons = Object.entries(result.excluded.reasons).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `${k}=${v}`);
  const segmentBytes = result.segments.reduce((n, s) => n + Buffer.byteLength(JSON.stringify(s.segment), "utf8"), 0);
  const sourceBytes = rows.reduce((n, r) => n + byteLength(r.record_json), 0);
  const closedBy = (k: string) => result.windows.filter((w) => w.closed_by === k).length;
  const cutoffLabel = options.cutoffMs === Infinity ? "none" : String((options.cutoffMs ?? DEFAULT_CUTOFF_MS) / 3_600_000);

  const lines: string[] = [];
  lines.push("state-compression M3: local read-only reader (nothing written)");
  lines.push(`tenant: ${tenant}`);
  lines.push(`rows_read: ${rows.length}`);
  lines.push(`foreign_rows_dropped: ${foreign}`);
  lines.push(`points_included: ${result.included}`);
  lines.push(`excluded: ${result.excluded.count}${reasons.length ? ` (${reasons.join(", ")})` : ""}`);
  lines.push(`sealing: size=${options.segmentSize} cutoff_hours=${cutoffLabel} grace_minutes=${(options.graceMs ?? 0) / 60_000} as_of=${iso(options.asOfMs)}`);
  lines.push(`windows: sealed_full=${closedBy("full")} sealed_cutoff=${closedBy("cutoff")} late_records=${result.late} arrival_from_proof_timestamp=${result.arrival_fallback}`);
  lines.push(`loss: ${lossLabel}`);
  if (result.anchors) {
    const a = result.anchors;
    lines.push(`context: anchors=read reference_anchors=${a.references} recovery_records_linkable=${a.recoveries} recovery_unlinked=${a.unlinked_recoveries} invalid_reference_rows=${a.invalid_references} invalid_recovery_rows=${a.invalid_recoveries}`);
  } else {
    lines.push("context: not requested (no --anchor-file), segments carry no context");
  }
  lines.push(`segments: ${result.segments.length}  pending: ${result.pending}`);
  result.segments.forEach((s, i) => {
    const seg = s.segment;
    let line = `segment ${seg.seq}: count=${seg.count} closed_by=${result.windows[i].closed_by} sha256=${s.segment_sha256} source_ids_root=${seg.source_ids_root}`;
    if (seg.loss.mode === "bounded") {
      const m = seg.loss.max_abs_err;
      line += ` max_abs_err=${m.predicted},${m.observed},${m.phi}`;
    }
    if (seg.context) {
      const c = seg.context;
      const by = Object.entries(c.recovery.by_status).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `${k}=${v}`).join(",");
      line += ` recovery=${c.recovery.count}${by ? `(${by})` : ""} recovery_root=${c.recovery.records_root ?? "none"}`;
      line += c.reference.status === "present"
        ? ` reference=${c.reference.reference_id} commit=${c.reference.commit_sha} snapshot_sha256=${c.reference.snapshot_sha256}`
        : " reference=none";
    }
    lines.push(line);
  });
  lines.push(`chain_root: ${result.head_sha256 ?? "none (no sealed segments)"}`);
  lines.push(`bytes: source_records=${sourceBytes} segments=${segmentBytes}`);
  const named: [string, { errors: string[] }][] = [
    ["chain", checks.chain], ["recompute", checks.recompute], ["sources", checks.sources],
    [options.loss?.mode === "bounded" ? "bounded" : "lossless", checks.reconstruction], ["context", checks.context],
  ];
  let failed = false;
  for (const [name, r] of named) {
    if (r.errors.length) { failed = true; lines.push(`FAIL ${name}: ${r.errors.length} error(s)`); for (const e of r.errors.slice(0, 20)) lines.push(`  ${e}`); }
    else lines.push(`PASS ${name}`);
  }
  lines.push(`RESULT: ${failed ? "FAIL" : "PASS"}`);
  if (codec.codec === "scp4d" && !failed) {
    try {
      let bytes = 0;
      result.windows.forEach((w, i) => {
        const side = encodeWindowScp4d(w.points);
        bytes += side.bytes.length;
        lines.push(`scp4d segment ${result.segments[i].segment.seq}: frames=${side.frames} bytes=${side.bytes.length} sha256=${side.sha256} round_trip=PASS`);
      });
      lines.push(`scp4d: segments=${result.windows.length} bytes=${bytes} stored=sidecar round_trip=PASS`);
    } catch {
      lines.push("scp4d: FAIL");
      return { exitCode: 1, lines };
    }
  }
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
