/**
 * 4D state compression: scheduled sync. For each allowlisted tenant, keeps the stored state chain
 * (shiyan.state_segments, storage project) and its independent anchor (shiyan_anchor.state_chain_anchors, anchors
 * project) current. It reuses the M4/M5 modules directly (store.ts, anchor-store.ts), so the statement allowlists,
 * per-tenant advisory locks, READ ONLY transactions and refusal rules are exactly those of the two CLIs.
 *
 *   dry run (default; READ ONLY on both databases, writes nothing):
 *     SHIYAN_STATE_COMPRESSION=1 SHIYAN_SYNC_TENANTS=prod-a \
 *       npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/sync-state-chains.ts \
 *       --storage-file ~/.shiyan-storage-url --anchor-file ~/.shiyan-anchor-url
 *   write (append newly sealed segments, then anchor the new head):  ... --write
 *
 * Per tenant, in order (any failure stops THAT tenant; later tenants still run; exit 1 if any tenant failed):
 *   1. probe          READ ONLY verify of the stored chain; yields its own options (sealing, loss, context);
 *                     then a READ ONLY anchor pre-check: if the witness already disagrees, nothing is written at all
 *   2. persist dry    READ ONLY; refused => FAIL
 *   3. persist write  only with --write and would_append > 0
 *   4. verify-stored  READ ONLY; any stored check error => FAIL
 *   5. anchor dry     READ ONLY on anchors; mismatch/invalid => FAIL
 *   6. anchor write   only with --write and the head not yet anchored
 *   7. verify-anchor  READ ONLY; mismatch => FAIL; after --write the latest anchor must be the current head
 * Options: a tenant with a stored chain is always synced with that chain's own options (never hardcoded). A tenant
 * with nothing stored starts with the defaults used for prod-a: lossless, 24 h cutoff, 10 min grace, anchors context.
 * Output: one line per tenant plus RESULT; only counts, seqs and hashes. Never URLs, roles, hosts, payloads or error
 * text (DB errors print class/code only).
 * Exit codes: 0 PASS (or no tenants configured), 1 any tenant FAILED or a connection failed, 2 gate/usage.
 */
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { independentDatabases } from "../src/core/neon-db";
import { diagnosticErrorClass, diagnosticErrorCode } from "../src/core/storage-diagnostics";
import { TENANT_ID_PATTERN } from "../src/core/tenant-auth";
import { DEFAULT_CUTOFF_MS, DEFAULT_GRACE_MS, DEFAULT_SEGMENT_SIZE, type AnchorSource, type ChainOptions } from "../src/core/compression/index";
import { readTenantAnchors, type ReadOnlyClient } from "../src/core/compression/source";
import { persistTenantSegments, type PersistMode, type PersistResult } from "../src/core/compression/store";
import { anchorStateChainHead, type AnchorMode, type AnchorResult } from "../src/core/compression/anchor-store";
import { FLAG, argValue, defaultDeps, readUrl, type CompressTenantDeps, type CompressTenantOutcome } from "./compress-tenant";

type Env = Record<string, string | undefined>;
export const TENANTS_VAR = "SHIYAN_SYNC_TENANTS";
export const MAX_SYNC_TENANTS = 50;

export type TenantList = { ok: true; tenants: string[] } | { ok: false; line: string };

/** Comma-separated allowlist; every entry must match TENANT_ID_PATTERN. Duplicates are dropped; order is kept. */
export function parseTenantList(raw: string | undefined): TenantList {
  const parts = (raw ?? "").split(",").map((x) => x.trim()).filter((x) => x.length > 0);
  const tenants: string[] = [];
  for (const [i, t] of parts.entries()) {
    if (!TENANT_ID_PATTERN.test(t)) return { ok: false, line: `usage: ${TENANTS_VAR} entry ${i + 1} is not a valid tenant id` };
    if (!tenants.includes(t)) tenants.push(t);
  }
  if (tenants.length > MAX_SYNC_TENANTS) return { ok: false, line: `usage: ${TENANTS_VAR} lists more than ${MAX_SYNC_TENANTS} tenants` };
  return { ok: true, tenants };
}

class StepFailed extends Error {
  constructor(readonly step: string, readonly detail: string) { super(`${step}: ${detail}`); this.name = "StepFailed"; }
}
const dbDetail = (error: unknown) => `class=${diagnosticErrorClass(error) || "unknown"} code=${diagnosticErrorCode(error) || "none"}`;

function storedFailures(r: PersistResult): number {
  const c = r.stored_checks;
  const errs = c ? c.chain.errors.length + c.sources.errors.length + c.reconstruction.errors.length + c.context.errors.length : 0;
  return r.invalid_stored.length + errs;
}

/** The options a tenant is synced with: its stored chain's own, or the prod-a defaults when nothing is stored. */
export function syncOptions(probe: PersistResult, anchors: AnchorSource, asOfMs: number): ChainOptions {
  const s = probe.stored_options;
  if (!s) {
    return { segmentSize: DEFAULT_SEGMENT_SIZE, cutoffMs: DEFAULT_CUTOFF_MS, graceMs: DEFAULT_GRACE_MS, asOfMs, loss: { mode: "lossless" }, anchors };
  }
  return { segmentSize: s.params.segmentSize, cutoffMs: s.params.cutoffMs, graceMs: s.params.graceMs, asOfMs, loss: s.loss, anchors: s.context ? anchors : undefined };
}

export interface TenantSummary {
  tenant: string;
  ok: boolean;
  line: string;
}

async function syncTenant(
  tenant: string, write: boolean, storage: ReadOnlyClient, anchorsDb: ReadOnlyClient, asOfMs: number,
): Promise<TenantSummary> {
  let step = "anchors.context";
  const run = async <T>(name: string, fn: () => Promise<T>): Promise<T> => {
    step = name;
    try { return await fn(); } catch (error) { if (error instanceof StepFailed) throw error; throw new StepFailed(name, dbDetail(error)); }
  };
  const persist = (mode: PersistMode, options: ChainOptions) => persistTenantSegments(storage, tenant, mode, options);
  try {
    const context = await run("anchors.context", () => readTenantAnchors(anchorsDb, tenant));
    const defaults: ChainOptions = { segmentSize: DEFAULT_SEGMENT_SIZE, cutoffMs: DEFAULT_CUTOFF_MS, graceMs: DEFAULT_GRACE_MS, asOfMs, anchors: context };
    // 1. probe: verify what is stored, with its own options.
    const probe = await run("persist.probe", () => persist("verify", defaults));
    if (storedFailures(probe)) throw new StepFailed("persist.probe", `stored chain does not verify (${storedFailures(probe)} error(s))`);
    const options = syncOptions(probe, context, asOfMs);
    const precheck = await run("anchor.precheck", () => anchorStateChainHead(anchorsDb, tenant, "verify", probe.stored_hashes));
    if (precheck.invalid.length) throw new StepFailed("anchor.precheck", "invalid anchor rows");
    if (precheck.comparison.status === "mismatch") throw new StepFailed("anchor.precheck", `mismatch (${precheck.comparison.mismatches.length} anchor(s) disagree with the stored chain)`);
    // 2. persist dry run.
    const dry = await run("persist.dry-run", () => persist("dry-run", options));
    if (dry.extension.refused.length) throw new StepFailed("persist.dry-run", `refused (${dry.extension.refused.length} reason(s))`);
    const wouldAppend = dry.appended;
    // 3. persist write, only after a passing dry run, and only when there is something to append.
    let appended = 0;
    if (write && wouldAppend > 0) {
      const w = await run("persist.write", () => persist("write", options));
      if (w.extension.refused.length) throw new StepFailed("persist.write", `refused (${w.extension.refused.length} reason(s))`);
      appended = w.inserted;
    }
    // 4. verify-stored (fresh read, includes anything just appended).
    const verified = await run("persist.verify-stored", () => persist("verify", options));
    if (storedFailures(verified)) throw new StepFailed("persist.verify-stored", `stored chain does not verify (${storedFailures(verified)} error(s))`);
    const hashes = verified.stored_hashes;
    // 5. anchor dry run.
    const anchorStep = async (mode: AnchorMode): Promise<AnchorResult> => {
      const a = await run(`anchor.${mode}`, () => anchorStateChainHead(anchorsDb, tenant, mode, hashes));
      if (a.invalid.length) throw new StepFailed(`anchor.${mode}`, "invalid anchor rows");
      if (a.comparison.status === "mismatch") throw new StepFailed(`anchor.${mode}`, `mismatch (${a.comparison.mismatches.length} anchor(s) disagree with the stored chain)`);
      return a;
    };
    const aDry = await anchorStep("dry-run");
    // 6. anchor write, only when the head is not yet anchored.
    let anchored = 0;
    if (write && aDry.would_insert > 0) anchored = (await anchorStep("write")).inserted;
    // 7. verify-anchor.
    const v = await anchorStep("verify");
    const head = hashes.length ? hashes[hashes.length - 1] : null;
    const covers = v.comparison.covers_head;
    if (write && head !== null && !covers) throw new StepFailed("anchor.verify", "latest anchor is not the current head");
    const loss = options.loss?.mode ?? "lossless";
    const line = `tenant ${tenant}: OK mode=${write ? "write" : "dry-run"} stored=${hashes.length} `
      + `${write ? `appended=${appended}` : `would_append=${wouldAppend}`} pending=${verified.extension.pending} `
      + `loss=${loss} context=${options.anchors ? "yes" : "no"} anchor=${v.comparison.status} `
      + `${write ? `anchored=${anchored}` : `would_anchor=${aDry.would_insert}`} covers_head=${covers ? "yes" : "no"} `
      + `head=${head ?? "none"}${v.comparison.latest ? ` anchored_seq=${v.comparison.latest.seq}` : ""}`;
    return { tenant, ok: true, line };
  } catch (error) {
    const f = error instanceof StepFailed ? error : new StepFailed(step, dbDetail(error));
    return { tenant, ok: false, line: `tenant ${tenant}: FAIL at ${f.step} (${f.detail}); later steps skipped, nothing further written` };
  }
}

/** All I/O goes through deps so tests can run it with mock clients. Returns the lines to print. */
export async function runStateChainSync(argv: readonly string[], env: Env, deps: CompressTenantDeps = defaultDeps): Promise<CompressTenantOutcome> {
  if (env[FLAG] !== "1") return { exitCode: 2, lines: [`REFUSED: state compression is off by default; set ${FLAG}=1 (and pass --write to write)`] };
  const known = new Set(["--write", "--storage-file", "--anchor-file"]);
  for (const [i, a] of argv.entries()) {
    if (a.startsWith("--") && !known.has(a)) return { exitCode: 2, lines: [`usage: unknown flag ${a.slice(0, 40)}`] };
    if (!a.startsWith("--") && !(i > 0 && (argv[i - 1] === "--storage-file" || argv[i - 1] === "--anchor-file"))) return { exitCode: 2, lines: ["usage: unexpected argument"] };
  }
  const list = parseTenantList(env[TENANTS_VAR]);
  if (!list.ok) return { exitCode: 2, lines: [list.line] };
  if (list.tenants.length === 0) return { exitCode: 0, lines: [`state-chain sync: no tenants configured (${TENANTS_VAR} is empty); nothing to do`, "RESULT: PASS (0 tenants)"] };
  for (const f of ["--storage-file", "--anchor-file"]) {
    if (argv.includes(f) && !argValue(argv, f)) return { exitCode: 2, lines: [`usage: ${f} needs a path`] };
  }
  const anchorFile = argValue(argv, "--anchor-file");
  if (!anchorFile && !env.SHIYAN_ANCHOR_URL?.trim()) return { exitCode: 2, lines: ["usage: provide --anchor-file <path> or SHIYAN_ANCHOR_URL (the independent anchors database)"] };
  const write = argv.includes("--write");
  const storageUrl = readUrl("storage", argValue(argv, "--storage-file"), env.SHIYAN_STORAGE_URL, env, deps);
  if (!storageUrl.ok) return { exitCode: storageUrl.exitCode, lines: [storageUrl.line] };
  const anchorsUrl = readUrl("anchors", anchorFile, env.SHIYAN_ANCHOR_URL, env, deps);
  if (!anchorsUrl.ok) return { exitCode: anchorsUrl.exitCode, lines: [anchorsUrl.line] };
  if (!independentDatabases(storageUrl.checked, anchorsUrl.checked)) {
    return { exitCode: 1, lines: ["FAIL anchors.url: must point at a different database with a different role than storage (nothing was written)"] };
  }

  const asOfMs = (deps.now ?? (() => Date.now()))();
  const lines = [`state-chain sync: mode=${write ? "write" : "dry-run (READ ONLY, nothing written)"} tenants=${list.tenants.length} as_of=${new Date(asOfMs).toISOString()}`];
  // One connection per database for the whole run (each step is its own transaction).
  let storage: Awaited<ReturnType<CompressTenantDeps["connect"]>> | undefined;
  let anchors: Awaited<ReturnType<CompressTenantDeps["connect"]>> | undefined;
  try {
    try { storage = await deps.connect(storageUrl.checked, "storage"); } catch (error) {
      return { exitCode: 1, lines: [...lines, `FAIL storage.connect: ${dbDetail(error)}`, "RESULT: FAIL (nothing was written)"] };
    }
    try { anchors = await deps.connect(anchorsUrl.checked, "anchors"); } catch (error) {
      return { exitCode: 1, lines: [...lines, `FAIL anchors.connect: ${dbDetail(error)}`, "RESULT: FAIL (nothing was written)"] };
    }
    const results: TenantSummary[] = [];
    for (const tenant of list.tenants) {
      const r = await syncTenant(tenant, write, storage.client, anchors.client, asOfMs);
      results.push(r);
      lines.push(r.line);
    }
    const failed = results.filter((r) => !r.ok).length;
    lines.push(failed ? `RESULT: FAIL (${failed} of ${results.length} tenant(s) failed)` : `RESULT: PASS (${results.length} tenant(s))`);
    return { exitCode: failed ? 1 : 0, lines };
  } finally {
    await storage?.close().catch(() => undefined);
    await anchors?.close().catch(() => undefined);
  }
}

const isMain = (() => {
  try { return !!process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url); } catch { return false; }
})();

if (isMain) {
  runStateChainSync(process.argv.slice(2), process.env).then(
    ({ exitCode, lines }) => { for (const l of lines) console.log(l); process.exitCode = exitCode; },
    (error) => { console.error(`FAIL sync-state-chains: class=${diagnosticErrorClass(error) || "unknown"}`); process.exitCode = 1; },
  );
}
