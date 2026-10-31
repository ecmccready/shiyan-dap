// Run: npx tsx scripts/check-medicare.ts
// Pure checks for the Medicare vertical: provenance hash, domain isolation, deterministic DQ check (no network, no writes).
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { notesCoverage } from "../src/lib/medicare/investigation";
import { reviewCompletePulse, COMPLETE_PULSE_MS, handoffReadyChipPulse, HANDOFF_READY_PULSE_MS, handoffPackReadyPulse, HANDOFF_PACK_READY_PULSE_MS, notesChipPulse, NOTES_CHIP_PULSE_MS, reviewProgressStartPulse, PROGRESS_START_PULSE_MS, rowFilterPulse, ROW_FILTER_PULSE_MS, bulkSetPulse, BULK_SET_PULSE_MS, noteFocusPulse, NOTE_FOCUS_PULSE_MS, keyTargetPulse, KEY_TARGET_PULSE_MS, cheatsheetPulse, CHEATSHEET_PULSE_MS } from "../src/lib/medicare/investigation";
import { buildProvenance, canonicalJson, contentHash, MEDICARE_PROVENANCE_SCHEMA, MEDICARE_DOMAIN_LABEL, MEDICARE_NOTE } from "../src/lib/medicare/provenance";
import { checkRequiredNonNegative, MEDICARE_DQ_SCHEMA, DQ_CHECK_ID } from "../src/lib/medicare/dq";
import { MEDICARE_FIXTURE, FIXTURE_PROVENANCE, FIXTURE_DQ, FIXTURE_BASELINES, FIXTURE_EVIDENCE } from "../src/lib/medicare/fixture";
import { MEDICARE_CASE, formatInvestigationCaseBrief, formatReviewedCaseBrief, buildHandoffPack, buildWinSummary, medicareAnchorId } from "../src/lib/medicare/case-brief";
import { medicareCopyAllLabel, medicareToastHistoryJson, removeToastHistoryEntry, restoreMedicareToast, clearToastHistory, pushToastHistory, dismissedToastHistory, TOAST_HISTORY_MAX, medicareToastCopyText, medicareToastPillLabel, TOAST_PILL_COPIED_MS, medicareToastDurationMs, toastExpiry, toastsAfterLeave, TOAST_LEAVE_GRACE_MS, dismissMedicareToast, clearAllMedicareToasts, showClearAllToasts, medicareEscTarget, medicareToastStack, MEDICARE_TOAST_ORDER, handoffReadyToast, HANDOFF_READY_TOAST_MS, emptyRowFilterToast, EMPTY_ROW_FILTER_TOAST_MS, reviewCompleteToast, COMPLETE_TOAST_MS, keyActionChanges, keyToastText, KEY_TOAST_MS, MEDICARE_KEYMAP, firstAvailableTemplate, cycleRowFilter, ROW_FILTER_CYCLE, moveDispositionTarget, noteTemplates, appendNoteTemplate, handoffPulseActive, HANDOFF_PULSE_MS, handoffReadyAnnotated, notesNudge, toggleRowFilter, rowMatchesFilter, rowFilterEmphasis, notesCount, applyDispositionNote, DISPOSITION_NOTE_MAX, nextReviewTimer, reviewElapsedMs, formatElapsed, dispositionShortcut, redoDisposition, commitDisposition, undoDisposition, DISPOSITION_HISTORY_LIMIT, applyBulkDisposition, toggleStatusFilter, filterEmphasis, statusChips, currentDispositionsJson, reviewCompletion, reviewProgress, applyDisposition, buildInvestigationReport, verifyReportHash, MEDICARE_INVESTIGATION_SCHEMA, DISPOSITION_STATUSES } from "../src/lib/medicare/investigation";
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
for (const j of [{ key: "1", ctrlKey: true }, { key: "1", metaKey: true }, { key: "u", targetTag: "INPUT" }, { key: "2", targetTag: "textarea" }, { key: "1", editable: true }, { key: "4" }, { key: "x" }, null, {}])
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
// 31. j/k move disposition target (pure).
assert.deepEqual(dispositionShortcut({ key: "j" }), { kind: "move", dir: 1 }); assert.deepEqual(dispositionShortcut({ key: "k" }), { kind: "move", dir: -1 });
assert.equal(dispositionShortcut({ key: "j", ctrlKey: true }), null); assert.equal(dispositionShortcut({ key: "j", targetTag: "input" }), null);
const mv = ["a", "b", "c"];
assert.equal(moveDispositionTarget(mv, "a", 1), "b"); assert.equal(moveDispositionTarget(mv, "b", -1), "a");
assert.equal(moveDispositionTarget(mv, "c", 1), "c", "clamp end"); assert.equal(moveDispositionTarget(mv, "a", -1), "a", "clamp start");
assert.equal(moveDispositionTarget(mv, null, 1), "a"); assert.equal(moveDispositionTarget(mv, "zz", -1), "c");
assert.equal(moveDispositionTarget([], "a", 1), null); assert.equal(moveDispositionTarget(mv, "a", 2), null); assert.equal(moveDispositionTarget(null, "a", 1), null);
assert.equal(moveDispositionTarget(ids, ids[2], -1), ids[1]);
console.log("j/k move    -> j/k move the key target through disposition rows, clamped; 1/2/3/u/r unchanged");
// 32. n focuses the target's note field (pure key map).
assert.deepEqual(dispositionShortcut({ key: "n" }), { kind: "note" }); assert.deepEqual(dispositionShortcut({ key: "N" }), { kind: "note" });
assert.equal(dispositionShortcut({ key: "n", targetTag: "INPUT" }), null, "typing n in a note stays text"); assert.equal(dispositionShortcut({ key: "n", metaKey: true }), null);
console.log("key n       -> focuses the target row's note field (only once it has a status); typing untouched");
// 33. h copies the hand-off pack (pure key map; the key presses the existing 📦 button).
assert.deepEqual(dispositionShortcut({ key: "h" }), { kind: "handoff" }); assert.deepEqual(dispositionShortcut({ key: "H" }), { kind: "handoff" });
assert.equal(dispositionShortcut({ key: "h", targetTag: "INPUT" }), null, "typing h in a note stays text"); assert.equal(dispositionShortcut({ key: "h", ctrlKey: true }), null);
console.log("key h       -> copies the 📦 hand-off pack (same button, same hash), pulses it; typing untouched");
// 34. y copies the current dispositions JSON (pure key map; the key presses the existing button).
assert.deepEqual(dispositionShortcut({ key: "y" }), { kind: "dispositions" }); assert.deepEqual(dispositionShortcut({ key: "Y" }), { kind: "dispositions" });
assert.equal(dispositionShortcut({ key: "y", targetTag: "INPUT" }), null, "typing y in a note stays text"); assert.equal(dispositionShortcut({ key: "y", metaKey: true }), null);
console.log("key y       -> copies the current dispositions JSON (same button, same report_hash); typing untouched");
// 35. f cycles the row filter (pure).
assert.deepEqual(dispositionShortcut({ key: "f" }), { kind: "filter" }); assert.equal(dispositionShortcut({ key: "f", targetTag: "INPUT" }), null); assert.equal(dispositionShortcut({ key: "f", ctrlKey: true }), null);
{ const seen: unknown[] = []; let f: unknown = null; for (let i = 0; i < 5; i++) { f = cycleRowFilter(f); seen.push(f); }
  assert.deepEqual(seen, ["unreviewed", "needs_human_review", "cleared_pattern_only", "has_note", null], "All → … → has_note → All"); }
assert.equal(ROW_FILTER_CYCLE.length, 5); assert.equal(cycleRowFilter("fraud"), "unreviewed"); assert.equal(cycleRowFilter(42), "unreviewed");
console.log("key f       -> cycles All → unreviewed → needs_human_review → cleared_pattern_only → has_note → All; chips stay in sync");
// 36. t applies the first unused note template on the target (pure).
assert.deepEqual(dispositionShortcut({ key: "t" }), { kind: "template" }); assert.equal(dispositionShortcut({ key: "t", targetTag: "INPUT" }), null); assert.equal(dispositionShortcut({ key: "t", metaKey: true }), null);
{ const T = noteTemplates("needs_human_review", "rule_candidate");
  assert.equal(firstAvailableTemplate("needs_human_review", "rule_candidate", ""), T[0]);
  assert.equal(firstAvailableTemplate("needs_human_review", "rule_candidate", T[0]), T[1]);
  assert.equal(firstAvailableTemplate("needs_human_review", "rule_candidate", `mine; ${T[0]}; ${T[1]}`), T[2]);
  assert.equal(firstAvailableTemplate("needs_human_review", "rule_candidate", T.join("; ")), null, "all used");
  assert.equal(firstAvailableTemplate("unreviewed", "rule_candidate", ""), null, "no note while unreviewed");
  let n = ""; for (let i = 0; i < 4; i++) { const t = firstAvailableTemplate("needs_human_review", "rule_candidate", n); if (t) n = appendNoteTemplate(n, t); }
  assert.equal(n, T.join("; ")); assert.ok(n.length <= DISPOSITION_NOTE_MAX); }
console.log("key t       -> adds the next unused quick note to the target row (undoable); nothing while unreviewed or all used");
// 37. ? cheat sheet (pure key map + keymap table).
assert.deepEqual(dispositionShortcut({ key: "?" }), { kind: "help" }); assert.deepEqual(dispositionShortcut({ key: "Escape" }), { kind: "help_close" });
assert.equal(dispositionShortcut({ key: "?", targetTag: "INPUT" }), null, "typing ? in a note stays text"); assert.equal(dispositionShortcut({ key: "?", metaKey: true }), null);
for (const row of MEDICARE_KEYMAP) for (const k of row.key.split(" / ")) assert.ok(dispositionShortcut({ key: k }), `sheet key ${k} is live`);
assert.equal(new Set(MEDICARE_KEYMAP.map((r) => r.key)).size, MEDICARE_KEYMAP.length); assert.ok(!MEDICARE_KEYMAP.some((r) => /fraud|misconduct|misdiagnos/i.test(r.does)));
console.log("key ?       -> toggles the keyboard cheat sheet (every listed key is live); Esc closes");
// 38. Keyboard action toast (pure text).
assert.equal(keyToastText(dispositionShortcut({ key: "1" }), "SYN-0006"), "needs_human_review · SYN-0006");
assert.equal(keyToastText(dispositionShortcut({ key: "2" }), ""), "cleared_pattern_only");
assert.equal(keyToastText(dispositionShortcut({ key: "u" }), "x"), "↶ undo"); assert.equal(keyToastText(dispositionShortcut({ key: "k" }), "x"), "↑ target");
assert.equal(keyToastText(dispositionShortcut({ key: "h" }), null), "📦 copy hand-off pack");
assert.equal(keyToastText(dispositionShortcut({ key: "?" }), "x"), null, "cheat sheet has no toast"); assert.equal(keyToastText(null, "x"), null);
for (const k of ["1", "2", "3", "u", "r", "j", "k", "n", "t", "f", "y", "h"]) { const t = keyToastText(dispositionShortcut({ key: k }), "SYN-0006"); assert.ok(t && t.length <= 60 && !/fraud|misconduct|misdiagnos/i.test(t), k); }
assert.ok(KEY_TOAST_MS > 0 && KEY_TOAST_MS <= 3000);
console.log("key toast   -> a short amber toast names the last keyboard action and target for ~1.6 s; none for ?");
// 39. Toast only when the shortcut changes state (pure gate).
{ const S = (k: string) => dispositionShortcut({ key: k }); const base = { target_id: "a", target_status: "unreviewed", target_kind: "rule_candidate", target_note: "", ids: ["a", "b"], can_undo: false, can_redo: false, button_ready: true };
  assert.equal(keyActionChanges(S("1"), base), true); assert.equal(keyActionChanges(S("3"), base), false, "already unreviewed");
  assert.equal(keyActionChanges(S("1"), { ...base, target_status: "needs_human_review" }), false, "same status");
  assert.equal(keyActionChanges(S("1"), { ...base, target_id: null }), false, "no target");
  assert.equal(keyActionChanges(S("u"), base), false); assert.equal(keyActionChanges(S("u"), { ...base, can_undo: true }), true);
  assert.equal(keyActionChanges(S("r"), base), false); assert.equal(keyActionChanges(S("r"), { ...base, can_redo: true }), true);
  assert.equal(keyActionChanges(S("j"), base), true); assert.equal(keyActionChanges(S("k"), base), false, "clamped at top");
  assert.equal(keyActionChanges(S("j"), { ...base, target_id: "b" }), false, "clamped at bottom");
  assert.equal(keyActionChanges(S("n"), base), false, "note disabled while unreviewed"); assert.equal(keyActionChanges(S("n"), { ...base, target_status: "needs_human_review" }), true);
  assert.equal(keyActionChanges(S("t"), base), false); assert.equal(keyActionChanges(S("t"), { ...base, target_status: "needs_human_review" }), true);
  assert.equal(keyActionChanges(S("t"), { ...base, target_status: "needs_human_review", target_note: noteTemplates("needs_human_review", "rule_candidate").join("; ") }), false, "all templates used");
  assert.equal(keyActionChanges(S("f"), base), true); assert.equal(keyActionChanges(S("y"), base), true); assert.equal(keyActionChanges(S("h"), { ...base, button_ready: false }), false);
  assert.equal(keyActionChanges(S("?"), base), false); assert.equal(keyActionChanges(null, base), false); assert.equal(keyActionChanges(S("1"), null), false); }
console.log("toast gate  -> ⌨ toast only when the key changes state or copies; no-ops (same status, clamped move, empty undo, unreviewed note) stay silent");
// 40. Review-complete toast (pure transition).
{ const P = (n: number) => ({ items: 3, reviewed: n, by_status: { unreviewed: 3 - n, needs_human_review: n >= 1 ? 1 : 0, cleared_pattern_only: Math.max(0, n - 1) } as Record<DispositionStatus, number> });
  const t = reviewCompleteToast(false, P(3)); assert.ok(t && t.startsWith("✅ Review complete · 3 of 3"), String(t));
  assert.ok(t!.includes("1 needs review") && t!.includes("2 cleared (pattern only)") && t!.includes("press h"));
  assert.equal(reviewCompleteToast(null, P(3)), null, "not on first load"); assert.equal(reviewCompleteToast(true, P(3)), null, "already complete (note edits)");
  assert.equal(reviewCompleteToast(false, P(2)), null); assert.equal(reviewCompleteToast(false, null), null);
  assert.ok(!/fraud|misconduct|misdiagnos/i.test(t!)); assert.ok(COMPLETE_TOAST_MS >= 2000 && COMPLETE_TOAST_MS <= 5000); }
console.log("complete    -> big green toast once when review reaches 3 of 3 (not on load, not again while complete; again after undo + redo)");
// 41. Toast when the row filter matches 0 items (pure).
{ const E = [{ status: "unreviewed" }, { status: "needs_human_review", note: "" }, { status: "unreviewed" }];
  assert.equal(emptyRowFilterToast("cleared_pattern_only", E), "Filter cleared_pattern_only: 0 of 3 items match · press f or click All to show all");
  assert.ok(emptyRowFilterToast("has_note", E)!.startsWith("Filter has_note: 0 of 3"), "blank note does not count");
  assert.equal(emptyRowFilterToast("unreviewed", E), null); assert.equal(emptyRowFilterToast("needs_human_review", E), null);
  assert.equal(emptyRowFilterToast(null, E), null, "All never empties"); assert.equal(emptyRowFilterToast("fraud", E), null); assert.equal(emptyRowFilterToast("has_note", []), null);
  const fx = buildInvestigationReport({ pack: ev, dispositions: {} }).entries;
  assert.equal(emptyRowFilterToast("unreviewed", fx), null); assert.ok(emptyRowFilterToast("needs_human_review", fx), "fixture start: needs review is empty → toast");
  assert.ok(!/fraud|misconduct|misdiagnos/i.test(emptyRowFilterToast("has_note", fx)!)); assert.ok(EMPTY_ROW_FILTER_TOAST_MS >= 2000 && EMPTY_ROW_FILTER_TOAST_MS <= 5000); }
console.log("empty filter-> big amber toast when a row filter matches 0 of 3 items; points to f or All");
// 42. Hand-off ready toast (pure transition).
{ const ids3 = buildInvestigationReport({ pack: ev, dispositions: {} }).entries.map((e) => e.item_id);
  let d = {} as DispositionInput; for (const id of ids3) d = applyDisposition(d, id, "needs_human_review");
  const doneNoNote = buildInvestigationReport({ pack: ev, dispositions: d });
  const doneNote = buildInvestigationReport({ pack: ev, dispositions: applyDispositionNote(d, ids3[0], "checked") });
  assert.equal(handoffReadyToast(false, doneNoNote), null, "complete without a note is not ready");
  assert.equal(handoffReadyToast(false, doneNote), "✅ Hand-off ready · reviewed with 1 note · press h to copy the 📦 hand-off pack");
  assert.equal(handoffReadyToast(true, doneNote), null, "already ready"); assert.equal(handoffReadyToast(null, doneNote), null, "not on first render");
  assert.equal(handoffReadyToast(false, null), null); assert.ok(!/fraud|misconduct|misdiagnos/i.test(handoffReadyToast(false, doneNote)!));
  assert.ok(HANDOFF_READY_TOAST_MS >= 2000 && HANDOFF_READY_TOAST_MS <= 5000); }
console.log("ready toast -> big green toast once when Hand-off ready turns on (complete + ≥1 note); h hint");
// 43. Toast stack: one column, fixed order, never overlapping (pure).
assert.deepEqual(medicareToastStack({ empty_filter: "e", complete: "c", handoff_ready: "h" }).map((x) => x.id), ["complete", "handoff_ready", "empty_filter"]);
assert.deepEqual(medicareToastStack({ empty_filter: "e" }), [{ id: "empty_filter", text: "e", tone: "amber" }]);
assert.deepEqual(medicareToastStack({ complete: "", handoff_ready: null, empty_filter: undefined }), []); assert.deepEqual(medicareToastStack(null), []);
assert.equal(medicareToastStack({ complete: "c", handoff_ready: "h" }).every((x) => x.tone === "green"), true);
assert.equal(new Set(MEDICARE_TOAST_ORDER).size, 3);
console.log("toast stack -> complete / hand-off ready / empty filter stack in one top column (fixed order, no overlap); ⌨ toast stays at the bottom");
// 44. Esc: cheat sheet first, then the stacked toasts (pure).
assert.equal(medicareEscTarget(true, 2), "help", "sheet open: Esc closes it, toasts stay"); assert.equal(medicareEscTarget(false, 2), "toasts");
assert.equal(medicareEscTarget(false, 0), null); assert.equal(medicareEscTarget(true, 0), "help"); assert.equal(medicareEscTarget("yes", 1), "toasts"); assert.equal(medicareEscTarget(false, "2"), null);
console.log("Esc         -> closes the cheat sheet first if open, otherwise dismisses all stacked top toasts");
// 45. Click one stacked toast to dismiss only that one (pure).
{ const st = medicareToastStack({ complete: "c", handoff_ready: "h", empty_filter: "e" });
  assert.deepEqual(dismissMedicareToast(st, "handoff_ready").map((x) => x.id), ["complete", "empty_filter"], "others stay in order");
  assert.deepEqual(dismissMedicareToast(st, "nope").map((x) => x.id), ["complete", "handoff_ready", "empty_filter"]);
  assert.deepEqual(dismissMedicareToast(dismissMedicareToast(st, "complete"), "empty_filter").map((x) => x.id), ["handoff_ready"]);
  assert.deepEqual(dismissMedicareToast(null, "complete"), []); assert.equal(st.length, 3, "input not mutated"); }
console.log("click toast -> clicking a stacked top toast (✕) dismisses only that one; the rest keep their order");
// 46. Hover pauses auto-dismiss (pure).
assert.equal(toastExpiry(true), "defer"); assert.equal(toastExpiry(false), "dismiss"); assert.equal(toastExpiry(undefined), "dismiss");
{ const st = medicareToastStack({ complete: "c", handoff_ready: "h", empty_filter: "e" });
  assert.deepEqual(toastsAfterLeave(["empty_filter", "complete"], st), ["complete", "empty_filter"], "deferred ones go after leave, in stack order");
  assert.deepEqual(toastsAfterLeave(["handoff_ready"], dismissMedicareToast(st, "handoff_ready")), [], "already clicked away");
  assert.deepEqual(toastsAfterLeave([], st), [], "not yet expired: stays until its own timer"); assert.deepEqual(toastsAfterLeave(null, null), []); }
assert.ok(TOAST_LEAVE_GRACE_MS >= 500 && TOAST_LEAVE_GRACE_MS <= 3000);
console.log("hover       -> hovering a stacked top toast pauses its auto-dismiss; it goes ~1.2 s after the pointer leaves");
// 47. Time-left bar duration per stacked toast (pure).
assert.equal(medicareToastDurationMs("complete"), COMPLETE_TOAST_MS); assert.equal(medicareToastDurationMs("handoff_ready"), HANDOFF_READY_TOAST_MS); assert.equal(medicareToastDurationMs("empty_filter"), EMPTY_ROW_FILTER_TOAST_MS);
assert.equal(medicareToastDurationMs("nope"), 0); for (const id of MEDICARE_TOAST_ORDER) assert.ok(medicareToastDurationMs(id) >= 2000 && medicareToastDurationMs(id) <= 5000, id);
console.log("time bar    -> each stacked top toast shows a thin bar shrinking over its own time; it pauses while the stack is hovered");
// 48. Click a stacked toast: copy its text, then dismiss (pure text).
{ const st = medicareToastStack({ complete: "✅ Review complete · 3 of 3", empty_filter: "Filter has_note: 0 of 3 items match" });
  assert.equal(medicareToastCopyText(st[0]), "✅ Review complete · 3 of 3"); assert.equal(medicareToastCopyText(st[1]), "⚠ Filter has_note: 0 of 3 items match", "amber keeps ⚠");
  assert.equal(medicareToastCopyText({ text: "  x  ", tone: "green" }), "x"); assert.equal(medicareToastCopyText({ text: "" }), ""); assert.equal(medicareToastCopyText(null), "");
  assert.deepEqual(dismissMedicareToast(st, st[0].id).map((x) => x.id), ["empty_filter"], "still dismissed after copy"); }
console.log("click copy  -> clicking a stacked top toast copies its text (⌨ copied toast text), then dismisses it");
// 49. Recent-toast history strip (pure).
{ const a = medicareToastStack({ complete: "c1" }); const b = medicareToastStack({ empty_filter: "e1" }); const c2 = medicareToastStack({ complete: "c1", handoff_ready: "h1" });
  let h = pushToastHistory([], a); h = pushToastHistory(h, b); h = pushToastHistory(h, c2);
  assert.deepEqual(h.map((x) => x.text), ["c1", "h1", "e1"], "newest first, de-duplicated");
  assert.deepEqual(dismissedToastHistory(h, c2).map((x) => x.text), ["e1"], "only gone ones in the strip");
  assert.deepEqual(dismissedToastHistory(h, []).map((x) => medicareToastCopyText(x)), ["c1", "h1", "⚠ e1"]);
  let big: ReturnType<typeof pushToastHistory> = []; for (let i = 0; i < 9; i++) big = pushToastHistory(big, medicareToastStack({ empty_filter: `e${i}` }));
  assert.equal(big.length, TOAST_HISTORY_MAX); assert.equal(big[0].text, "e8"); assert.deepEqual(pushToastHistory(null, null), []); }
console.log("history     -> last 5 dismissed/expired top toasts in an amber strip, newest first; click one to re-copy");
// 50. Clear the Recent toasts strip (pure).
{ const on = medicareToastStack({ complete: "c1" }); let h = pushToastHistory([], medicareToastStack({ empty_filter: "e1" })); h = pushToastHistory(h, on);
  const cl = clearToastHistory(h, on);
  assert.deepEqual(dismissedToastHistory(cl, on), [], "strip empty right after Clear"); assert.deepEqual(cl.map((x) => x.text), ["c1"], "on-screen toast kept for later");
  assert.deepEqual(dismissedToastHistory(cl, []).map((x) => x.text), ["c1"], "it appears once it goes");
  assert.deepEqual(clearToastHistory(h, []), []); assert.deepEqual(clearToastHistory(null, null), []); assert.equal(h.length, 2, "input not mutated"); }
console.log("clear       -> Clear empties the Recent toasts strip; a toast still on screen shows up after it goes");
{
  const e = { id: "complete", text: "Review complete", tone: "green" } as const;
  const a = { id: "empty_filter", text: "Filter x", tone: "amber" } as const;
  assert.equal(medicareToastPillLabel(e, null, 0), "⧉ Review complete");
  assert.equal(medicareToastPillLabel(e, { key: "Review complete", at: 100 }, 100), "✓ Copied");
  assert.equal(medicareToastPillLabel(e, { key: "Review complete", at: 100 }, 100 + TOAST_PILL_COPIED_MS - 1), "✓ Copied");
  assert.equal(medicareToastPillLabel(e, { key: "Review complete", at: 100 }, 100 + TOAST_PILL_COPIED_MS), "⧉ Review complete");
  assert.equal(medicareToastPillLabel(a, { key: "Review complete", at: 100 }, 100), "⧉ ⚠ Filter x");
  assert.equal(medicareToastPillLabel(a, { key: "⚠ Filter x", at: 100 }, 100), "✓ Copied");
  assert.equal(medicareToastPillLabel(null, null, 0), "");
  assert.equal(medicareToastPillLabel({ text: " " }, { key: "", at: 0 }, 0), "");
  assert.equal(medicareToastPillLabel(e, { key: "Review complete", at: NaN }, 0), "⧉ Review complete");
}
console.log("pill copied -> clicking a Recent toasts pill re-copies it and the pill flashes green \"✓ Copied\" for ~1.5 s");
{
  const st = medicareToastStack({ complete: "A", empty_filter: "B", handoff_ready: "C" });
  const orig = JSON.stringify(st);
  const r = clearAllMedicareToasts(st);
  assert.deepEqual(r.cleared, ["complete", "handoff_ready", "empty_filter"], "clear all lists every live toast in stack order");
  assert.deepEqual(r.stack, [], "stack empty after clear all");
  assert.equal(JSON.stringify(st), orig, "input untouched");
  assert.deepEqual(clearAllMedicareToasts(null), { cleared: [], stack: [] });
  assert.deepEqual(clearAllMedicareToasts("x" as never), { cleared: [], stack: [] });
  assert.equal(showClearAllToasts(st), true);
  assert.equal(showClearAllToasts(st.slice(0, 1)), false, "single toast: no Clear all");
  assert.equal(showClearAllToasts([]), false); assert.equal(showClearAllToasts(null), false);
  const hist = pushToastHistory([], st);
  assert.equal(dismissedToastHistory(hist, r.stack).length, 3, "cleared toasts land in Recent toasts (history untouched)");
}
console.log("clear all -> with 2+ stacked top toasts a ✕ Clear all N (Esc) control dismisses them at once; Recent toasts kept");
{ const e = { id: "complete" as const, text: "✅ Review complete", tone: "green" as const };
  assert.deepEqual(restoreMedicareToast(e, []), { id: "complete", text: "✅ Review complete" });
  assert.equal(restoreMedicareToast(e, [e]), null, "already on screen -> no-op");
  assert.deepEqual(restoreMedicareToast(e, [{ id: "complete", text: "other", tone: "green" }]), { id: "complete", text: "✅ Review complete" });
  assert.equal(restoreMedicareToast({ id: "bogus", text: "x" }, []), null); assert.equal(restoreMedicareToast({ id: "complete", text: " " }, []), null); assert.equal(restoreMedicareToast(null, null), null);
  const st = medicareToastStack({ complete: e.text }); assert.equal(dismissedToastHistory(pushToastHistory([], st), st).length, 0, "restored toast leaves the strip while live"); }
console.log("restore -> 📌 on a Recent toasts pill re-shows it as a live top toast (same slot/timer), no-op if already showing");
console.log("OK");
{ const h = [{ id: "complete" as const, text: "A", tone: "green" as const }, { id: "empty_filter" as const, text: "B", tone: "amber" as const }, { id: "handoff_ready" as const, text: "C", tone: "green" as const }];
  assert.deepEqual(removeToastHistoryEntry(h, h[1]).map((x) => x.text), ["A", "C"], "remove one keeps order");
  assert.deepEqual(removeToastHistoryEntry(h, { text: "Z", tone: "green" }).length, 3);
  assert.deepEqual(removeToastHistoryEntry(h, null).length, 3); assert.deepEqual(removeToastHistoryEntry(null, h[0]), []);
  assert.equal(h.length, 3, "input not mutated"); console.log("removeToastHistoryEntry OK"); }
{ const h = [{ id: "complete" as const, text: "A", tone: "green" as const }, { id: "empty_filter" as const, text: "B", tone: "amber" as const }];
  const j = JSON.parse(medicareToastHistoryJson(h)); assert.equal(j.schema, "aethel.medicare.toast_history.v1"); assert.equal(j.domain_label, "medicare"); assert.equal(j.count, 2);
  assert.deepEqual(j.entries, [{ kind: "complete", text: "A", tone: "green" }, { kind: "empty_filter", text: "B", tone: "amber" }]);
  assert.equal(JSON.parse(medicareToastHistoryJson(null)).count, 0); assert.equal(JSON.parse(medicareToastHistoryJson([{ text: " " }, null as any])).count, 0);
  assert.equal(h.length, 2); console.log("medicareToastHistoryJson OK"); }
{ assert.equal(medicareCopyAllLabel(null, 5), "⧉ Copy all"); assert.equal(medicareCopyAllLabel(1000, 1000), "✓ Copied");
  assert.equal(medicareCopyAllLabel(1000, 1000 + TOAST_PILL_COPIED_MS - 1), "✓ Copied"); assert.equal(medicareCopyAllLabel(1000, 1000 + TOAST_PILL_COPIED_MS), "⧉ Copy all");
  assert.equal(medicareCopyAllLabel(1000, 999), "⧉ Copy all"); assert.equal(medicareCopyAllLabel(NaN, 1), "⧉ Copy all"); console.log("medicareCopyAllLabel OK"); }
{
  assert.equal(reviewCompletePulse(null, 5, true), false, "no transition seen -> no pulse (page load already complete)");
  assert.equal(reviewCompletePulse(1000, 1000, true), true); assert.equal(reviewCompletePulse(1000, 1000 + COMPLETE_PULSE_MS - 1, true), true);
  assert.equal(reviewCompletePulse(1000, 1000 + COMPLETE_PULSE_MS, true), false); assert.equal(reviewCompletePulse(1000, 1500, false), false);
  assert.equal(reviewCompletePulse(1000, 999, true), false); assert.equal(reviewCompletePulse(NaN, 1, true), false); console.log("reviewCompletePulse OK"); }

{ assert.equal(handoffReadyChipPulse(null, 5, true), false, "no transition seen -> no pulse");
  assert.equal(handoffReadyChipPulse(1000, 1000, true), true); assert.equal(handoffReadyChipPulse(1000, 1000 + HANDOFF_READY_PULSE_MS - 1, true), true);
  assert.equal(handoffReadyChipPulse(1000, 1000 + HANDOFF_READY_PULSE_MS, true), false); assert.equal(handoffReadyChipPulse(1000, 1500, false), false, "not ready -> no pulse");
  assert.equal(handoffReadyChipPulse(1000, 999, true), false); assert.equal(handoffReadyChipPulse(NaN, 1, true), false); assert.equal(handoffReadyChipPulse("1", 2, true), false);
  assert.equal(HANDOFF_READY_PULSE_MS, 2400); console.log("handoffReadyChipPulse OK"); }
{ assert.equal(handoffPackReadyPulse(null, 5, true), false, "no transition -> no pack pulse");
  assert.equal(handoffPackReadyPulse(1000, 1000, true), true); assert.equal(handoffPackReadyPulse(1000, 1000 + HANDOFF_PACK_READY_PULSE_MS - 1, true), true);
  assert.equal(handoffPackReadyPulse(1000, 1000 + HANDOFF_PACK_READY_PULSE_MS, true), false); assert.equal(handoffPackReadyPulse(1000, 1500, false), false);
  assert.equal(handoffPackReadyPulse(1000, 999, true), false); assert.equal(handoffPackReadyPulse(NaN, 1, true), false); assert.equal(handoffPackReadyPulse("1", 2, true), false);
  assert.equal(HANDOFF_PACK_READY_PULSE_MS, 2400); console.log("handoffPackReadyPulse OK"); }

{ assert.equal(NOTES_CHIP_PULSE_MS, 2400);
  assert.equal(notesChipPulse(null, 5, 1), false, "no 0->1 transition seen -> no pulse");
  assert.equal(notesChipPulse(1000, 1000, 1), true); assert.equal(notesChipPulse(1000, 1000 + NOTES_CHIP_PULSE_MS - 1, 2), true);
  assert.equal(notesChipPulse(1000, 1000 + NOTES_CHIP_PULSE_MS, 1), false, "expires");
  assert.equal(notesChipPulse(1000, 1500, 0), false, "notes back to 0 stops pulse");
  assert.equal(notesChipPulse(1000, 999, 1), false); assert.equal(notesChipPulse("x", 1000, 1), false); assert.equal(notesChipPulse(1000, NaN, 1), false); assert.equal(notesChipPulse(1000, 1000, "1"), false);
  console.log("notes chip pulse OK"); }

{ assert.equal(PROGRESS_START_PULSE_MS, 2400);
  assert.equal(reviewProgressStartPulse(null, 5, 1), false, "no 0->1 transition -> no pulse");
  assert.equal(reviewProgressStartPulse(1000, 1000, 1), true); assert.equal(reviewProgressStartPulse(1000, 1000 + PROGRESS_START_PULSE_MS - 1, 3), true);
  assert.equal(reviewProgressStartPulse(1000, 1000 + PROGRESS_START_PULSE_MS, 1), false, "expires");
  assert.equal(reviewProgressStartPulse(1000, 1500, 0), false, "back to 0 stops pulse");
  assert.equal(reviewProgressStartPulse(1000, 999, 1), false); assert.equal(reviewProgressStartPulse("x", 1000, 1), false); assert.equal(reviewProgressStartPulse(1000, NaN, 1), false); assert.equal(reviewProgressStartPulse(1000, 1000, "1"), false);
  console.log("review progress start pulse OK"); }

{ const P = rowFilterPulse, M = ROW_FILTER_PULSE_MS; assert.equal(M, 2400); assert.equal(P(null, 5, "has_note"), false); assert.equal(P(1000, 1000, "needs_human_review"), true); assert.equal(P(1000, 1000 + M - 1, "has_note"), true);
  assert.equal(P(1000, 1000 + M, "has_note"), false); assert.equal(P(1000, 1500, null), false); assert.equal(P(1000, 1500, 3), false); assert.equal(P(1000, 999, "unreviewed"), false); assert.equal(P(NaN, 1000, "has_note"), false); assert.equal(P(1000, Infinity, "has_note"), false); console.log("rowFilterPulse OK"); }

{ const P = bulkSetPulse, M = BULK_SET_PULSE_MS; assert.equal(M, 2400); assert.equal(P(null, 5, true), false); assert.equal(P(1000, 1000, true), true); assert.equal(P(1000, 1000 + M - 1, true), true);
  assert.equal(P(1000, 1000 + M, true), false); assert.equal(P(1000, 1500, false), false); assert.equal(P(1000, 1500, "1"), false); assert.equal(P(1000, 999, true), false); assert.equal(P(NaN, 1000, true), false); assert.equal(P(1000, Infinity, true), false); console.log("bulkSetPulse OK"); }

{ const P = noteFocusPulse, M = NOTE_FOCUS_PULSE_MS; assert.equal(M, 2400); assert.equal(P(null, 5, "a", "a"), false); assert.equal(P(1000, 1000, "a", "a"), true); assert.equal(P(1000, 1000 + M - 1, "a", "a"), true);
  assert.equal(P(1000, 1000 + M, "a", "a"), false); assert.equal(P(1000, 1500, "a", "b"), false); assert.equal(P(1000, 1500, "", ""), false); assert.equal(P(1000, 1500, null, null), false); assert.equal(P(1000, 999, "a", "a"), false); assert.equal(P(NaN, 1000, "a", "a"), false); assert.equal(P(1000, Infinity, "a", "a"), false); console.log("noteFocusPulse OK"); }

{ const P = keyTargetPulse, M = KEY_TARGET_PULSE_MS; assert.equal(M, 2400); assert.equal(P(null, 5, "a"), false); assert.equal(P(1000, 1000, "a"), true); assert.equal(P(1000, 1000 + M - 1, "b"), true);
  assert.equal(P(1000, 1000 + M, "a"), false); assert.equal(P(1000, 1500, null), false); assert.equal(P(1000, 1500, ""), false); assert.equal(P(1000, 999, "a"), false); assert.equal(P(NaN, 1000, "a"), false); assert.equal(P(1000, Infinity, "a"), false); console.log("keyTargetPulse OK"); }

{ const P = cheatsheetPulse, M = CHEATSHEET_PULSE_MS; assert.equal(M, 2400); assert.equal(P(null, 5, true), false); assert.equal(P(1000, 1000, true), true); assert.equal(P(1000, 1000 + M - 1, true), true);
  assert.equal(P(1000, 1000 + M, true), false); assert.equal(P(1000, 1500, false), false); assert.equal(P(1000, 1500, "true"), false); assert.equal(P(1000, 999, true), false); assert.equal(P(NaN, 1000, true), false); assert.equal(P(1000, Infinity, true), false); console.log("cheatsheetPulse OK"); }

{ const C = notesCoverage; assert.deepEqual(C({ entries: [{ note: "a" }, {}, { note: " " }] }), { noted: 1, total: 3, label: "notes on 1 of 3", show: true });
  assert.equal(C({ entries: [{ note: "a" }, { note: "b" }, { note: "c" }] }).label, "notes on 3 of 3"); assert.equal(C({ entries: [{}, {}, {}] }).show, false);
  assert.equal(C(null).show, false); assert.equal(C({ entries: "x" }).total, 0); console.log("notesCoverage OK"); }
