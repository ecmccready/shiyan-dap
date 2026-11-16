/**
 * 4D state compression (M5): anchor one tenant's persisted state-chain head (shiyan.state_segments, storage project)
 * in the INDEPENDENT anchors project (shiyan_anchor.state_chain_anchors, migration 005). OFF by default. Local only.
 *
 *   dry run (default; READ ONLY on both databases, writes nothing):
 *     SHIYAN_STATE_COMPRESSION=1 npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/anchor-state-chain.ts \
 *       --tenant <tenant-id> --storage-file ~/.shiyan-storage-url --anchor-file ~/.shiyan-anchor-url
 *   anchor the head (needs --write as well as the flag):  ... --write
 *   verify the anchors against the stored chain (READ ONLY): ... --verify-anchor
 *
 * Every mode first verifies the stored chain READ ONLY (the same checks as persist-tenant-segments.ts --verify-stored,
 * with context re-derived from the anchors DB). If that fails, nothing is anchored. The anchors write is its own
 * transaction on the anchors DB with an exact statement allowlist; storage is never written.
 * Idempotent: an already-anchored head inserts 0. An existing anchor that disagrees with the stored chain is a
 * mismatch: refused, nothing written. Prints only hashes, seqs and counts; never URLs, payloads or error text.
 * Exit codes: 0 PASS (or nothing to do), 1 FAIL / REFUSED / error, 2 refused by gate or usage.
 */
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { independentDatabases } from "../src/core/neon-db";
import { diagnosticErrorClass, diagnosticErrorCode } from "../src/core/storage-diagnostics";
import { TENANT_ID_PATTERN } from "../src/core/tenant-auth";
import type { AnchorSource } from "../src/core/compression/index";
import { readTenantAnchors } from "../src/core/compression/source";
import { persistTenantSegments, type PersistResult } from "../src/core/compression/store";
import { anchorStateChainHead, type AnchorMode, type AnchorResult } from "../src/core/compression/anchor-store";
import { FLAG, argValue, defaultDeps, parseOptions, readUrl, type CompressTenantDeps, type CompressTenantOutcome } from "./compress-tenant";

type Env = Record<string, string | undefined>;

const fail = (label: string, error: unknown, table: string, migration: string): string[] => {
  const code = diagnosticErrorCode(error) || "none";
  const lines = [`FAIL ${label}: class=${diagnosticErrorClass(error) || "unknown"} code=${code}`];
  if (code === "42P01") lines.push(`hint: ${table} is missing; apply ${migration} (nothing was written)`);
  if (code === "42501") lines.push(`hint: the connecting role lacks a privilege on ${table}; see ${migration} grants (nothing was written)`);
  if (code === "23505") lines.push("hint: another anchor run for this tenant won the race; rerun (nothing was written by this run)");
  return lines;
};

export async function runAnchorStateChain(argv: readonly string[], env: Env, deps: CompressTenantDeps = defaultDeps): Promise<CompressTenantOutcome> {
  if (env[FLAG] !== "1") {
    return { exitCode: 2, lines: [`REFUSED: state compression is off by default; set ${FLAG}=1 (and pass --write to anchor)`] };
  }
  const tenant = argValue(argv, "--tenant");
  if (!tenant || !TENANT_ID_PATTERN.test(tenant)) {
    return { exitCode: 2, lines: ["usage: anchor-state-chain.ts --tenant <tenant-id> --storage-file <path> --anchor-file <path> [--write | --verify-anchor]"] };
  }
  if (argv.includes("--write") && argv.includes("--verify-anchor")) return { exitCode: 2, lines: ["usage: --write and --verify-anchor are exclusive"] };
  for (const f of ["--storage-file", "--anchor-file"]) {
    if (argv.includes(f) && !argValue(argv, f)) return { exitCode: 2, lines: [`usage: ${f} needs a path`] };
  }
  const anchorFile = argValue(argv, "--anchor-file");
  if (!anchorFile && !env.SHIYAN_ANCHOR_URL?.trim()) return { exitCode: 2, lines: ["usage: provide --anchor-file <path> or SHIYAN_ANCHOR_URL (the independent anchors database)"] };
  const mode: AnchorMode = argv.includes("--write") ? "write" : argv.includes("--verify-anchor") ? "verify" : "dry-run";
  const parsed = parseOptions(argv, (deps.now ?? (() => Date.now()))());
  if (!parsed.ok) return { exitCode: 2, lines: [parsed.line] };
  const { lossLabel: _lossLabel, ...options } = parsed.value;

  const storage = readUrl("storage", argValue(argv, "--storage-file"), env.SHIYAN_STORAGE_URL, env, deps);
  if (!storage.ok) return { exitCode: storage.exitCode, lines: [storage.line] };
  const anchorsUrl = readUrl("anchors", anchorFile, env.SHIYAN_ANCHOR_URL, env, deps);
  if (!anchorsUrl.ok) return { exitCode: anchorsUrl.exitCode, lines: [anchorsUrl.line] };
  if (!independentDatabases(storage.checked, anchorsUrl.checked)) {
    return { exitCode: 1, lines: ["FAIL anchors.url: must point at a different database with a different role than storage (nothing was written)"] };
  }

  const label = mode === "write" ? "write (anchors the verified stored head)" : mode === "verify" ? "verify-anchor (READ ONLY, nothing written)" : "dry-run (READ ONLY, nothing written)";
  const lines: string[] = [`state-compression M5 anchor: ${label}`, `tenant: ${tenant}`];

  let anchorsConn: Awaited<ReturnType<CompressTenantDeps["connect"]>>;
  try { anchorsConn = await deps.connect(anchorsUrl.checked, "anchors"); } catch (error) {
    return { exitCode: 1, lines: [...lines, ...fail("anchors.connect", error, "shiyan_anchor.state_chain_anchors", "db/migrations/005_shiyan_state_chain_anchors.sql")] };
  }
  try {
    // 1. Context source for re-derivation (READ ONLY on the anchors DB).
    let context: AnchorSource;
    try { context = await readTenantAnchors(anchorsConn.client, tenant); } catch (error) {
      return { exitCode: 1, lines: [...lines, ...fail("anchors.read", error, "shiyan_anchor reference/recovery tables", "db/migrations/001_shiyan_anchors.sql / 002")] };
    }
    // 2. Verify the stored chain (READ ONLY on the storage DB; same checks as --verify-stored).
    let r: PersistResult;
    try {
      const conn = await deps.connect(storage.checked, "storage");
      try { r = await persistTenantSegments(conn.client, tenant, "verify", { ...options, anchors: context }); } finally { await conn.close().catch(() => undefined); }
    } catch (error) {
      return { exitCode: 1, lines: [...lines, ...fail("storage.verify", error, "shiyan.state_segments", "db/migrations/004_shiyan_state_segments.sql")] };
    }
    const c = r.stored_checks!;
    let storedFailed = r.invalid_stored.length > 0;
    const checks: string[] = [];
    for (const [n, v] of [["chain", c.chain], ["sources", c.sources], ["reconstruction", c.reconstruction], ["context", c.context]] as const) {
      if (v.errors.length) { storedFailed = true; checks.push(`FAIL stored ${n}: ${v.errors.length} error(s)`); for (const x of v.errors.slice(0, 20)) checks.push(`  ${x}`); }
      else checks.push(`PASS stored ${n}`);
    }
    for (const x of r.invalid_stored.slice(0, 20)) checks.push(`  invalid stored ${x}`);
    lines.push(`stored_segments: ${r.stored_before}`);
    lines.push(`stored_head: ${r.stored_head_after ?? "none"}`);
    lines.push(...checks);
    lines.push("context_source: anchors DB (re-derived wherever the stored chain carries context)");
    if (storedFailed) {
      lines.push("RESULT: REFUSED (stored chain does not verify; nothing anchored)");
      return { exitCode: 1, lines };
    }

    // 3. Anchors DB: compare, then (write only) insert the head in its own transaction.
    let a: AnchorResult;
    try { a = await anchorStateChainHead(anchorsConn.client, tenant, mode, r.stored_hashes); } catch (error) {
      return { exitCode: 1, lines: [...lines, ...fail(`anchors.${mode}`, error, "shiyan_anchor.state_chain_anchors", "db/migrations/005_shiyan_state_chain_anchors.sql")] };
    }
    lines.push(`anchors_before: ${a.anchors_before}`);
    for (const x of a.invalid) lines.push(`refused: ${x}`);
    lines.push(`anchor_status: ${a.invalid.length ? "invalid" : a.comparison.status}`);
    for (const x of a.comparison.mismatches.slice(0, 20)) lines.push(`  mismatch ${x}`);
    if (mode !== "verify") {
      lines.push(`${mode === "write" ? "anchored" : "would_anchor"}: ${mode === "write" ? a.inserted : a.would_insert}`);
      if (a.head && (a.inserted || a.would_insert)) lines.push(`head: seq=${a.head.seq} segment_count=${a.head.segment_count} chain_head=${a.head.chain_head}`);
      else if (!a.head) lines.push("head: none (nothing stored yet; nothing to anchor)");
    }
    const latest = a.latest_after;
    lines.push(`latest_anchor: ${latest ? `seq=${latest.seq} chain_head=${latest.chain_head} anchored_at=${latest.anchored_at}` : "none"}`);
    const coversHead = latest !== null && a.head !== null && latest.seq === a.head.seq && latest.chain_head === a.head.chain_head;
    lines.push(`covers_head: ${coversHead ? "yes" : "no"}`);

    const refused = a.invalid.length > 0 || a.comparison.status === "mismatch";
    if (mode === "verify") {
      const ok = !refused && a.comparison.status === "anchored";
      lines.push(`RESULT: ${ok ? "PASS" : a.comparison.status === "unanchored" && !refused ? "FAIL (no anchor yet)" : "FAIL"}`);
      return { exitCode: ok ? 0 : 1, lines };
    }
    lines.push(`RESULT: ${refused ? "REFUSED (anchor mismatch; nothing written)" : "PASS"}`);
    return { exitCode: refused ? 1 : 0, lines };
  } finally {
    await anchorsConn.close().catch(() => undefined);
  }
}

const isMain = (() => {
  try { return !!process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url); } catch { return false; }
})();

if (isMain) {
  runAnchorStateChain(process.argv.slice(2), process.env).then(
    ({ exitCode, lines }) => { for (const l of lines) console.log(l); process.exitCode = exitCode; },
    (error) => { console.error(`FAIL anchor-state-chain: class=${diagnosticErrorClass(error) || "unknown"}`); process.exitCode = 1; },
  );
}
