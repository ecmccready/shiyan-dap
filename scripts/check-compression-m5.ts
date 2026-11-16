/** TEST ONLY. Offline check for M5 of the 4D state compression engine: the read-only customer proof export field
 * (export-reader.ts + the customer-proof route), migration 005 text, the staged anchors schema-guard expectation,
 * the anchors writer (anchor-store.ts) and the anchor CLI. Uses in-memory fakes that answer only the exact
 * allowlisted statements; hand-written fixtures built here; never connects to a database or the network.
 * The only files touched are fixture URL files and a filesystem experience store in a fresh temp dir, deleted at the end.
 * Run: npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-compression-m5.ts
 */
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CHAIN_HEADS_SQL, STATE_ANCHORS_SQL } from "../src/core/compression/chain-head";
import {
  isAllowedExportSql, readStateCompressionExport, stateCompressionExportEnabled, stateCompressionForExport, type QueryClient,
} from "../src/core/compression/export-reader";
import {
  ANCHOR_LOCK_SQL, ANCHOR_WRITE_BEGIN, INSERT_STATE_ANCHOR_SQL, anchorStateChainHead, isAllowedAnchorSql,
} from "../src/core/compression/anchor-store";
import { READ_ONLY_BEGIN, TENANT_ROWS_SQL, TENANT_RECOVERY_RECORDS_SQL, TENANT_REFERENCE_ANCHORS_SQL, type ReadOnlyClient } from "../src/core/compression/source";
import { INSERT_SEGMENT_SQL, STORED_SEGMENTS_SQL, TENANT_LOCK_SQL, WRITE_BEGIN, persistTenantSegments } from "../src/core/compression/store";
import {
  STAGED_ANCHOR_COLUMNS, STAGED_ANCHOR_TRIGGERS, compareColumns, compareTriggers, decodeTgType, stagedTableMissing,
} from "../src/core/schema-guard";
import { FLAG, type CompressTenantDeps } from "./compress-tenant";
import { runAnchorStateChain } from "./anchor-state-chain";

const sha = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");
const H = 3_600_000, MIN = 60_000;
const T0 = Date.UTC(2026, 5, 1);
const A = "tenant-a", B = "tenant-b";
const PW = "fixture-pw-" + randomBytes(6).toString("hex");
const fid = (i: number) => `wb-${i.toString(16).padStart(32, "0")}`;
type Row = Record<string, unknown>;
const err = (code: string) => Object.assign(new Error(`boom postgres://leak:LEAKED-SECRET@h/d code ${code}`), { code });

/** One pg-shaped shiyan.experiences row (fixture). */
function pgRow(i: number, tMs: number, arrMs: number, tenant = A): Row {
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

/** Storage DB fake (M4 statements + the M5 export SELECT). Transactional inserts; PK, sha CHECK and link trigger emulated. */
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
        if (this.failOn && sql === this.failOn.sql) throw err(this.failOn.code);
        if (sql === WRITE_BEGIN || sql === READ_ONLY_BEGIN) { this.buffer = []; return { rows: [] }; }
        if (sql === "COMMIT") { this.segments.push(...(this.buffer ?? [])); this.buffer = null; return { rows: [] }; }
        if (sql === "ROLLBACK") { this.buffer = null; return { rows: [] }; }
        if (sql === TENANT_LOCK_SQL) return { rows: [{ pg_advisory_xact_lock: "" }] };
        if (sql === TENANT_ROWS_SQL) return { rows: this.experiences.filter((r) => r.tenant_id === params?.[0]) };
        if (sql === STORED_SEGMENTS_SQL || sql === CHAIN_HEADS_SQL) {
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
          if (sha(String(row.segment_json)) !== row.segment_sha256) throw err("23514");
          const mine = this.visible(String(row.tenant_id));
          if (mine.some((r) => r.seq === row.seq)) throw err("23505");
          const prev = mine.find((r) => r.seq === (row.seq as number) - 1);
          if ((row.seq === 0) !== (row.prev_segment_sha256 === null) || (row.seq !== 0 && prev?.segment_sha256 !== row.prev_segment_sha256)) throw err("23503");
          this.buffer.push(row);
          return { rows: [] };
        }
        throw new Error(`fake storage: unexpected statement ${sql.slice(0, 30)}`);
      },
    };
  }
}

/** Anchors DB fake: reference/recovery context SELECTs (empty) and shiyan_anchor.state_chain_anchors (PK + CHECK emulated). */
class FakeAnchors {
  anchors: Row[] = [];
  log: { sql: string; params?: unknown[] }[] = [];
  failOn: { sql: string; code: string } | null = null;
  leak = false;
  private buffer: Row[] | null = null;
  private clock = Date.UTC(2026, 10, 16, 22, 0, 0);
  client(): ReadOnlyClient & QueryClient {
    return {
      query: async (sql: string, params?: unknown[]) => {
        this.log.push({ sql, params });
        if (this.failOn && sql === this.failOn.sql) throw err(this.failOn.code);
        if (sql === ANCHOR_WRITE_BEGIN || sql === READ_ONLY_BEGIN) { this.buffer = []; return { rows: [] }; }
        if (sql === "COMMIT") { this.anchors.push(...(this.buffer ?? [])); this.buffer = null; return { rows: [] }; }
        if (sql === "ROLLBACK") { this.buffer = null; return { rows: [] }; }
        if (sql === ANCHOR_LOCK_SQL) return { rows: [{ pg_advisory_xact_lock: "" }] };
        if (sql === TENANT_REFERENCE_ANCHORS_SQL || sql === TENANT_RECOVERY_RECORDS_SQL) return { rows: [] };
        if (sql === STATE_ANCHORS_SQL) {
          const all = [...this.anchors, ...(this.buffer ?? [])];
          return { rows: (this.leak ? all : all.filter((r) => r.tenant_id === params?.[0])).sort((a, b) => (a.seq as number) - (b.seq as number)) };
        }
        if (sql === INSERT_STATE_ANCHOR_SQL) {
          const [tenant_id, seq, chain_head, segment_count] = params ?? [];
          if (this.buffer === null) throw new Error("insert outside a transaction");
          if (segment_count !== (seq as number) + 1 || !/^[0-9a-f]{64}$/.test(String(chain_head))) throw err("23514");
          if ([...this.anchors, ...this.buffer].some((r) => r.tenant_id === tenant_id && r.seq === seq)) throw err("23505");
          this.clock += MIN;
          this.buffer.push({ tenant_id, seq, chain_head, segment_count, anchored_at: new Date(this.clock) });
          return { rows: [] };
        }
        throw new Error(`fake anchors: unexpected statement ${sql.slice(0, 30)}`);
      },
    };
  }
  kinds() { return this.log.map((q) => q.sql === STATE_ANCHORS_SQL ? "SELECT anchors" : q.sql === INSERT_STATE_ANCHOR_SQL ? "INSERT" : q.sql === ANCHOR_LOCK_SQL ? "LOCK" : q.sql === TENANT_REFERENCE_ANCHORS_SQL || q.sql === TENANT_RECOVERY_RECORDS_SQL ? "SELECT context" : q.sql); }
}

/** Synthetic, linked chain-head rows for export tests (hashes only; the DB CHECKs are migration 004's job). */
function headRows(tenant: string, n: number, extra: Partial<Row> = {}): Row[] {
  const rows: Row[] = [];
  let prev: string | null = null;
  for (let i = 0; i < n; i++) {
    const h = sha(`${tenant}-segment-${i}`);
    rows.push({ tenant_id: tenant, seq: i, segment_sha256: h, prev_segment_sha256: prev, point_count: 3 + i, window_closed_at: new Date(T0 + (i + 1) * 24 * H), loss_mode: "lossless", context_sha256: null, ...extra });
    prev = h;
  }
  return rows;
}
const anchorRow = (tenant: string, seq: number, head: string, at = T0 + 100 * H, count = seq + 1): Row => ({ tenant_id: tenant, seq, chain_head: head, segment_count: count, anchored_at: new Date(at) });
/** Simple recording client over fixed rows per SQL (tenant filtering optional to emulate a leaky DB). */
function tableClient(rows: Record<string, Row[]>, log: { sql: string; params?: unknown[] }[] = [], leaky = false): QueryClient {
  return {
    query: async (sql, params) => {
      log.push({ sql, params });
      const all = rows[sql];
      if (!all) throw err("42P01");
      return { rows: leaky ? all : all.filter((r) => r.tenant_id === params?.[0]) };
    },
  };
}

let checks = 0;
const check = async (name: string, fn: () => void | Promise<void>) => { await fn(); checks += 1; console.log(`PASS ${name}`); };
const noInternals = (x: unknown) => {
  const t = JSON.stringify(x);
  for (const bad of ["LEAKED-SECRET", "postgres://", "boom", "42P01", "42501", "timeout", "Error", PW]) assert.ok(!t.includes(bad), `leaked ${bad}`);
};

async function main(): Promise<void> {
  const root = join(import.meta.dirname, "..");
  // ---------- Migration 005 text ----------
  const sql = readFileSync(join(root, "db", "migrations", "005_shiyan_state_chain_anchors.sql"), "utf8");
  const code = sql.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  await check("migration 005: anchors-project table, append-only triggers, SELECT+INSERT grants, idempotent, plain SQL", () => {
    assert.match(code, /CREATE TABLE IF NOT EXISTS shiyan_anchor\.state_chain_anchors \(/);
    assert.match(code, /PRIMARY KEY \(tenant_id, seq\)/);
    assert.match(code, /segment_count\s+integer\s+NOT NULL CHECK \(segment_count = seq \+ 1\)/);
    assert.match(code, /chain_head\s+text\s+NOT NULL CHECK \(chain_head ~ '\^\[0-9a-f\]\{64\}\$'\)/);
    assert.match(code, /anchored_at\s+timestamptz NOT NULL DEFAULT now\(\)/);
    assert.match(code, /CREATE OR REPLACE TRIGGER state_chain_anchors_no_update_delete\s+BEFORE UPDATE OR DELETE ON shiyan_anchor\.state_chain_anchors\s+FOR EACH ROW EXECUTE FUNCTION shiyan_anchor\.reject_mutation\(\);/);
    assert.match(code, /CREATE OR REPLACE TRIGGER state_chain_anchors_no_truncate\s+BEFORE TRUNCATE ON shiyan_anchor\.state_chain_anchors\s+FOR EACH STATEMENT EXECUTE FUNCTION shiyan_anchor\.reject_mutation\(\);/);
    assert.match(code, /REVOKE ALL ON shiyan_anchor\.state_chain_anchors FROM PUBLIC;/);
    assert.match(code, /GRANT SELECT, INSERT ON shiyan_anchor\.state_chain_anchors TO shiyan_anchor;/);
    assert.match(code, /GRANT SELECT, INSERT ON shiyan_anchor\.state_chain_anchors TO shiyan_anchor_app;/);
    for (const g of [...code.matchAll(/GRANT ([^;]+?) ON/g)].map((m) => m[1])) assert.ok(!/UPDATE|DELETE|TRUNCATE|ALL/.test(g), `unexpected grant: ${g}`);
    assert.ok(!/shiyan_app\b/.test(code), "the storage role gets nothing in the anchors project");
    assert.ok(!/\bshiyan\.(?!state)/.test(code) && !/\bshiyan\.state_segments\b/.test(code), "touches only the anchors schema");
    assert.ok(!/\b(DROP|DELETE FROM|TRUNCATE (TABLE )?shiyan|ALTER TABLE|ALTER ROLE|CREATE ROLE|UPDATE shiyan|INSERT INTO)\b/.test(code), "no destructive, role or data statements");
    assert.ok(!/^\\/m.test(sql), "plain SQL, no psql meta-commands (Neon SQL Editor)");
    assert.ok(!/password|secret/i.test(code), "no secrets");
    assert.ok(!/CREATE TABLE (?!IF NOT EXISTS)/.test(code), "idempotent create");
    assert.match(code, /^BEGIN;/m); assert.match(code, /^COMMIT;/m);
  });

  await check("migration 005 columns match the staged schema-guard expectation exactly", () => {
    const body = code.slice(code.indexOf("CREATE TABLE IF NOT EXISTS shiyan_anchor.state_chain_anchors"), code.indexOf("PRIMARY KEY"));
    const cols = [...body.matchAll(/^\s{2}([a-z_0-9]+)\s+(text|integer|bigint|timestamptz)(?=[\s,])/gm)].map((m) => ({ name: m[1], dataType: m[2] }));
    assert.deepEqual(cols, STAGED_ANCHOR_COLUMNS.state_chain_anchors.map((c) => ({ ...c })));
    assert.deepEqual(compareColumns("anchors.state_chain_anchors", cols, STAGED_ANCHOR_COLUMNS.state_chain_anchors), { name: "anchors.state_chain_anchors.columns", ok: true });
  });

  await check("schema guard: staged anchors table is SKIP while absent, FAIL with --require-state-anchors, real tgtypes 27/34 match", () => {
    const skip = stagedTableMissing("anchors.state_chain_anchors", "db/migrations/005_shiyan_state_chain_anchors.sql", false);
    assert.equal(skip.ok, true); assert.match(String(skip.detail), /^SKIP: pending db\/migrations\/005/);
    assert.equal(stagedTableMissing("anchors.state_chain_anchors", "db/migrations/005_shiyan_state_chain_anchors.sql", true).ok, false);
    const real = [["state_chain_anchors_no_truncate", 34], ["state_chain_anchors_no_update_delete", 27]].map(([n, t]) => ({ name: n as string, table: "state_chain_anchors", functionName: "reject_mutation", ...decodeTgType(t as number) }));
    assert.equal(compareTriggers("anchors.state_chain_anchors", real, STAGED_ANCHOR_TRIGGERS.state_chain_anchors).ok, true);
    assert.equal(compareTriggers("anchors.state_chain_anchors", real.slice(0, 1), STAGED_ANCHOR_TRIGGERS.state_chain_anchors).ok, false);
    const guard = readFileSync(join(root, "scripts", "check-schema.ts"), "utf8");
    assert.match(guard, /argv\.includes\("--require-state-anchors"\)/);
    assert.match(guard, /STAGED_ANCHOR_COLUMNS/);
  });

  // ---------- Export reader ----------
  await check("export reader allowlist: exactly two tenant-scoped SELECTs; never BEGIN, INSERT or any write", async () => {
    assert.ok(isAllowedExportSql(CHAIN_HEADS_SQL) && isAllowedExportSql(STATE_ANCHORS_SQL));
    for (const s of [INSERT_SEGMENT_SQL, INSERT_STATE_ANCHOR_SQL, "BEGIN", READ_ONLY_BEGIN, STORED_SEGMENTS_SQL, TENANT_ROWS_SQL, "DELETE FROM shiyan.state_segments"]) assert.ok(!isAllowedExportSql(s));
    assert.match(CHAIN_HEADS_SQL, /^SELECT [a-z_0-9, ]+ FROM shiyan\.state_segments WHERE tenant_id = \$1 ORDER BY seq$/);
    assert.match(STATE_ANCHORS_SQL, /^SELECT [a-z_0-9, ]+ FROM shiyan_anchor\.state_chain_anchors WHERE tenant_id = \$1 ORDER BY seq$/);
    assert.ok(!/segment_json|source_ids/.test(CHAIN_HEADS_SQL), "the export never reads segment payloads or source ids");
    const sLog: { sql: string; params?: unknown[] }[] = [], aLog: { sql: string; params?: unknown[] }[] = [];
    const rows = headRows(A, 2);
    await readStateCompressionExport(A, { storage: tableClient({ [CHAIN_HEADS_SQL]: rows }, sLog), anchors: tableClient({ [STATE_ANCHORS_SQL]: [] }, aLog) });
    assert.deepEqual(sLog, [{ sql: CHAIN_HEADS_SQL, params: [A] }]);
    assert.deepEqual(aLog, [{ sql: STATE_ANCHORS_SQL, params: [A] }]);
    const src = readFileSync(join(root, "src", "core", "compression", "export-reader.ts"), "utf8");
    assert.ok(!/\b(INSERT|UPDATE|DELETE|TRUNCATE|CREATE|ALTER|DROP|GRANT)\b/.test(src));
    assert.ok(!/from "\.\/(store|anchor-store|source)"/.test(src), "the export never imports a writer or source.ts");
  });

  await check("export: present + anchored (head covered), present + stale anchor, unanchored", async () => {
    const rows = headRows(A, 3);
    const heads = rows.map((r) => r.segment_sha256 as string);
    const at = T0 + 120 * H;
    const full = await readStateCompressionExport(A, { storage: tableClient({ [CHAIN_HEADS_SQL]: rows }), anchors: tableClient({ [STATE_ANCHORS_SQL]: [anchorRow(A, 0, heads[0]), anchorRow(A, 2, heads[2], at)] }) });
    assert.deepEqual(full, {
      format: "aethel.state-chain/1", status: "present", chain_head: heads[2], segment_count: 3, last_seq: 2,
      sealed_through: new Date(T0 + 72 * H).toISOString(), points: 3 + 4 + 5, loss_mode: "lossless", context: false,
      anchor: { status: "anchored", anchored_seq: 2, anchored_head: heads[2], anchored_at: new Date(at).toISOString(), anchor_count: 2, covers_head: true },
    });
    const stale = await readStateCompressionExport(A, { storage: tableClient({ [CHAIN_HEADS_SQL]: rows }), anchors: tableClient({ [STATE_ANCHORS_SQL]: [anchorRow(A, 1, heads[1])] }) });
    assert.equal(stale.anchor.status, "anchored"); assert.equal(stale.anchor.anchored_seq, 1); assert.equal(stale.anchor.covers_head, false);
    const none = await readStateCompressionExport(A, { storage: tableClient({ [CHAIN_HEADS_SQL]: rows }), anchors: tableClient({ [STATE_ANCHORS_SQL]: [] }) });
    assert.deepEqual(none.anchor, { status: "unanchored", anchored_seq: null, anchored_head: null, anchored_at: null, anchor_count: 0, covers_head: false });
    const ctx = await readStateCompressionExport(A, { storage: tableClient({ [CHAIN_HEADS_SQL]: headRows(A, 1, { loss_mode: "bounded", context_sha256: sha("ctx") }) }) });
    assert.equal(ctx.loss_mode, "bounded"); assert.equal(ctx.context, true); assert.equal(ctx.anchor.status, "unavailable");
  });

  await check("export: anchor mismatch (wrong head, seq beyond the stored head, wrong count, anchors without a stored chain)", async () => {
    const rows = headRows(A, 2);
    const heads = rows.map((r) => r.segment_sha256 as string);
    for (const bad of [anchorRow(A, 1, sha("forged")), anchorRow(A, 5, heads[1]), anchorRow(A, 1, heads[1], T0, 7)]) {
      const r = await readStateCompressionExport(A, { storage: tableClient({ [CHAIN_HEADS_SQL]: rows }), anchors: tableClient({ [STATE_ANCHORS_SQL]: [anchorRow(A, 0, heads[0]), bad] }) });
      assert.equal(r.status, "present");
      assert.deepEqual(r.anchor, { status: "mismatch", anchored_seq: null, anchored_head: null, anchored_at: null, anchor_count: 2, covers_head: false });
    }
    const absent = await readStateCompressionExport(A, { storage: tableClient({ [CHAIN_HEADS_SQL]: [] }), anchors: tableClient({ [STATE_ANCHORS_SQL]: [anchorRow(A, 0, heads[0])] }) });
    assert.equal(absent.status, "absent"); assert.equal(absent.anchor.status, "mismatch");
  });

  await check("export: absent, unavailable (missing table, permission, timeout, throw, no client, bad tenant) and inconsistent; never throws, no internals", async () => {
    const absent = await readStateCompressionExport(A, { storage: tableClient({ [CHAIN_HEADS_SQL]: [] }), anchors: tableClient({ [STATE_ANCHORS_SQL]: [] }) });
    assert.deepEqual(absent, { format: "aethel.state-chain/1", status: "absent", chain_head: null, segment_count: 0, last_seq: null, sealed_through: null, points: 0, loss_mode: null, context: false,
      anchor: { status: "unanchored", anchored_seq: null, anchored_head: null, anchored_at: null, anchor_count: 0, covers_head: false } });
    const thrower = (code: string): QueryClient => ({ query: async () => { throw err(code); } });
    const syncThrower: QueryClient = { query: () => { throw err("XX000"); } };
    const hang: QueryClient = { query: () => new Promise(() => undefined) };
    const cases: [string, Promise<unknown>][] = [
      ["missing table", readStateCompressionExport(A, { storage: thrower("42P01") })],
      ["permission", readStateCompressionExport(A, { storage: thrower("42501") })],
      ["sync throw", readStateCompressionExport(A, { storage: syncThrower })],
      ["timeout", readStateCompressionExport(A, { storage: hang }, 50)],
      ["no client", readStateCompressionExport(A, {})],
      ["bad tenant", readStateCompressionExport("Bad Tenant!", { storage: tableClient({ [CHAIN_HEADS_SQL]: [] }) })],
    ];
    for (const [name, p] of cases) {
      const r = await p as { status: string; anchor: { status: string } };
      assert.equal(r.status, "unavailable", name); assert.equal(r.anchor.status, "unavailable", name); noInternals(r);
    }
    const rows = headRows(A, 3);
    const anchorsDown = await readStateCompressionExport(A, { storage: tableClient({ [CHAIN_HEADS_SQL]: rows }), anchors: hang }, 50);
    assert.equal(anchorsDown.status, "present"); assert.equal(anchorsDown.anchor.status, "unavailable");
    const anchorsMissing = await readStateCompressionExport(A, { storage: tableClient({ [CHAIN_HEADS_SQL]: rows }), anchors: thrower("42P01") });
    assert.equal(anchorsMissing.status, "present"); assert.equal(anchorsMissing.anchor.status, "unavailable"); noInternals(anchorsMissing);
    const broken = [rows[0], { ...rows[1], prev_segment_sha256: sha("x") }, rows[2]];
    const gap = [rows[0], rows[2]];
    const malformed = [{ ...rows[0], segment_sha256: "nope" }];
    for (const bad of [broken, gap, malformed]) {
      const r = await readStateCompressionExport(A, { storage: tableClient({ [CHAIN_HEADS_SQL]: bad }) });
      assert.equal(r.status, "inconsistent"); assert.equal(r.chain_head, null); noInternals(r);
    }
  });

  await check("export tenant isolation: each tenant sees only its own head; a leaky DB is never shown", async () => {
    const both = { [CHAIN_HEADS_SQL]: [...headRows(A, 2), ...headRows(B, 4)], [STATE_ANCHORS_SQL]: [anchorRow(B, 3, sha(`${B}-segment-3`))] };
    const a = await readStateCompressionExport(A, { storage: tableClient(both), anchors: tableClient(both) });
    const b = await readStateCompressionExport(B, { storage: tableClient(both), anchors: tableClient(both) });
    assert.equal(a.chain_head, sha(`${A}-segment-1`)); assert.equal(a.segment_count, 2); assert.equal(a.anchor.status, "unanchored");
    assert.equal(b.chain_head, sha(`${B}-segment-3`)); assert.equal(b.segment_count, 4); assert.equal(b.anchor.status, "anchored");
    assert.ok(!JSON.stringify(a).includes(sha(`${B}-segment-3`)));
    const leakyStorage = await readStateCompressionExport(A, { storage: tableClient(both, [], true) });
    assert.equal(leakyStorage.status, "unavailable"); assert.equal(leakyStorage.chain_head, null);
    const leakyAnchors = await readStateCompressionExport(A, { storage: tableClient(both), anchors: tableClient(both, [], true) });
    assert.equal(leakyAnchors.status, "present"); assert.equal(leakyAnchors.anchor.status, "unavailable");
  });

  // ---------- Env resolution + the route, with fake pools in the app's pool cache ----------
  const dir = mkdtempSync(join(tmpdir(), "m5-check-"));
  const storageUrl = `postgresql://fixture_role:${PW}@127.0.0.1:5432/fixture_db?sslmode=disable`;
  const anchorUrl = `postgresql://fixture_anchor:${PW}@127.0.0.1:5432/fixture_anchor_db?sslmode=disable`;
  const pools = (() => {
    const key = Symbol.for("shiyan-dap.neon-pools");
    const holder = globalThis as unknown as Record<symbol, Map<string, unknown>>;
    if (!holder[key]) holder[key] = new Map();
    return holder[key];
  })();
  const storageRows: Row[] = [];
  const experienceRows: Row[] = [];
  const anchorRows: Row[] = [];
  const poolLog: { purpose: string; sql: string }[] = [];
  let storageMissing = false;
  const fakePool = (purpose: "storage" | "anchors") => ({
    on: () => undefined, end: async () => undefined,
    connect: async () => { throw new Error("connect not expected in this test"); },
    query: async (q: string, params?: unknown[]) => {
      poolLog.push({ purpose, sql: q });
      const tenant = params?.[0];
      if (purpose === "storage" && /FROM shiyan\.experiences WHERE tenant_id = \$1 AND experience_id = \$2/.test(q)) {
        return { rows: experienceRows.filter((r) => r.tenant_id === tenant && r.experience_id === params?.[1]) };
      }
      if (purpose === "storage" && q === CHAIN_HEADS_SQL) { if (storageMissing) throw err("42P01"); return { rows: storageRows.filter((r) => r.tenant_id === tenant) }; }
      if (purpose === "anchors" && q === STATE_ANCHORS_SQL) return { rows: anchorRows.filter((r) => r.tenant_id === tenant) };
      throw new Error(`fake ${purpose} pool: unexpected statement`);
    },
  });
  pools.set(JSON.stringify(["storage", "127.0.0.1", 5432, "fixture_db", "fixture_role"]), fakePool("storage"));
  pools.set(JSON.stringify(["anchors", "127.0.0.1", 5432, "fixture_anchor_db", "fixture_anchor"]), fakePool("anchors"));
  const neonEnv = { SHIYAN_STORAGE_BACKEND: "neon", SHIYAN_STORAGE_URL: storageUrl, SHIYAN_ANCHOR_URL: anchorUrl };

  await check("env resolution: off unless SHIYAN_STATE_COMPRESSION=1; neon pools -> present; filesystem -> unavailable; same-DB anchors -> anchor unavailable", async () => {
    assert.equal(stateCompressionExportEnabled({}), false);
    for (const v of ["0", "true", "yes", " 1", "1 "]) assert.equal(stateCompressionExportEnabled({ [FLAG]: v }), false, v);
    assert.equal(stateCompressionExportEnabled({ [FLAG]: "1" }), true);
    storageRows.push(...headRows(A, 2));
    anchorRows.push(anchorRow(A, 1, storageRows[1].segment_sha256 as string));
    const r = await stateCompressionForExport(A, neonEnv);
    assert.equal(r.status, "present"); assert.equal(r.anchor.status, "anchored"); assert.equal(r.anchor.covers_head, true);
    assert.equal((await stateCompressionForExport(A, {})).status, "unavailable");
    assert.equal((await stateCompressionForExport(A, { SHIYAN_STORAGE_BACKEND: "filesystem" })).status, "unavailable");
    const same = await stateCompressionForExport(A, { ...neonEnv, SHIYAN_ANCHOR_URL: storageUrl });
    assert.equal(same.status, "present"); assert.equal(same.anchor.status, "unavailable");
    const noAnchor = await stateCompressionForExport(A, { ...neonEnv, SHIYAN_ANCHOR_URL: undefined });
    assert.equal(noAnchor.anchor.status, "unavailable");
    noInternals(await stateCompressionForExport(A, { ...neonEnv, SHIYAN_STORAGE_URL: "postgresql://u:LEAKED-SECRET@example.invalid/db" }));
  });

  // Route: build real records through the filesystem routes, then serve them from the fake Neon pool.
  const KA = randomBytes(24).toString("hex"), KB = randomBytes(24).toString("hex");
  const before = { ...process.env };
  Object.assign(process.env, {
    AETHEL_HF_MEMORY_ROOT: join(dir, "memory"),
    AETHEL_TENANT_KEYS: JSON.stringify({ [A]: sha(KA), [B]: sha(KB) }),
    VERCEL_GIT_COMMIT_SHA: "test-only",
  });
  for (const k of ["SHIYAN_STORAGE_BACKEND", "SHIYAN_STORAGE_URL", "SHIYAN_ANCHOR_URL", "SHIYAN_DATABASE_URL", "SHIYAN_ANCHOR_DATABASE_URL", FLAG, "VERCEL", "AETHEL_GITHUB_TOKEN"]) delete process.env[k];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("Network forbidden in offline test"); };
  try {
    const runs = await import("../src/app/api/v1/runs/route");
    const customer = await import("../src/app/api/v1/customer-proof/[id]/route");
    const { experienceDigest } = await import("../src/core/hf-memory");
    const auth = (k: string) => ({ authorization: `Bearer ${k}` });
    const submit = async (k: string, run_id: string) => {
      const r = await runs.POST(new Request("http://test.invalid/api/v1/runs", { method: "POST", headers: auth(k), body: JSON.stringify({
        contract_version: "aethel.run/1", run_id, workbench: { name: "test-only-workbench", version: "test-only" },
        goal: "Test fixture only", action: "Test fixture only", predicted: 1, observed: 1, seed: 42 }) }));
      const body = await r.json() as Record<string, unknown>;
      assert.equal(r.status, 201, JSON.stringify(body));
      return String(body.experience_id);
    };
    const exportRaw = async (k: string, id: string) => {
      const r = await customer.GET(new Request(`http://test.invalid/api/v1/customer-proof/${id}`, { headers: auth(k) }), { params: Promise.resolve({ id }) });
      return { status: r.status, text: await r.text(), headers: [...r.headers.entries()].sort().map(([n, v]) => `${n}: ${v}`).join("\n") };
    };
    const routeLogStart = poolLog.length;
    const idA = await submit(KA, "test-only-run-a");
    const idB = await submit(KB, "test-only-run-b");

    await check("route, flag off: export body is byte-identical to the pre-M5 shape (filesystem and Neon backends); headers unchanged", async () => {
      for (const v of [undefined, "0", "true"]) {
        if (v === undefined) delete process.env[FLAG]; else process.env[FLAG] = v;
        const r = await exportRaw(KA, idA);
        assert.equal(r.status, 200);
        const body = JSON.parse(r.text) as Record<string, unknown>;
        assert.deepEqual(Object.keys(body), ["report_version", "record", "content_sha256", "server_verdict"]);
        assert.equal(r.text, JSON.stringify({ report_version: "aethel.customer-proof/1", record: body.record, content_sha256: body.content_sha256, server_verdict: body.server_verdict }));
        assert.equal(body.content_sha256, experienceDigest(body.record as never));
      }
      // Same record served from the (fake) Neon store.
      for (const [tenant, id] of [[A, idA], [B, idB]] as const) {
        const fs = JSON.parse((await exportRaw(tenant === A ? KA : KB, id)).text) as { record: Record<string, unknown>; content_sha256: string };
        const canon = (v: unknown): string => Array.isArray(v) ? `[${v.map(canon).join(",")}]` : v !== null && typeof v === "object"
          ? `{${Object.keys(v as object).filter((k) => (v as Row)[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canon((v as Row)[k])}`).join(",")}}` : JSON.stringify(v);
        experienceRows.push({ tenant_id: tenant, experience_id: id, record_json: canon(fs.record), content_sha256: fs.content_sha256, proof_timestamp: new Date(T0) });
      }
      delete process.env[FLAG];
      const fsOff = await exportRaw(KA, idA);
      Object.assign(process.env, neonEnv);
      const neonOff = await exportRaw(KA, idA);
      // The Neon store returns the canonical key order of record_json (pre-existing behaviour), so compare values here;
      // byte identity is asserted per backend (flag off vs the pre-M5 4-key literal, and flag on vs flag off).
      assert.equal(neonOff.status, 200); assert.deepEqual(JSON.parse(neonOff.text), JSON.parse(fsOff.text)); assert.equal(neonOff.headers, fsOff.headers);
      const nb = JSON.parse(neonOff.text) as Record<string, unknown>;
      assert.equal(neonOff.text, JSON.stringify({ report_version: nb.report_version, record: nb.record, content_sha256: nb.content_sha256, server_verdict: nb.server_verdict }));
      assert.ok(!poolLog.slice(routeLogStart).some((q) => q.sql === CHAIN_HEADS_SQL || q.sql === STATE_ANCHORS_SQL), "flag off: the state-chain tables are never queried");
    });

    await check("route, flag on: state_compression appended last; all other bytes, content_sha256 and headers unchanged; tenant-scoped", async () => {
      Object.assign(process.env, neonEnv);
      delete process.env[FLAG];
      const off = await exportRaw(KA, idA);
      const logStart = poolLog.length;
      process.env[FLAG] = "1";
      const on = await exportRaw(KA, idA);
      assert.equal(on.status, 200); assert.equal(on.headers, off.headers);
      const body = JSON.parse(on.text) as Record<string, unknown>;
      assert.deepEqual(Object.keys(body), ["report_version", "record", "content_sha256", "server_verdict", "state_compression"]);
      assert.ok(on.text.startsWith(off.text.slice(0, -1) + ',"state_compression":'), "existing bytes are a prefix");
      const { state_compression: sc, ...rest } = body;
      assert.equal(JSON.stringify(rest), off.text);
      assert.deepEqual(sc, {
        format: "aethel.state-chain/1", status: "present", chain_head: storageRows[1].segment_sha256, segment_count: 2, last_seq: 1,
        sealed_through: new Date(T0 + 48 * H).toISOString(), points: 7, loss_mode: "lossless", context: false,
        anchor: { status: "anchored", anchored_seq: 1, anchored_head: storageRows[1].segment_sha256, anchored_at: new Date(T0 + 100 * H).toISOString(), anchor_count: 1, covers_head: true },
      });
      const sent = poolLog.slice(logStart).map((q) => q.sql).filter((q) => q === CHAIN_HEADS_SQL || q === STATE_ANCHORS_SQL);
      assert.deepEqual(sent, [CHAIN_HEADS_SQL, STATE_ANCHORS_SQL]);
      const b = JSON.parse((await exportRaw(KB, idB)).text) as { state_compression: { status: string; chain_head: unknown } };
      assert.equal(b.state_compression.status, "absent"); assert.equal(b.state_compression.chain_head, null);
      const cross = await exportRaw(KB, idA);
      assert.equal(cross.status, 404); assert.ok(!cross.text.includes("state_compression"));
    });

    await check("route, flag on: a missing table or a non-Neon backend never fails the export (status unavailable, no internals)", async () => {
      Object.assign(process.env, neonEnv, { [FLAG]: "1" });
      storageMissing = true;
      const r = await exportRaw(KA, idA);
      storageMissing = false;
      assert.equal(r.status, 200);
      const body = JSON.parse(r.text) as { state_compression: { status: string; anchor: { status: string } } };
      assert.equal(body.state_compression.status, "unavailable"); assert.equal(body.state_compression.anchor.status, "unavailable");
      noInternals(body.state_compression);
      for (const k of ["SHIYAN_STORAGE_BACKEND", "SHIYAN_STORAGE_URL", "SHIYAN_ANCHOR_URL"]) delete process.env[k];
      const fsOn = await exportRaw(KA, idA);
      assert.equal(fsOn.status, 200);
      assert.equal((JSON.parse(fsOn.text) as { state_compression: { status: string } }).state_compression.status, "unavailable");
      const route = readFileSync(join(root, "src", "app", "api", "v1", "customer-proof", "[id]", "route.ts"), "utf8");
      assert.ok(!/compression\/(store|anchor-store|source|index)"/.test(route), "the route imports only the read-only export reader");
    });
  } finally {
    globalThis.fetch = realFetch;
    for (const k of Object.keys(process.env)) if (!(k in before)) delete process.env[k];
    Object.assign(process.env, before);
  }

  // ---------- Anchor writer (anchor-store.ts) ----------
  const day1 = Array.from({ length: 5 }, (_, i) => pgRow(i, T0 + i * MIN, T0 + i * MIN));
  const day2 = Array.from({ length: 3 }, (_, i) => pgRow(10 + i, T0 + 30 * H + i * MIN, T0 + 30 * H + i * MIN));
  const options = { segmentSize: 256, cutoffMs: 24 * H, graceMs: 10 * MIN, asOfMs: T0 + 55 * H, loss: { mode: "lossless" as const } };
  const storage = new FakeStorage();
  storage.experiences.push(...day1);
  const w1 = await persistTenantSegments(storage.client(), A, "write", { ...options, asOfMs: T0 + 30 * H });
  assert.equal(w1.inserted, 1);
  const hashes1 = (await persistTenantSegments(storage.client(), A, "verify", options)).stored_hashes;
  assert.deepEqual(hashes1, [w1.stored_head_after]);

  await check("anchor allowlist: write = BEGIN, lock, anchors SELECT, one INSERT, COMMIT/ROLLBACK; read modes cannot INSERT or lock", () => {
    for (const s of [ANCHOR_WRITE_BEGIN, ANCHOR_LOCK_SQL, STATE_ANCHORS_SQL, INSERT_STATE_ANCHOR_SQL, "COMMIT", "ROLLBACK"]) assert.ok(isAllowedAnchorSql(s, "write"), s);
    for (const m of ["dry-run", "verify"] as const) {
      for (const s of [READ_ONLY_BEGIN, STATE_ANCHORS_SQL, "COMMIT", "ROLLBACK"]) assert.ok(isAllowedAnchorSql(s, m));
      for (const s of [INSERT_STATE_ANCHOR_SQL, ANCHOR_LOCK_SQL, ANCHOR_WRITE_BEGIN]) assert.ok(!isAllowedAnchorSql(s, m));
    }
    for (const s of [INSERT_SEGMENT_SQL, CHAIN_HEADS_SQL, TENANT_ROWS_SQL, "DELETE FROM shiyan_anchor.state_chain_anchors"]) assert.ok(!isAllowedAnchorSql(s, "write"));
    assert.equal(INSERT_STATE_ANCHOR_SQL, "INSERT INTO shiyan_anchor.state_chain_anchors (tenant_id, seq, chain_head, segment_count) VALUES ($1, $2, $3, $4)");
  });

  const anchorsDb = new FakeAnchors();
  await check("anchor dry run is READ ONLY and inserts nothing; write anchors the head under the tenant lock; rerun inserts 0", async () => {
    const dry = await anchorStateChainHead(anchorsDb.client(), A, "dry-run", hashes1);
    assert.equal(dry.would_insert, 1); assert.equal(dry.inserted, 0); assert.equal(anchorsDb.anchors.length, 0);
    assert.deepEqual(anchorsDb.kinds(), [READ_ONLY_BEGIN, "SELECT anchors", "COMMIT"]);
    anchorsDb.log = [];
    const w = await anchorStateChainHead(anchorsDb.client(), A, "write", hashes1);
    assert.equal(w.inserted, 1); assert.deepEqual(w.head, { seq: 0, chain_head: hashes1[0], segment_count: 1 });
    assert.deepEqual(anchorsDb.kinds(), ["BEGIN", "LOCK", "SELECT anchors", "INSERT", "SELECT anchors", "COMMIT"]);
    assert.deepEqual(anchorsDb.log[1].params, [A]);
    assert.equal(anchorsDb.anchors.length, 1);
    anchorsDb.log = [];
    const again = await anchorStateChainHead(anchorsDb.client(), A, "write", hashes1);
    assert.equal(again.inserted, 0); assert.equal(again.would_insert, 0); assert.equal(again.comparison.covers_head, true);
    assert.ok(!anchorsDb.kinds().includes("INSERT")); assert.equal(anchorsDb.anchors.length, 1);
  });

  await check("anchor after the stored chain grows: new head anchored at its seq; older anchors still verified", async () => {
    storage.experiences.push(...day2);
    const w2 = await persistTenantSegments(storage.client(), A, "write", options);
    assert.equal(w2.inserted, 1); assert.equal(w2.stored_hashes.length, 1, "stored_hashes is what was read before the append");
    const all = (await persistTenantSegments(storage.client(), A, "verify", options)).stored_hashes;
    assert.equal(all.length, 2);
    const w = await anchorStateChainHead(anchorsDb.client(), A, "write", all);
    assert.equal(w.inserted, 1); assert.equal(w.head?.seq, 1);
    const v = await anchorStateChainHead(anchorsDb.client(), A, "verify", all);
    assert.equal(v.comparison.status, "anchored"); assert.equal(v.comparison.covers_head, true); assert.equal(v.would_insert, 0);
    assert.deepEqual(anchorsDb.anchors.map((r) => r.seq), [0, 1]);
  });

  await check("anchor mismatch (different head at an existing seq) refuses, rolls back, writes nothing; verify reports it", async () => {
    const forged = new FakeAnchors();
    forged.anchors.push({ tenant_id: A, seq: 0, chain_head: sha("forged"), segment_count: 1, anchored_at: new Date(T0) });
    const hashes = (await persistTenantSegments(storage.client(), A, "verify", options)).stored_hashes;
    const w = await anchorStateChainHead(forged.client(), A, "write", hashes);
    assert.equal(w.comparison.status, "mismatch"); assert.equal(w.inserted, 0); assert.equal(w.would_insert, 0);
    assert.ok(!forged.kinds().includes("INSERT")); assert.equal(forged.kinds().at(-1), "ROLLBACK"); assert.equal(forged.anchors.length, 1);
    assert.match(w.comparison.mismatches[0], /^anchor seq 0: chain_head [0-9a-f]{64} != stored [0-9a-f]{64}$/);
    const v = await anchorStateChainHead(forged.client(), A, "verify", hashes);
    assert.equal(v.comparison.status, "mismatch");
    const beyond = new FakeAnchors();
    beyond.anchors.push({ tenant_id: A, seq: 9, chain_head: hashes[1], segment_count: 10, anchored_at: new Date(T0) });
    assert.equal((await anchorStateChainHead(beyond.client(), A, "write", hashes)).comparison.status, "mismatch");
    const leaky = new FakeAnchors(); leaky.leak = true;
    leaky.anchors.push({ tenant_id: B, seq: 0, chain_head: sha("b"), segment_count: 1, anchored_at: new Date(T0) });
    const l = await anchorStateChainHead(leaky.client(), A, "write", hashes);
    assert.deepEqual(l.invalid, ["anchors: a row belongs to another tenant"]); assert.equal(l.inserted, 0); assert.equal(leaky.anchors.length, 1);
  });

  await check("anchor race (PK conflict) rolls back and rethrows; an empty stored chain anchors nothing", async () => {
    const race = new FakeAnchors();
    race.failOn = { sql: INSERT_STATE_ANCHOR_SQL, code: "23505" };
    await assert.rejects(anchorStateChainHead(race.client(), A, "write", hashes1), (e: { code?: string }) => e.code === "23505");
    assert.equal(race.kinds().at(-1), "ROLLBACK"); assert.equal(race.anchors.length, 0);
    const empty = new FakeAnchors();
    const r = await anchorStateChainHead(empty.client(), A, "write", []);
    assert.equal(r.head, null); assert.equal(r.inserted, 0); assert.ok(!empty.kinds().includes("INSERT"));
    await assert.rejects(anchorStateChainHead(empty.client(), "Bad Tenant!", "write", []));
    await assert.rejects(anchorStateChainHead(empty.client(), A, "write", ["not-a-hash"]));
  });

  // ---------- Anchor CLI ----------
  {
    const storageFile = join(dir, "storage-url"), anchorFile = join(dir, "anchor-url"), sameFile = join(dir, "same-url");
    writeFileSync(storageFile, `${storageUrl}\n`); writeFileSync(anchorFile, `${anchorUrl}\n`); writeFileSync(sameFile, `${storageUrl}\n`);
    const snapshot = () => readdirSync(dir).filter((n) => n !== "memory").sort().map((n) => `${n}:${statSync(join(dir, n)).size}:${readFileSync(join(dir, n), "utf8")}`).join("|");
    const before = snapshot();
    const cliStorage = new FakeStorage();
    cliStorage.experiences.push(...day1, ...day2);
    await persistTenantSegments(cliStorage.client(), A, "write", options);
    const cliAnchors = new FakeAnchors();
    const deps = (s: FakeStorage = cliStorage, a: FakeAnchors = cliAnchors): CompressTenantDeps => ({
      readTextFile: (p) => readFileSync(p, "utf8"),
      connect: async (_c, purpose) => ({ client: purpose === "storage" ? s.client() : a.client(), close: async () => undefined }),
      home: () => dir,
      now: () => T0 + 55 * H,
    });
    const ON = { [FLAG]: "1" };
    const base = ["--tenant", A, "--storage-file", storageFile, "--anchor-file", anchorFile];
    const run = async (argv: string[], env: Record<string, string> = ON, d = deps()) => { const o = await runAnchorStateChain(argv, env, d); return { ...o, text: o.lines.join("\n") }; };
    const leaks = (t: string) => [PW, "fixture_role", "127.0.0.1", "postgres://", "FIXTURE-PAYLOAD", "LEAKED-SECRET", "boom", "segment_json", "run-wb-"].filter((x) => t.includes(x));
    const heads = (await persistTenantSegments(cliStorage.client(), A, "verify", options)).stored_hashes;
    const setupLen = cliStorage.log.length;

    await check("anchor CLI gate and usage: off by default (even with --write), anchors URL required, same DB/role refused; nothing read", async () => {
      for (const env of [{}, { [FLAG]: "0" }] as Record<string, string>[]) {
        const o = await run([...base, "--write"], env);
        assert.equal(o.exitCode, 2); assert.match(o.text, /^REFUSED: .*SHIYAN_STATE_COMPRESSION=1/);
      }
      assert.equal((await run(["--tenant", A, "--storage-file", storageFile])).exitCode, 2);
      assert.equal((await run([...base, "--write", "--verify-anchor"])).exitCode, 2);
      const same = await run(["--tenant", A, "--storage-file", storageFile, "--anchor-file", sameFile, "--write"]);
      assert.equal(same.exitCode, 1); assert.match(same.text, /different database with a different role/);
      assert.equal(cliStorage.log.length, setupLen, "nothing read from storage");
      assert.equal(cliAnchors.log.length, 0);
    });

    await check("anchor CLI: dry run (READ ONLY), --write anchors the verified head, rerun anchors 0, --verify-anchor PASS", async () => {
      const dry = await run(base);
      assert.equal(dry.exitCode, 0, dry.text);
      assert.match(dry.text, /PASS stored chain\nPASS stored sources\nPASS stored reconstruction\nPASS stored context/);
      assert.match(dry.text, /anchor_status: unanchored\nwould_anchor: 1\nhead: seq=1 segment_count=2 chain_head=([0-9a-f]{64})/);
      assert.ok(dry.text.includes(`chain_head=${heads[1]}`)); assert.equal(cliAnchors.anchors.length, 0);
      assert.ok(!cliAnchors.kinds().includes("INSERT") && !cliAnchors.kinds().includes("BEGIN"));
      const w = await run([...base, "--write"]);
      assert.equal(w.exitCode, 0, w.text); assert.match(w.text, /\nanchored: 1\n/); assert.match(w.text, /covers_head: yes\nRESULT: PASS$/);
      assert.deepEqual(cliAnchors.anchors.map((r) => [r.seq, r.chain_head]), [[1, heads[1]]]);
      const again = await run([...base, "--write"]);
      assert.equal(again.exitCode, 0); assert.match(again.text, /anchor_status: anchored\nanchored: 0\n/); assert.equal(cliAnchors.anchors.length, 1);
      const v = await run([...base, "--verify-anchor"]);
      assert.equal(v.exitCode, 0, v.text); assert.match(v.text, /latest_anchor: seq=1 chain_head=[0-9a-f]{64} anchored_at=\S+\ncovers_head: yes\nRESULT: PASS$/);
      const cliSql = new Set(cliStorage.log.slice(setupLen).map((q) => q.sql));
      assert.deepEqual([...cliSql].sort(), [READ_ONLY_BEGIN, STORED_SEGMENTS_SQL, TENANT_ROWS_SQL, "COMMIT"].sort(), "the anchor CLI only reads storage (READ ONLY)");
      for (const t of [dry.text, w.text, again.text, v.text]) assert.deepEqual(leaks(t), []);
    });

    await check("anchor CLI refuses: stored chain does not verify (nothing anchored); anchor mismatch (exit 1); verify FAILs on mismatch and on no anchor", async () => {
      const tampered = new FakeStorage();
      tampered.experiences.push(...day1, ...day2);
      await persistTenantSegments(tampered.client(), A, "write", options);
      tampered.experiences.splice(0, 1);
      const freshAnchors = new FakeAnchors();
      const t = await run([...base, "--write"], ON, deps(tampered, freshAnchors));
      assert.equal(t.exitCode, 1); assert.match(t.text, /FAIL stored sources/); assert.match(t.text, /RESULT: REFUSED \(stored chain does not verify; nothing anchored\)$/);
      assert.equal(freshAnchors.anchors.length, 0); assert.ok(!freshAnchors.kinds().includes("INSERT"));
      const forged = new FakeAnchors();
      forged.anchors.push({ tenant_id: A, seq: 0, chain_head: sha("forged"), segment_count: 1, anchored_at: new Date(T0) });
      const m = await run([...base, "--write"], ON, deps(cliStorage, forged));
      assert.equal(m.exitCode, 1); assert.match(m.text, /anchor_status: mismatch\n  mismatch anchor seq 0: /); assert.match(m.text, /RESULT: REFUSED \(anchor mismatch; nothing written\)$/);
      assert.equal(forged.anchors.length, 1);
      const vm = await run([...base, "--verify-anchor"], ON, deps(cliStorage, forged));
      assert.equal(vm.exitCode, 1); assert.match(vm.text, /RESULT: FAIL$/);
      const vn = await run([...base, "--verify-anchor"], ON, deps(cliStorage, new FakeAnchors()));
      assert.equal(vn.exitCode, 1); assert.match(vn.text, /RESULT: FAIL \(no anchor yet\)$/);
    });

    await check("anchor CLI: missing 005 table (42P01) and missing 004 table give hints, no error text, nothing written", async () => {
      const missing = new FakeAnchors(); missing.failOn = { sql: STATE_ANCHORS_SQL, code: "42P01" };
      const o = await run([...base, "--write"], ON, deps(cliStorage, missing));
      assert.equal(o.exitCode, 1); assert.match(o.text, /FAIL anchors\.write: class=\S+ code=42P01\nhint: shiyan_anchor\.state_chain_anchors is missing; apply db\/migrations\/005_shiyan_state_chain_anchors\.sql/);
      assert.ok(!missing.kinds().includes("INSERT")); assert.equal(missing.kinds().at(-1), "ROLLBACK");
      const noSeg = new FakeStorage(); noSeg.failOn = { sql: STORED_SEGMENTS_SQL, code: "42P01" };
      const s = await run(base, ON, deps(noSeg, new FakeAnchors()));
      assert.equal(s.exitCode, 1); assert.match(s.text, /hint: shiyan\.state_segments is missing; apply db\/migrations\/004/);
      for (const t of [o.text, s.text]) assert.deepEqual(leaks(t), []);
      assert.equal(snapshot(), before, "fixture URL files unchanged; the CLI writes no files");
    });
  }

  rmSync(dir, { recursive: true, force: true });
  console.log(`PASS check-compression-m5 (${checks} checks)`);
}

main().catch((error) => { console.error(error); process.exit(1); });
