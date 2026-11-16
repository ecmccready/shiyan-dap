/** TEST ONLY. Offline check for the M2 read-only tenant source (src/core/compression/source.ts) and the local
 * CLI (scripts/compress-tenant.ts). Uses a recording mock pg client and hand-written fixture rows built here;
 * never connects to a database. The only file it touches is a fixture URL file it creates in a fresh temp dir
 * and deletes at the end. Run: npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-compression-source.ts
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  READ_ONLY_BEGIN, TENANT_ROWS_SQL, isAllowedReadOnlySql, readTenantRows, toSourceRow, type ReadOnlyClient,
} from "../src/core/compression/source";
import { FLAG, runCompressTenant, type CompressTenantDeps } from "./compress-tenant";

const sha = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");
const TENANT = "fixture-tenant";
const OTHER = "other-tenant";

type Fixture = { id: string; tenant?: string; predicted: number; observed: number; phi: number; step: number; ts: Date; source?: string };
/** A raw pg-shaped row (proof_timestamp is a Date, as node-postgres returns timestamptz). */
function pgRow(f: Fixture): Record<string, unknown> {
  const tenant = f.tenant ?? TENANT;
  const record = {
    experience_id: f.id, tenant_id: tenant, repo: "workbench:fixture-bench", commit_sha: "1.0.0",
    goal: "FIXTURE-PAYLOAD-goal", baseline: `predicted=${f.predicted}`, action: "FIXTURE-PAYLOAD-action",
    predicted_outcome: String(f.predicted), observed_outcome: String(f.observed),
    delta_e: Math.abs(f.predicted - f.observed), metrics: { transformations: 8 },
    verification: { replay_verdict: "PASS", verifier_version: "deterministic-proof-v1" },
    metamorphic: { seed: 42, transformation: JSON.stringify({ inputs: { predicted: f.predicted, observed: f.observed, phi: f.phi, step: f.step }, transformations: [] }),
      expected_relation: "fixture relation", result: ["PASS", "FAIL", "INCONCLUSIVE"][f.step % 3], converged: true },
    provenance: { source: f.source ?? "third-party-workbench", run_id: `run-${f.id}`, timestamp: f.ts.toISOString() },
    reuse_eligibility: false, z_next_action: "FIXTURE-PAYLOAD-next", data_classification: "third-party-submission", revision: 1,
  };
  const record_json = JSON.stringify(record);
  return { tenant_id: tenant, experience_id: f.id, record_json, content_sha256: sha(record_json), proof_timestamp: f.ts };
}

const id = (i: number) => `wb-${i.toString(16).padStart(32, "0")}`;
const at = (i: number) => new Date(Date.UTC(2026, 0, 1, 0, 0, 0, i * 250));
const tenantRows = Array.from({ length: 300 }, (_, i) => pgRow({
  id: id(i), predicted: i === 7 ? -0 : 1 + i / 10, observed: 1 + i / 9, phi: 1 - i / 1000, step: i, ts: at(i),
}));
const otherSourceRow = pgRow({ id: id(9001), predicted: 1, observed: 1, phi: 1, step: 0, ts: at(1), source: "internal-test" });
const foreignRow = pgRow({ id: id(9002), tenant: OTHER, predicted: 5, observed: 5, phi: 1, step: 0, ts: at(2) });
const tamperedRow = { ...pgRow({ id: id(9003), predicted: 2, observed: 2, phi: 1, step: 1, ts: at(3) }), content_sha256: "0".repeat(64) };

/** Recording mock: answers only the statements it is sent and keeps a log of every one. */
function mockClient(rows: unknown[], failOn?: string): { client: ReadOnlyClient; log: { sql: string; params?: unknown[] }[] } {
  const log: { sql: string; params?: unknown[] }[] = [];
  return {
    log,
    client: {
      async query(sql: string, params?: unknown[]) {
        log.push({ sql, params });
        if (failOn && sql.startsWith(failOn)) {
          throw Object.assign(new Error("permission denied for postgres://leaky_user:SHOULD-NOT-PRINT@db.example/x"), { code: "42501" });
        }
        return { rows: sql === TENANT_ROWS_SQL ? rows : [] };
      },
    },
  };
}
const READ_ONLY_STATEMENTS = new Set([READ_ONLY_BEGIN, TENANT_ROWS_SQL, "COMMIT", "ROLLBACK"]);
const onlyReadOnly = (log: { sql: string }[]) => log.every((q) => READ_ONLY_STATEMENTS.has(q.sql));

let checks = 0;
const check = async (name: string, fn: () => void | Promise<void>) => { await fn(); checks += 1; console.log(`PASS ${name}`); };

async function main(): Promise<void> {
const dir = mkdtempSync(join(tmpdir(), "shiyan-m2-"));
const urlFile = join(dir, "storage-url");
// Loopback, sslmode=disable fixture URL (accepted by checkDatabaseUrl only outside Vercel). Not a real credential.
const FIXTURE_PASSWORD = "fixture-pw-must-not-print";
writeFileSync(urlFile, `postgres://fixture_role:${FIXTURE_PASSWORD}@localhost:5432/fixture_db?sslmode=disable\n`);
const fileState = () => ({ mtime: statSync(urlFile).mtimeMs, sha: sha(readFileSync(urlFile, "utf8")), entries: readdirSync(dir).sort().join(",") });

try {
  await check("toSourceRow converts a pg Date to an ISO string and passes strings through", () => {
    const d = new Date(Date.UTC(2026, 10, 16, 21, 44, 5, 123));
    assert.equal(toSourceRow({ ...tenantRows[0], proof_timestamp: d }).proof_timestamp, "2026-11-16T21:44:05.123Z");
    assert.equal(toSourceRow({ ...tenantRows[0], proof_timestamp: "2026-01-01T00:00:00.000Z" }).proof_timestamp, "2026-01-01T00:00:00.000Z");
    assert.notEqual(typeof toSourceRow({ ...tenantRows[0], proof_timestamp: new Date(Number.NaN) }).proof_timestamp, "string");
    assert.notEqual(typeof toSourceRow({ ...tenantRows[0], proof_timestamp: 12345 }).proof_timestamp, "string");
    assert.notEqual(typeof toSourceRow(null).tenant_id, "string");
  });

  await check("readTenantRows sends only BEGIN READ ONLY, one tenant-scoped SELECT, COMMIT", async () => {
    const { client, log } = mockClient(tenantRows);
    const out = await readTenantRows(client, TENANT);
    assert.deepEqual(log.map((q) => q.sql), [READ_ONLY_BEGIN, TENANT_ROWS_SQL, "COMMIT"]);
    assert.deepEqual(log[1].params, [TENANT]);
    assert.match(TENANT_ROWS_SQL, /^SELECT .* FROM shiyan\.experiences WHERE tenant_id = \$1 /);
    assert.equal(out.rows.length, 300);
    assert.ok(out.rows.every((r) => typeof r.proof_timestamp === "string" && r.proof_timestamp.endsWith("Z")));
  });

  await check("other tenants' rows never appear (dropped and counted even if the DB returns them)", async () => {
    const { client } = mockClient([...tenantRows.slice(0, 5), foreignRow]);
    const out = await readTenantRows(client, TENANT);
    assert.equal(out.foreign_dropped, 1);
    assert.equal(out.rows.length, 5);
    assert.ok(out.rows.every((r) => r.tenant_id === TENANT));
    assert.ok(!JSON.stringify(out.rows).includes(OTHER));
  });

  await check("errors roll back, rethrow, and still send only read-only statements", async () => {
    const { client, log } = mockClient(tenantRows, "SELECT");
    await assert.rejects(readTenantRows(client, TENANT), /permission denied/);
    assert.deepEqual(log.map((q) => q.sql), [READ_ONLY_BEGIN, TENANT_ROWS_SQL, "ROLLBACK"]);
  });

  await check("invalid tenant is refused before any statement is sent", async () => {
    for (const bad of ["", "UPPER", "a b", "../x", "x".repeat(41)]) {
      const { client, log } = mockClient(tenantRows);
      await assert.rejects(readTenantRows(client, bad), /TENANT_ID_PATTERN/);
      assert.equal(log.length, 0);
    }
  });

  await check("statement allowlist refuses anything but the four read-only statements", () => {
    for (const ok of READ_ONLY_STATEMENTS) assert.ok(isAllowedReadOnlySql(ok));
    for (const bad of ["BEGIN", "SET TRANSACTION READ WRITE", "insert into shiyan.experiences values (1)", `${TENANT_ROWS_SQL}; DROP TABLE x`,
      "SELECT 1", "select tenant_id from shiyan.experiences"]) assert.ok(!isAllowedReadOnlySql(bad), bad);
  });

  // ---------- CLI ----------
  const spyDeps = (rows: unknown[], failOn?: string) => {
    const mock = mockClient(rows, failOn);
    const calls = { read: 0, connect: 0, close: 0 };
    const deps: CompressTenantDeps = {
      readTextFile: (p) => { calls.read += 1; return readFileSync(p, "utf8"); },
      connect: async () => { calls.connect += 1; return { client: mock.client, close: async () => { calls.close += 1; } }; },
      home: () => dir,
    };
    return { deps, calls, log: mock.log };
  };
  const argv = ["--tenant", TENANT, "--storage-file", urlFile];
  const ON = { [FLAG]: "1" };
  const leaks = (text: string) => [FIXTURE_PASSWORD, "fixture_role", "localhost", "postgres://", "fixture_db", "FIXTURE-PAYLOAD",
    "record_json", "wb-", "run-wb", OTHER, "SHOULD-NOT-PRINT", "leaky_user", "permission denied", "third-party-workbench"].filter((s) => text.includes(s));

  await check("CLI is off by default: refuses without the flag and reads nothing", async () => {
    for (const env of [{}, { [FLAG]: "0" }, { [FLAG]: "true" }, { [FLAG]: "" }]) {
      const { deps, calls, log } = spyDeps(tenantRows);
      const out = await runCompressTenant(argv, env, deps);
      assert.equal(out.exitCode, 2);
      assert.match(out.lines.join("\n"), /^REFUSED: .*SHIYAN_STATE_COMPRESSION=1/);
      assert.deepEqual(calls, { read: 0, connect: 0, close: 0 });
      assert.equal(log.length, 0);
    }
  });

  await check("CLI usage errors: missing/invalid tenant, missing URL source", async () => {
    const { deps, calls } = spyDeps(tenantRows);
    assert.equal((await runCompressTenant(["--storage-file", urlFile], ON, deps)).exitCode, 2);
    assert.equal((await runCompressTenant(["--tenant", "Bad Tenant", "--storage-file", urlFile], ON, deps)).exitCode, 2);
    assert.equal((await runCompressTenant(["--tenant", TENANT], ON, deps)).exitCode, 2);
    assert.equal(calls.connect, 0);
  });

  const before = fileState();
  let passOutput = "";
  await check("CLI compresses and verifies one tenant: PASS, chain root, counts, exclusions", async () => {
    const { deps, calls, log } = spyDeps([...tenantRows, otherSourceRow, foreignRow, tamperedRow]);
    const out = await runCompressTenant(argv, ON, deps);
    passOutput = out.lines.join("\n");
    assert.equal(out.exitCode, 0, passOutput);
    assert.match(passOutput, /^rows_read: 302$/m);
    assert.match(passOutput, /^foreign_rows_dropped: 1$/m);
    assert.match(passOutput, /^points_included: 300$/m);
    assert.match(passOutput, /^excluded: 2 \(hash_mismatch=1, not_third_party_workbench=1\)$/m);
    assert.match(passOutput, /^segments: 2 {2}pending: 0$/m);
    assert.match(passOutput, /^segment 0: count=256 closed_by=full sha256=[0-9a-f]{64} source_ids_root=[0-9a-f]{64}$/m);
    assert.match(passOutput, /^segment 1: count=44 closed_by=cutoff sha256=[0-9a-f]{64} /m);
    assert.match(passOutput, /^chain_root: [0-9a-f]{64}$/m);
    for (const c of ["chain", "recompute", "sources", "lossless", "context"]) assert.match(passOutput, new RegExp(`^PASS ${c}$`, "m"));
    assert.match(passOutput, /^RESULT: PASS$/m);
    assert.deepEqual(calls, { read: 1, connect: 1, close: 1 });
    assert.ok(onlyReadOnly(log), "mock pg client received a non-read-only statement");
    assert.deepEqual(log.map((q) => q.sql), [READ_ONLY_BEGIN, TENANT_ROWS_SQL, "COMMIT"]);
  });

  await check("CLI output contains no payloads, ids, URL, role, host or password", () => {
    assert.deepEqual(leaks(passOutput), []);
    for (const line of passOutput.split("\n")) {
      assert.ok(/^[A-Za-z0-9_ :=(),.\-]*$/.test(line), `unexpected characters in output line: ${line.slice(0, 40)}`);
    }
  });

  await check("CLI is deterministic: same rows in any order give the same chain root", async () => {
    const { deps } = spyDeps([...tenantRows].reverse());
    const out = (await runCompressTenant(argv, ON, deps)).lines.join("\n");
    const root = (t: string) => t.match(/^chain_root: (\S+)$/m)?.[1];
    assert.ok(root(passOutput));
    assert.equal(root(out), root(passOutput));
  });

  await check("--full-windows-only leaves the partial window pending", async () => {
    const { deps } = spyDeps(tenantRows);
    const out = await runCompressTenant([...argv, "--full-windows-only"], ON, deps);
    assert.equal(out.exitCode, 0);
    assert.match(out.lines.join("\n"), /^segments: 1 {2}pending: 44$/m);
  });

  await check("CLI read failure prints only error class/code, rolls back, exits 1", async () => {
    const { deps, calls, log } = spyDeps(tenantRows, "SELECT");
    const out = await runCompressTenant(argv, ON, deps);
    const text = out.lines.join("\n");
    assert.equal(out.exitCode, 1);
    assert.match(text, /^FAIL storage\.read: class=\S+ code=42501$/);
    assert.deepEqual(leaks(text), []);
    assert.equal(calls.close, 1);
    assert.deepEqual(log.map((q) => q.sql), [READ_ONLY_BEGIN, TENANT_ROWS_SQL, "ROLLBACK"]);
  });

  await check("CLI rejects a non-TLS remote URL without echoing it", async () => {
    const bad = join(dir, "bad-url");
    writeFileSync(bad, `postgres://fixture_role:${FIXTURE_PASSWORD}@db.example.com/fixture_db\n`);
    const { deps, calls } = spyDeps(tenantRows);
    const out = await runCompressTenant(["--tenant", TENANT, "--storage-file", bad], ON, deps);
    rmSync(bad);
    assert.equal(out.exitCode, 1);
    assert.match(out.lines.join("\n"), /^FAIL storage\.url: must set sslmode/);
    assert.deepEqual(leaks(out.lines.join("\n")), []);
    assert.equal(calls.connect, 0);
  });

  await check("no-write guarantee: storage file mtime, hash and temp dir contents unchanged", () => {
    assert.deepEqual(fileState(), before);
  });
} finally {
  rmSync(dir, { recursive: true, force: true });
}
assert.ok(!statSafe(dir), "temp dir was not removed");
console.log(`PASS check-compression-source (${checks} checks)`);
}
function statSafe(p: string) { try { return statSync(p); } catch { return null; } }

main().catch((error) => { console.error(error); process.exit(1); });
