// Run: npx tsx scripts/check-medicare.ts
// Pure checks for the Medicare vertical: provenance hash, domain isolation, deterministic DQ check (no network, no writes).
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { buildProvenance, canonicalJson, contentHash, MEDICARE_PROVENANCE_SCHEMA, MEDICARE_DOMAIN_LABEL, MEDICARE_NOTE } from "../src/lib/medicare/provenance";
import { checkRequiredNonNegative, MEDICARE_DQ_SCHEMA, DQ_CHECK_ID } from "../src/lib/medicare/dq";
import { MEDICARE_FIXTURE, FIXTURE_PROVENANCE, FIXTURE_DQ, FIXTURE_BASELINES, FIXTURE_EVIDENCE } from "../src/lib/medicare/fixture";
import { MEDICARE_CASE, formatInvestigationCaseBrief, formatReviewedCaseBrief, buildHandoffPack, buildWinSummary, medicareAnchorId } from "../src/lib/medicare/case-brief";
import { noteTemplates, appendNoteTemplate, handoffPulseActive, HANDOFF_PULSE_MS, handoffReadyAnnotated, notesNudge, toggleRowFilter, rowMatchesFilter, rowFilterEmphasis, notesCount, applyDispositionNote, DISPOSITION_NOTE_MAX, nextReviewTimer, reviewElapsedMs, formatElapsed, dispositionShortcut, redoDisposition, commitDisposition, undoDisposition, DISPOSITION_HISTORY_LIMIT, applyBulkDisposition, toggleStatusFilter, filterEmphasis, statusChips, currentDispositionsJson, reviewCompletion, reviewProgress, applyDisposition, buildInvestigationReport, verifyReportHash, MEDICARE_INVESTIGATION_SCHEMA, DISPOSITION_STATUSES } from "../src/lib/medicare/investigation";
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

// 10. Anchors for the top candidate (pure, stable, fragment-safe).
assert.equal(medicareAnchorId("candidate", 5), "medicare-candidate-5");
assert.equal(medicareAnchorId("evidence", "rule:payment_vs_charge.v1:5"), "medicare-evidence-rule-payment-vs-charge-v1-5");
assert.equal(medicareAnchorId("disposition", "rule:payment_vs_charge.v1:5"), "medicare-disposition-rule-payment-vs-charge-v1-5");
assert.equal(FIXTURE_BASELINES.rules[0].candidates[0].row_index, 5);
const anchors = ev.items.map((i) => medicareAnchorId("evidence", i.item_id)); assert.equal(new Set(anchors).size, anchors.length, "unique");
console.log("anchors     -> top candidate row 5 → #medicare-candidate-5, evidence and disposition anchors unique");
// 11. Review progress (pure).
assert.deepEqual(reviewProgress(inv), { items: 3, reviewed: 0, percent: 0, label: "0 of 3 reviewed", by_status: { unreviewed: 3, needs_human_review: 0, cleared_pattern_only: 0 } });
assert.deepEqual(reviewProgress(live), { items: 3, reviewed: 2, percent: 67, label: "2 of 3 reviewed", by_status: { unreviewed: 1, needs_human_review: 1, cleared_pattern_only: 1 } });
for (const j of [null, "x", {}, [], cyc]) assert.equal(reviewProgress(j).label, "0 of 0 reviewed");
console.log("progress    -> 0 of 3 reviewed → 2 of 3 (67%) after two dispositions; counts by status");
// 12. Review complete (pure).
assert.equal(reviewCompletion(reviewProgress(inv)).complete, false); assert.equal(reviewCompletion(reviewProgress(live)).complete, false);
const all3 = buildInvestigationReport({ pack: ev, dispositions: applyDisposition(applyDisposition(applyDisposition({}, ids[0], "cleared_pattern_only"), ids[1], "cleared_pattern_only"), ids[2], "needs_human_review") });
const done = reviewCompletion(reviewProgress(all3));
assert.equal(done.complete, true); assert.match(done.message, /^Review complete: all 3 items dispositioned \(1 needs_human_review, 2 cleared_pattern_only\)/); assert.match(done.message, /not findings of fraud, misconduct or misdiagnosis/);
for (const j of [null, undefined, reviewProgress(null)]) assert.equal(reviewCompletion(j as never).complete, false);
console.log("complete    -> banner only at 3 of 3; message keeps pattern ≠ conclusion");
// 13. Copy current dispositions JSON (pure).
const cj = currentDispositionsJson(all3); assert.ok(cj); const back = JSON.parse(cj);
assert.equal(back.report_hash, all3.report_hash); assert.ok(verifyReportHash(back)); assert.deepEqual(back.entries.map((e: { status: string }) => e.status), ["cleared_pattern_only", "cleared_pattern_only", "needs_human_review"]);
assert.equal(currentDispositionsJson(t2), "", "tampered report not copied");
for (const j of [null, "x", {}, cyc]) assert.equal(currentDispositionsJson(j), "");
console.log("live copy   -> current statuses + verifying report_hash; tampered or unreadable gives nothing");
// 14. Reviewed case brief over the live report (pure).
const rb = formatReviewedCaseBrief(all3, ev, FIXTURE_PROVENANCE);
assert.ok(rb.includes("> Review complete: all 3 items dispositioned (1 needs_human_review, 2 cleared_pattern_only)"));
assert.ok(rb.includes(all3.report_hash)); assert.ok(rb.includes("[needs_human_review] rule:payment_vs_charge.v1:5")); assert.ok(rb.includes("Detected pattern ≠ verified conclusion"));
assert.ok(formatReviewedCaseBrief(live, ev, FIXTURE_PROVENANCE).includes("> Review in progress: 2 of 3 reviewed."));
assert.equal(formatReviewedCaseBrief(t2, ev, FIXTURE_PROVENANCE), "", "tampered report not exported");
assert.equal(formatReviewedCaseBrief(r3, ev, FIXTURE_PROVENANCE), "", "unverified pack not exported");
for (const j of [null, "x", {}, cyc]) assert.equal(formatReviewedCaseBrief(j, ev, FIXTURE_PROVENANCE), "");
console.log("reviewed    -> brief over live report: review-complete header, live statuses and report_hash; tampered/unlinked gives nothing");
// 15. Status chips (pure).
assert.deepEqual(statusChips(inv).map((c) => c.label), ["SYN-0003 · unreviewed", "SYN-0004 · unreviewed", "SYN-0006 · unreviewed"]);
assert.deepEqual(statusChips(all3).map((c) => c.status), ["cleared_pattern_only", "cleared_pattern_only", "needs_human_review"]);
assert.equal(statusChips(all3)[2].label, "SYN-0006 · needs review");
for (const j of [null, "x", {}, cyc]) assert.deepEqual(statusChips(j), []);
console.log("chips       -> one chip per item, follows dispositions; only the three review statuses");
// 16. Status filter (pure).
assert.equal(toggleStatusFilter(null, "needs_human_review"), "needs_human_review");
assert.equal(toggleStatusFilter("needs_human_review", "needs_human_review"), null, "re-click clears");
assert.equal(toggleStatusFilter("needs_human_review", "cleared_pattern_only"), "cleared_pattern_only");
for (const j of ["fraud", null, 1, {}]) assert.equal(toggleStatusFilter("unreviewed", j), null);
assert.equal(filterEmphasis("unreviewed", null), "all"); assert.equal(filterEmphasis("unreviewed", "unreviewed"), "match"); assert.equal(filterEmphasis("cleared_pattern_only", "unreviewed"), "dim");
assert.deepEqual(all3.entries.map((e) => filterEmphasis(e.status, "needs_human_review")), ["dim", "dim", "match"]);
console.log("filter      -> chip toggles status filter, re-click or All clears; matching rows highlighted, others dimmed");
// 17. Bulk disposition (pure).
const b0 = {}; const b1 = applyBulkDisposition(b0, ids, "cleared_pattern_only");
assert.deepEqual(b0, {}); assert.deepEqual(Object.values(b1), [{ status: "cleared_pattern_only" }, { status: "cleared_pattern_only" }, { status: "cleared_pattern_only" }]);
assert.equal(reviewProgress(buildInvestigationReport({ pack: ev, dispositions: b1 })).label, "3 of 3 reviewed");
const b2 = applyBulkDisposition(b1, [ids[0], ids[1]], "unreviewed"); assert.deepEqual(Object.keys(b2), [ids[2]]);
assert.deepEqual(applyBulkDisposition(b1, ids, "fraud"), b1, "invented status ignored");
assert.deepEqual(applyBulkDisposition(b1, "x", "needs_human_review"), b1);
console.log("bulk        -> set all shown to one review status or reset; pure; invented statuses ignored");
// 18. Undo history (pure).
let h = { past: [] as Record<string, never>[], present: {}, last_action: null as string | null };
h = commitDisposition(h, applyDisposition(h.present, ids[2], "needs_human_review"), "SYN-0006 → needs_human_review");
h = commitDisposition(h, applyBulkDisposition(h.present, [ids[0], ids[1]], "cleared_pattern_only"), "set 2 to cleared_pattern_only");
assert.equal(h.past.length, 2); assert.equal(h.last_action, "set 2 to cleared_pattern_only");
assert.equal(reviewProgress(buildInvestigationReport({ pack: ev, dispositions: h.present })).label, "3 of 3 reviewed");
assert.equal(commitDisposition(h, { ...h.present }, "noop"), h, "no-op change not recorded");
h = undoDisposition(h); assert.deepEqual(h.present, { [ids[2]]: { status: "needs_human_review" } }, "bulk undone in one step"); assert.equal(h.last_action, null);
h = undoDisposition(h); assert.deepEqual(h.present, {}); assert.equal(undoDisposition(h), h, "nothing to undo");
let cap = { past: [] as object[], present: {}, last_action: null as string | null };
for (let i = 0; i < 30; i++) cap = commitDisposition(cap as never, { [`k${i}`]: { status: "needs_human_review" } }, `s${i}`) as never;
assert.equal(cap.past.length, DISPOSITION_HISTORY_LIMIT);
console.log("undo        -> single and bulk changes undo one step at a time; no-ops skipped; history capped at 20");
// 19. Redo (pure).
let rh = { past: [] as object[], present: {}, last_action: null as string | null, future: [] as object[] } as never as Parameters<typeof redoDisposition>[0];
rh = commitDisposition(rh, applyDisposition(rh.present, ids[0], "needs_human_review"), "a");
rh = commitDisposition(rh, applyBulkDisposition(rh.present, ids, "cleared_pattern_only"), "bulk");
const afterBulk = rh.present;
rh = undoDisposition(rh); rh = undoDisposition(rh); assert.deepEqual(rh.present, {}); assert.equal(rh.future?.length, 2);
rh = redoDisposition(rh); assert.deepEqual(rh.present, { [ids[0]]: { status: "needs_human_review" } });
rh = redoDisposition(rh); assert.deepEqual(rh.present, afterBulk, "bulk redone in one step"); assert.equal(redoDisposition(rh), rh, "nothing to redo");
rh = undoDisposition(rh); rh = commitDisposition(rh, applyDisposition(rh.present, ids[2], "unreviewed"), "x");
rh = commitDisposition(rh, applyDisposition(rh.present, ids[1], "needs_human_review"), "y"); assert.deepEqual(rh.future, [], "new change clears redo");
assert.equal(redoDisposition({ past: [], present: {}, last_action: null }).future, undefined, "older history without future is safe");
console.log("redo        -> undo/redo walk both ways; bulk redone in one step; a new change clears redo");
// 20. Keyboard shortcuts (pure map).
assert.deepEqual(dispositionShortcut({ key: "1" }), { kind: "set", status: "needs_human_review" });
assert.deepEqual(dispositionShortcut({ key: "2", targetTag: "select" }), { kind: "set", status: "cleared_pattern_only" });
assert.deepEqual(dispositionShortcut({ key: "3" }), { kind: "set", status: "unreviewed" });
assert.deepEqual(dispositionShortcut({ key: "u" }), { kind: "undo" }); assert.deepEqual(dispositionShortcut({ key: "R" }), { kind: "redo" });
for (const j of [{ key: "1", ctrlKey: true }, { key: "1", metaKey: true }, { key: "u", targetTag: "INPUT" }, { key: "2", targetTag: "textarea" }, { key: "1", editable: true }, { key: "4" }, { key: "f" }, null, {}])
  assert.equal(dispositionShortcut(j as never), null);
console.log("keys        -> 1/2/3 set the targeted row, u undo, r redo; ignored with modifiers or while typing");
// 21. Reviewer hand-off pack (pure).
const hp = JSON.parse(buildHandoffPack(all3, ev, FIXTURE_PROVENANCE));
assert.equal(hp.schema_version, "aethel.medicare.handoff.v1"); assert.equal(hp.domain_label, "medicare");
assert.equal(hp.evidence_pack_hash, ev.pack_hash); assert.equal(hp.report_hash, all3.report_hash); assert.equal(hp.dataset_content_hash, FIXTURE_PROVENANCE.content_hash);
assert.deepEqual(hp.progress, { label: "3 of 3 reviewed", reviewed: 3, items: 3, percent: 100, by_status: { unreviewed: 0, needs_human_review: 1, cleared_pattern_only: 2 }, complete: true });
assert.ok(hp.case_brief_markdown.includes("> Review complete")); assert.ok(verifyReportHash(hp.investigation));
const { handoff_hash, ...hbody } = hp; assert.equal(handoff_hash, contentHash(hbody), "handoff hash recomputes");
assert.equal(JSON.parse(buildHandoffPack(inv, ev, FIXTURE_PROVENANCE)).progress.complete, false);
assert.equal(buildHandoffPack(t2, ev, FIXTURE_PROVENANCE), ""); for (const j of [null, "x", {}, cyc]) assert.equal(buildHandoffPack(j, ev, FIXTURE_PROVENANCE), "");
console.log("hand-off    -> aethel.medicare.handoff.v1: reviewed brief + live report + progress, linked hashes, recomputable handoff_hash");
// 22. Review timer (pure).
let tm = { started_at: null as number | null, frozen_at: null as number | null };
tm = nextReviewTimer(tm, { reviewed: 0, items: 3 }, 1000); assert.deepEqual(tm, { started_at: null, frozen_at: null });
tm = nextReviewTimer(tm, { reviewed: 1, items: 3 }, 5000); assert.deepEqual(tm, { started_at: 5000, frozen_at: null });
assert.equal(nextReviewTimer(tm, { reviewed: 2, items: 3 }, 9000), tm, "keeps start");
tm = nextReviewTimer(tm, { reviewed: 3, items: 3 }, 65000); assert.deepEqual(tm, { started_at: 5000, frozen_at: 65000 });
assert.equal(reviewElapsedMs(tm, 999999), 60000, "frozen"); assert.equal(formatElapsed(reviewElapsedMs(tm, 0)), "1:00");
tm = nextReviewTimer(tm, { reviewed: 2, items: 3 }, 70000); assert.equal(tm.frozen_at, null, "undo of completion resumes");
assert.equal(nextReviewTimer(tm, { reviewed: 0, items: 3 }, 80000).started_at, null, "reset clears");
assert.equal(formatElapsed(3723000), "1:02:03"); assert.equal(formatElapsed(-5), "0:00"); assert.equal(formatElapsed("x"), "0:00");
assert.equal(reviewElapsedMs({ started_at: null, frozen_at: null }, 5), 0);
console.log("timer       -> starts at first disposition, freezes at 3 of 3, resumes on undo, clears on reset");
// 23. Hand-off pack carries frozen review time only at complete.
const ht = JSON.parse(buildHandoffPack(all3, ev, FIXTURE_PROVENANCE, { elapsed_ms: 125400, frozen: true }));
assert.deepEqual(ht.review_time, { elapsed_ms: 125400, elapsed: "2:05", basis: "tab-local timer from first disposition to Review complete" });
{ const { handoff_hash: hh, ...b } = ht; assert.equal(hh, contentHash(b)); }
assert.equal(JSON.parse(buildHandoffPack(all3, ev, FIXTURE_PROVENANCE, { elapsed_ms: 125400, frozen: false })).review_time, undefined, "running timer not included");
assert.equal(JSON.parse(buildHandoffPack(live, ev, FIXTURE_PROVENANCE, { elapsed_ms: 5000, frozen: true })).review_time, undefined, "only at complete");
for (const tj of [null, {}, { elapsed_ms: -1, frozen: true }, { elapsed_ms: "x", frozen: true }]) assert.equal(JSON.parse(buildHandoffPack(all3, ev, FIXTURE_PROVENANCE, tj as never)).review_time, undefined);
assert.equal(buildHandoffPack(all3, ev, FIXTURE_PROVENANCE), buildHandoffPack(all3, ev, FIXTURE_PROVENANCE, null), "no timer = unchanged pack");
console.log("hand-off t  -> frozen review time (e.g. 2:05) included only at Review complete; hash covers it");
// 24. Reviewer notes (pure; tab-local; flow into the report, dispositions JSON and hand-off).
const n0 = applyDisposition({}, ids[2], "needs_human_review");
const n1 = applyDispositionNote(n0, ids[2], "  payment exceeds charge; check modifier  ");
assert.deepEqual(n0, { [ids[2]]: { status: "needs_human_review" } }, "input not mutated");
assert.deepEqual(n1[ids[2]], { status: "needs_human_review", note: "payment exceeds charge; check modifier" });
assert.deepEqual(applyDisposition(n1, ids[2], "cleared_pattern_only")[ids[2]], { status: "cleared_pattern_only", note: "payment exceeds charge; check modifier" }, "status change keeps note");
assert.deepEqual(applyDispositionNote(n1, ids[2], "   ")[ids[2]], { status: "needs_human_review" }, "blank clears");
assert.deepEqual(applyDispositionNote({}, ids[0], "x"), {}, "unreviewed item gets no note");
assert.equal((applyDispositionNote(n0, ids[2], "y".repeat(500))[ids[2]] as { note: string }).note.length, DISPOSITION_NOTE_MAX);
const nr = buildInvestigationReport({ pack: ev, dispositions: n1 });
assert.equal(nr.entries[2].note, "payment exceeds charge; check modifier"); assert.ok(verifyReportHash(nr));
assert.ok(JSON.parse(currentDispositionsJson(nr)).entries[2].note.startsWith("payment exceeds"));
const nAll = applyDispositionNote(applyBulkDisposition({}, ids, "cleared_pattern_only"), ids[2], "explained by bundling");
assert.ok(JSON.parse(buildHandoffPack(buildInvestigationReport({ pack: ev, dispositions: nAll }), ev, FIXTURE_PROVENANCE)).case_brief_markdown.includes("note: explained by bundling"));
console.log("notes       -> optional per-item reviewer note: kept across status changes, cleared when blank, in report, JSON and hand-off");
// 25. Notes count (pure).
assert.deepEqual(notesCount(inv), { count: 0, label: "0 notes" });
assert.deepEqual(notesCount(nr), { count: 1, label: "1 note" });
const two = buildInvestigationReport({ pack: ev, dispositions: applyDispositionNote(nAll, ids[0], "entry error") });
assert.deepEqual(notesCount(two), { count: 2, label: "2 notes" });
for (const j of [null, "x", {}, cyc]) assert.equal(notesCount(j).count, 0);
console.log("notes chip  -> ✎ N notes on the Win strip, follows dispositions");
// 26. Notes filter (pure).
assert.equal(toggleRowFilter(null, "has_note"), "has_note"); assert.equal(toggleRowFilter("has_note", "has_note"), null);
assert.equal(toggleRowFilter("has_note", "needs_human_review"), "needs_human_review"); assert.equal(toggleRowFilter("unreviewed", "fraud"), null);
assert.deepEqual(two.entries.map((e) => rowMatchesFilter(e, "has_note")), [true, false, true]);
assert.deepEqual(two.entries.map((e) => rowFilterEmphasis(e, "has_note")), ["match", "dim", "match"]);
assert.deepEqual(two.entries.map((e) => rowFilterEmphasis(e, null)), ["all", "all", "all"]);
assert.equal(rowMatchesFilter({ status: "needs_human_review", note: "  " }, "has_note"), false); assert.equal(rowMatchesFilter(null, "has_note"), false);
assert.equal(rowMatchesFilter(two.entries[2], "cleared_pattern_only"), true, "status filters unchanged");
console.log("notes filter -> ✎ chip toggles rows-with-notes filter; re-click or All clears; status filters unchanged");
// 27. Notes nudge (pure).
assert.equal(notesNudge(inv).show, false, "not before complete"); assert.equal(notesNudge(live).show, false);
assert.equal(notesNudge(all3).show, true, "complete, no notes"); assert.match(notesNudge(all3).message, /^Review complete with no reviewer notes\. Optional/);
assert.equal(notesNudge(buildInvestigationReport({ pack: ev, dispositions: nAll })).show, false, "hidden once a note exists");
for (const j of [null, "x", {}, cyc]) assert.equal(notesNudge(j).show, false);
console.log("nudge       -> optional 'Add notes?' banner only at Review complete with 0 notes");
// 28. Annotated hand-off ready chip (pure).
assert.equal(handoffReadyAnnotated(inv).ready, false); assert.equal(handoffReadyAnnotated(all3).ready, false, "complete but no notes");
assert.equal(handoffReadyAnnotated(nr).ready, false, "notes but not complete");
assert.deepEqual(handoffReadyAnnotated(buildInvestigationReport({ pack: ev, dispositions: nAll })), { ready: true, label: "Hand-off ready · reviewed with 1 note" });
assert.equal(handoffReadyAnnotated(two).label, "Hand-off ready · reviewed with 2 notes");
for (const j of [null, "x", {}, cyc]) assert.equal(handoffReadyAnnotated(j).ready, false);
assert.ok(handoffReadyAnnotated(two).ready !== notesNudge(two).show, "chip and nudge never both show");
console.log("ready chip  -> ✅ Hand-off ready only at Review complete with ≥1 note; never alongside the nudge");
// 29. Hand-off chip → button pulse (pure timing).
assert.equal(handoffPulseActive(1000, 1000), true); assert.equal(handoffPulseActive(1000, 1000 + HANDOFF_PULSE_MS - 1), true);
assert.equal(handoffPulseActive(1000, 1000 + HANDOFF_PULSE_MS), false); assert.equal(handoffPulseActive(1000, 999), false);
for (const [a, b] of [[null, 1], [1, null], ["1", 2], [NaN, 1]]) assert.equal(handoffPulseActive(a, b), false);
console.log("pulse       -> chip click scrolls to the 📦 hand-off button and highlights it for 2.4 s");
// 30. Quick note templates (pure).
for (const st of ["needs_human_review", "cleared_pattern_only"]) for (const k of ["data_quality", "rule_candidate"]) {
  const t = noteTemplates(st, k); assert.ok(t.length >= 2 && t.length <= 3); for (const x of t) { assert.ok(!/fraud|misconduct|misdiagnos/i.test(x)); assert.ok(x.length <= DISPOSITION_NOTE_MAX); }
}
assert.deepEqual(noteTemplates("unreviewed", "rule_candidate"), []); assert.deepEqual(noteTemplates("fraud", "x"), []);
assert.equal(appendNoteTemplate("", "Request supporting documentation"), "Request supporting documentation");
assert.equal(appendNoteTemplate("checked", "Request supporting documentation"), "checked; Request supporting documentation");
assert.equal(appendNoteTemplate("a; Request supporting documentation", "Request supporting documentation"), "a; Request supporting documentation", "no duplicate");
assert.equal(appendNoteTemplate("y".repeat(199), "zz").length, DISPOSITION_NOTE_MAX); assert.equal(appendNoteTemplate(null, null), "");
const tn = applyDispositionNote(n0, ids[2], appendNoteTemplate(undefined, noteTemplates("needs_human_review", "rule_candidate")[2]));
assert.equal(buildInvestigationReport({ pack: ev, dispositions: tn }).entries[2].note, "Check billing modifier or bundling");
console.log("templates   -> 2–3 neutral quick notes per status/kind; append without duplicates; capped; flows into report");
console.log("OK");
