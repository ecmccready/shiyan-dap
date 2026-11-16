/** TEST ONLY. Offline check for M4 of the 4D state compression engine: migration 004 text, schema-guard
 * expectations for the staged table, the append-only writer (store.ts) and the persist CLI. Uses an in-memory
 * fake of the storage DB that answers only the exact allowlisted statements (and emulates the PK, the
 * sha256 CHECK and the link trigger). Hand-written fixtures built here; never connects to a database. The only
 * files touched are fixture URL files in a fresh temp dir, deleted at the end.
 * Run: npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-compression-m4.ts
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildTenantChain, type AnchorSource } from "../src/core/compression";
import { READ_ONLY_BEGIN, TENANT_ROWS_SQL, TENANT_RECOVERY_RECORDS_SQL, TENANT_REFERENCE_ANCHORS_SQL, toSourceRow, type ReadOnlyClient } from "../src/core/compression/source";
import {
  INSERT_SEGMENT_SQL, STORED_SEGMENTS_SQL, TENANT_LOCK_SQL, WRITE_BEGIN, isAllowedStoreSql, parseStoredRow, persistTenantSegments,
} from "../src/core/compression/store";
import {
  STAGED_STORAGE_COLUMNS, STAGED_STORAGE_TRIGGERS, compareColumns, compareTriggers, decodeTgType, stagedTableMissing,
} from "../src/core/schema-guard";
import { FLAG, type CompressTenantDeps } from "./compress-tenant";
import { runPersistTenant } from "./persist-tenant-segments";

const sha = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");
const H = 3_600_000, MIN = 60_000;
const T0 = Date.UTC(2026, 5, 1);
const A = "tenant-a", B = "tenant-b";
const fid = (i: number) => `wb-${i.toString(16).padStart(32, "0")}`;

/** One pg-shaped shiyan.experiences row (fixture). */
function pgRow(i: number, tMs: number, arrMs: number, tenant = A): Record<string, unknown> {
  const id = fid(i);
  const inputs = { predicted: 1 + i / 10, observed: 1 + i / 9, phi: 1 - i / 1000, step: i };
  const record = {
    experience_id: id, tenant_id: tenant, repo: "workbench:fixture-bench", commit_sha: "1.0.0",
    goal: "FIXTURE-PAYLOAD-goal", baseline: `predicted=${inputs.predicted}`, action: "FIXTURE-PAYLOAD-action",
    predicted_outcome: String(inputs.predicted), observed_outcome: String(inputs.observed),
    delta_e: Math.abs(inputs.predicted - inputs.observed), metrics: { transformations: 8 },
    verification: { replay_verdict: "PASS", verifier_version: "deterministic-proof-v1" },
    metamorphic: { seed: 42, transformation: JSON.stringify({ inputs, transformations: [] }), expected_relation: "fixture relation",
      result: ["PASS", "FAIL", "INCONCLUSIVE"][i % 3], converged: true },
    provenance: { source: "third-party-workbench", run_id: `run-${id}`, timestamp: new Date(tMs).toISOString() },
    reuse_eligibility: false, z_next_action: "FIXTURE-PAYLOAD-next", data_classification: "third-party-submission", revision: 1,
  };
  const record_json = JSON.stringify(record);
  return { tenant_id: tenant, experience_id: id, record_json, content_sha256: sha(record_json), proof_timestamp: new Date(tMs), created_at: new Date(arrMs) };
}

type Row = Record<string, unknown>;
/** In-memory storage DB fake: exact statements only, transactional inserts, PK + sha CHECK + link trigger emulated. */
class FakeStorage {
  experiences: Row[] = [];
  segments: Row[] = [];
  log: { sql: string; params?: unknown[] }[] = [];
  failOn: { sql: string; code: string } | null = null;
  private buffer: Row[] | null = null;
  private visible(tenant: string) { return [...this.segments, ...(this.buffer ?? [])].filter((r) => r.tenant_id === tenant).sort((a, b) => (a.seq as number) - (b.seq as number)); }
  client(): ReadOnlyClient {
    return {
      query: async (sql: string, params?: unknown[]) => {
        this.log.push({ sql, params });
        if (this.failOn && sql === this.failOn.sql) throw Object.assign(new Error(`boom postgres://leak:LEAKED-SECRET@h/d`), { code: this.failOn.code });
        if (sql === WRITE_BEGIN || sql === READ_ONLY_BEGIN) { this.buffer = []; return { rows: [] }; }
        if (sql === "COMMIT") { this.segments.push(...(this.buffer ?? [])); this.buffer = null; return { rows: [] }; }
        if (sql === "ROLLBACK") { this.buffer = null; return { rows: [] }; }
        if (sql === TENANT_LOCK_SQL) return { rows: [{ pg_advisory_xact_lock: "" }] };
        if (sql === TENANT_ROWS_SQL) return { rows: this.experiences.filter((r) => r.tenant_id === params?.[0]) };
        if (sql === STORED_SEGMENTS_SQL) {
          return { rows: this.visible(String(params?.[0])).map((r) => ({ ...r, cutoff_ms: r.cutoff_ms === null ? null : String(r.cutoff_ms), grace_ms: String(r.grace_ms) })) };
        }
        if (sql === INSERT_SEGMENT_SQL) {
          const p = params ?? [];
          const row: Row = {
            tenant_id: p[0], seq: p[1], segment_sha256: p[2], prev_segment_sha256: p[3], segment_json: p[4], point_count: p[5], source_ids: p[6],
            window_opened_at: p[7], window_closed_at: p[8], closed_by: p[9], segment_size: p[10], cutoff_ms: p[11], grace_ms: p[12], loss_mode: p[13],
            eps_predicted: p[14], eps_observed: p[15], eps_phi: p[16], context_sha256: p[17],
          };
          if (this.buffer === null) throw new Error("insert outside a transaction");
          if (sha(String(row.segment_json)) !== row.segment_sha256) throw Object.assign(new Error("check"), { code: "23514" });
          const mine = this.visible(String(row.tenant_id));
          if (mine.some((r) => r.seq === row.seq)) throw Object.assign(new Error("dup"), { code: "23505" });
          const prev = mine.find((r) => r.seq === (row.seq as number) - 1);
          if ((row.seq === 0) !== (row.prev_segment_sha256 === null) || (row.seq !== 0 && prev?.segment_sha256 !== row.prev_segment_sha256)) {
            throw Object.assign(new Error("link"), { code: "23503" });
          }
          this.buffer.push(row);
          return { rows: [] };
        }
        throw new Error(`fake storage: unexpected statement ${sql.slice(0, 30)}`);
      },
    };
  }
  sqlKinds() { return this.log.map((q) => q.sql === TENANT_ROWS_SQL ? "SELECT experiences" : q.sql === STORED_SEGMENTS_SQL ? "SELECT segments" : q.sql === INSERT_SEGMENT_SQL ? "INSERT" : q.sql === TENANT_LOCK_SQL ? "LOCK" : q.sql); }
}

let checks = 0;
const check = async (name: string, fn: () => void | Promise<void>) => { await fn(); checks += 1; console.log(`PASS ${name}`); };

async function main(): Promise<void> {
  // ---------- Migration 004 text ----------
  const sql = readFileSync(join(import.meta.dirname, "..", "db", "migrations", "004_shiyan_state_segments.sql"), "utf8");
  const code = sql.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  await check("migration 004: table, triggers, grants, idempotent, no destructive statements", () => {
    assert.match(code, /CREATE TABLE IF NOT EXISTS shiyan\.state_segments \(/);
    assert.match(code, /PRIMARY KEY \(tenant_id, seq\)/);
    assert.match(code, /CREATE OR REPLACE TRIGGER state_segments_no_update_delete\s+BEFORE UPDATE OR DELETE ON shiyan\.state_segments\s+FOR EACH ROW EXECUTE FUNCTION shiyan\.reject_mutation\(\);/);
    assert.match(code, /CREATE OR REPLACE TRIGGER state_segments_no_truncate\s+BEFORE TRUNCATE ON shiyan\.state_segments\s+FOR EACH STATEMENT EXECUTE FUNCTION shiyan\.reject_mutation\(\);/);
    assert.match(code, /CREATE OR REPLACE TRIGGER state_segments_link_check\s+BEFORE INSERT ON shiyan\.state_segments\s+FOR EACH ROW EXECUTE FUNCTION shiyan\.state_segments_link_check\(\);/);
    assert.match(code, /s\.seq = NEW\.seq - 1 AND s\.segment_sha256 = NEW\.prev_segment_sha256/);
    assert.match(code, /CONSTRAINT state_segments_sha256_matches CHECK \(segment_sha256 = encode\(sha256\(convert_to\(segment_json, 'UTF8'\)\), 'hex'\)\)/);
    assert.match(code, /GRANT SELECT, INSERT ON shiyan\.state_segments TO shiyan_app;/);
    assert.match(code, /REVOKE ALL ON shiyan\.state_segments FROM PUBLIC;/);
    const grants = [...code.matchAll(/GRANT ([^;]+?) ON/g)].map((m) => m[1]);
    for (const g of grants) assert.ok(!/UPDATE|DELETE|TRUNCATE|ALL/.test(g), `unexpected grant: ${g}`);
    assert.ok(!/\b(DROP|DELETE FROM|TRUNCATE (TABLE )?shiyan|ALTER TABLE|UPDATE shiyan|INSERT INTO)\b/.test(code), "no destructive or data statements");
    assert.ok(!/^\\/m.test(sql), "plain SQL, no psql meta-commands (Neon SQL Editor)");
    assert.ok(!/password|secret/i.test(code), "no secrets");
    assert.match(code, /^BEGIN;/m); assert.match(code, /^COMMIT;\s*$/m);
    assert.ok(!/CREATE TABLE (?!IF NOT EXISTS)/.test(code) && !/CREATE INDEX (?!IF NOT EXISTS)/.test(code), "idempotent creates");
  });
  await check("migration 004 columns match the schema-guard expectation exactly", () => {
    const body = code.slice(code.indexOf("CREATE TABLE IF NOT EXISTS shiyan.state_segments"), code.indexOf("PRIMARY KEY (tenant_id, seq)"));
    const cols = [...body.matchAll(/^\s{2}([a-z_0-9]+)\s+(text\[\]|text|integer|bigint|timestamptz|double precision)(?=[\s,])/gm)].map((m) => ({ name: m[1], dataType: m[2] === "text[]" ? "array" : m[2] }));
    assert.deepEqual(cols, [...STAGED_STORAGE_COLUMNS.state_segments]);
  });
  await check("schema guard: staged table is SKIP while absent, FAIL if required, and matches 004's real catalog shape", () => {
    assert.deepEqual(stagedTableMissing("storage.state_segments", "db/migrations/004_shiyan_state_segments.sql", false),
      { name: "storage.state_segments", ok: true, detail: "SKIP: pending db/migrations/004_shiyan_state_segments.sql (not applied yet)" });
    assert.equal(stagedTableMissing("storage.state_segments", "x", true).ok, false);
    // information_schema / pg_trigger values as PostgreSQL 17 reports them for 004 (observed by applying it to a scratch instance).
    const info = STAGED_STORAGE_COLUMNS.state_segments.map((c) => ({ name: c.name, dataType: c.dataType === "array" ? "ARRAY" : c.dataType === "timestamptz" ? "timestamp with time zone" : c.dataType }));
    assert.equal(compareColumns("storage.state_segments", info, STAGED_STORAGE_COLUMNS.state_segments).ok, true);
    const real = [["state_segments_link_check", "state_segments_link_check", 7], ["state_segments_no_truncate", "reject_mutation", 34], ["state_segments_no_update_delete", "reject_mutation", 27]] as const;
    const actual = real.map(([name, fn, t]) => ({ name, table: "state_segments", functionName: fn, ...decodeTgType(t) }));
    assert.equal(compareTriggers("storage.state_segments", actual, STAGED_STORAGE_TRIGGERS.state_segments).ok, true);
    assert.equal(compareTriggers("storage.state_segments", actual.slice(1), STAGED_STORAGE_TRIGGERS.state_segments).ok, false, "missing link trigger fails");
  });

  // ---------- Writer ----------
  const day1 = [0, 1, 2, 3].map((i) => pgRow(i, T0 + i * MIN, T0 + i * MIN));
  const day2 = [4, 5, 6].map((i) => pgRow(i, T0 + 30 * H + i * MIN, T0 + 30 * H + i * MIN));
  const opts = (asOfMs: number) => ({ asOfMs });
  const sealedBoth = T0 + 55 * H;

  await check("statement allowlist: write = BEGIN, lock, SELECTs, INSERT into state_segments, COMMIT/ROLLBACK; read modes cannot INSERT", () => {
    for (const s of [WRITE_BEGIN, TENANT_LOCK_SQL, TENANT_ROWS_SQL, STORED_SEGMENTS_SQL, INSERT_SEGMENT_SQL, "COMMIT", "ROLLBACK"]) assert.ok(isAllowedStoreSql(s, "write"), s);
    for (const m of ["dry-run", "verify"] as const) {
      assert.ok(!isAllowedStoreSql(INSERT_SEGMENT_SQL, m)); assert.ok(!isAllowedStoreSql(WRITE_BEGIN, m)); assert.ok(!isAllowedStoreSql(TENANT_LOCK_SQL, m));
      assert.ok(isAllowedStoreSql(READ_ONLY_BEGIN, m));
    }
    assert.ok(!isAllowedStoreSql(READ_ONLY_BEGIN, "write"));
    for (const bad of ["UPDATE shiyan.state_segments SET seq = 1", "DELETE FROM shiyan.state_segments", "INSERT INTO shiyan.experiences VALUES (1)", `${INSERT_SEGMENT_SQL}; SELECT 1`]) {
      assert.ok(!isAllowedStoreSql(bad, "write"), bad);
    }
    assert.match(INSERT_SEGMENT_SQL, /^INSERT INTO shiyan\.state_segments \([a-z_0-9, ]+\) VALUES \(\$1(, \$\d+)*\)$/);
    assert.match(STORED_SEGMENTS_SQL, /^SELECT [a-z_0-9, ]+ FROM shiyan\.state_segments WHERE tenant_id = \$1 ORDER BY seq$/);
  });
  await check("dry run inserts nothing and runs READ ONLY", async () => {
    const db = new FakeStorage(); db.experiences = [...day1, ...day2];
    const r = await persistTenantSegments(db.client(), A, "dry-run", opts(sealedBoth));
    assert.equal(r.appended, 2); assert.equal(r.inserted, 0); assert.equal(db.segments.length, 0);
    assert.deepEqual(db.sqlKinds(), [READ_ONLY_BEGIN, "SELECT experiences", "SELECT segments", "COMMIT"]);
  });
  await check("write inserts only sealed segments (pending window never), under the tenant lock; equals the M3 chain", async () => {
    const db = new FakeStorage(); db.experiences = [...day1, ...day2];
    const asOf = T0 + 30 * H + 60 * MIN; // window 1 sealed; window 2 open
    const r = await persistTenantSegments(db.client(), A, "write", opts(asOf));
    assert.equal(r.inserted, 1); assert.equal(db.segments.length, 1); assert.equal(r.extension.pending, 3);
    assert.deepEqual(db.sqlKinds(), [WRITE_BEGIN, "LOCK", "SELECT experiences", "SELECT segments", "INSERT", "SELECT segments", "COMMIT"]);
    assert.deepEqual(db.log[1].params, [A]);
    const m3 = buildTenantChain(A, [...day1, ...day2].map(toSourceRow), opts(asOf));
    assert.equal(db.segments[0].segment_sha256, m3.segments[0].segment_sha256, "first persisted chain = M3 chain");
    assert.deepEqual(db.segments[0].source_ids, day1.map((r) => r.experience_id));
    assert.equal(db.segments[0].closed_by, "cutoff"); assert.equal(db.segments[0].cutoff_ms, 24 * H); assert.equal(db.segments[0].loss_mode, "lossless");
    const parsed = parseStoredRow({ ...db.segments[0], grace_ms: String(db.segments[0].grace_ms), cutoff_ms: String(db.segments[0].cutoff_ms) }, A);
    assert.ok(parsed.ok, parsed.ok ? "" : parsed.reason);
  });
  await check("rerun is idempotent (0 inserted, no INSERT sent); later run appends only the newly sealed window", async () => {
    const db = new FakeStorage(); db.experiences = [...day1, ...day2];
    await persistTenantSegments(db.client(), A, "write", opts(T0 + 30 * H + 60 * MIN));
    db.log = [];
    const again = await persistTenantSegments(db.client(), A, "write", opts(T0 + 30 * H + 61 * MIN));
    assert.equal(again.inserted, 0); assert.ok(!db.sqlKinds().includes("INSERT")); assert.equal(db.segments.length, 1);
    const later = await persistTenantSegments(db.client(), A, "write", opts(sealedBoth));
    assert.equal(later.inserted, 1); assert.equal(db.segments.length, 2);
    assert.equal(db.segments[1].prev_segment_sha256, db.segments[0].segment_sha256);
    const third = await persistTenantSegments(db.client(), A, "write", opts(sealedBoth + H));
    assert.equal(third.inserted, 0);
  });
  await check("late commit never alters stored segments: it goes to the next window; verify-stored passes", async () => {
    const db = new FakeStorage(); db.experiences = [...day1];
    const t1 = T0 + 24 * H + 11 * MIN;
    await persistTenantSegments(db.client(), A, "write", opts(t1));
    const storedHash = db.segments[0].segment_sha256;
    // A run timestamped (and DB-arrived) inside window 1 but only committed/visible after window 1 was stored.
    const lateCommit = pgRow(40, T0 + 5 * MIN, T0 + 5 * MIN);
    const lateT = pgRow(41, T0 - H, T0 + 26 * H);
    db.experiences.push(lateCommit, lateT);
    const t2 = T0 + 50 * H + 11 * MIN;
    const r = await persistTenantSegments(db.client(), A, "write", opts(t2));
    assert.equal(r.extension.refused.length, 0, r.extension.refused.join("; "));
    assert.equal(db.segments[0].segment_sha256, storedHash, "stored window 1 unchanged");
    assert.equal(r.inserted, 1);
    assert.deepEqual([...(db.segments[1].source_ids as string[])].sort(), [lateCommit.experience_id, lateT.experience_id].sort());
    assert.equal(r.extension.late, 1, "lateT has t before window 1; lateCommit is late by arrival, not by t");
    const v = await persistTenantSegments(db.client(), A, "verify", opts(t2));
    for (const [k, c] of Object.entries(v.stored_checks!)) assert.ok(c.ok, `${k}: ${c.errors.join("; ")}`);
    assert.equal(v.from_scratch_prefix, false, "from scratch, the late commit would have joined window 1");
  });
  await check("stored-prefix mismatch refuses and writes nothing (options differ, tampered row, missing source row)", async () => {
    const db = new FakeStorage(); db.experiences = [...day1, ...day2];
    await persistTenantSegments(db.client(), A, "write", opts(T0 + 30 * H + 60 * MIN));
    for (const [why, o] of [["cutoff", { asOfMs: sealedBoth, cutoffMs: 12 * H }], ["loss", { asOfMs: sealedBoth, loss: { mode: "bounded" as const, eps: { predicted: 0.1, observed: 0.1, phi: 0.1 } } }],
      ["context", { asOfMs: sealedBoth, anchors: { references: [], recoveries: [] } as AnchorSource }]] as const) {
      db.log = [];
      const r = await persistTenantSegments(db.client(), A, "write", o);
      assert.ok(r.extension.refused.length > 0, why); assert.equal(r.inserted, 0); assert.equal(db.segments.length, 1);
      assert.ok(!db.sqlKinds().includes("INSERT")); assert.equal(db.log.at(-1)?.sql, "ROLLBACK");
    }
    const saved = db.segments[0];
    db.segments[0] = { ...saved, source_ids: [...(saved.source_ids as string[])].reverse() };
    let r = await persistTenantSegments(db.client(), A, "write", opts(sealedBoth));
    assert.ok(r.extension.refused.length > 0); assert.equal(db.segments.length, 1);
    db.segments[0] = { ...saved, context_sha256: "0".repeat(64) };
    r = await persistTenantSegments(db.client(), A, "write", opts(sealedBoth));
    assert.ok(r.extension.refused.length > 0);
    db.segments[0] = { ...saved, segment_json: String(saved.segment_json).replace('"seq":0', '"seq":0 ') };
    r = await persistTenantSegments(db.client(), A, "write", opts(sealedBoth));
    assert.ok(r.invalid_stored.length > 0 && r.extension.refused.length > 0);
    db.segments[0] = saved;
    db.experiences = db.experiences.filter((x) => x.experience_id !== fid(2));
    r = await persistTenantSegments(db.client(), A, "write", opts(sealedBoth));
    assert.ok(r.extension.refused.some((x) => /stored sources/.test(x))); assert.equal(db.segments.length, 1);
  });
  await check("tenant isolation: tenant A's run never reads, inserts or links tenant B's rows", async () => {
    const db = new FakeStorage();
    db.experiences = [...day1, ...[0, 1].map((i) => pgRow(100 + i, T0 + i * MIN, T0 + i * MIN, B))];
    await persistTenantSegments(db.client(), B, "write", opts(sealedBoth));
    const bHash = db.segments[0].segment_sha256;
    db.log = [];
    const r = await persistTenantSegments(db.client(), A, "write", opts(sealedBoth));
    assert.equal(r.inserted, 1); assert.equal(r.stored_before, 0, "B's segments are not A's chain");
    assert.ok(db.log.filter((q) => q.params).every((q) => q.params![0] === A));
    assert.equal(db.segments.find((x) => x.tenant_id === A)?.seq, 0);
    assert.equal(db.segments.find((x) => x.tenant_id === B)?.segment_sha256, bHash);
    // A DB that wrongly returns another tenant's stored row is refused, not merged.
    const leaky = new FakeStorage(); leaky.experiences = [...day1];
    leaky.segments = [{ ...db.segments.find((x) => x.tenant_id === B)! }];
    const c = leaky.client();
    const spy: ReadOnlyClient = { query: (s, p) => (s === STORED_SEGMENTS_SQL ? c.query(s, [B]) : c.query(s, p)) };
    const rr = await persistTenantSegments(spy, A, "write", opts(sealedBoth));
    assert.ok(rr.invalid_stored.some((x) => /another tenant/.test(x))); assert.equal(rr.inserted, 0);
  });
  await check("concurrent append (PK conflict) rolls back, inserts nothing, and rethrows", async () => {
    const db = new FakeStorage(); db.experiences = [...day1];
    db.failOn = { sql: INSERT_SEGMENT_SQL, code: "23505" };
    await assert.rejects(persistTenantSegments(db.client(), A, "write", opts(sealedBoth)), /boom/);
    assert.equal(db.segments.length, 0); assert.equal(db.log.at(-1)?.sql, "ROLLBACK");
  });
  await check("bounded and context chains persist and verify with their stored parameters", async () => {
    const db = new FakeStorage(); db.experiences = [...day1, ...day2];
    const anchors: AnchorSource = { references: [{ reference_id: `ref-${"1".padStart(32, "0")}`, commit_sha: "a".repeat(40), snapshot_sha256: sha("s"), envelope_sha256: sha("e"), created_at: new Date(T0 - H).toISOString() }],
      recoveries: [{ run_id: `run-${fid(1)}`, status: "PROMOTED", record_sha256: sha("r1"), created_at: new Date(T0 + H).toISOString() }] };
    const o = { asOfMs: sealedBoth, loss: { mode: "bounded" as const, eps: { predicted: 1e-3, observed: 1e-3, phi: 1e-4 } }, anchors };
    const w = await persistTenantSegments(db.client(), A, "write", o);
    assert.equal(w.inserted, 2); assert.equal(db.segments[0].loss_mode, "bounded"); assert.equal(db.segments[0].eps_phi, 1e-4);
    assert.match(String(db.segments[0].context_sha256), /^[0-9a-f]{64}$/);
    const v = await persistTenantSegments(db.client(), A, "verify", { asOfMs: sealedBoth, anchors });
    for (const [k, c] of Object.entries(v.stored_checks!)) assert.ok(c.ok, `${k}: ${c.errors.join("; ")}`);
    assert.equal(v.from_scratch_prefix, true);
    const noAnchors = await persistTenantSegments(db.client(), A, "verify", { asOfMs: sealedBoth });
    assert.ok(Object.values(noAnchors.stored_checks!).every((c) => c.ok)); assert.equal(noAnchors.from_scratch_prefix, undefined);
  });

  // ---------- CLI ----------
  const dir = mkdtempSync(join(tmpdir(), "shiyan-m4-"));
  try {
    const PW = "fixture-pw-must-not-print";
    const storageFile = join(dir, "storage-url"), anchorFile = join(dir, "anchor-url");
    writeFileSync(storageFile, `postgres://fixture_role:${PW}@localhost:5432/fixture_db?sslmode=disable\n`);
    writeFileSync(anchorFile, `postgres://fixture_anchor:${PW}@127.0.0.1:5432/fixture_anchor_db?sslmode=disable\n`);
    const snap = () => readdirSync(dir).sort().map((n) => `${n}:${statSync(join(dir, n)).mtimeMs}:${sha(readFileSync(join(dir, n), "utf8"))}`).join("|");
    const before = snap();
    const db = new FakeStorage(); db.experiences = [...day1, ...day2];
    const anchorLog: string[] = [];
    const calls: string[] = [];
    const deps: CompressTenantDeps = {
      readTextFile: (p) => readFileSync(p, "utf8"),
      connect: async (_c, purpose) => {
        calls.push(purpose);
        const client: ReadOnlyClient = purpose === "storage" ? db.client() : { query: async (s) => { anchorLog.push(s); return { rows: [] }; } };
        return { client, close: async () => undefined };
      },
      home: () => dir,
      now: () => sealedBoth,
    };
    const base = ["--tenant", A, "--storage-file", storageFile];
    const ON = { [FLAG]: "1" };
    const run = async (argv: string[], env: Record<string, string> = ON) => { const o = await runPersistTenant(argv, env, deps); return { ...o, text: o.lines.join("\n") }; };
    const leaks = (t: string) => [PW, "fixture_role", "localhost", "postgres://", "FIXTURE-PAYLOAD", "wb-", "run-", "LEAKED-SECRET", "boom", "segment_json"].filter((x) => t.includes(x));

    await check("CLI gate: refuses without the flag (even with --write) and reads nothing", async () => {
      for (const env of [{}, { [FLAG]: "0" }] as Record<string, string>[]) {
        const o = await run([...base, "--write"], env);
        assert.equal(o.exitCode, 2); assert.match(o.text, /^REFUSED: .*SHIYAN_STATE_COMPRESSION=1/);
      }
      assert.deepEqual(calls, []); assert.equal(db.log.length, 0);
      const both = await run([...base, "--write", "--verify-stored"]);
      assert.equal(both.exitCode, 2); assert.deepEqual(calls, []);
    });
    await check("CLI without --write is a dry run: prints would_append, writes nothing", async () => {
      const o = await run(base);
      assert.equal(o.exitCode, 0, o.text);
      assert.match(o.text, /^state-compression M4: dry-run \(READ ONLY, nothing written\)$/m);
      assert.match(o.text, /^would_append: 2$/m);
      assert.match(o.text, /^segment 0: count=4 closed_by=cutoff sha256=[0-9a-f]{64}$/m);
      assert.equal(db.segments.length, 0); assert.ok(!db.sqlKinds().includes("INSERT"));
      assert.deepEqual(leaks(o.text), []);
    });
    await check("CLI --write appends; rerun appends 0; verify-stored PASS (read-only)", async () => {
      const w = await run([...base, "--write"]);
      assert.equal(w.exitCode, 0, w.text); assert.match(w.text, /^appended: 2$/m); assert.equal(db.segments.length, 2);
      const head = w.text.match(/^chain_head: ([0-9a-f]{64})$/m)?.[1];
      assert.equal(head, db.segments[1].segment_sha256);
      const again = await run([...base, "--write"]);
      assert.equal(again.exitCode, 0); assert.match(again.text, /^appended: 0$/m); assert.equal(db.segments.length, 2);
      db.log = [];
      const v = await run([...base, "--verify-stored"]);
      assert.equal(v.exitCode, 0, v.text);
      for (const c of ["chain", "sources", "reconstruction", "context"]) assert.match(v.text, new RegExp(`^PASS stored ${c}$`, "m"));
      assert.match(v.text, /^from_scratch_prefix: yes$/m); assert.match(v.text, /^RESULT: PASS$/m);
      assert.ok(!db.sqlKinds().includes("INSERT")); assert.equal(db.log[0].sql, READ_ONLY_BEGIN);
      for (const t of [w.text, again.text, v.text]) assert.deepEqual(leaks(t), []);
      assert.ok([w.text, v.text].every((t) => t.split("\n").every((l) => /^[A-Za-z0-9_ :=(),.\-]*$/.test(l))));
    });
    await check("CLI refuses an append whose options differ from the stored chain (exit 1, nothing written)", async () => {
      const o = await run([...base, "--write", "--anchor-file", anchorFile]);
      assert.equal(o.exitCode, 1); assert.match(o.text, /^RESULT: REFUSED \(nothing written\)$/m); assert.equal(db.segments.length, 2);
      assert.deepEqual(anchorLog, [READ_ONLY_BEGIN, TENANT_REFERENCE_ANCHORS_SQL, TENANT_RECOVERY_RECORDS_SQL, "COMMIT"]);
      const tampered = new FakeStorage(); tampered.experiences = db.experiences; tampered.segments = db.segments.map((r, i) => (i === 1 ? { ...r, context_sha256: "f".repeat(64) } : r));
      const v = await runPersistTenant([...base, "--verify-stored"], ON, { ...deps, connect: async () => ({ client: tampered.client(), close: async () => undefined }) });
      assert.equal(v.exitCode, 1); assert.match(v.lines.join("\n"), /^FAIL stored context: 1 error\(s\)$/m);
    });
    await check("CLI: missing table (42P01) gives a migration hint and no error text", async () => {
      const missing = new FakeStorage(); missing.experiences = [...day1]; missing.failOn = { sql: STORED_SEGMENTS_SQL, code: "42P01" };
      const o = await runPersistTenant([...base, "--write"], ON, { ...deps, connect: async () => ({ client: missing.client(), close: async () => undefined }) });
      const text = o.lines.join("\n");
      assert.equal(o.exitCode, 1); assert.match(text, /^FAIL storage\.write: class=\S+ code=42P01$/m);
      assert.match(text, /apply db\/migrations\/004_shiyan_state_segments\.sql/); assert.deepEqual(leaks(text), []);
      assert.equal(missing.log.at(-1)?.sql, "ROLLBACK");
    });
    await check("no-write guarantee for files: fixture URL files and temp dir unchanged", () => { assert.equal(snap(), before); });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  console.log(`PASS check-compression-m4 (${checks} checks)`);
}

main().catch((error) => { console.error(error); process.exit(1); });
