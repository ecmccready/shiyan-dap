/**
 * Read-only schema guard for the storage and anchors Neon databases.
 * Never prints URLs, passwords, or error message text. Exit 1 on any FAIL.
 *
 *   npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-schema.ts \
 *     --storage-file ~/.shiyan-storage-url --anchor-file ~/.shiyan-anchor-url
 *
 * URLs may also come from SHIYAN_STORAGE_URL and SHIYAN_ANCHOR_URL.
 * Staged tables (shiyan.state_segments, migration 004) are SKIP while absent and fully checked once present;
 * add --require-state-segments to make their absence a FAIL.
 * A database whose URL is not provided is skipped (not a failure).
 */
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import {
  checkDatabaseUrl,
  independentDatabases,
  poolFor,
  type CheckedDatabaseUrl,
} from "../src/core/neon-db";
import {
  APP_TABLE_PRIVILEGES,
  EXPECTED_ANCHOR_COLUMNS,
  EXPECTED_ANCHOR_TRIGGERS,
  EXPECTED_STORAGE_COLUMNS,
  EXPECTED_STORAGE_TRIGGERS,
  STAGED_STORAGE_COLUMNS,
  STAGED_STORAGE_MIGRATIONS,
  STAGED_STORAGE_TRIGGERS,
  stagedTableMissing,
  RECOVERY_RECORD_PRIVILEGES,
  compareColumns,
  comparePrivileges,
  compareTriggers,
  decodeTgType,
  formatCheck,
  type CheckResult,
  type ColumnInfo,
  type PrivilegeInfo,
  type TriggerInfo,
} from "../src/core/schema-guard";
import { diagnosticErrorClass, diagnosticErrorCode } from "../src/core/storage-diagnostics";
import type { Pool } from "pg";

type Env = Record<string, string | undefined>;

function expandHome(path: string): string {
  if (path === "~") return homedir();
  if (path.startsWith("~/")) return resolve(homedir(), path.slice(2));
  return path;
}

function argValue(argv: string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  if (index === -1) return undefined;
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) return undefined;
  return value;
}

function readUrlFile(path: string): { ok: true; value: string } | { ok: false; reason: string } {
  const resolved = expandHome(path);
  if (!existsSync(resolved)) return { ok: false, reason: "file not found" };
  try {
    const value = readFileSync(resolved, "utf8").trim();
    if (!value) return { ok: false, reason: "file is empty" };
    return { ok: true, value };
  } catch {
    return { ok: false, reason: "file could not be read" };
  }
}

function resolveUrl(
  label: string,
  argv: string[],
  env: Env,
  fileFlag: string,
  envName: string,
): { kind: "skip" } | { kind: "fail"; result: CheckResult } | { kind: "ok"; url: string } {
  const file = argValue(argv, fileFlag);
  if (file) {
    const read = readUrlFile(file);
    if (!read.ok) return { kind: "fail", result: { name: `${label}.url`, ok: false, detail: read.reason } };
    return { kind: "ok", url: read.value };
  }
  const fromEnv = env[envName];
  if (fromEnv && fromEnv.trim()) return { kind: "ok", url: fromEnv.trim() };
  return { kind: "skip" };
}

async function queryPool<T extends Record<string, unknown>>(
  pool: Pool,
  sql: string,
  params: unknown[],
): Promise<{ ok: true; rows: T[] } | { ok: false; detail: string }> {
  try {
    const result = await pool.query<T>(sql, params);
    return { ok: true, rows: result.rows };
  } catch (error) {
    return { ok: false, detail: `code=${diagnosticErrorCode(error)} class=${diagnosticErrorClass(error)}` };
  }
}

async function loadColumns(pool: Pool, schema: string, table: string): Promise<{ ok: true; value: ColumnInfo[] } | { ok: false; detail: string }> {
  const result = await queryPool<{ column_name: unknown; data_type: unknown }>(
    pool,
    `SELECT column_name, data_type
       FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2
      ORDER BY ordinal_position`,
    [schema, table],
  );
  if (!result.ok) return result;
  const value: ColumnInfo[] = [];
  for (const row of result.rows) {
    if (typeof row.column_name !== "string" || typeof row.data_type !== "string") {
      return { ok: false, detail: "malformed column listing" };
    }
    value.push({ name: row.column_name, dataType: row.data_type });
  }
  return { ok: true, value };
}

async function loadTriggers(pool: Pool, schema: string, table: string): Promise<{ ok: true; value: TriggerInfo[] } | { ok: false; detail: string }> {
  const result = await queryPool<{ tgname: unknown; proname: unknown; tgtype: unknown }>(
    pool,
    `SELECT t.tgname, p.proname, t.tgtype
       FROM pg_trigger t
       JOIN pg_class c ON c.oid = t.tgrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       JOIN pg_proc p ON p.oid = t.tgfoid
      WHERE n.nspname = $1 AND c.relname = $2 AND NOT t.tgisinternal
      ORDER BY t.tgname`,
    [schema, table],
  );
  if (!result.ok) return result;
  const value: TriggerInfo[] = [];
  for (const row of result.rows) {
    if (typeof row.tgname !== "string" || typeof row.proname !== "string") {
      return { ok: false, detail: "malformed trigger listing" };
    }
    const tgtype = typeof row.tgtype === "number" ? row.tgtype : Number(row.tgtype);
    if (!Number.isInteger(tgtype)) return { ok: false, detail: "malformed trigger listing" };
    const decoded = decodeTgType(tgtype);
    value.push({ name: row.tgname, table, functionName: row.proname, ...decoded });
  }
  return { ok: true, value };
}

async function loadPrivileges(
  pool: Pool,
  qualifiedTable: string,
  sequence?: string,
): Promise<{ ok: true; value: PrivilegeInfo } | { ok: false; detail: string }> {
  const tableSql = `SELECT has_table_privilege(current_user, $1, 'SELECT') AS sel,
                            has_table_privilege(current_user, $1, 'INSERT') AS ins,
                            has_table_privilege(current_user, $1, 'UPDATE') AS upd,
                            has_table_privilege(current_user, $1, 'DELETE') AS del`;
  const table = await queryPool<{ sel: unknown; ins: unknown; upd: unknown; del: unknown }>(
    pool,
    tableSql,
    [qualifiedTable],
  );
  if (!table.ok) return table;
  const row = table.rows[0];
  if (!row || typeof row.sel !== "boolean" || typeof row.ins !== "boolean"
    || typeof row.upd !== "boolean" || typeof row.del !== "boolean") {
    return { ok: false, detail: "malformed privilege listing" };
  }
  const value: PrivilegeInfo = { select: row.sel, insert: row.ins, update: row.upd, delete: row.del };
  if (sequence) {
    const seq = await queryPool<{ usage: unknown; sel: unknown }>(
      pool,
      `SELECT has_sequence_privilege(current_user, $1, 'USAGE') AS usage,
              has_sequence_privilege(current_user, $1, 'SELECT') AS sel`,
      [sequence],
    );
    if (!seq.ok) return seq;
    const seqRow = seq.rows[0];
    if (!seqRow || typeof seqRow.usage !== "boolean" || typeof seqRow.sel !== "boolean") {
      return { ok: false, detail: "malformed sequence privilege listing" };
    }
    value.sequenceUsage = seqRow.usage;
    value.sequenceSelect = seqRow.sel;
  }
  return { ok: true, value };
}

async function tableExists(pool: Pool, schema: string, table: string): Promise<{ ok: true; exists: boolean } | { ok: false; detail: string }> {
  const result = await queryPool<{ present: unknown }>(
    pool,
    `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
         WHERE table_schema = $1 AND table_name = $2 AND table_type = 'BASE TABLE'
      ) AS present`,
    [schema, table],
  );
  if (!result.ok) return result;
  const present = result.rows[0]?.present;
  if (typeof present !== "boolean") return { ok: false, detail: "malformed table existence check" };
  return { ok: true, exists: present };
}

async function checkSchemaUsage(pool: Pool, label: string, schema: string): Promise<CheckResult> {
  const result = await queryPool<{ usage: unknown }>(
    pool,
    "SELECT has_schema_privilege(current_user, $1, 'USAGE') AS usage",
    [schema],
  );
  if (!result.ok) return { name: `${label}.schema.usage`, ok: false, detail: result.detail };
  return result.rows[0]?.usage === true
    ? { name: `${label}.schema.usage`, ok: true }
    : { name: `${label}.schema.usage`, ok: false, detail: "connecting role lacks USAGE" };
}

async function inspectTable(
  pool: Pool,
  label: string,
  schema: string,
  table: string,
  expectedColumns: readonly ColumnInfo[],
  expectedTriggers: readonly TriggerInfo[],
  expectedPrivileges: PrivilegeInfo,
  sequence?: string,
): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const exists = await tableExists(pool, schema, table);
  if (!exists.ok) {
    return [{ name: `${label}.exists`, ok: false, detail: exists.detail }];
  }
  if (!exists.exists) {
    return [{ name: `${label}.exists`, ok: false, detail: "table is missing" }];
  }
  results.push({ name: `${label}.exists`, ok: true });

  const columns = await loadColumns(pool, schema, table);
  results.push(columns.ok
    ? compareColumns(label, columns.value, expectedColumns)
    : { name: `${label}.columns`, ok: false, detail: columns.detail });

  const triggers = await loadTriggers(pool, schema, table);
  results.push(triggers.ok
    ? compareTriggers(label, triggers.value, expectedTriggers)
    : { name: `${label}.triggers`, ok: false, detail: triggers.detail });

  const privileges = await loadPrivileges(pool, `${schema}.${table}`, sequence);
  results.push(privileges.ok
    ? comparePrivileges(label, privileges.value, expectedPrivileges)
    : { name: `${label}.privileges`, ok: false, detail: privileges.detail });

  return results;
}

async function inspectDatabase(
  purpose: "storage" | "anchors",
  checked: CheckedDatabaseUrl,
  requireStaged = false,
): Promise<CheckResult[]> {
  const pool = poolFor(purpose, checked);
  const results: CheckResult[] = [];
  try {
    const who = await queryPool<{ current_user: unknown }>(pool, "SELECT current_user", []);
    if (!who.ok) return [{ name: `${purpose}.connect`, ok: false, detail: who.detail }];
    results.push({ name: `${purpose}.connect`, ok: true });

    if (purpose === "storage") {
      results.push(await checkSchemaUsage(pool, "storage", "shiyan"));
      results.push(...await inspectTable(pool, "storage.experiences", "shiyan", "experiences",
        EXPECTED_STORAGE_COLUMNS.experiences, EXPECTED_STORAGE_TRIGGERS.experiences, APP_TABLE_PRIVILEGES));
      results.push(...await inspectTable(pool, "storage.reference_envelopes", "shiyan", "reference_envelopes",
        EXPECTED_STORAGE_COLUMNS.reference_envelopes, EXPECTED_STORAGE_TRIGGERS.reference_envelopes, APP_TABLE_PRIVILEGES));
      for (const table of Object.keys(STAGED_STORAGE_COLUMNS)) {
        const label = `storage.${table}`;
        const exists = await tableExists(pool, "shiyan", table);
        if (!exists.ok) results.push({ name: `${label}.exists`, ok: false, detail: exists.detail });
        else if (!exists.exists) results.push(stagedTableMissing(label, STAGED_STORAGE_MIGRATIONS[table], requireStaged));
        else results.push(...await inspectTable(pool, label, "shiyan", table,
          STAGED_STORAGE_COLUMNS[table], STAGED_STORAGE_TRIGGERS[table], APP_TABLE_PRIVILEGES));
      }
    } else {
      results.push(await checkSchemaUsage(pool, "anchors", "shiyan_anchor"));
      results.push(...await inspectTable(pool, "anchors.reference_anchors", "shiyan_anchor", "reference_anchors",
        EXPECTED_ANCHOR_COLUMNS.reference_anchors, EXPECTED_ANCHOR_TRIGGERS.reference_anchors, APP_TABLE_PRIVILEGES));
      results.push(...await inspectTable(pool, "anchors.recovery_records", "shiyan_anchor", "recovery_records",
        EXPECTED_ANCHOR_COLUMNS.recovery_records, EXPECTED_ANCHOR_TRIGGERS.recovery_records,
        RECOVERY_RECORD_PRIVILEGES, "shiyan_anchor.recovery_records_id_seq"));
    }
    return results;
  } finally {
    await pool.end().catch(() => undefined);
  }
}

export async function runSchemaGuard(argv: string[] = process.argv.slice(2), env: Env = process.env): Promise<{ results: CheckResult[]; failed: boolean }> {
  const results: CheckResult[] = [];
  const storage = resolveUrl("storage", argv, env, "--storage-file", "SHIYAN_STORAGE_URL");
  const anchors = resolveUrl("anchors", argv, env, "--anchor-file", "SHIYAN_ANCHOR_URL");

  let storageChecked: CheckedDatabaseUrl | undefined;
  let anchorsChecked: CheckedDatabaseUrl | undefined;

  if (storage.kind === "skip") {
    results.push({ name: "storage", ok: true, detail: "SKIP: no URL provided" });
  } else if (storage.kind === "fail") {
    results.push(storage.result);
  } else {
    const checked = checkDatabaseUrl(storage.url, env);
    if (!checked.ok) {
      results.push({ name: "storage.url", ok: false, detail: checked.reason });
    } else {
      storageChecked = checked.value;
      results.push(...await inspectDatabase("storage", checked.value, argv.includes("--require-state-segments")));
    }
  }

  if (anchors.kind === "skip") {
    results.push({ name: "anchors", ok: true, detail: "SKIP: no URL provided" });
  } else if (anchors.kind === "fail") {
    results.push(anchors.result);
  } else {
    const checked = checkDatabaseUrl(anchors.url, env);
    if (!checked.ok) {
      results.push({ name: "anchors.url", ok: false, detail: checked.reason });
    } else {
      anchorsChecked = checked.value;
      results.push(...await inspectDatabase("anchors", checked.value));
    }
  }

  if (storageChecked && anchorsChecked) {
    results.push(independentDatabases(storageChecked, anchorsChecked)
      ? { name: "independent", ok: true }
      : { name: "independent", ok: false, detail: "URLs must point at different databases with different roles" });
  }

  // Skips are recorded as ok with a SKIP detail so they are not failures.
  const failed = results.some((result) => !result.ok);
  return { results, failed };
}

function printResult(result: CheckResult): void {
  if (result.ok && result.detail?.startsWith("SKIP:")) {
    console.log(`SKIP ${result.name}: ${result.detail.slice("SKIP:".length).trim()}`);
    return;
  }
  console.log(formatCheck(result));
}

async function main(): Promise<void> {
  const { results, failed } = await runSchemaGuard();
  for (const result of results) printResult(result);
  if (failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error("FAIL schema-guard:", diagnosticErrorClass(error), diagnosticErrorCode(error));
  process.exit(1);
});
