// Pure, side-effect-free comparison of Neon storage and anchors schema
// against the shapes in db/migrations/001_shiyan_storage.sql,
// 001_shiyan_anchors.sql, and 002_shiyan_recovery_records.sql.
// Used by scripts/check-schema.ts. Prints and connections live in the script.

export type ColumnInfo = { name: string; dataType: string };

export type TriggerInfo = {
  name: string;
  table: string;
  functionName: string;
  timing: "BEFORE" | "AFTER" | "INSTEAD OF";
  level: "ROW" | "STATEMENT";
  events: readonly string[];
};

export type PrivilegeInfo = {
  select: boolean;
  insert: boolean;
  update: boolean;
  delete: boolean;
  sequenceUsage?: boolean;
  sequenceSelect?: boolean;
};

export type CheckResult = { name: string; ok: boolean; detail?: string };

/** Canonical type names matching the migrations, plus information_schema aliases. */
const TYPE_ALIASES: Record<string, string> = {
  text: "text",
  bytea: "bytea",
  timestamptz: "timestamptz",
  "timestamp with time zone": "timestamptz",
  bigint: "bigint",
  int8: "bigint",
  "double precision": "double precision",
  float8: "double precision",
  numeric: "numeric",
};

export function normalizeDataType(dataType: string): string {
  return TYPE_ALIASES[dataType.trim().toLowerCase()] ?? dataType.trim().toLowerCase();
}

export const EXPECTED_STORAGE_COLUMNS: Record<string, readonly ColumnInfo[]> = {
  experiences: [
    { name: "tenant_id", dataType: "text" },
    { name: "experience_id", dataType: "text" },
    { name: "record_json", dataType: "text" },
    { name: "content_sha256", dataType: "text" },
    { name: "proof_timestamp", dataType: "timestamptz" },
    { name: "created_at", dataType: "timestamptz" },
  ],
  reference_envelopes: [
    { name: "tenant_id", dataType: "text" },
    { name: "reference_id", dataType: "text" },
    { name: "envelope", dataType: "bytea" },
    { name: "envelope_sha256", dataType: "text" },
    { name: "created_at", dataType: "timestamptz" },
  ],
};

export const EXPECTED_ANCHOR_COLUMNS: Record<string, readonly ColumnInfo[]> = {
  reference_anchors: [
    { name: "tenant_id", dataType: "text" },
    { name: "reference_id", dataType: "text" },
    { name: "anchor_version", dataType: "text" },
    { name: "envelope_format", dataType: "text" },
    { name: "repo", dataType: "text" },
    { name: "commit_sha", dataType: "text" },
    { name: "snapshot_sha256", dataType: "text" },
    { name: "envelope_sha256", dataType: "text" },
    { name: "created_at", dataType: "timestamptz" },
  ],
  recovery_records: [
    { name: "id", dataType: "bigint" },
    { name: "tenant_id", dataType: "text" },
    { name: "reference_id", dataType: "text" },
    { name: "run_id", dataType: "text" },
    { name: "status", dataType: "text" },
    { name: "prior_predicted", dataType: "double precision" },
    { name: "synthesized_predicted", dataType: "double precision" },
    { name: "anchor_delta", dataType: "double precision" },
    { name: "phi_lift", dataType: "double precision" },
    { name: "max_anchor_shift_ratio", dataType: "numeric" },
    { name: "proof_verdict", dataType: "text" },
    { name: "record_sha256", dataType: "text" },
    { name: "prev_record_sha256", dataType: "text" },
    { name: "created_at", dataType: "timestamptz" },
  ],
};

/** Legacy production shape that 001's CREATE TABLE IF NOT EXISTS would silently skip. */
export const LEGACY_REFERENCE_ENVELOPES_COLUMNS: readonly ColumnInfo[] = [
  { name: "envelope_id", dataType: "text" },
  { name: "record_json", dataType: "text" },
  { name: "content_sha256", dataType: "text" },
  { name: "proof_timestamp", dataType: "timestamptz" },
];

function appendOnlyPair(table: string, prefix: string, functionName: string): TriggerInfo[] {
  return [
    {
      name: `${prefix}_no_update_delete`,
      table,
      functionName,
      timing: "BEFORE",
      level: "ROW",
      events: ["DELETE", "UPDATE"],
    },
    {
      name: `${prefix}_no_truncate`,
      table,
      functionName,
      timing: "BEFORE",
      level: "STATEMENT",
      events: ["TRUNCATE"],
    },
  ];
}

export const EXPECTED_STORAGE_TRIGGERS: Record<string, readonly TriggerInfo[]> = {
  experiences: appendOnlyPair("experiences", "experiences", "reject_mutation"),
  reference_envelopes: appendOnlyPair("reference_envelopes", "envelopes", "reject_mutation"),
};

export const EXPECTED_ANCHOR_TRIGGERS: Record<string, readonly TriggerInfo[]> = {
  reference_anchors: appendOnlyPair("reference_anchors", "anchors", "reject_mutation"),
  recovery_records: appendOnlyPair("recovery_records", "recovery_records", "reject_mutation"),
};

export const APP_TABLE_PRIVILEGES: PrivilegeInfo = {
  select: true,
  insert: true,
  update: false,
  delete: false,
};

export const RECOVERY_RECORD_PRIVILEGES: PrivilegeInfo = {
  select: true,
  insert: true,
  update: false,
  delete: false,
  sequenceUsage: true,
  sequenceSelect: true,
};

/**
 * Decode pg_trigger.tgtype into timing, level, and events.
 * Bits (PostgreSQL src/include/catalog/pg_trigger.h): 1=ROW, 2=BEFORE, 4=INSERT,
 * 8=DELETE, 16=UPDATE, 32=TRUNCATE, 64=INSTEAD. Neither BEFORE nor INSTEAD means AFTER.
 */
export function decodeTgType(tgtype: number): Pick<TriggerInfo, "timing" | "level" | "events"> {
  const timing: TriggerInfo["timing"] = tgtype & 2 ? "BEFORE" : tgtype & 64 ? "INSTEAD OF" : "AFTER";
  const level: TriggerInfo["level"] = tgtype & 1 ? "ROW" : "STATEMENT";
  const events: string[] = [];
  if (tgtype & 4) events.push("INSERT");
  if (tgtype & 8) events.push("DELETE");
  if (tgtype & 16) events.push("UPDATE");
  if (tgtype & 32) events.push("TRUNCATE");
  return { timing, level, events };
}

export function compareColumns(
  label: string,
  actual: readonly ColumnInfo[],
  expected: readonly ColumnInfo[],
): CheckResult {
  const name = `${label}.columns`;
  const actualMap = new Map(actual.map((column) => [column.name, normalizeDataType(column.dataType)]));
  const expectedMap = new Map(expected.map((column) => [column.name, normalizeDataType(column.dataType)]));
  const missing = [...expectedMap.keys()].filter((key) => !actualMap.has(key));
  const unexpected = [...actualMap.keys()].filter((key) => !expectedMap.has(key));
  const typeMismatch = [...expectedMap.keys()]
    .filter((key) => actualMap.has(key) && actualMap.get(key) !== expectedMap.get(key))
    .map((key) => `${key} type ${actualMap.get(key)} != ${expectedMap.get(key)}`);
  const ok = missing.length === 0 && unexpected.length === 0 && typeMismatch.length === 0;
  const parts: string[] = [];
  if (missing.length) parts.push(`missing ${missing.join(", ")}`);
  if (unexpected.length) parts.push(`unexpected ${unexpected.join(", ")}`);
  if (typeMismatch.length) parts.push(typeMismatch.join("; "));
  return ok ? { name, ok } : { name, ok, detail: parts.join("; ") };
}

function triggerKey(trigger: TriggerInfo): string {
  const events = [...trigger.events].sort().join("|");
  return `${trigger.name}\t${trigger.functionName}\t${trigger.timing}\t${trigger.level}\t${events}`;
}

export function compareTriggers(
  label: string,
  actual: readonly TriggerInfo[],
  expected: readonly TriggerInfo[],
): CheckResult {
  const name = `${label}.triggers`;
  const actualKeys = new Set(actual.map(triggerKey));
  const expectedKeys = expected.map(triggerKey);
  const missing = expectedKeys.filter((key) => !actualKeys.has(key)).map((key) => key.split("\t")[0]);
  const expectedSet = new Set(expectedKeys);
  const unexpected = actual.filter((trigger) => !expectedSet.has(triggerKey(trigger))).map((trigger) => trigger.name);
  const ok = missing.length === 0 && unexpected.length === 0;
  const parts: string[] = [];
  if (missing.length) parts.push(`missing ${[...new Set(missing)].join(", ")}`);
  if (unexpected.length) parts.push(`unexpected ${[...new Set(unexpected)].join(", ")}`);
  return ok ? { name, ok } : { name, ok, detail: parts.join("; ") };
}

export function comparePrivileges(label: string, actual: PrivilegeInfo, expected: PrivilegeInfo): CheckResult {
  const name = `${label}.privileges`;
  const problems: string[] = [];
  if (actual.select !== expected.select) problems.push(`SELECT is ${actual.select}, expected ${expected.select}`);
  if (actual.insert !== expected.insert) problems.push(`INSERT is ${actual.insert}, expected ${expected.insert}`);
  if (actual.update !== expected.update) problems.push(`UPDATE is ${actual.update}, expected ${expected.update}`);
  if (actual.delete !== expected.delete) problems.push(`DELETE is ${actual.delete}, expected ${expected.delete}`);
  if (expected.sequenceUsage !== undefined && actual.sequenceUsage !== expected.sequenceUsage) {
    problems.push(`sequence USAGE is ${actual.sequenceUsage ?? false}, expected ${expected.sequenceUsage}`);
  }
  if (expected.sequenceSelect !== undefined && actual.sequenceSelect !== expected.sequenceSelect) {
    problems.push(`sequence SELECT is ${actual.sequenceSelect ?? false}, expected ${expected.sequenceSelect}`);
  }
  return problems.length === 0 ? { name, ok: true } : { name, ok: false, detail: problems.join("; ") };
}

export function formatCheck(result: CheckResult): string {
  return result.ok
    ? `PASS ${result.name}`
    : `FAIL ${result.name}${result.detail ? `: ${result.detail}` : ""}`;
}
