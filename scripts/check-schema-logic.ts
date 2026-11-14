/** TEST ONLY. Pure schema-guard comparison against fixture column listings. No database, no secrets.
 *  Run: npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-schema-logic.ts
 */
import assert from "node:assert/strict";
import {
  APP_TABLE_PRIVILEGES,
  EXPECTED_STORAGE_COLUMNS,
  EXPECTED_STORAGE_TRIGGERS,
  LEGACY_REFERENCE_ENVELOPES_COLUMNS,
  RECOVERY_RECORD_PRIVILEGES,
  compareColumns,
  comparePrivileges,
  compareTriggers,
  decodeTgType,
  formatCheck,
} from "../src/core/schema-guard";

const expectedEnvelopes = EXPECTED_STORAGE_COLUMNS.reference_envelopes;

// Exact expected shape, including information_schema type aliases, passes.
const exact = compareColumns("storage.reference_envelopes", [
  { name: "tenant_id", dataType: "text" },
  { name: "reference_id", dataType: "text" },
  { name: "envelope", dataType: "bytea" },
  { name: "envelope_sha256", dataType: "text" },
  { name: "created_at", dataType: "timestamp with time zone" },
], expectedEnvelopes);
assert.equal(exact.ok, true, formatCheck(exact));
assert.equal(formatCheck(exact), "PASS storage.reference_envelopes.columns");

// The legacy production shape (no envelope column) must FAIL.
const legacy = compareColumns(
  "storage.reference_envelopes",
  LEGACY_REFERENCE_ENVELOPES_COLUMNS,
  expectedEnvelopes,
);
assert.equal(legacy.ok, false, "legacy envelopes shape must FAIL");
assert.match(legacy.detail ?? "", /missing .*envelope/);
assert.match(legacy.detail ?? "", /unexpected envelope_id/);
assert.match(legacy.detail ?? "", /unexpected envelope_id, record_json/);
assert.equal(formatCheck(legacy).startsWith("FAIL storage.reference_envelopes.columns"), true);

// Missing or mistyped columns fail; extra columns fail.
const missing = compareColumns("storage.experiences",
  EXPECTED_STORAGE_COLUMNS.experiences.filter((column) => column.name !== "created_at"),
  EXPECTED_STORAGE_COLUMNS.experiences);
assert.equal(missing.ok, false);
assert.match(missing.detail ?? "", /missing created_at/);

const wrongType = compareColumns("storage.reference_envelopes", [
  { name: "tenant_id", dataType: "text" },
  { name: "reference_id", dataType: "text" },
  { name: "envelope", dataType: "text" },
  { name: "envelope_sha256", dataType: "text" },
  { name: "created_at", dataType: "timestamptz" },
], expectedEnvelopes);
assert.equal(wrongType.ok, false);
assert.match(wrongType.detail ?? "", /envelope type text != bytea/);

const extra = compareColumns("storage.reference_envelopes", [
  ...expectedEnvelopes,
  { name: "record_json", dataType: "text" },
], expectedEnvelopes);
assert.equal(extra.ok, false);
assert.match(extra.detail ?? "", /unexpected record_json/);

// Triggers: real pg_trigger.tgtype values. 27 = ROW(1)+BEFORE(2)+DELETE(8)+UPDATE(16);
// 34 = BEFORE(2)+TRUNCATE(32) at statement level.
const decodedRow = decodeTgType(27);
assert.deepEqual(decodedRow, { timing: "BEFORE", level: "ROW", events: ["DELETE", "UPDATE"] });
const decodedTruncate = decodeTgType(34);
assert.deepEqual(decodedTruncate, { timing: "BEFORE", level: "STATEMENT", events: ["TRUNCATE"] });
// AFTER ROW INSERT = ROW(1)+INSERT(4); INSTEAD OF ROW UPDATE = ROW(1)+UPDATE(16)+INSTEAD(64).
assert.deepEqual(decodeTgType(5), { timing: "AFTER", level: "ROW", events: ["INSERT"] });
assert.deepEqual(decodeTgType(81), { timing: "INSTEAD OF", level: "ROW", events: ["UPDATE"] });

const triggerPass = compareTriggers("storage.reference_envelopes", [
  { name: "envelopes_no_update_delete", table: "reference_envelopes", functionName: "reject_mutation", ...decodedRow },
  { name: "envelopes_no_truncate", table: "reference_envelopes", functionName: "reject_mutation", ...decodedTruncate },
], EXPECTED_STORAGE_TRIGGERS.reference_envelopes);
assert.equal(triggerPass.ok, true, formatCheck(triggerPass));

const triggerFail = compareTriggers("storage.reference_envelopes", [], EXPECTED_STORAGE_TRIGGERS.reference_envelopes);
assert.equal(triggerFail.ok, false);
assert.match(triggerFail.detail ?? "", /missing envelopes_no_update_delete/);

// Privileges: app role must be SELECT+INSERT only, plus sequence usage on recovery_records.
const privPass = comparePrivileges("storage.reference_envelopes", {
  select: true, insert: true, update: false, delete: false,
}, APP_TABLE_PRIVILEGES);
assert.equal(privPass.ok, true);

const privWrite = comparePrivileges("storage.reference_envelopes", {
  select: true, insert: true, update: true, delete: false,
}, APP_TABLE_PRIVILEGES);
assert.equal(privWrite.ok, false);
assert.match(privWrite.detail ?? "", /UPDATE is true/);

const recPass = comparePrivileges("anchors.recovery_records", {
  select: true, insert: true, update: false, delete: false, sequenceUsage: true, sequenceSelect: true,
}, RECOVERY_RECORD_PRIVILEGES);
assert.equal(recPass.ok, true);

const recSeqFail = comparePrivileges("anchors.recovery_records", {
  select: true, insert: true, update: false, delete: false, sequenceUsage: false, sequenceSelect: true,
}, RECOVERY_RECORD_PRIVILEGES);
assert.equal(recSeqFail.ok, false);
assert.match(recSeqFail.detail ?? "", /sequence USAGE is false/);

console.log("check-schema-logic: PASS");
