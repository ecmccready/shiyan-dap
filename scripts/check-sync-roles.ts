/** TEST ONLY. Offline check for the scheduled-sync least-privilege roles: parses
 * db/migrations/006_shiyan_sync_role.sql and 006_shiyan_anchor_sync_role.sql, asserts the exact
 * grant set and the absence of forbidden privileges, and statically checks that every table the
 * sync path queries is covered by a grant with the needed verb (allowlist in scripts/sync-role-grants.ts,
 * derived from the 2026-11-17 audit). Also exercises scripts/verify-sync-roles.ts against in-memory
 * fakes (READ ONLY, no URLs or secrets in output). Never connects to a database or the network.
 * The only files touched are fixture URL files in a fresh temp dir, deleted at the end.
 * Run: npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-sync-roles.ts
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TENANT_ROWS_SQL, TENANT_REFERENCE_ANCHORS_SQL, TENANT_RECOVERY_RECORDS_SQL, type ReadOnlyClient } from "../src/core/compression/source";
import { INSERT_SEGMENT_SQL, STORED_SEGMENTS_SQL, TENANT_LOCK_SQL } from "../src/core/compression/store";
import { INSERT_STATE_ANCHOR_SQL, ANCHOR_LOCK_SQL } from "../src/core/compression/anchor-store";
import { CHAIN_HEADS_SQL, STATE_ANCHORS_SQL } from "../src/core/compression/chain-head";
import type { CompressTenantDeps } from "./compress-tenant";
import {
  ANCHOR_SYNC_ROLE, STORAGE_SYNC_ROLE, SYNC_ROLE_GRANTS, privilegesAllowed, tablesUsedInSql,
  type RoleGrantSpec,
} from "./sync-role-grants";
import {
  VERIFY_BEGIN, VERIFY_MEMBERS_SQL, VERIFY_ROLE_SQL, VERIFY_SCHEMA_SQL, VERIFY_SEQUENCES_SQL, VERIFY_TABLES_SQL,
  isAllowedVerifySql, judgeRolePrivileges, runVerifySyncRoles, type RoleObservation, type TablePrivRow,
} from "./verify-sync-roles";

const PW = "fixture-pw-" + randomBytes(6).toString("hex");
const root = join(import.meta.dirname, "..");
const STORAGE_MIGRATION = join(root, "db", "migrations", "006_shiyan_sync_role.sql");
const ANCHOR_MIGRATION = join(root, "db", "migrations", "006_shiyan_anchor_sync_role.sql");
const SYNC_PATH_FILES = [
  "scripts/sync-state-chains.ts",
  "src/core/compression/source.ts",
  "src/core/compression/store.ts",
  "src/core/compression/anchor-store.ts",
  "src/core/compression/chain-head.ts",
] as const;

const codeOf = (sql: string) => sql.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");

function parseGrants(code: string): { privileges: string[]; object: string; role: string }[] {
  return [...code.matchAll(/GRANT\s+(.+?)\s+ON\s+(.+?)\s+TO\s+([a-z_][a-z0-9_]*)\s*;/gi)].map((m) => ({
    privileges: m[1].split(",").map((p) => p.trim().toUpperCase()),
    object: m[2].replace(/\s+/g, " ").trim(),
    role: m[3],
  }));
}

function assertMigration(spec: RoleGrantSpec, sql: string): void {
  const code = codeOf(sql);
  assert.ok(!/^\\/m.test(sql), `${spec.role}: plain SQL, no psql meta-commands`);
  assert.ok(!/PASSWORD\s+/i.test(code) && !/CREATE\s+ROLE/i.test(code), `${spec.role}: no PASSWORD clause and no CREATE ROLE`);
  assert.match(code, /^BEGIN;/m);
  assert.match(code, /^COMMIT;\s*$/m);
  assert.ok(code.trim().startsWith("BEGIN;") && code.trim().endsWith("COMMIT;"), `${spec.role}: wrapped in one transaction`);
  assert.match(code, new RegExp(`IF NOT EXISTS \\(SELECT 1 FROM pg_roles WHERE rolname = '${spec.role}'\\)`));
  assert.match(code, /RAISE EXCEPTION/);
  assert.match(code, /rolsuper OR r\.rolcreatedb OR r\.rolcreaterole OR r\.rolreplication OR r\.rolbypassrls/);
  assert.match(code, /NOT r\.rolcanlogin/);
  assert.match(code, new RegExp(`REVOKE ALL ON SCHEMA ${spec.schema} FROM ${spec.role};`));
  assert.match(code, new RegExp(`REVOKE ALL ON ALL TABLES IN SCHEMA ${spec.schema} FROM ${spec.role};`));
  assert.match(code, new RegExp(`REVOKE ALL ON ALL SEQUENCES IN SCHEMA ${spec.schema} FROM ${spec.role};`));
  assert.match(code, new RegExp(`GRANT USAGE ON SCHEMA ${spec.schema} TO ${spec.role};`));
  const grants = parseGrants(code);
  const expected = [
    { privileges: ["USAGE"], object: `SCHEMA ${spec.schema}`, role: spec.role },
    ...spec.tables.map((t) => ({ privileges: [...t.privileges], object: t.table, role: spec.role })),
  ];
  assert.deepEqual(grants, expected, `${spec.role}: exact grant set`);
  for (const g of grants) {
    assert.ok(!g.privileges.some((p) => /^(ALL|UPDATE|DELETE|TRUNCATE|REFERENCES|TRIGGER|CREATE|EXECUTE)$/.test(p)), `forbidden privilege in ${JSON.stringify(g)}`);
    assert.ok(!/\bSEQUENCE\b|\bALL TABLES\b|\bALL SEQUENCES\b/i.test(g.object), `over-broad grant: ${g.object}`);
  }
  assert.ok(!/\bGRANT\b[\s\S]*?\b(UPDATE|DELETE|TRUNCATE|REFERENCES|TRIGGER)\b/.test(code), `${spec.role}: no forbidden privilege words on a GRANT`);
  assert.ok(!/GRANT[\s\S]*ON\s+SEQUENCE/i.test(code), `${spec.role}: no sequence grants`);
  assert.ok(!/\b(DROP TABLE|DROP ROLE|DROP FUNCTION|DELETE FROM|TRUNCATE TABLE|ALTER TABLE|INSERT INTO|CREATE TABLE|CREATE ROLE)\b/i.test(code), `${spec.role}: no destructive or data statements`);
}

const none: Omit<TablePrivRow, "schema" | "name"> = { sel: false, ins: false, upd: false, del: false, trunc: false, refs: false, trig: false };
const table = (schema: string, name: string, privs: Partial<TablePrivRow> = {}): TablePrivRow => ({ schema, name, ...none, ...privs });

function goodStorage(): RoleObservation {
  return {
    role: { rolname: STORAGE_SYNC_ROLE, rolsuper: false, rolcreatedb: false, rolcreaterole: false, rolreplication: false, rolbypassrls: false, rolcanlogin: true },
    members: [],
    schemaUsage: true, schemaCreate: false,
    tables: [
      table("shiyan", "experiences", { sel: true }),
      table("shiyan", "reference_envelopes"),
      table("shiyan", "state_segments", { sel: true, ins: true }),
    ],
    sequences: [],
  };
}
function goodAnchors(): RoleObservation {
  return {
    role: { rolname: ANCHOR_SYNC_ROLE, rolsuper: false, rolcreatedb: false, rolcreaterole: false, rolreplication: false, rolbypassrls: false, rolcanlogin: true },
    members: [],
    schemaUsage: true, schemaCreate: false,
    tables: [
      table("shiyan_anchor", "recovery_records", { sel: true }),
      table("shiyan_anchor", "reference_anchors", { sel: true }),
      table("shiyan_anchor", "state_chain_anchors", { sel: true, ins: true }),
    ],
    sequences: [{ schema: "shiyan_anchor", name: "recovery_records_id_seq", usage: false, sel: false, upd: false }],
  };
}

class FakePriv {
  log: { sql: string; params?: unknown[] }[] = [];
  failOn?: string;
  constructor(readonly obs: RoleObservation) {}
  client(): ReadOnlyClient {
    return {
      query: async (sql: string, params?: unknown[]) => {
        this.log.push({ sql, params });
        if (this.failOn && sql === this.failOn) throw Object.assign(new Error(`boom postgres://leak:LEAKED-SECRET@h/d code 57014`), { code: "57014" });
        if (sql === VERIFY_BEGIN || sql === "COMMIT" || sql === "ROLLBACK") return { rows: [] };
        if (sql === VERIFY_ROLE_SQL) return { rows: [this.obs.role] };
        if (sql === VERIFY_MEMBERS_SQL) return { rows: this.obs.members.map((rolname) => ({ rolname })) };
        if (sql === VERIFY_SCHEMA_SQL) return { rows: [{ usage: this.obs.schemaUsage, create_schema: this.obs.schemaCreate }] };
        if (sql === VERIFY_TABLES_SQL) return { rows: this.obs.tables };
        if (sql === VERIFY_SEQUENCES_SQL) return { rows: this.obs.sequences };
        throw new Error(`fake verify: unexpected statement ${sql.slice(0, 40)}`);
      },
    };
  }
}

let checks = 0;
const check = async (name: string, fn: () => void | Promise<void>) => { await fn(); checks += 1; console.log(`PASS ${name}`); };

async function main(): Promise<void> {
  const storageSql = readFileSync(STORAGE_MIGRATION, "utf8");
  const anchorSql = readFileSync(ANCHOR_MIGRATION, "utf8");
  const storageSpec = SYNC_ROLE_GRANTS.find((s) => s.project === "storage")!;
  const anchorsSpec = SYNC_ROLE_GRANTS.find((s) => s.project === "anchors")!;

  await check("migration 006 storage: role must already exist, exact grants, no forbidden privileges, idempotent, plain SQL", () => {
    assertMigration(storageSpec, storageSql);
    assert.match(storageSql, /STORAGE Neon project/);
    assert.match(codeOf(storageSql), /to_regclass\('shiyan\.experiences'\)/);
    assert.match(codeOf(storageSql), /to_regclass\('shiyan\.state_segments'\)/);
    assert.match(codeOf(storageSql), /rolname IN \('shiyan_app', 'neon_superuser'\)/);
  });

  await check("migration 006 anchors: role must already exist, exact grants, no forbidden privileges, idempotent, plain SQL", () => {
    assertMigration(anchorsSpec, anchorSql);
    assert.match(anchorSql, /ANCHORS Neon project/);
    assert.match(codeOf(anchorSql), /to_regclass\('shiyan_anchor\.reference_anchors'\)/);
    assert.match(codeOf(anchorSql), /to_regclass\('shiyan_anchor\.recovery_records'\)/);
    assert.match(codeOf(anchorSql), /to_regclass\('shiyan_anchor\.state_chain_anchors'\)/);
    assert.match(codeOf(anchorSql), /rolname IN \('shiyan_anchor', 'shiyan_anchor_app', 'neon_superuser'\)/);
    assert.match(anchorSql, /recovery_records_id_seq/);
    assert.ok(!/GRANT[\s\S]*recovery_records_id_seq/i.test(codeOf(anchorSql)), "sequence is mentioned only to explain why it is not granted");
  });

  await check("neither migration creates a role, sets a password, or grants UPDATE/DELETE/TRUNCATE/CREATE", () => {
    for (const [name, sql] of [["storage", storageSql], ["anchors", anchorSql]] as const) {
      const code = codeOf(sql);
      assert.ok(!/CREATE\s+ROLE/i.test(code), name);
      assert.ok(!/PASSWORD/i.test(code), name);
      assert.ok(!/ALTER\s+ROLE/i.test(code), name);
      assert.equal((code.match(/GRANT /g) ?? []).length, name === "storage" ? 3 : 4);
    }
  });

  await check("static coverage: every table the sync path queries is on the grant allowlist with the needed verb", () => {
    const exported: [string, string][] = [
      ["TENANT_ROWS_SQL", TENANT_ROWS_SQL],
      ["TENANT_REFERENCE_ANCHORS_SQL", TENANT_REFERENCE_ANCHORS_SQL],
      ["TENANT_RECOVERY_RECORDS_SQL", TENANT_RECOVERY_RECORDS_SQL],
      ["STORED_SEGMENTS_SQL", STORED_SEGMENTS_SQL],
      ["INSERT_SEGMENT_SQL", INSERT_SEGMENT_SQL],
      ["STATE_ANCHORS_SQL", STATE_ANCHORS_SQL],
      ["INSERT_STATE_ANCHOR_SQL", INSERT_STATE_ANCHOR_SQL],
    ];
    const lockSql = [TENANT_LOCK_SQL, ANCHOR_LOCK_SQL];
    for (const sql of lockSql) {
      assert.equal(tablesUsedInSql(sql).length, 0, `lock SQL must not touch a table: ${sql}`);
      assert.match(sql, /pg_advisory_xact_lock\(hashtext\(/);
    }
    const uses = exported.flatMap(([, sql]) => tablesUsedInSql(sql));
    assert.ok(uses.length >= 7, "expected every SELECT/INSERT constant to name a table");
    for (const u of uses) {
      const spec = SYNC_ROLE_GRANTS.find((s) => u.table.startsWith(`${s.schema}.`));
      assert.ok(spec, `no sync role covers table ${u.table}`);
      assert.ok(privilegesAllowed(spec, u.table).has(u.verb), `${u.verb} on ${u.table} is not granted to ${spec.role}`);
    }
    // Belt-and-suspenders: scan the sync-path sources for any other qualified table references.
    for (const rel of SYNC_PATH_FILES) {
      const text = readFileSync(join(root, rel), "utf8");
      for (const u of tablesUsedInSql(text)) {
        const spec = SYNC_ROLE_GRANTS.find((s) => u.table.startsWith(`${s.schema}.`));
        assert.ok(spec, `${rel}: unqualified/unknown table ${u.table}`);
        assert.ok(privilegesAllowed(spec, u.table).has(u.verb), `${rel}: ${u.verb} on ${u.table} is not granted to ${spec.role}`);
      }
    }
    const syncCli = readFileSync(join(root, "scripts/sync-state-chains.ts"), "utf8");
    assert.ok(!/export-reader/.test(syncCli), "sync CLI must not import the export reader");
    assert.ok(!/CHAIN_HEADS_SQL/.test(syncCli), "sync CLI must not use CHAIN_HEADS_SQL");
    // CHAIN_HEADS_SQL is export-only; it still only SELECTs state_segments, already granted.
    const exportUse = tablesUsedInSql(CHAIN_HEADS_SQL);
    assert.deepEqual(exportUse, [{ verb: "SELECT", table: "shiyan.state_segments" }]);
  });

  await check("judgeRolePrivileges: good observations PASS; UPDATE, extra table access, CREATE, and a sequence grant FAIL", () => {
    const s = judgeRolePrivileges(storageSpec, goodStorage());
    assert.equal(s.ok, true, s.lines.join("\n"));
    assert.ok(s.lines.some((l) => l.includes("PASS table shiyan.experiences SELECT")));
    assert.ok(s.lines.some((l) => l.includes("PASS table shiyan.state_segments INSERT")));
    assert.ok(s.lines.some((l) => l.includes("PASS table shiyan.reference_envelopes no access")));
    assert.ok(s.lines.some((l) => l.includes("PASS schema shiyan no CREATE")));

    const updated = goodStorage();
    updated.tables = updated.tables.map((t) => t.name === "state_segments" ? { ...t, upd: true } : t);
    const u = judgeRolePrivileges(storageSpec, updated);
    assert.equal(u.ok, false);
    assert.ok(u.lines.some((l) => /FAIL table shiyan\.state_segments has UPDATE/.test(l)));

    const leak = goodStorage();
    leak.tables = leak.tables.map((t) => t.name === "reference_envelopes" ? { ...t, sel: true } : t);
    const l = judgeRolePrivileges(storageSpec, leak);
    assert.equal(l.ok, false);
    assert.ok(l.lines.some((x) => /FAIL table shiyan\.reference_envelopes has SELECT/.test(x)));

    const create = goodStorage();
    create.schemaCreate = true;
    assert.equal(judgeRolePrivileges(storageSpec, create).ok, false);

    const a = judgeRolePrivileges(anchorsSpec, goodAnchors());
    assert.equal(a.ok, true, a.lines.join("\n"));
    const seq = goodAnchors();
    seq.sequences = [{ schema: "shiyan_anchor", name: "recovery_records_id_seq", usage: true, sel: false, upd: false }];
    const q = judgeRolePrivileges(anchorsSpec, seq);
    assert.equal(q.ok, false);
    assert.ok(q.lines.some((x) => /FAIL sequence shiyan_anchor\.recovery_records_id_seq has USAGE/.test(x)));
  });

  const dir = mkdtempSync(join(tmpdir(), "sync-roles-"));
  const storageFile = join(dir, "storage-url"), anchorFile = join(dir, "anchor-url"), sameFile = join(dir, "same-url");
  writeFileSync(storageFile, `postgresql://shiyan_sync:${PW}@127.0.0.1:5432/fixture_db?sslmode=disable\n`);
  writeFileSync(anchorFile, `postgresql://shiyan_anchor_sync:${PW}@127.0.0.1:5432/fixture_anchor_db?sslmode=disable\n`);
  writeFileSync(sameFile, `postgresql://shiyan_sync:${PW}@127.0.0.1:5432/fixture_db?sslmode=disable\n`);
  const leaks = (t: string) => [PW, "127.0.0.1", "postgres", "LEAKED-SECRET", "fixture_db", "boom"].filter((x) => t.includes(x));
  try {
    let connects: string[] = [];
    const deps = (s: FakePriv, a: FakePriv): CompressTenantDeps => ({
      readTextFile: (p) => readFileSync(p, "utf8"),
      connect: async (_c, purpose) => {
        connects.push(purpose);
        return { client: purpose === "storage" ? s.client() : a.client(), close: async () => undefined };
      },
      home: () => dir,
    });
    const base = ["--storage-file", storageFile, "--anchor-file", anchorFile];

    await check("verifier usage: both URL files required; unknown flags refused; same-DB URLs fail closed; nothing connected", async () => {
      connects = [];
      const s = new FakePriv(goodStorage()), a = new FakePriv(goodAnchors());
      assert.equal((await runVerifySyncRoles([], {}, deps(s, a))).exitCode, 2);
      assert.equal((await runVerifySyncRoles(["--storage-file", storageFile], {}, deps(s, a))).exitCode, 2);
      assert.equal((await runVerifySyncRoles([...base, "--write"], {}, deps(s, a))).exitCode, 2);
      const same = await runVerifySyncRoles(["--storage-file", storageFile, "--anchor-file", sameFile], {}, deps(s, a));
      assert.equal(same.exitCode, 1);
      assert.match(same.lines.join("\n"), /different database with a different role/);
      assert.deepEqual(connects, []);
      assert.equal(s.log.length + a.log.length, 0);
    });

    await check("verifier PASS: both roles, only READ ONLY statements, no URLs or secrets in output", async () => {
      const s = new FakePriv(goodStorage()), a = new FakePriv(goodAnchors());
      const o = await runVerifySyncRoles(base, {}, deps(s, a));
      const text = o.lines.join("\n");
      assert.equal(o.exitCode, 0, text);
      assert.match(text, /^verify-sync-roles: storage role=shiyan_sync$/m);
      assert.match(text, /^verify-sync-roles: anchors role=shiyan_anchor_sync$/m);
      assert.match(text, /^RESULT: PASS$/m);
      assert.deepEqual(leaks(text), []);
      for (const fake of [s, a]) {
        assert.ok(fake.log[0]?.sql === VERIFY_BEGIN);
        assert.ok(fake.log.every((q) => isAllowedVerifySql(q.sql)));
        assert.ok(fake.log.every((q) => q.sql === "COMMIT" || q.sql === "ROLLBACK" || q.sql === VERIFY_BEGIN || q.sql.startsWith("SELECT ")), fake.log.map((q) => q.sql.slice(0, 40)).join(","));
        assert.equal(fake.log.at(-1)?.sql, "COMMIT");
      }
    });

    await check("verifier FAIL: a forbidden privilege or a DB error prints class/code only, writes nothing, exits 1", async () => {
      const bad = goodStorage();
      bad.tables = bad.tables.map((t) => t.name === "experiences" ? { ...t, ins: true } : t);
      const s = new FakePriv(bad), a = new FakePriv(goodAnchors());
      const o = await runVerifySyncRoles(base, {}, deps(s, a));
      const text = o.lines.join("\n");
      assert.equal(o.exitCode, 1);
      assert.match(text, /FAIL table shiyan\.experiences has INSERT/);
      assert.match(text, /RESULT: FAIL \(nothing was written\)/);
      assert.deepEqual(leaks(text), []);
      const s2 = new FakePriv(goodStorage()); s2.failOn = VERIFY_TABLES_SQL;
      const a2 = new FakePriv(goodAnchors());
      const err = await runVerifySyncRoles(base, {}, deps(s2, a2));
      assert.equal(err.exitCode, 1);
      assert.match(err.lines.join("\n"), /FAIL storage\.read: class=\S+ code=57014/);
      assert.ok(!err.lines.join("\n").includes("LEAKED-SECRET"));
      assert.equal(s2.log.at(-1)?.sql, "ROLLBACK");
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  console.log(`PASS check-sync-roles (${checks} checks)`);
}

main().catch((error) => { console.error(error); process.exit(1); });
