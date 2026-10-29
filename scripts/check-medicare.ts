// Run: npx tsx scripts/check-medicare.ts
// Pure checks for the Medicare vertical: provenance hash, domain isolation, deterministic DQ check (no network, no writes).
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { buildProvenance, canonicalJson, contentHash, MEDICARE_PROVENANCE_SCHEMA, MEDICARE_DOMAIN_LABEL, MEDICARE_NOTE } from "../src/lib/medicare/provenance";
import { checkRequiredNonNegative, MEDICARE_DQ_SCHEMA, DQ_CHECK_ID } from "../src/lib/medicare/dq";
import { MEDICARE_FIXTURE, FIXTURE_PROVENANCE, FIXTURE_DQ } from "../src/lib/medicare/fixture";

// 1. Canonical JSON and hash.
assert.equal(canonicalJson({ b: 1, a: [2, { d: null, c: "x" }] }), '{"a":[2,{"c":"x","d":null}],"b":1}');
assert.equal(canonicalJson({ a: 1, b: undefined }), '{"a":1}'); assert.equal(canonicalJson(NaN), "null");
assert.equal(contentHash({ a: 1, b: 2 }), contentHash({ b: 2, a: 1 }), "key order does not change the hash");
assert.notEqual(contentHash({ a: 1 }), contentHash({ a: 2 }));
assert.equal(contentHash([1, "x"]), createHash("sha256").update('[1,"x"]').digest("hex"), "matches node sha256 of canonical bytes");
assert.match(FIXTURE_PROVENANCE.content_hash, /^[0-9a-f]{64}$/);
assert.equal(FIXTURE_PROVENANCE.content_hash, contentHash(JSON.parse(JSON.stringify(MEDICARE_FIXTURE.rows))), "stable across a JSON round trip");
console.log(`hash        -> canonical sha256, stable: ${FIXTURE_PROVENANCE.content_hash.slice(0, 16)}…`);

// 2. Provenance record and domain isolation.
assert.deepEqual(Object.keys(FIXTURE_PROVENANCE), ["schema_version", "source_id", "source_name", "release_id", "retrieved_at", "content_hash", "domain_label", "note"]);
assert.equal(FIXTURE_PROVENANCE.schema_version, "aethel.medicare.provenance.v1"); assert.equal(MEDICARE_PROVENANCE_SCHEMA, "aethel.medicare.provenance.v1");
assert.equal(FIXTURE_PROVENANCE.domain_label, "medicare"); assert.equal(MEDICARE_DOMAIN_LABEL, "medicare"); assert.notEqual(FIXTURE_PROVENANCE.domain_label as string, "safety");
assert.match(MEDICARE_NOTE, /not a verified conclusion/); assert.match(MEDICARE_NOTE, /fraud/);
assert.equal(MEDICARE_FIXTURE.synthetic, true); assert.match(MEDICARE_FIXTURE.note, /SYNTHETIC/); assert.match(MEDICARE_FIXTURE.note, /no real providers/);
assert.ok(MEDICARE_FIXTURE.rows.every((r) => r.provider_id.startsWith("SYN-")), "synthetic ids only");
const p2 = buildProvenance({ source_id: "s", source_name: "n", release_id: "r", retrieved_at: "2026-10-29T00:00:00.000Z", data: [] });
assert.deepEqual(p2, buildProvenance({ source_id: "s", source_name: "n", release_id: "r", retrieved_at: "2026-10-29T00:00:00.000Z", data: [] }), "pure");
assert.deepEqual(JSON.parse(JSON.stringify(p2)), p2, "JSON-safe");
console.log("provenance  -> aethel.medicare.provenance.v1, domain_label medicare (never safety), synthetic fixture");

// 3. DQ check finds the seeded anomalies and nothing else.
assert.equal(FIXTURE_DQ.schema_version, MEDICARE_DQ_SCHEMA); assert.equal(FIXTURE_DQ.check_id, DQ_CHECK_ID); assert.equal(FIXTURE_DQ.domain_label, "medicare");
assert.equal(FIXTURE_DQ.rows_checked, 5); assert.equal(FIXTURE_DQ.rows_with_issues, 2);
assert.deepEqual(FIXTURE_DQ.findings, [
  { row_index: 2, field: "avg_medicare_payment", issue: "negative" },
  { row_index: 3, field: "hcpcs_code", issue: "missing" },
]);
assert.deepEqual(checkRequiredNonNegative([{ provider_id: "a", hcpcs_code: "b", service_count: 0, avg_submitted_charge: 0, avg_medicare_payment: 0 }]).findings, [], "zero is allowed");
assert.deepEqual(checkRequiredNonNegative([{ provider_id: "a", hcpcs_code: "b", service_count: "3", avg_submitted_charge: 1 }]).findings.map((f) => f.issue), ["not_a_number", "missing"]);
assert.deepEqual(checkRequiredNonNegative([null]).findings, [{ row_index: 0, field: null, issue: "not_an_object" }]);
assert.equal(checkRequiredNonNegative(Array.from({ length: 300 }, () => ({}))).findings.length, 200, "findings capped");
assert.equal(checkRequiredNonNegative(Array.from({ length: 300 }, () => ({}))).truncated, true);
assert.deepEqual(checkRequiredNonNegative(MEDICARE_FIXTURE.rows), FIXTURE_DQ, "deterministic");
console.log("dq check    -> required_nonnegative.v1 finds the 2 seeded anomalies (negative payment, missing code) in 5 rows");

// 4. Never throws.
const cyc: Record<string, unknown> = {}; cyc.self = cyc;
const proxy = new Proxy({}, { get() { throw new Error("boom"); } });
for (const j of [null, undefined, 0, "x", {}, [], [1, "a", [], null], cyc, proxy, [proxy], Symbol("s"), new Map(), { length: 5 }]) {
  const r = checkRequiredNonNegative(j); assert.equal(r.domain_label, "medicare");
  assert.equal(typeof contentHash(j === proxy || (Array.isArray(j) && j[0] === proxy) ? [] : j === cyc ? {} : j), "string");
}
console.log("junk        -> DQ never throws");
console.log("OK");
