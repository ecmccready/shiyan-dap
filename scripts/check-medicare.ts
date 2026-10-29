// Run: npx tsx scripts/check-medicare.ts
// Pure checks for the Medicare vertical: provenance hash, domain isolation, deterministic DQ check (no network, no writes).
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { buildProvenance, canonicalJson, contentHash, MEDICARE_PROVENANCE_SCHEMA, MEDICARE_DOMAIN_LABEL, MEDICARE_NOTE } from "../src/lib/medicare/provenance";
import { checkRequiredNonNegative, MEDICARE_DQ_SCHEMA, DQ_CHECK_ID } from "../src/lib/medicare/dq";
import { MEDICARE_FIXTURE, FIXTURE_PROVENANCE, FIXTURE_DQ, FIXTURE_BASELINES, FIXTURE_EVIDENCE } from "../src/lib/medicare/fixture";
import { MEDICARE_CASE, formatInvestigationCaseBrief, buildWinSummary } from "../src/lib/medicare/case-brief";
import { applyDisposition, buildInvestigationReport, verifyReportHash, MEDICARE_INVESTIGATION_SCHEMA, DISPOSITION_STATUSES } from "../src/lib/medicare/investigation";
import { buildEvidencePack, verifyPackHash, MEDICARE_EVIDENCE_SCHEMA, UNCERTAINTY_NOTE } from "../src/lib/medicare/evidence";
import { runBaselines, paymentVsCharge, MEDICARE_BASELINES_SCHEMA, PAYMENT_VS_CHARGE_RULE } from "../src/lib/medicare/baselines";

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
assert.equal(FIXTURE_DQ.rows_checked, 6); assert.equal(FIXTURE_DQ.rows_with_issues, 2);
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
console.log("dq check    -> required_nonnegative.v1 finds the 2 seeded anomalies (negative payment, missing code) in 6 rows");

// 4. Never throws.
const cyc: Record<string, unknown> = {}; cyc.self = cyc;
const proxy = new Proxy({}, { get() { throw new Error("boom"); } });
for (const j of [null, undefined, 0, "x", {}, [], [1, "a", [], null], cyc, proxy, [proxy], Symbol("s"), new Map(), { length: 5 }]) {
  const r = checkRequiredNonNegative(j); assert.equal(r.domain_label, "medicare");
  assert.equal(typeof contentHash(j === proxy || (Array.isArray(j) && j[0] === proxy) ? [] : j === cyc ? {} : j), "string");
}
console.log("junk        -> DQ never throws");
// 5. Know How: documented rule payment_vs_charge.v1 (pure, medicare-labeled, ranked candidates).
assert.equal(FIXTURE_BASELINES.schema_version, "aethel.medicare.baselines.v1"); assert.equal(MEDICARE_BASELINES_SCHEMA, "aethel.medicare.baselines.v1");
assert.equal(FIXTURE_BASELINES.domain_label, "medicare"); assert.equal(FIXTURE_BASELINES.note, MEDICARE_NOTE);
const pvc = FIXTURE_BASELINES.rules[0];
assert.equal(pvc.rule_id, PAYMENT_VS_CHARGE_RULE); assert.equal(pvc.rule_id, "payment_vs_charge.v1");
assert.equal(pvc.rows_evaluated, 5); assert.equal(pvc.rows_skipped, 1, "the negative-payment row is skipped (DQ reports it)");
assert.deepEqual(pvc.candidates, [{ row_index: 5, provider_id: "SYN-0006", charge: 120, payment: 150, ratio: 1.25 }]);
const ranked = paymentVsCharge([
  { provider_id: "a", avg_submitted_charge: 100, avg_medicare_payment: 110 },
  { provider_id: "b", avg_submitted_charge: 100, avg_medicare_payment: 200 },
  { provider_id: "c", avg_submitted_charge: 0, avg_medicare_payment: 5 },
  { provider_id: "d", avg_submitted_charge: 100, avg_medicare_payment: 100 },
  { provider_id: "e", avg_submitted_charge: 100, avg_medicare_payment: 110 },
]);
assert.deepEqual(ranked.candidates.map((c) => c.provider_id), ["c", "b", "a", "e"], "zero charge first, then ratio desc, ties by row; equal is not a candidate");
assert.equal(ranked.candidates[0].ratio, null);
assert.equal(paymentVsCharge(Array.from({ length: 300 }, () => ({ avg_submitted_charge: 1, avg_medicare_payment: 2 }))).candidates.length, 200, "capped");
for (const j of [null, undefined, 0, "x", {}, [], [1, null, []], proxy, [proxy], cyc, Symbol("s")]) assert.equal(runBaselines(j).domain_label, "medicare");
assert.deepEqual(runBaselines(MEDICARE_FIXTURE.rows), FIXTURE_BASELINES, "deterministic");
assert.deepEqual(JSON.parse(JSON.stringify(FIXTURE_BASELINES)), FIXTURE_BASELINES, "JSON-safe");
console.log("baselines   -> payment_vs_charge.v1: 5 evaluated, 1 skipped, 1 candidate (SYN-0006, ratio 1.25); ranked; never throws");

// 6. Show: evidence pack links every item to dataset hash, row hash and transformation (pure, medicare-labeled).
const ev = FIXTURE_EVIDENCE;
assert.equal(ev.schema_version, "aethel.medicare.evidence.v1"); assert.equal(MEDICARE_EVIDENCE_SCHEMA, "aethel.medicare.evidence.v1");
assert.equal(ev.domain_label, "medicare"); assert.equal(ev.note, MEDICARE_NOTE); assert.equal(ev.uncertainty_note, UNCERTAINTY_NOTE);
assert.deepEqual(ev.counts, { items: 3, data_quality: 2, rule_candidates: 1, unreviewed: 3 });
assert.deepEqual(ev.items.map((i) => i.item_id), ["dq:required_nonnegative.v1:2:avg_medicare_payment", "dq:required_nonnegative.v1:3:hcpcs_code", "rule:payment_vs_charge.v1:5"]);
assert.deepEqual(ev.transformations, [{ id: "required_nonnegative.v1", schema: "aethel.medicare.dq.v1" }, { id: "payment_vs_charge.v1", schema: "aethel.medicare.baselines.v1" }]);
assert.equal(ev.source.content_hash, FIXTURE_PROVENANCE.content_hash);
for (const it of ev.items) {
  assert.equal(it.source_content_hash, FIXTURE_PROVENANCE.content_hash); assert.equal(it.review_status, "unreviewed");
  assert.equal(it.row_hash, contentHash(MEDICARE_FIXTURE.rows[it.row_index]), "row hash is sha256 of that exact source row");
  assert.equal(it.provider_id, MEDICARE_FIXTURE.rows[it.row_index].provider_id);
}
assert.equal(ev.items[2].detail, "payment 150 > charge 120 (ratio 1.25)");
assert.match(ev.pack_hash, /^[0-9a-f]{64}$/); assert.equal(verifyPackHash(ev), true);
assert.equal(verifyPackHash(JSON.parse(JSON.stringify(ev))), true, "recomputable after a JSON round trip");
const tampered = JSON.parse(JSON.stringify(ev)); tampered.items[0].review_status = "confirmed"; assert.equal(verifyPackHash(tampered), false, "tamper breaks the hash");
for (const j of [null, "x", {}, [], proxy, cyc]) assert.equal(verifyPackHash(j), false);
const emptyPack = buildEvidencePack({ provenance: FIXTURE_PROVENANCE, dq: checkRequiredNonNegative([]), baselines: runBaselines([]), rows: [] });
assert.equal(emptyPack.counts.items, 0); assert.equal(verifyPackHash(emptyPack), true);
assert.equal(buildEvidencePack({ provenance: FIXTURE_PROVENANCE, dq: FIXTURE_DQ, baselines: FIXTURE_BASELINES, rows: null }).items[0].row_hash, null, "missing rows give null row hash");
assert.deepEqual(buildEvidencePack({ provenance: FIXTURE_PROVENANCE, dq: FIXTURE_DQ, baselines: FIXTURE_BASELINES, rows: MEDICARE_FIXTURE.rows }), ev, "deterministic");
assert.deepEqual(JSON.parse(JSON.stringify(ev)), ev, "JSON-safe");
console.log(`evidence    -> 3 items (2 data quality, 1 rule), each linked to dataset + row sha256 and its check; pack ${ev.pack_hash.slice(0, 16)}… recomputable, tamper-evident`);

// 7. Do: investigation report links the evidence pack_hash; three review statuses only; no wrongdoing claims.
const inv = buildInvestigationReport({ pack: FIXTURE_EVIDENCE });
assert.equal(inv.schema_version, "aethel.medicare.investigation.v1"); assert.equal(MEDICARE_INVESTIGATION_SCHEMA, inv.schema_version);
assert.equal(inv.domain_label, "medicare"); assert.equal(inv.note, MEDICARE_NOTE);
assert.deepEqual([...DISPOSITION_STATUSES], ["unreviewed", "needs_human_review", "cleared_pattern_only"]);
assert.deepEqual(inv.evidence, { schema: "aethel.medicare.evidence.v1", pack_hash: ev.pack_hash, pack_verified: true, source_content_hash: FIXTURE_PROVENANCE.content_hash });
assert.deepEqual(inv.counts, { items: 3, unreviewed: 3, needs_human_review: 0, cleared_pattern_only: 0, rejected: 0 });
assert.deepEqual(inv.entries.map((e) => e.item_id), ev.items.map((i) => i.item_id));
assert.ok(verifyReportHash(inv)); assert.ok(verifyReportHash(JSON.parse(JSON.stringify(inv))));
for (const j of [null, "x", {}, [], proxy, cyc]) assert.equal(verifyReportHash(j), false);
const ids = ev.items.map((i) => i.item_id);
const r2 = buildInvestigationReport({ pack: ev, dispositions: {
  [ids[0]]: { status: "cleared_pattern_only", reviewer: "reviewer-a", note: "entry error in source" },
  [ids[1]]: { status: "needs_human_review" },
  [ids[2]]: { status: "fraud" },
  "rule:none:9": { status: "needs_human_review" },
} });
assert.deepEqual(r2.counts, { items: 3, unreviewed: 1, needs_human_review: 1, cleared_pattern_only: 1, rejected: 2 });
assert.equal(r2.entries[0].reviewer, "reviewer-a"); assert.equal(r2.entries[2].status, "unreviewed", "unknown status stays unreviewed");
assert.deepEqual(r2.rejected.map((r) => r.item_id).sort(), [ids[2], "rule:none:9"].sort());
assert.notEqual(r2.report_hash, inv.report_hash); assert.ok(verifyReportHash(r2));
const t2 = JSON.parse(JSON.stringify(r2)); t2.entries[1].status = "cleared_pattern_only"; assert.equal(verifyReportHash(t2), false, "tamper breaks the hash");
const badPack = JSON.parse(JSON.stringify(ev)); badPack.items[0].detail = "edited";
const r3 = buildInvestigationReport({ pack: badPack, dispositions: { [ids[0]]: { status: "needs_human_review" } } });
assert.equal(r3.evidence.pack_verified, false); assert.equal(r3.counts.items, 0); assert.equal(r3.counts.rejected, 1);
for (const j of [null, "x", {}, [], proxy, cyc]) { const r = buildInvestigationReport({ pack: j, dispositions: j }); assert.equal(r.evidence.pack_verified, false); assert.ok(verifyReportHash(r)); }
const banned = /fraud|misconduct|misdiagnos/i;
for (const s of DISPOSITION_STATUSES) assert.ok(!banned.test(s));
assert.deepEqual(buildInvestigationReport({ pack: FIXTURE_EVIDENCE }), inv, "deterministic");
assert.deepEqual(JSON.parse(JSON.stringify(inv)), inv, "JSON-safe");
console.log(`investigation -> 3 items unreviewed, linked to pack ${inv.evidence.pack_hash?.slice(0, 16)}…; 3 statuses only, bad status/id/pack rejected; report ${inv.report_hash.slice(0, 16)}… tamper-evident`);

// 8. Chosen case, reviewer case brief and client disposition helper (pure; no fraud statuses).
assert.equal(MEDICARE_CASE.domain_label, "medicare"); assert.match(MEDICARE_CASE.dataset, /Physician & Other Practitioners/);
assert.match(MEDICARE_CASE.anomaly_class, /payment_vs_charge\.v1/); assert.match(MEDICARE_CASE.anomaly_class, /required_nonnegative\.v1/);
const brief = formatInvestigationCaseBrief(inv, ev, FIXTURE_PROVENANCE);
for (const needle of [FIXTURE_PROVENANCE.content_hash, ev.pack_hash, inv.report_hash, ...ids, "Detected pattern ≠ verified conclusion", "3 unreviewed"]) assert.ok(brief.includes(needle), `brief has ${needle}`);
assert.equal(formatInvestigationCaseBrief(inv, ev, FIXTURE_PROVENANCE), brief, "deterministic");
assert.match(formatInvestigationCaseBrief(null as never, null as never, null as never), /could not be read/);
const d0 = {}; const d1 = applyDisposition(d0, ids[0], "needs_human_review", "rev-1");
assert.deepEqual(d0, {}, "input not mutated"); assert.deepEqual(d1, { [ids[0]]: { status: "needs_human_review", reviewer: "rev-1" } });
assert.deepEqual(applyDisposition(d1, ids[0], "fraud"), d1, "invented status ignored");
assert.deepEqual(applyDisposition(d1, "", "needs_human_review"), d1);
assert.deepEqual(applyDisposition(d1, ids[0], "unreviewed"), {}, "unreviewed clears");
for (const j of [null, "x", []]) assert.deepEqual(applyDisposition(j, ids[1], "cleared_pattern_only"), { [ids[1]]: { status: "cleared_pattern_only" } });
const live = buildInvestigationReport({ pack: ev, dispositions: applyDisposition(applyDisposition({}, ids[0], "cleared_pattern_only"), ids[2], "needs_human_review") });
assert.deepEqual(live.counts, { items: 3, unreviewed: 1, needs_human_review: 1, cleared_pattern_only: 1, rejected: 0 });
assert.notEqual(live.report_hash, inv.report_hash); assert.ok(verifyReportHash(live));
assert.ok(formatInvestigationCaseBrief(live, ev, FIXTURE_PROVENANCE).includes(live.report_hash));
console.log(`case        -> ${MEDICARE_CASE.case_id}; brief links dataset/pack/report hashes; applyDisposition pure, rejects invented statuses; report hash updates`);

// 9. Win strip summary (pure).
const win = buildWinSummary(inv, ev, FIXTURE_BASELINES.rules[0].candidates[0]);
assert.equal(win.line, "1 ranked anomaly ready for review · 2 data-quality patterns · 3 evidence items · hand-off ready");
assert.deepEqual(win.top, { provider_id: "SYN-0006", payment: 150, charge: 120, ratio: 1.25, excess: 30 });
assert.equal(win.hand_off_ready, true); assert.equal(win.domain_label, "medicare");
assert.equal(buildWinSummary(r3, emptyPack, undefined).hand_off_ready, false);
console.log("win         -> 1 ranked anomaly · 2 DQ · 3 items · hand-off ready; top SYN-0006 150 vs 120 (+30)");

console.log("OK");
