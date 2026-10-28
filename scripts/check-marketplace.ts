// Run: npx tsx scripts/check-marketplace.ts
// Checks the Φ marketplace listing contract and the license-intent stub on fixture records (no network, no writes).
import assert from "node:assert/strict";
import {
  buildListings, buildIndex, createLicenseIntent, reuseHref, licenseGate,
  LICENSE_INTENT_PHI_MIN, LISTINGS_SCHEMA, INTENT_SCHEMA, DEFAULT_DOMAIN,
} from "../src/lib/marketplace/listings";
import { parseReuseParam, findHighlighted } from "../src/lib/marketplace/listings";
import { errorSurfaceFor, rankKey, surfaceNote, ERROR_SURFACE_SCHEMA } from "../src/lib/marketplace/error-surface";
import { toLedgerEventShape } from "../src/lib/marketplace/ledger-preview";
import type { ExperienceEntry } from "../src/lib/level4/experience-client";

const SEQ = ["mark_boundary", "complete_field", "request_independent_check", "seal_pack"];
type Opts = { phi?: number; e?: number; t?: string; system?: string; extra?: Partial<ExperienceEntry> };
const run = (id: string, o: Opts = {}): ExperienceEntry[] =>
  SEQ.map((y, i) => {
    const last = i === SEQ.length - 1;
    return {
      run_id: id, iteration: i + 1, e: last ? (o.e ?? 0.151) : 0.9,
      verified_at: last ? (o.t ?? "2026-10-24T19:47:47.814Z") : "2026-10-24T19:47:00.000Z",
      eligible: last, state: last ? "COMPLETE" : "CONTINUE", y,
      e0: 1.561, delta_e: last ? Number((1.561 - (o.e ?? 0.151)).toFixed(3)) : 0, cold_e: 0.165,
      phi: last ? (o.phi ?? 0.014) : -0.5, tensor_distance: 0.1,
      ...(o.system ? { system: o.system } : {}), ...(last ? o.extra : {}),
    };
  });

// 1. Empty store.
assert.deepEqual(buildListings([]), []);
const idx0 = buildIndex([]);
assert.equal(idx0.count, 0); assert.equal(idx0.schema, LISTINGS_SCHEMA);
console.log("empty store      -> no listings, index schema present");

// 2. Only Φ > 0 and reusable are listed; ineligible excluded.
const bad: Partial<ExperienceEntry>[] = [{ eligible: false }, { state: "CONTINUE" }, { phi: 0 }, { phi: -0.1 }, { tensor_distance: 99 }];
for (const b of bad) assert.equal(buildListings(run("run_bad", { extra: b })).length, 0, JSON.stringify(b));
assert.equal(buildListings(run("run_gap").filter((x) => x.iteration !== 2)).length, 0, "gappy sequence excluded");
const one = buildListings([...run("run_bad", { phi: -0.1 }), ...run("run_ok")]);
assert.deepEqual(one.map((l) => l.run_id), ["run_ok"]);
assert.ok(one.every((l) => l.phi > 0));
console.log("filter           -> only Φ>0 reusable runs; ineligible, Φ<=0, tensor over ε, gappy excluded");

// 3. Shape, Δe math, domain, reuse href, one listing per run.
const l = one[0];
assert.equal(l.final_e, 0.151); assert.equal(l.baseline_e, 0.165); assert.equal(l.e0, 1.561);
assert.equal(l.delta_e, 1.41); assert.equal(Number((l.e0! - l.final_e).toFixed(3)), l.delta_e);
assert.equal(l.phi, Number((l.baseline_e! - l.final_e).toFixed(3)));
assert.deepEqual(l.sequence, SEQ);
assert.equal(l.domain, DEFAULT_DOMAIN); assert.equal(l.domain_source, "default");
assert.equal(buildListings(run("run_d", { system: "logistics" }))[0].domain, "logistics");
assert.equal(l.reuse_href, "/workbench/autonomous?reuse=run_ok"); assert.equal(l.reuse_href, reuseHref("run_ok"));
const noDelta = run("run_nd"); delete (noDelta[3] as Partial<ExperienceEntry>).delta_e;
assert.equal(buildListings(noDelta)[0].delta_e, 1.41, "Δe derived from e0 when not stored");
assert.equal(buildListings([...run("run_x"), ...run("run_x")]).length, 1, "duplicate rows collapse to one listing");
console.log(`shape and Δe     -> final_e ${l.final_e}, Δe ${l.delta_e}, Φ ${l.phi}, reuse ${l.reuse_href}`);

// 4. Ranking: Φ desc; ties go to the later verified_at.
const rankedEntries = [
  ...run("run_low", { phi: 0.02, t: "2026-10-26T00:00:00.000Z" }),
  ...run("run_tie_old", { phi: 0.05, t: "2026-10-20T00:00:00.000Z" }),
  ...run("run_high", { phi: 0.2, t: "2026-10-19T00:00:00.000Z" }),
  ...run("run_tie_new", { phi: 0.05, t: "2026-10-25T00:00:00.000Z" }),
];
const ranked = buildListings(rankedEntries);
assert.deepEqual(ranked.map((x) => x.run_id), ["run_high", "run_tie_new", "run_tie_old", "run_low"]);
const sameTime = buildListings([...run("run_p", { phi: 0.05 }), ...run("run_q", { phi: 0.05 })]);
assert.deepEqual(sameTime.map((x) => x.run_id), ["run_q", "run_p"], "same Φ and time: later record first");
console.log("ranking          -> Φ desc, ties to the later record");

// 5. Threshold gating.
assert.equal(LICENSE_INTENT_PHI_MIN, 0.01);
assert.equal(licenseGate(0.01).allowed, false, "equal to threshold does not exceed it");
assert.equal(licenseGate(0.011).allowed, true);
const lo = buildListings(run("run_lo", { phi: 0.005 }))[0];
assert.equal(lo.license_intent.allowed, false);
assert.match(lo.license_intent.reason, /does not exceed/);
const refused = createLicenseIntent(lo, "2026-10-28T00:00:00.000Z");
assert.equal(refused.ok, false);
console.log(`threshold        -> intent needs Φ > ${LICENSE_INTENT_PHI_MIN}; below is refused with a reason`);

// 6. Intent record and ledger event shape.
const made = createLicenseIntent(l, "2026-10-28T00:00:00.000Z");
assert.ok(made.ok);
if (made.ok) {
  assert.deepEqual(made.intent, {
    schema: INTENT_SCHEMA, type: "license_intent", sequence_ref: "run_ok", phi: 0.014, final_e: 0.151, delta_e: 1.41,
    threshold: 0.01, created_at: "2026-10-28T00:00:00.000Z", settlement: "none — no money movement", status: "intent_only",
  });
  const ev = toLedgerEventShape(made.intent);
  assert.equal(ev.assetId, "run_ok"); assert.equal(ev.preview, true); assert.equal(ev.signature, "unsigned");
  assert.equal(ev.stateData.auditStatus, "PENDING"); assert.match(ev.stateData.metadataHash, /^[0-9a-f]{64}$/);
  assert.equal(ev.timestamp, Date.parse("2026-10-28T00:00:00.000Z"));
  assert.equal(ev.stateData.splitRule, undefined, "no split rule: no money movement");
  assert.deepEqual(toLedgerEventShape(made.intent), ev, "deterministic");
}
console.log("intent record    -> intent_only, settlement none, ledger preview shaped (no POST)");

// 7. Index carries listings, threshold and reuse hrefs.
const idx = buildIndex(rankedEntries);
assert.equal(idx.count, 4); assert.equal(idx.license_intent_phi_min, 0.01);
assert.ok(idx.listings.every((x) => x.reuse_href.startsWith("/workbench/autonomous?reuse=")));
console.log("index            -> schema, count, threshold, reuse hrefs");

// 8. Error surface (display only): shape, placeholders null, nothing invented.
const es = l.error_surface;
assert.equal(es.schema_version, ERROR_SURFACE_SCHEMA); assert.equal(es.ranking_key, "phi");
assert.deepEqual(es.primary, { axis: "phi", value: 0.014 });
assert.deepEqual(es.axes.map((a) => a.axis), ["accuracy", "tensor_distance", "latency", "cost", "safety"]);
const ax = (n: string) => es.axes.find((a) => a.axis === n)!;
assert.equal(ax("accuracy").value, 0.151); assert.equal(ax("accuracy").status, "measured");
assert.equal(ax("tensor_distance").value, 0.1); assert.equal(ax("tensor_distance").status, "measured");
for (const n of ["latency", "cost", "safety"]) {
  assert.equal(ax(n).value, null, n); assert.equal(ax(n).status, "placeholder", n);
  assert.match(ax(n).note, /placeholder — not measured yet/, n);
}
assert.equal(surfaceNote(es), "[Φ 0.014 · e 0.151 · tensor 0.100 · latency — · cost — · safety —]");
const noTd = run("run_notd"); delete (noTd[3] as Partial<ExperienceEntry>).tensor_distance;
const esNo = buildListings(noTd)[0].error_surface;
assert.equal(esNo.axes.find((a) => a.axis === "tensor_distance")!.value, null);
assert.equal(esNo.axes.find((a) => a.axis === "tensor_distance")!.status, "placeholder", "absent tensor distance is not invented");
assert.deepEqual(errorSurfaceFor({ phi: 0.014, final_e: 0.151, tensor_distance: 0.1 }), es, "pure: same input, same output");
console.log("error surface    -> phi primary; e + tensor measured; latency/cost/safety null placeholders; " + surfaceNote(es));

// 9. Ranking unchanged by the surface: Φ-only, rankKey is Φ, order matches the pre-surface expectation.
assert.equal(rankKey(l), l.phi);
const withTd = [
  ...run("run_low", { phi: 0.02, t: "2026-10-26T00:00:00.000Z", extra: { tensor_distance: 0.0 } }),
  ...run("run_tie_old", { phi: 0.05, t: "2026-10-20T00:00:00.000Z", extra: { tensor_distance: 0.15 } }),
  ...run("run_high", { phi: 0.2, t: "2026-10-19T00:00:00.000Z", extra: { tensor_distance: 0.15 } }),
  ...run("run_tie_new", { phi: 0.05, t: "2026-10-25T00:00:00.000Z", extra: { tensor_distance: 0.0 } }),
];
assert.deepEqual(buildListings(withTd).map((x) => x.run_id), ranked.map((x) => x.run_id), "order identical whatever the other axes hold");
console.log("ranking hook     -> rankKey = Φ; order unchanged by tensor distance or any other axis");

// 10. JSON index includes error_surface and keeps every existing field.
const json = JSON.parse(JSON.stringify(buildIndex(rankedEntries)));
assert.equal(json.schema, LISTINGS_SCHEMA);
for (const x of json.listings) {
  for (const k of ["run_id", "domain", "final_e", "baseline_e", "e0", "delta_e", "phi", "verified_at", "sequence", "reuse_href", "license_intent"]) assert.ok(k in x, k);
  assert.equal(x.error_surface.ranking_key, "phi"); assert.equal(x.error_surface.primary.value, x.phi);
  assert.equal(x.error_surface.axes.find((a: { axis: string }) => a.axis === "latency").value, null);
}
console.log("index JSON       -> error_surface on every listing; existing fields intact");

// 11. Marketplace ?reuse= highlight parsing (pure).
assert.equal(parseReuseParam("?reuse=run_ok"), "run_ok");
assert.equal(parseReuseParam("reuse=run_ok&x=1"), "run_ok");
assert.equal(parseReuseParam(""), null); assert.equal(parseReuseParam("?reuse="), null);
assert.equal(parseReuseParam("?reuse=../etc"), null); assert.equal(parseReuseParam("?reuse=<script>"), null);
assert.equal(findHighlighted(ranked, "run_high")?.run_id, "run_high");
assert.equal(findHighlighted(ranked, "run_missing"), null, "not a listing -> note, no error");
assert.equal(findHighlighted(ranked, null), null);
console.log("reuse highlight  -> valid id highlights its listing; unknown or malformed id yields null (note only)");
console.log("OK");
