/** TEST ONLY. Offline check for the scheduled state-chain sync: scripts/sync-state-chains.ts (with in-memory fakes of
 * the storage and anchors databases that answer only the exact allowlisted statements) and a static check of
 * the state-chain-sync workflow (.github/workflows/, or staged at ops/github/). Hand-written fixtures built here; never connects to a database or the network.
 * The only files touched are fixture URL files in a fresh temp dir, deleted at the end.
 * Run: npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-state-chain-sync.ts
 */
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CHAIN_HEADS_SQL, STATE_ANCHORS_SQL } from "../src/core/compression/chain-head";
import { ANCHOR_LOCK_SQL, ANCHOR_WRITE_BEGIN, INSERT_STATE_ANCHOR_SQL } from "../src/core/compression/anchor-store";
import { READ_ONLY_BEGIN, TENANT_ROWS_SQL, TENANT_RECOVERY_RECORDS_SQL, TENANT_REFERENCE_ANCHORS_SQL, type ReadOnlyClient } from "../src/core/compression/source";
import { INSERT_SEGMENT_SQL, STORED_SEGMENTS_SQL, TENANT_LOCK_SQL, WRITE_BEGIN, persistTenantSegments } from "../src/core/compression/store";
import type { QueryClient } from "../src/core/compression/export-reader";
import { FLAG, type CompressTenantDeps } from "./compress-tenant";
import { parseTenantList, runStateChainSync, TENANTS_VAR } from "./sync-state-chains";

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


let checks = 0;
const check = async (name: string, fn: () => void | Promise<void>) => { await fn(); checks += 1; console.log(`PASS ${name}`); };

async function main(): Promise<void> {
  const root = join(import.meta.dirname, "..");
  const dir = mkdtempSync(join(tmpdir(), "sync-check-"));
  const storageFile = join(dir, "storage-url"), anchorFile = join(dir, "anchor-url"), sameFile = join(dir, "same-url");
  writeFileSync(storageFile, `postgresql://fixture_role:${PW}@127.0.0.1:5432/fixture_db?sslmode=disable\n`);
  writeFileSync(anchorFile, `postgresql://fixture_anchor:${PW}@127.0.0.1:5432/fixture_anchor_db?sslmode=disable\n`);
  writeFileSync(sameFile, `postgresql://fixture_role:${PW}@127.0.0.1:5432/fixture_db?sslmode=disable\n`);
  const day1 = (t = A) => Array.from({ length: 5 }, (_, i) => pgRow(i + (t === A ? 0 : 100), T0 + i * MIN, T0 + i * MIN, t));
  const day2 = (t = A) => Array.from({ length: 3 }, (_, i) => pgRow(10 + i + (t === A ? 0 : 100), T0 + 30 * H + i * MIN, T0 + 30 * H + i * MIN, t));
  let now = T0 + 55 * H;
  let connects: string[] = [];
  const deps = (s: FakeStorage, a: FakeAnchors): CompressTenantDeps => ({
    readTextFile: (p) => readFileSync(p, "utf8"),
    connect: async (_c, purpose) => { connects.push(purpose); return { client: purpose === "storage" ? s.client() : a.client(), close: async () => undefined }; },
    home: () => dir,
    now: () => now,
  });
  const base = ["--storage-file", storageFile, "--anchor-file", anchorFile];
  const env = (tenants: string | undefined) => ({ [FLAG]: "1", ...(tenants === undefined ? {} : { [TENANTS_VAR]: tenants }) });
  const run = async (argv: string[], e: Record<string, string>, s: FakeStorage, a: FakeAnchors) => {
    const o = await runStateChainSync(argv, e, deps(s, a));
    return { ...o, text: o.lines.join("\n") };
  };
  const leaks = (t: string) => [PW, "fixture_role", "fixture_anchor", "127.0.0.1", "postgres", "FIXTURE-PAYLOAD", "LEAKED-SECRET", "boom", "segment_json", "run-wb-", "wb-0"].filter((x) => t.includes(x));
  const writes = (s: FakeStorage, a: FakeAnchors) => [
    ...s.log.filter((q) => q.sql === INSERT_SEGMENT_SQL || q.sql === WRITE_BEGIN || q.sql === TENANT_LOCK_SQL).map((q) => q.sql),
    ...a.log.filter((q) => q.sql === INSERT_STATE_ANCHOR_SQL || q.sql === ANCHOR_WRITE_BEGIN || q.sql === ANCHOR_LOCK_SQL).map((q) => q.sql),
  ];

  await check("tenant allowlist: comma-separated, validated with TENANT_ID_PATTERN, deduplicated, capped; invalid => usage, nothing read", async () => {
    assert.deepEqual(parseTenantList(" prod-a, ,prod-b,prod-a "), { ok: true, tenants: ["prod-a", "prod-b"] });
    assert.deepEqual(parseTenantList(undefined), { ok: true, tenants: [] });
    for (const bad of ["Prod-A", "prod a", "-x", "a/b", "prod-a;DROP", "x".repeat(41)]) assert.equal(parseTenantList(`prod-a,${bad}`).ok, false, bad);
    assert.equal(parseTenantList(Array.from({ length: 51 }, (_, i) => `t${i}`).join(",")).ok, false);
    const s = new FakeStorage(), a = new FakeAnchors();
    connects = [];
    const o = await run(base, env("prod-a,Bad Tenant"), s, a);
    assert.equal(o.exitCode, 2); assert.match(o.text, /^usage: SHIYAN_SYNC_TENANTS entry 2 is not a valid tenant id$/);
    assert.ok(!o.text.includes("Bad Tenant"), "the invalid value is not echoed");
    assert.deepEqual(connects, []);
  });

  await check("gate and no-op: refuses without SHIYAN_STATE_COMPRESSION=1; no tenants configured => exit 0, nothing read; unknown flags refused", async () => {
    const s = new FakeStorage(), a = new FakeAnchors();
    connects = [];
    for (const e of [{}, { [FLAG]: "0", [TENANTS_VAR]: A }] as Record<string, string>[]) {
      const o = await run([...base, "--write"], e, s, a);
      assert.equal(o.exitCode, 2); assert.match(o.text, /^REFUSED: /);
    }
    for (const t of [undefined, "", " , "]) {
      const o = await run([...base, "--write"], env(t), s, a);
      assert.equal(o.exitCode, 0); assert.match(o.text, /no tenants configured/); assert.match(o.text, /RESULT: PASS \(0 tenants\)$/);
    }
    assert.equal((await run([...base, "--tenant", A], env(A), s, a)).exitCode, 2);
    assert.equal((await run(["--storage-file", storageFile], env(A), s, a)).exitCode, 2, "the anchors database is required");
    const same = await run(["--storage-file", storageFile, "--anchor-file", sameFile, "--write"], env(A), s, a);
    assert.equal(same.exitCode, 1); assert.match(same.text, /different database with a different role/);
    assert.deepEqual(connects, []); assert.equal(s.log.length + a.log.length, 0);
  });

  const s = new FakeStorage(), a = new FakeAnchors();
  s.experiences.push(...day1(), ...day2());
  await check("dry run by default: READ ONLY on both databases, reports would_append/would_anchor, writes nothing", async () => {
    const o = await run(base, env(A), s, a);
    assert.equal(o.exitCode, 0, o.text);
    assert.match(o.text, /^state-chain sync: mode=dry-run \(READ ONLY, nothing written\) tenants=1 as_of=\S+$/m);
    assert.match(o.text, /^tenant tenant-a: OK mode=dry-run stored=0 would_append=2 pending=0 loss=lossless context=yes anchor=unanchored would_anchor=0 covers_head=no head=none$/m);
    assert.match(o.text, /RESULT: PASS \(1 tenant\(s\)\)$/);
    assert.deepEqual(writes(s, a), []); assert.equal(s.segments.length, 0); assert.equal(a.anchors.length, 0);
    assert.deepEqual(leaks(o.text), []);
  });

  await check("--write: appends only after a passing dry run, verifies, anchors the new head, verifies the anchor", async () => {
    s.log = []; a.log = [];
    const o = await run([...base, "--write"], env(A), s, a);
    assert.equal(o.exitCode, 0, o.text);
    assert.equal(s.segments.length, 2); assert.equal(a.anchors.length, 1);
    const head = s.segments[1].segment_sha256 as string;
    assert.match(o.text, new RegExp(`^tenant tenant-a: OK mode=write stored=2 appended=2 pending=0 loss=lossless context=yes anchor=anchored anchored=1 covers_head=yes head=${head} anchored_seq=1$`, "m"));
    // Order: READ ONLY dry run before any write; write transaction under the tenant lock.
    const kinds = s.log.map((q) => q.sql);
    const firstWrite = kinds.indexOf(WRITE_BEGIN);
    assert.ok(firstWrite > 0 && kinds.slice(0, firstWrite).filter((x) => x === READ_ONLY_BEGIN).length === 2, "probe + dry run precede the write");
    assert.equal(kinds[firstWrite + 1], TENANT_LOCK_SQL);
    const ak = a.log.map((q) => q.sql);
    assert.ok(ak.indexOf(ANCHOR_WRITE_BEGIN) > ak.indexOf(READ_ONLY_BEGIN) && ak[ak.indexOf(ANCHOR_WRITE_BEGIN) + 1] === ANCHOR_LOCK_SQL);
    assert.ok(s.log.every((q) => q.params === undefined || q.params[0] === A), "every storage statement is scoped to the tenant");
    assert.ok(a.log.every((q) => q.params === undefined || q.params[0] === A), "every anchors statement is scoped to the tenant");
    assert.deepEqual(leaks(o.text), []);
  });

  await check("idempotent rerun: appended=0 anchored=0, no INSERT or write transaction sent", async () => {
    s.log = []; a.log = [];
    const o = await run([...base, "--write"], env(A), s, a);
    assert.equal(o.exitCode, 0, o.text);
    assert.match(o.text, /tenant tenant-a: OK mode=write stored=2 appended=0 pending=0 .* anchor=anchored anchored=0 covers_head=yes/);
    assert.deepEqual(writes(s, a), []);
  });

  await check("uses the stored chain's own options (not hardcoded): a context-free bounded chain is extended as such", async () => {
    const s2 = new FakeStorage(), a2 = new FakeAnchors();
    s2.experiences.push(...day1());
    const opts = { segmentSize: 256, cutoffMs: 12 * H, graceMs: 5 * MIN, asOfMs: T0 + 30 * H, loss: { mode: "bounded" as const, eps: { predicted: 0.001, observed: 0.001, phi: 0.0001 } } };
    assert.equal((await persistTenantSegments(s2.client(), A, "write", opts)).inserted, 1);
    s2.experiences.push(...day2());
    const o = await run([...base, "--write"], env(A), s2, a2);
    assert.equal(o.exitCode, 0, o.text);
    assert.match(o.text, /stored=2 appended=1 pending=0 loss=bounded context=no anchor=anchored anchored=1 covers_head=yes/);
    assert.equal(s2.segments[1].cutoff_ms, 12 * H); assert.equal(s2.segments[1].grace_ms, 5 * MIN); assert.equal(s2.segments[1].context_sha256, null);
  });

  await check("fail closed: a persist failure stops that tenant before anchoring, other tenants continue, exit 1", async () => {
    const s3 = new FakeStorage(), a3 = new FakeAnchors();
    s3.experiences.push(...day1(), ...day2(), ...day1(B), ...day2(B));
    await persistTenantSegments(s3.client(), A, "write", { segmentSize: 256, cutoffMs: 24 * H, graceMs: 10 * MIN, asOfMs: now, loss: { mode: "lossless" } });
    s3.experiences.splice(0, 1); // tenant-a's stored segment no longer matches its sources
    s3.log = []; a3.log = [];
    const o = await run([...base, "--write"], env(`${A},${B}`), s3, a3);
    assert.equal(o.exitCode, 1);
    assert.match(o.text, /^tenant tenant-a: FAIL at persist\.probe \(stored chain does not verify \(\d+ error\(s\)\)\); later steps skipped, nothing further written$/m);
    assert.match(o.text, /^tenant tenant-b: OK mode=write stored=2 appended=2 /m);
    assert.match(o.text, /RESULT: FAIL \(1 of 2 tenant\(s\) failed\)$/);
    assert.ok(!a3.log.some((q) => q.params?.[0] === A && (q.sql === STATE_ANCHORS_SQL || q.sql === INSERT_STATE_ANCHOR_SQL)), "no anchor step for the failed tenant");
    assert.ok(!s3.log.some((q) => q.sql === INSERT_SEGMENT_SQL && q.params?.[0] === A));
    assert.deepEqual(a3.anchors.map((r) => r.tenant_id), [B]);
    assert.deepEqual(leaks(o.text), []);
  });

  await check("fail closed: a DB error prints class/code only and skips the rest of that tenant", async () => {
    const s4 = new FakeStorage(), a4 = new FakeAnchors();
    s4.experiences.push(...day1(), ...day2());
    s4.failOn = { sql: INSERT_SEGMENT_SQL, code: "42501" };
    const o = await run([...base, "--write"], env(A), s4, a4);
    assert.equal(o.exitCode, 1);
    assert.match(o.text, /^tenant tenant-a: FAIL at persist\.write \(class=\S+ code=42501\); later steps skipped/m);
    assert.equal(s4.segments.length, 0); assert.equal(a4.anchors.length, 0); assert.equal(a4.log.filter((q) => q.sql === STATE_ANCHORS_SQL).length, 1, "only the READ ONLY pre-check"); assert.ok(!a4.log.some((q) => q.sql === ANCHOR_WRITE_BEGIN || q.sql === INSERT_STATE_ANCHOR_SQL), "no anchor write after a failed persist write");
    assert.deepEqual(leaks(o.text), []);
    const s5 = new FakeStorage(), a5 = new FakeAnchors();
    s5.failOn = { sql: STORED_SEGMENTS_SQL, code: "42P01" };
    const m = await run([...base, "--write"], env(A), s5, a5);
    assert.equal(m.exitCode, 1); assert.match(m.text, /FAIL at persist\.probe \(class=\S+ code=42P01\)/);
  });

  await check("fail closed: an anchor mismatch is caught before any write (storage untouched, no anchor insert, exit 1)", async () => {
    const s6 = new FakeStorage(), a6 = new FakeAnchors();
    s6.experiences.push(...day1(), ...day2());
    a6.anchors.push({ tenant_id: A, seq: 0, chain_head: sha("forged"), segment_count: 1, anchored_at: new Date(T0) });
    const o = await run([...base, "--write"], env(A), s6, a6);
    assert.equal(o.exitCode, 1);
    assert.match(o.text, /^tenant tenant-a: FAIL at anchor\.precheck \(mismatch \(1 anchor\(s\) disagree with the stored chain\)\); later steps skipped/m);
    assert.equal(a6.anchors.length, 1); assert.ok(!a6.log.some((q) => q.sql === INSERT_STATE_ANCHOR_SQL || q.sql === ANCHOR_WRITE_BEGIN));
    assert.equal(s6.segments.length, 0); assert.deepEqual(writes(s6, a6), []);
    // A mismatch that appears only after an append (anchor at the new seq) is still refused at the anchor step.
    const s7 = new FakeStorage(), a7 = new FakeAnchors();
    s7.experiences.push(...day1(), ...day2());
    a7.anchors.push({ tenant_id: A, seq: 1, chain_head: sha("forged"), segment_count: 2, anchored_at: new Date(T0) });
    const late = await run([...base, "--write"], env(A), s7, a7);
    assert.equal(late.exitCode, 1); assert.match(late.text, /FAIL at anchor\.precheck/, "an anchor beyond the stored head is a mismatch before any write");
    assert.equal(s7.segments.length, 0);
    const dry = await run(base, env(A), s6, a6);
    assert.equal(dry.exitCode, 1, "a dry run also fails closed on a mismatch");
  });

  await check("connection failures fail closed with class/code only", async () => {
    const o = await runStateChainSync([...base, "--write"], env(A), { ...deps(new FakeStorage(), new FakeAnchors()), connect: async () => { throw Object.assign(new Error(`connect postgres://x:${PW}@h/d`), { code: "28P01" }); } });
    assert.equal(o.exitCode, 1); assert.match(o.lines.join("\n"), /FAIL storage\.connect: class=\S+ code=28P01\nRESULT: FAIL \(nothing was written\)$/);
    assert.deepEqual(leaks(o.lines.join("\n")), []);
  });

  // ---------- Workflow YAML (static) ----------
  // The workflow ships staged at ops/github/ (the bot's push token cannot write .github/workflows);
  // once installed at .github/workflows/ that copy is checked, and a leftover staged copy must be identical.
  const installedPath = join(root, ".github", "workflows", "state-chain-sync.yml");
  const stagedPath = join(root, "ops", "github", "state-chain-sync.yml");
  const yml = existsSync(installedPath) ? readFileSync(installedPath, "utf8") : readFileSync(stagedPath, "utf8");
  if (existsSync(installedPath) && existsSync(stagedPath)) assert.equal(readFileSync(stagedPath, "utf8"), yml, "staged and installed workflow differ");
  console.log(`  (workflow checked at ${existsSync(installedPath) ? ".github/workflows" : "ops/github (staged, not yet installed)"})`);
  const code = yml.split("\n").filter((l) => !l.trim().startsWith("#")).join("\n");
  await check("workflow: hourly + manual, contents: read, no overlap, pinned actions, timeout, npm ci", () => {
    assert.match(code, /schedule:\n\s+- cron: "17 \* \* \* \*"/);
    assert.match(code, /workflow_dispatch:\n\s+inputs:\n\s+write:\n(\s+.+\n)*?\s+type: boolean\n(\s+.+\n)*?\s+default: false/);
    assert.match(code, /^permissions:\n  contents: read\n/m);
    assert.equal((code.match(/permissions:/g) ?? []).length, 1);
    assert.match(code, /concurrency:\n\s+group: state-chain-sync\n\s+cancel-in-progress: false/);
    assert.match(code, /timeout-minutes: 10/);
    for (const u of code.matchAll(/uses: (\S+)/g)) assert.match(u[1], /^actions\/(checkout|setup-node)@(v\d+|[0-9a-f]{40})$/, u[1]);
    assert.match(code, /persist-credentials: false/);
    assert.match(code, /run: npm ci/);
  });

  await check("workflow: writes gated by the SHIYAN_SYNC_WRITE variable (schedule) or write input (manual); inert until configured", () => {
    assert.match(code, /SYNC_WRITE: \$\{\{ \(github\.event_name == 'schedule' && vars\.SHIYAN_SYNC_WRITE == 'true'\) \|\| \(github\.event_name == 'workflow_dispatch' && inputs\.write == true\) \}\}/);
    assert.match(code, /if \[ "\$SYNC_WRITE" = "true" \]; then WRITE_FLAG="--write"; fi/);
    assert.equal((code.match(/--write/g) ?? []).length, 1, "--write appears only behind the gate");
    assert.match(code, /SHIYAN_STATE_COMPRESSION: "1"/);
    assert.match(code, /configured=false/);
    for (const step of code.split(/\n      - name: /).slice(2)) {
      const name = step.split("\n")[0];
      if (name === "Remove database URL files") assert.match(step, /if: always\(\)/);
      else assert.match(step, /if: steps\.config\.outputs\.configured == 'true'/, name);
    }
  });

  await check("workflow: secrets only written to 0600 temp files (masked, passed by path, removed always); no tracing or env dumps", () => {
    const secretRefs = [...code.matchAll(/secrets\.([A-Z_]+)/g)].map((m) => m[0]);
    assert.deepEqual([...new Set(secretRefs)].sort(), ["secrets.SHIYAN_ANCHOR_URL", "secrets.SHIYAN_STORAGE_URL"]);
    const writeStep = code.slice(code.indexOf("- name: Write database URL files"), code.indexOf("- name: Sync state chains"));
    assert.match(writeStep, /STORAGE_URL: \$\{\{ secrets\.SHIYAN_STORAGE_URL \}\}/); assert.match(writeStep, /ANCHOR_URL: \$\{\{ secrets\.SHIYAN_ANCHOR_URL \}\}/);
    assert.match(writeStep, /umask 077/);
    assert.match(writeStep, /echo "::add-mask::\$STORAGE_URL"/); assert.match(writeStep, /echo "::add-mask::\$ANCHOR_URL"/);
    assert.match(writeStep, /printf '%s' "\$STORAGE_URL" > "\$RUNNER_TEMP\/shiyan-storage-url"/);
    assert.match(writeStep, /printf '%s' "\$ANCHOR_URL" > "\$RUNNER_TEMP\/shiyan-anchor-url"/);
    const outside = code.replace(writeStep, "");
    assert.ok(!/secrets\.SHIYAN_(STORAGE|ANCHOR)_URL \}\}/.test(outside.replace(/HAS_(STORAGE|ANCHOR)_URL: \$\{\{ secrets\.SHIYAN_(STORAGE|ANCHOR)_URL != '' \}\}/g, "")), "secret values are only expanded in the file-writing step");
    assert.ok(!/\$STORAGE_URL|\$ANCHOR_URL/.test(outside), "URL variables are used only in the file-writing step");
    assert.match(code, /- name: Remove database URL files\n\s+if: always\(\)\n\s+shell: bash\n\s+run: rm -f "\$RUNNER_TEMP\/shiyan-storage-url" "\$RUNNER_TEMP\/shiyan-anchor-url"/);
    assert.match(code, /--storage-file "\$RUNNER_TEMP\/shiyan-storage-url"/); assert.match(code, /--anchor-file "\$RUNNER_TEMP\/shiyan-anchor-url"/);
    assert.ok(!/set -x|set -o xtrace|\bxtrace\b|\bprintenv\b|^\s*env\s*$|\benv \|/m.test(code), "no tracing or env dumps");
    assert.ok(!/cat "\$RUNNER_TEMP|echo "\$(STORAGE|ANCHOR)_URL"/.test(code));
    assert.ok(!/ACTIONS_STEP_DEBUG|ACTIONS_RUNNER_DEBUG/.test(code));
  });

  rmSync(dir, { recursive: true, force: true });
  console.log(`PASS check-state-chain-sync (${checks} checks)`);
}

main().catch((error) => { console.error(error); process.exit(1); });
