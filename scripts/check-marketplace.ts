// Run: npx tsx scripts/check-marketplace.ts
// Checks the Φ marketplace listing contract and the license-intent stub on fixture records (no network, no writes).
import assert from "node:assert/strict";
import {
  buildListings, buildIndex, createLicenseIntent, reuseHref, licenseGate,
  LICENSE_INTENT_PHI_MIN, LISTINGS_SCHEMA, INTENT_SCHEMA, DEFAULT_DOMAIN,
} from "../src/lib/marketplace/listings";
import { parseReuseParam, findHighlighted } from "../src/lib/marketplace/listings";
import { errorSurfaceFor, rankKey, surfaceNote, ERROR_SURFACE_SCHEMA } from "../src/lib/marketplace/error-surface";
import { peerStatus, peerHandoffUrl, PEERS_NOTE } from "../src/lib/marketplace/peer";
import { buildPeerRegistry, isValidPeerUrl, normalizeOrigin, PEERS_SCHEMA, PEERS_REGISTRY_NOTE, PLACEHOLDER_NOTE } from "../src/lib/marketplace/peers";
import { validatePeerListingIndex, validatePeerIndexSource, PEER_INDEX_NOTE } from "../src/lib/marketplace/peer-index";
import { formatPeerIndexReport } from "../src/lib/marketplace/peer-index-report";
import { checkRouteContract, formatRouteContractReport, ROUTE_CONTRACT_NOTE } from "../src/lib/marketplace/route-contract";
import { parseOperatorOrigin, parseOriginArgs, routeUrls, formatOriginReport, safeSnippet, ORIGIN_NOTE, type RouteProbe } from "../src/lib/marketplace/origin-check";
import { buildGlobalSnapshot, classifyRun, GLOBAL_SNAPSHOT_SCHEMA, SNAPSHOT_NOTE } from "../src/lib/diagnostics/global-snapshot";
import { validateGlobalSnapshot, formatSnapshotReport, SNAPSHOT_VALIDATE_NOTE } from "../src/lib/diagnostics/global-snapshot-validate";
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

// 12. Peer status and hand-off link (display only).
const ps = peerStatus(l);
assert.equal(ps.peer_ready, true); assert.equal(ps.status, "available_for_reuse"); assert.match(ps.reason, /replay-vets/);
assert.equal(peerStatus({ run_id: "run_ok", sequence: [], phi: 0.014 }).peer_ready, false, "empty sequence");
assert.equal(peerStatus({ run_id: "run_ok", sequence: ["a", ""], phi: 0.014 }).peer_ready, false, "blank action");
assert.equal(peerStatus({ run_id: "bad id!", sequence: SEQ, phi: 0.014 }).peer_ready, false, "invalid run id");
assert.equal(peerStatus({ run_id: "x".repeat(81), sequence: SEQ, phi: 0.014 }).status, "not_ready", "id over 80 chars");
assert.equal(peerStatus({ run_id: "run_ok", sequence: SEQ, phi: 0 }).peer_ready, false, "phi not above 0");
assert.deepEqual(peerStatus(l), peerStatus(l), "pure");
assert.equal(peerHandoffUrl("https://shiyan-dap.vercel.app", "run_ok"), "https://shiyan-dap.vercel.app/workbench/autonomous?reuse=run_ok");
assert.equal(peerHandoffUrl("https://shiyan-dap.vercel.app/", "run_ok"), "https://shiyan-dap.vercel.app/workbench/autonomous?reuse=run_ok", "trailing slash");
assert.equal(peerHandoffUrl("http://localhost:3000//", "demo-run"), "http://localhost:3000/workbench/autonomous?reuse=demo-run");
for (const bad of ["", "a b", "../etc", "run?x=1", "run&x=1", "<script>", "x".repeat(81)]) assert.equal(peerHandoffUrl("https://a.example", bad), null, bad);
assert.equal(peerHandoffUrl("not an origin", "run_ok"), null);
assert.equal(peerHandoffUrl("javascript:alert(1)", "run_ok"), null);
assert.equal(new URL(peerHandoffUrl("https://a.example", "run_ok")!).searchParams.get("reuse"), "run_ok");
assert.equal(parseReuseParam(new URL(peerHandoffUrl("https://a.example", "run_ok")!).search), "run_ok", "link round-trips");
console.log("peer status/link -> peerStatus gates id, sequence, Φ; peerHandoffUrl validates id and origin (trailing slash ok)");

// 13. JSON index: peer fields additive; ranking unchanged.
const pj = JSON.parse(JSON.stringify(buildIndex(rankedEntries)));
assert.equal(pj.schema, LISTINGS_SCHEMA, "schema string unchanged");
assert.equal(pj.peer_ready_count, 4); assert.equal(pj.peers_note, PEERS_NOTE); assert.match(pj.peers_note, /this node's index/);
for (const x of pj.listings) {
  assert.equal(x.peer_ready, true); assert.equal(x.peer_status, "available_for_reuse");
  assert.equal(x.peer_handoff_path, x.reuse_href); assert.ok(x.peer_handoff_path.startsWith("/workbench/autonomous?reuse="));
  assert.ok(!/^https?:/.test(x.peer_handoff_path), "relative: nothing server-dependent");
}
assert.deepEqual(pj.listings.map((x: { run_id: string }) => x.run_id), ["run_high", "run_tie_new", "run_tie_old", "run_low"], "order unchanged");
assert.equal(buildIndex([]).peer_ready_count, 0);
console.log("peer JSON        -> peer_ready, peer_status, peer_handoff_path per listing; peer_ready_count; order unchanged");

// 14. Static peer registry (pure; no network, no store, no writes).
const reg = buildPeerRegistry("https://shiyan-dap.vercel.app");
assert.equal(reg.schema_version, PEERS_SCHEMA); assert.equal(reg.schema_version, "aethel.marketplace.peers.v1");
assert.equal(reg.self_id, "self"); assert.equal(reg.peers[0].id, "self", "self first"); assert.equal(reg.peers[0].role, "self");
assert.equal(reg.peers[0].status, "this_node");
assert.equal(reg.peers[0].index_url, "https://shiyan-dap.vercel.app/workbench/marketplace");
assert.equal(reg.peers[0].listings_url, "https://shiyan-dap.vercel.app/api/marketplace/listings");
assert.equal(reg.peers.length, 3); assert.equal(reg.note, PEERS_REGISTRY_NOTE); assert.match(reg.note, /No discovery protocol/);
for (const ph of reg.peers.slice(1)) {
  assert.equal(ph.role, "placeholder"); assert.equal(ph.status, "placeholder");
  assert.equal(ph.index_url, null); assert.equal(ph.listings_url, null); assert.equal(ph.note, PLACEHOLDER_NOTE);
  assert.match(ph.name, /\(placeholder\)$/);
}
assert.deepEqual(reg.peers.map((x) => x.id), ["self", "peer-example-a", "peer-example-b"]);
assert.equal(buildPeerRegistry("https://shiyan-dap.vercel.app/").peers[0].index_url, "https://shiyan-dap.vercel.app/workbench/marketplace", "trailing slash");
assert.equal(buildPeerRegistry("http://localhost:3000").peers[0].listings_url, "http://localhost:3000/api/marketplace/listings", "local http");
for (const bad of [null, undefined, "", "not a url", "javascript:alert(1)", "ftp://a.example", "https://u:p@a.example", "https://a.example/path", "https://a.example?x=1"]) {
  const r = buildPeerRegistry(bad as string | null | undefined);
  assert.equal(r.peers[0].index_url, "/workbench/marketplace", `relative fallback: ${String(bad)}`);
  assert.equal(r.peers[0].listings_url, "/api/marketplace/listings");
}
assert.equal(normalizeOrigin("https://a.example///"), null, "path other than / is not an origin");
assert.deepEqual(JSON.parse(JSON.stringify(reg)), reg, "JSON-safe and pure");
assert.deepEqual(buildPeerRegistry("https://x.example"), buildPeerRegistry("https://x.example"), "pure");
const caps = reg.peers[0].capabilities;
assert.ok(caps, "self has capabilities");
assert.deepEqual(caps, {
  listings_schema: LISTINGS_SCHEMA, peers_schema: PEERS_SCHEMA,
  handoff_path_template: "/workbench/autonomous?reuse={run_id}", license_intent_phi_min: LICENSE_INTENT_PHI_MIN,
  read_only: true, writes: "none", cross_node_trust: "none", attestation: "none — self-reported, not third-party attested",
});
assert.equal(caps.listings_schema, "aethel.marketplace.listings.v1"); assert.equal(caps.peers_schema, "aethel.marketplace.peers.v1");
assert.equal(caps.license_intent_phi_min, 0.01);
assert.equal(reg.schema_version, "aethel.marketplace.peers.v1", "schema string unchanged (additive field only)");
for (const ph of reg.peers.slice(1)) assert.equal("capabilities" in ph, false, "placeholders carry no capabilities");
assert.equal(reg.peers.filter((x) => x.capabilities !== undefined).length, 1, "self only");
assert.deepEqual(buildPeerRegistry(null).peers[0].capabilities, caps, "capabilities do not depend on origin");
assert.deepEqual(JSON.parse(JSON.stringify(caps)), caps, "capabilities are JSON-safe");
console.log("peer registry    -> self first, absolute URLs from origin, relative fallback, placeholders have null URLs, schema v1; self-only capabilities");

// 15. Peer URL validator for future entries (https only, no credentials, no local/private hosts).
for (const ok of ["https://peer.example.org", "https://peer.example.org/workbench/marketplace", "https://a.b.example.com:8443/api/marketplace/listings", "https://8.8.8.8/x"]) assert.equal(isValidPeerUrl(ok), true, ok);
for (const bad of [
  "http://peer.example.org", "https://user:pw@peer.example.org", "https://user@peer.example.org", "https://localhost/x", "https://localhost:3000",
  "https://127.0.0.1", "https://127.1.2.3", "https://10.0.0.5", "https://192.168.1.1", "https://172.16.0.1", "https://172.31.255.255", "https://169.254.169.254",
  "https://0.0.0.0", "https://100.64.0.1", "https://[::1]", "https://[fe80::1]", "https://[fd00::1]", "https://2130706433", "https://printer.local", "https://db.internal",
  "https://intranet", "javascript:alert(1)", "ftp://peer.example.org", "file:///etc/passwd", "data:text/html,x", "", "not a url", "https://peer.example.org/a b",
]) assert.equal(isValidPeerUrl(bad), false, bad);
assert.equal(isValidPeerUrl("https://172.32.0.1"), true, "172.32 is public");
assert.equal(isValidPeerUrl(null), false); assert.equal(isValidPeerUrl(undefined), false); assert.equal(isValidPeerUrl(42), false);
console.log("peer url gate    -> https public hosts accepted; http, credentials, localhost, private/link-local IPs, IPv6, non-http schemes rejected");
// 16. Peer listing index shape validator (pure; shape check only, no fetching, no trust).
type J = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const goodIdx = (): J => JSON.parse(JSON.stringify(buildIndex(rankedEntries)));
const mutate = (fn: (d: J) => void): J => { const d = goodIdx(); fn(d); return d; };
const failsWith = (input: unknown, re: RegExp, label: string) => {
  const r = validatePeerListingIndex(input);
  assert.equal(r.ok, false, `${label}: should fail`);
  if (!r.ok) { assert.ok(r.errors.length > 0 && r.errors.length <= 20, `${label}: error count`); assert.ok(r.errors.some((e) => re.test(e)), `${label}: ${r.errors.join(" | ")}`); }
};
assert.match(PEER_INDEX_NOTE, /^Shape check only: well-formed does not mean verified, attested or reusable\./);
const good = goodIdx();
const vr = validatePeerListingIndex(good);
assert.equal(vr.ok, true); assert.equal(good.listings.length, 4);
if (vr.ok) { assert.deepEqual(vr.warnings, []); assert.deepEqual(JSON.parse(JSON.stringify(vr.index)), good, "sanitized copy deep-equals the input"); assert.notEqual(vr.index.listings[0], good.listings[0], "a copy, not the same object"); }
const emptyRes = validatePeerListingIndex(JSON.parse(JSON.stringify(buildIndex([]))));
assert.equal(emptyRes.ok, true); if (emptyRes.ok) assert.equal(emptyRes.index.count, 0);
for (const [v, label] of [[null, "null"], [[], "array"], ["x", "string"], [{}, "empty object"], [42, "number"], [undefined, "undefined"]] as [unknown, string][]) failsWith(v, /./, label);
failsWith(mutate((d) => { d.schema = "aethel.marketplace.listings.v2"; }), /schema/, "wrong schema");
failsWith(mutate((d) => { d.count = 3; }), /count/, "count mismatch");
failsWith(mutate((d) => { d.peer_ready_count = 1; }), /peer_ready_count/, "peer_ready_count mismatch");
failsWith(mutate((d) => { d.license_intent_phi_min = null; }), /license_intent_phi_min/, "threshold not a number");
failsWith(mutate((d) => { d.notice = 1; d.peers_note = null; }), /notice/, "notice not a string");
failsWith(mutate((d) => { d.listings[0].run_id = "../x"; }), /run_id/, "bad run_id");
for (const phi of [0, -0.1, null, "0.5"]) failsWith(mutate((d) => { d.listings[0].phi = phi; }), /phi/, `phi ${String(phi)}`);
failsWith(mutate((d) => { d.listings[0].sequence = []; }), /sequence/, "empty sequence");
failsWith(mutate((d) => { d.listings[0].sequence = ["a", ""]; }), /sequence/, "blank action");
failsWith(mutate((d) => { d.listings[0].sequence = Array.from({ length: 201 }, () => "a"); }), /sequence/, "sequence over 200");
failsWith(mutate((d) => { d.listings[0].reuse_href = "https://evil.example/workbench/autonomous?reuse=run_high"; }), /reuse_href/, "absolute reuse_href");
failsWith(mutate((d) => { d.listings[0].reuse_href = "/workbench/autonomous?reuse=run_other"; }), /reuse_href/, "mismatched reuse_href");
failsWith(mutate((d) => { d.listings[0].peer_handoff_path = "/workbench/autonomous?reuse=run_other"; }), /peer_handoff_path/, "peer_handoff_path differs");
failsWith(mutate((d) => { d.listings[0].peer_status = "not_ready"; }), /peer_status/, "peer_status inconsistent");
failsWith(mutate((d) => { d.listings[0].verified_at = "not a date"; }), /verified_at/, "bad date");
failsWith(mutate((d) => { d.listings[0].domain_source = "elsewhere"; }), /domain_source/, "bad domain_source");
failsWith(mutate((d) => { d.listings[0].e0 = "1"; }), /e0/, "e0 not number or null");
failsWith(mutate((d) => { d.listings[0].license_intent = { allowed: "yes" }; }), /license_intent/, "license_intent shape");
failsWith(mutate((d) => { d.listings[0].error_surface.ranking_key = "latency"; }), /ranking_key/, "wrong ranking_key");
failsWith(mutate((d) => { d.listings[0].error_surface.primary.value = 0.5; }), /primary\.value/, "primary.value != phi");
failsWith(mutate((d) => { d.listings[0].error_surface.primary.axis = "accuracy"; }), /primary\.axis/, "primary.axis != phi");
failsWith(mutate((d) => { d.listings[0].error_surface.schema_version = "x"; }), /schema_version/, "surface schema");
failsWith(mutate((d) => { d.listings[0].error_surface.axes[2].value = 0.3; }), /placeholder axis/, "placeholder axis with value");
failsWith(mutate((d) => { d.listings[0].error_surface.axes[0].status = "guess"; }), /status/, "axis status");
failsWith(mutate((d) => { d.listings[0].error_surface.axes[0].axis = "vibes"; }), /axis/, "unknown axis");
failsWith(mutate((d) => { d.listings[1].run_id = d.listings[0].run_id; d.listings[1].reuse_href = d.listings[0].reuse_href; d.listings[1].peer_handoff_path = d.listings[0].reuse_href; }), /duplicate run_id/, "duplicate run_id");
const many = mutate((d) => { d.listings = Array.from({ length: 501 }, () => d.listings[0]); d.count = 501; d.peer_ready_count = 501; });
failsWith(many, /more than 500/, "over 500 listings");
const manyBad = mutate((d) => { d.listings = Array.from({ length: 100 }, () => ({})); d.count = 100; });
const mb = validatePeerListingIndex(manyBad); assert.equal(mb.ok, false); if (!mb.ok) assert.equal(mb.errors.length, 20, "errors capped at 20");
const unsorted = mutate((d) => { d.listings.reverse(); });
const ur = validatePeerListingIndex(unsorted);
assert.equal(ur.ok, true, "unsorted is a warning, not an error"); if (ur.ok) { assert.equal(ur.warnings.length, 1); assert.match(ur.warnings[0], /not ranked by phi/); }
const extra = mutate((d) => { d.surprise = "x"; d.listings[0].future_field = { a: 1 }; d.listings[0].error_surface.future = 1; d.listings[0].error_surface.axes[0].future = 1; d.listings[0].license_intent.future = 1; });
const er = validatePeerListingIndex(extra);
assert.equal(er.ok, true);
if (er.ok) {
  assert.equal("surprise" in er.index, false); assert.equal("future_field" in er.index.listings[0], false);
  assert.equal("future" in er.index.listings[0].error_surface, false); assert.equal("future" in er.index.listings[0].license_intent, false);
  assert.deepEqual(JSON.parse(JSON.stringify(er.index)), good, "unknown fields dropped, rest identical");
}
assert.deepEqual(good, goodIdx(), "input not mutated");
// Deterministic junk: must never throw.
const cyc: J = {}; cyc.self = cyc;
const proxy = new Proxy({}, { get() { throw new Error("boom"); }, ownKeys() { throw new Error("boom"); } });
const junkBase: unknown[] = [null, undefined, true, false, 0, -1, 1.5, NaN, Infinity, -Infinity, "", "x", "{}", "aethel.marketplace.listings.v1", [], [[]], [null], [{}], {}, { listings: null }, { listings: {} },
  { schema: LISTINGS_SCHEMA }, { schema: LISTINGS_SCHEMA, listings: [] }, { schema: LISTINGS_SCHEMA, listings: [null, 1, "a", [], {}], count: 5 }, { listings: "abc", count: "0" },
  Symbol("s"), 10n, () => 1, new Date(0), /re/, new Map(), new Set([1]), cyc, proxy, Object.create(null), new Array(1000), { count: NaN, peer_ready_count: -1, listings: [] }];
const junk: unknown[] = [];
for (let i = 0; i < 200; i++) junk.push(junkBase[i % junkBase.length]);
for (const j of junk) { const r = validatePeerListingIndex(j); assert.equal(typeof r.ok, "boolean"); }
assert.equal(junk.length, 200);
assert.equal(validatePeerListingIndex({ schema: LISTINGS_SCHEMA, count: 0, license_intent_phi_min: 0.01, peer_ready_count: 0, notice: "n", peers_note: "p", listings: [] }).ok, true);
// Source gate (future only; reuses isValidPeerUrl).
for (const ok of ["https://peer.example.org", "https://peer.example.org/", "https://peer.example.org/api/marketplace/listings", "https://a.example.com:8443/api/marketplace/listings", "https://peer.example.org/x/api/marketplace/listings"]) assert.equal(validatePeerIndexSource(ok), true, ok);
for (const bad of ["http://peer.example.org", "https://localhost/api/marketplace/listings", "https://127.0.0.1", "https://10.0.0.5/api/marketplace/listings", "https://192.168.1.1", "https://user:pw@peer.example.org",
  "https://peer.example.org/other", "https://peer.example.org/workbench/marketplace", "https://peer.example.org/api/marketplace/listings?x=1", "https://peer.example.org/#f", "", "javascript:alert(1)"]) assert.equal(validatePeerIndexSource(bad), false, bad);
for (const bad of [null, undefined, 42, {}, [], true]) assert.equal(validatePeerIndexSource(bad), false);
console.log(`peer index shape -> real index and empty index ok; ${junk.length} junk values never throw; bad shapes rejected with capped errors; unsorted is a warning; unknown fields dropped; source gate reuses isValidPeerUrl`);

// 17. Peer index report formatter (pure; the CLI scripts/validate-peer-index.ts is a thin wrapper around it).
const repOk = formatPeerIndexReport(validatePeerListingIndex(goodIdx()));
assert.equal(repOk.exitCode, 0); assert.equal(repOk.lines[0], PEER_INDEX_NOTE);
assert.deepEqual(repOk.lines, [PEER_INDEX_NOTE, "OK: 4 listings, 4 peer_ready"], "valid index: note, OK line with counts, no warnings");
const notReady = mutate((d) => { d.listings[3].peer_ready = false; d.listings[3].peer_status = "not_ready"; d.peer_ready_count = 3; });
assert.deepEqual(formatPeerIndexReport(validatePeerListingIndex(notReady)).lines[1], "OK: 4 listings, 3 peer_ready");
assert.deepEqual(formatPeerIndexReport(validatePeerListingIndex(buildIndex([]))).lines, [PEER_INDEX_NOTE, "OK: 0 listings, 0 peer_ready"]);
const repWarn = formatPeerIndexReport(validatePeerListingIndex(unsorted));
assert.equal(repWarn.exitCode, 0, "warnings do not fail");
assert.equal(repWarn.lines.length, 3); assert.match(repWarn.lines[1], /^OK: 4 listings, 4 peer_ready$/); assert.match(repWarn.lines[2], /^warning: listings are not ranked by phi/);
const repBad = formatPeerIndexReport(validatePeerListingIndex(mutate((d) => { d.count = 9; d.listings[0].phi = 0; })));
assert.equal(repBad.exitCode, 1); assert.equal(repBad.lines[0], PEER_INDEX_NOTE);
assert.ok(repBad.lines.length >= 3 && repBad.lines.slice(1).every((x) => x.startsWith("error: ")), "every error line is prefixed");
assert.ok(repBad.lines.every((x) => !x.startsWith("OK")), "no OK line on failure");
assert.equal(formatPeerIndexReport(validatePeerListingIndex(null)).exitCode, 1);
assert.deepEqual(formatPeerIndexReport(validatePeerListingIndex(goodIdx())), formatPeerIndexReport(validatePeerListingIndex(goodIdx())), "pure and deterministic");
console.log("peer index report-> OK line with counts, warning: lines do not fail, error: lines exit 1, deterministic (CLI run end-to-end by hand)");

// 18. Route contract checker (pure): the right content on the right route, not just a 200.
const peersHttps = JSON.parse(JSON.stringify(buildPeerRegistry("https://shiyan-dap.vercel.app")));
const peersLocal = JSON.parse(JSON.stringify(buildPeerRegistry("http://localhost:3000")));
const peersRel = JSON.parse(JSON.stringify(buildPeerRegistry(null)));
for (const [d, label] of [[peersHttps, "https"], [peersLocal, "localhost"], [peersRel, "relative"]] as [J, string][]) {
  const r = checkRouteContract("peers", d);
  assert.equal(r.ok, true, `peers ${label}: ${JSON.stringify(r)}`);
}
assert.equal(checkRouteContract("listings", goodIdx()).ok, true);
assert.equal(checkRouteContract("listings", JSON.parse(JSON.stringify(buildIndex([])))).ok, true);
const crossL = checkRouteContract("listings", peersHttps); // the real bug: peers registry served on the listings route
assert.equal(crossL.ok, false); if (!crossL.ok) { assert.deepEqual(crossL.errors, ["this looks like the peers registry, not a listings index (wrong route content)"]); }
const crossP = checkRouteContract("peers", goodIdx());
assert.equal(crossP.ok, false); if (!crossP.ok) { assert.deepEqual(crossP.errors, ["this looks like a listings index, not the peers registry (wrong route content)"]); }
const pfail = (d: unknown, re: RegExp, label: string) => {
  const r = checkRouteContract("peers", d);
  assert.equal(r.ok, false, `${label}: should fail`);
  if (!r.ok) { assert.ok(r.errors.length <= 20); assert.ok(r.errors.some((e) => re.test(e)), `${label}: ${r.errors.join(" | ")}`); }
};
const pm = (fn: (d: J) => void): J => { const d = JSON.parse(JSON.stringify(peersHttps)); fn(d); return d; };
pfail(pm((d) => { d.peers[0].capabilities.writes = "some"; }), /capabilities\.writes/, "tampered writes");
pfail(pm((d) => { d.peers[0].capabilities.cross_node_trust = "full"; }), /cross_node_trust/, "tampered trust");
pfail(pm((d) => { d.peers[0].capabilities.listings_schema = "x"; }), /listings_schema/, "tampered listings_schema");
pfail(pm((d) => { d.peers[0].capabilities.license_intent_phi_min = 0.5; }), /license_intent_phi_min/, "tampered threshold");
pfail(pm((d) => { d.peers[0].capabilities.extra = 1; }), /unknown capability/, "extra capability");
pfail(pm((d) => { d.peers[1].index_url = "https://peer.example.org/workbench/marketplace"; }), /null URLs/, "placeholder with URL");
pfail(pm((d) => { d.peers[1].capabilities = JSON.parse(JSON.stringify(d.peers[0].capabilities)); }), /only the self entry/, "capabilities on a placeholder");
pfail(pm((d) => { d.peers.reverse(); }), /first entry/, "self not first");
pfail(pm((d) => { d.peers[0].role = "placeholder"; }), /role "self"/, "first entry not role self");
pfail(pm((d) => { d.schema_version = "aethel.marketplace.peers.v2"; }), /schema_version/, "wrong schema_version");
pfail(pm((d) => { d.peers = []; }), /non-empty/, "empty peers");
pfail(pm((d) => { d.self_id = 5; }), /self_id/, "self_id not string");
pfail(pm((d) => { d.peers[0].name = null; }), /name/, "name not string");
pfail(pm((d) => { d.peers[0].index_url = "https://u:p@x.example/"; }), /index_url/, "self URL with credentials");
pfail(pm((d) => { d.peers[0].listings_url = "//evil.example/x"; }), /listings_url/, "protocol-relative self URL");
pfail(pm((d) => { d.peers[2].id = d.peers[1].id; }), /duplicate id/, "duplicate id");
pfail(pm((d) => { d.peers[2].role = "node"; d.peers[2].status = "listed"; d.peers[2].index_url = "http://127.0.0.1/x"; }), /peer URL gate/, "non-self URL must pass the gate");
const ok2 = checkRouteContract("peers", pm((d) => { d.peers[2].role = "node"; d.peers[2].status = "listed"; d.peers[2].index_url = "https://peer.example.org/workbench/marketplace"; }));
assert.equal(ok2.ok, true, "a non-placeholder peer with a gate-valid URL is allowed by shape");
const noCaps = checkRouteContract("peers", pm((d) => { delete d.peers[0].capabilities; }));
assert.equal(noCaps.ok, true); if (noCaps.ok) assert.deepEqual(noCaps.warnings, ["self has no capabilities object"]);
const rjunk: unknown[] = [null, undefined, 0, "", "x", [], [null], {}, { peers: null }, { peers: [null] }, { peers: [1], schema_version: PEERS_SCHEMA, self_id: "self" }, { listings: 5 }, cyc, proxy, Symbol("s"), 10n, () => 1, new Map(), Object.create(null), { schema: LISTINGS_SCHEMA, peers: [] }];
let rn = 0;
for (let i = 0; i < 200; i++) for (const route of ["peers", "listings"] as const) { const r = checkRouteContract(route, rjunk[i % rjunk.length]); assert.equal(typeof r.ok, "boolean"); rn++; }
assert.equal(rn, 400);
assert.equal(checkRouteContract("other" as never, {}).ok, false, "unknown route name fails");
const rep1 = formatRouteContractReport("peers", checkRouteContract("peers", peersHttps));
assert.deepEqual(rep1, { lines: [ROUTE_CONTRACT_NOTE, "OK: peers contract holds"], exitCode: 0 });
const rep2 = formatRouteContractReport("listings", crossL);
assert.equal(rep2.exitCode, 1); assert.deepEqual(rep2.lines, [ROUTE_CONTRACT_NOTE, "error: this looks like the peers registry, not a listings index (wrong route content)"]);
const rep3 = formatRouteContractReport("peers", noCaps);
assert.deepEqual(rep3, { lines: [ROUTE_CONTRACT_NOTE, "OK: peers contract holds", "warning: self has no capabilities object"], exitCode: 0 });
assert.deepEqual(checkRouteContract("peers", peersHttps), checkRouteContract("peers", peersHttps), "pure and deterministic");
console.log("route contract   -> peers and listings shapes hold; swapped content fails in both directions; tampered capabilities, placeholder URLs, self-not-first rejected; 400 junk calls never throw");

// 19. Operator origin check helpers (pure, no network). The CLI scripts/check-origin.ts is a thin fetching wrapper, run by hand.
// Decisions: https is accepted for any host (including https://localhost); plain http only for localhost and 127.0.0.1;
// origin only (no path other than "/", no query, fragment, credentials); isValidPeerUrl is NOT reused (it rejects localhost on purpose).
for (const [arg, want] of [
  ["https://shiyan-dap.vercel.app", "https://shiyan-dap.vercel.app"], ["https://shiyan-dap.vercel.app/", "https://shiyan-dap.vercel.app"],
  ["HTTPS://Shiyan-Dap.Vercel.App", "https://shiyan-dap.vercel.app"], ["https://shiyan-dap.vercel.app:443", "https://shiyan-dap.vercel.app"],
  ["http://localhost:3000", "http://localhost:3000"], ["http://localhost:3000/", "http://localhost:3000"], ["http://localhost", "http://localhost"],
  ["http://127.0.0.1:3000", "http://127.0.0.1:3000"], ["https://localhost", "https://localhost"], ["https://localhost:3443", "https://localhost:3443"],
] as [string, string][]) assert.equal(parseOperatorOrigin(arg), want, arg);
for (const bad of [
  "http://example.com", "http://shiyan-dap.vercel.app", "http://192.168.1.5:3000", "http://[::1]:3000", "http://0.0.0.0:3000", "https://user:pw@example.org", "https://user@example.org",
  "https://example.org/path", "https://example.org/api/marketplace/peers", "http://localhost:3000/x", "https://example.org?x=1", "https://example.org/?x=1", "https://example.org#f", "https://example.org/#f",
  "https://example.org?", "https://example.org#", "ftp://example.org", "file:///etc/passwd", "javascript:alert(1)", "data:text/html,x", "", " ", "not a url", "example.org", "//example.org", "https://", "https://exa mple.org", "https://example.org ",
  "x".repeat(3000),
]) assert.equal(parseOperatorOrigin(bad), null, bad.slice(0, 40));
for (const bad of [null, undefined, 42, {}, [], true, ["https://example.org"], Symbol("s"), () => 1]) assert.equal(parseOperatorOrigin(bad), null);
assert.deepEqual(routeUrls("https://shiyan-dap.vercel.app"), { peers: "https://shiyan-dap.vercel.app/api/marketplace/peers", listings: "https://shiyan-dap.vercel.app/api/marketplace/listings" });
assert.deepEqual(Object.keys(routeUrls("http://localhost:3000")), ["peers", "listings"], "exactly two URLs");
assert.equal(safeSnippet("a\u0000b\nc\u001b[31m"), "a b c [31m", "control characters removed"); assert.equal(safeSnippet("x".repeat(300)).length, 201); assert.equal(safeSnippet(5), "");
const O = "https://shiyan-dap.vercel.app";
const pOk: RouteProbe = { route: "peers", status: 200, json: peersHttps };
const lOk: RouteProbe = { route: "listings", status: 200, json: goodIdx() };
const all = formatOriginReport(O, [pOk, lOk]);
assert.equal(all.exitCode, 0); assert.equal(all.lines[0], ORIGIN_NOTE);
assert.deepEqual(all.lines.slice(1), [`Origin: ${O}`, "peers: HTTP 200 — OK: peers contract holds", "listings: HTTP 200 — OK: listings contract holds", `Summary: both route contracts hold at ${O}`]);
const swapped = formatOriginReport(O, [pOk, { route: "listings", status: 200, json: peersHttps }]);
assert.equal(swapped.exitCode, 1); assert.ok(swapped.lines.includes("listings: HTTP 200 — contract failed"));
assert.ok(swapped.lines.includes("  error: this looks like the peers registry, not a listings index (wrong route content)")); assert.ok(swapped.lines.at(-1)!.startsWith("Summary: 1 of 2 routes failed"));
const r503 = formatOriginReport(O, [pOk, { route: "listings", status: 503, failure: "expected HTTP 200", snippet: '{"error":"Experience store is not configured"}' }]);
assert.equal(r503.exitCode, 1); assert.ok(r503.lines.includes("listings: HTTP 503 — failed")); assert.ok(r503.lines.includes('  body: {"error":"Experience store is not configured"}'));
const r301 = formatOriginReport(O, [{ route: "peers", status: 301, failure: "redirect not followed (Location: https://other.example/)" }, lOk]);
assert.equal(r301.exitCode, 1); assert.ok(r301.lines.includes("peers: HTTP 301 — failed")); assert.ok(r301.lines.some((x) => x.startsWith("  error: redirect not followed")));
const rNet = formatOriginReport(O, [{ route: "peers", status: null, failure: "timed out after 10s" }, { route: "listings", status: null, failure: "network error: ECONNREFUSED" }]);
assert.equal(rNet.exitCode, 1); assert.ok(rNet.lines.includes("peers: no HTTP response — failed")); assert.ok(rNet.lines.at(-1)!.startsWith("Summary: 2 of 2 routes failed"));
const rMissing = formatOriginReport(O, [pOk]); assert.equal(rMissing.exitCode, 1); assert.ok(rMissing.lines.includes("  error: no result recorded"));
assert.equal(formatOriginReport(O, [pOk, { route: "listings", status: 204 }]).exitCode, 1, "non-200 without a failure text still fails");
const rInj = formatOriginReport(O, [pOk, { route: "listings", status: 502, failure: "bad\nerror: forged\u001b[2J", snippet: "x\ny" }]);
assert.ok(rInj.lines.every((x) => !/[\u0000-\u001f]/.test(x)), "remote text cannot add lines or control characters");
assert.deepEqual(formatOriginReport(O, [pOk, lOk]), formatOriginReport(O, [pOk, lOk]), "pure and deterministic");
console.log("origin check     -> origin parser (https any host, http localhost/127.0.0.1 only), two fixed URLs, report for ok / contract failure / 503 / 3xx / network failure; deterministic (CLI run by hand)");

// 20. Global · misdiagnosis snapshot (pure; copyable operator hand-off, same classification as /workbench/global).
const GT = "2026-10-29T18:00:00.000Z";
const s0 = buildGlobalSnapshot([], GT);
assert.deepEqual(s0, { schema_version: "aethel.global.snapshot.v1", generated_at: GT, note: SNAPSHOT_NOTE, counts: { total: 0, eligible: 0, misdiagnosis_rejected: 0, in_progress: 0 }, runs: [] });
assert.equal(GLOBAL_SNAPSHOT_SCHEMA, "aethel.global.snapshot.v1");
assert.match(SNAPSHOT_NOTE, /not attestation/); assert.match(SNAPSHOT_NOTE, /not a clinical diagnosis/); assert.match(SNAPSHOT_NOTE, /wrong next action/);
const gRows = [
  ...run("run_elig", { t: "2026-10-27T00:00:00.000Z" }),
  ...run("run_rej", { t: "2026-10-28T00:00:00.000Z", extra: { eligible: false, phi: -0.2 } }),
  { run_id: "run_wip", iteration: 1, e: 0.9, verified_at: "2026-10-26T00:00:00.000Z", eligible: false, state: "CONTINUE", y: "mark_boundary" },
  { run_id: "run_wip", iteration: 2, e: 0.7, verified_at: "2026-10-26T00:01:00.000Z", eligible: false, state: "CONTINUE", y: "complete_field" },
];
const gs = buildGlobalSnapshot(gRows, GT);
assert.deepEqual(gs.counts, { total: 3, eligible: 1, misdiagnosis_rejected: 1, in_progress: 1 });
assert.equal(gs.counts.total, gs.counts.eligible + gs.counts.misdiagnosis_rejected + gs.counts.in_progress);
assert.deepEqual(gs.runs.map((r) => [r.run_id, r.status]), [["run_rej", "MISDIAGNOSIS_REJECTED"], ["run_elig", "ELIGIBLE_EXPERIENCE"], ["run_wip", "IN_PROGRESS"]], "newest first");
assert.deepEqual(gs.runs[1], { run_id: "run_elig", status: "ELIGIBLE_EXPERIENCE", final_e: 0.151, delta_e: 1.41, phi: 0.014, verified_at: "2026-10-27T00:00:00.000Z" });
assert.equal(gs.runs[2].final_e, 0.7, "latest iteration per run"); assert.equal(gs.runs[2].phi, null, "missing phi is null");
assert.equal(classifyRun({ eligible: true, state: "CONTINUE" }), "ELIGIBLE_EXPERIENCE");
assert.equal(classifyRun({ eligible: false, state: "COMPLETE" }), "MISDIAGNOSIS_REJECTED");
assert.equal(classifyRun({ state: "ABORTED" }), "IN_PROGRESS");
assert.deepEqual(Object.keys(gs.runs[0]).sort(), ["delta_e", "final_e", "phi", "run_id", "status", "verified_at"], "no extra fields copied");
assert.deepEqual(JSON.parse(JSON.stringify(gs)), gs, "JSON-safe");
assert.deepEqual(buildGlobalSnapshot(gRows, GT), gs, "pure and deterministic");
assert.equal(buildGlobalSnapshot(null as never, GT).counts.total, 0, "non-array input gives an empty snapshot");
console.log("global snapshot  -> aethel.global.snapshot.v1; eligible / misdiagnosis rejected / in progress counts; latest iteration per run; pure");

// 21. Global snapshot shape validator (pure; well-formed is not verified, attested or a diagnosis).
const gsJ = (): J => JSON.parse(JSON.stringify(buildGlobalSnapshot(gRows, GT)));
const vs = validateGlobalSnapshot(gsJ());
assert.equal(vs.ok, true); if (vs.ok) { assert.deepEqual(vs.snapshot, gsJ(), "sanitized copy equals input"); assert.deepEqual(vs.warnings, []); }
assert.equal(validateGlobalSnapshot(JSON.parse(JSON.stringify(buildGlobalSnapshot([], GT)))).ok, true, "empty ok");
const sfail = (d: unknown, re: RegExp, label: string) => {
  const r = validateGlobalSnapshot(d); assert.equal(r.ok, false, `${label}: should fail`);
  if (!r.ok) { assert.ok(r.errors.length <= 20); assert.ok(r.errors.some((e) => re.test(e)), `${label}: ${r.errors.join(" | ")}`); }
};
const sm = (fn: (d: J) => void): J => { const d = gsJ(); fn(d); return d; };
for (const [v, label] of [[null, "null"], [[], "array"], ["x", "string"], [{}, "empty object"]] as [unknown, string][]) sfail(v, /./, label);
sfail(sm((d) => { d.schema_version = "aethel.global.snapshot.v2"; }), /schema_version/, "wrong schema");
sfail(sm((d) => { d.counts.total = 9; }), /counts\.total/, "total mismatch");
sfail(sm((d) => { d.counts.eligible = 0; }), /counts\.eligible/, "tally mismatch");
sfail(sm((d) => { d.counts.in_progress = 1.5; }), /counts\.in_progress/, "non-integer count");
sfail(sm((d) => { d.runs[0].run_id = "../x"; }), /run_id/, "bad run_id");
sfail(sm((d) => { d.runs[1].run_id = d.runs[0].run_id; }), /duplicate run_id/, "duplicate");
sfail(sm((d) => { d.runs[0].status = "VERIFIED"; }), /status/, "bad status");
sfail(sm((d) => { d.runs[0].phi = "0.1"; }), /phi/, "phi not number or null");
sfail(sm((d) => { d.runs[0].verified_at = "nope"; }), /verified_at/, "bad verified_at");
sfail(sm((d) => { d.generated_at = "nope"; }), /generated_at/, "bad generated_at");
sfail(sm((d) => { d.note = 1; }), /note/, "note not string");
const sx = validateGlobalSnapshot(sm((d) => { d.extra = 1; d.runs[0].secret = "x"; d.counts.more = 2; }));
assert.equal(sx.ok, true); if (sx.ok) assert.deepEqual(sx.snapshot, gsJ(), "unknown fields dropped");
const sn = validateGlobalSnapshot(sm((d) => { d.runs[0].verified_at = null; }));
assert.equal(sn.ok, true); if (sn.ok) assert.equal(sn.warnings.length, 1, "null verified_at is a warning");
const sManyBad = sm((d) => { d.runs = Array.from({ length: 100 }, () => ({})); });
const smb = validateGlobalSnapshot(sManyBad); assert.equal(smb.ok, false); if (!smb.ok) assert.equal(smb.errors.length, 20, "errors capped");
for (let i = 0; i < 200; i++) assert.equal(typeof validateGlobalSnapshot(junk[i]).ok, "boolean");
assert.equal(validateGlobalSnapshot(proxy).ok, false); assert.equal(validateGlobalSnapshot(cyc).ok, false);
assert.deepEqual(formatSnapshotReport(vs), { lines: [SNAPSHOT_VALIDATE_NOTE, "OK: 3 runs, 1 eligible, 1 misdiagnosis rejected, 1 in progress"], exitCode: 0 });
assert.equal(formatSnapshotReport(validateGlobalSnapshot(null)).exitCode, 1);
assert.deepEqual(validateGlobalSnapshot(gsJ()), validateGlobalSnapshot(gsJ()), "pure");
console.log("snapshot shape   -> valid and empty ok; schema, counts, run_id, duplicate, status, dates rejected; unknown fields dropped; junk never throws");

// 22. Optional third path for the origin check: --with-snapshot (pure helpers; default behavior unchanged).
assert.deepEqual(parseOriginArgs(["https://shiyan-dap.vercel.app"]), { origin: O, withSnapshot: false });
assert.deepEqual(parseOriginArgs(["https://shiyan-dap.vercel.app/", "--with-snapshot"]), { origin: O, withSnapshot: true });
assert.deepEqual(parseOriginArgs(["--with-snapshot", "http://localhost:3000"]), { origin: "http://localhost:3000", withSnapshot: true });
for (const bad of [[], ["--with-snapshot"], ["--with-snapshot", "--with-snapshot"], [O, O], [O, "--other"], [O, "--with-snapshot", "x"], ["http://example.com", "--with-snapshot"], [O, 5], null, "x"]) assert.equal(parseOriginArgs(bad), null, JSON.stringify(bad));
assert.deepEqual(routeUrls(O), { peers: `${O}/api/marketplace/peers`, listings: `${O}/api/marketplace/listings` }, "flag off: two routes");
assert.deepEqual(routeUrls(O, true), { peers: `${O}/api/marketplace/peers`, listings: `${O}/api/marketplace/listings`, snapshot: `${O}/api/diagnostics/global-snapshot` }, "flag on: three");
const snapOk: RouteProbe = { route: "snapshot", status: 200, json: gsJ() };
assert.deepEqual(formatOriginReport(O, [pOk, lOk, snapOk]), all, "flag off ignores a snapshot probe");
const three = formatOriginReport(O, [pOk, lOk, snapOk], { withSnapshot: true });
assert.equal(three.exitCode, 0);
assert.deepEqual(three.lines.slice(2), ["peers: HTTP 200 — OK: peers contract holds", "listings: HTTP 200 — OK: listings contract holds", "snapshot: HTTP 200 — OK: snapshot contract holds", `Summary: all 3 route contracts hold at ${O}`]);
const snapBad = formatOriginReport(O, [pOk, lOk, { route: "snapshot", status: 200, json: sm((d) => { d.counts.total = 9; }) }], { withSnapshot: true });
assert.equal(snapBad.exitCode, 1); assert.ok(snapBad.lines.includes("snapshot: HTTP 200 — contract failed")); assert.ok(snapBad.lines.some((x) => /counts\.total/.test(x)));
const snapSwap = formatOriginReport(O, [pOk, lOk, { route: "snapshot", status: 200, json: goodIdx() }], { withSnapshot: true });
assert.equal(snapSwap.exitCode, 1, "listings content on the snapshot path fails");
const snap503 = formatOriginReport(O, [pOk, lOk, { route: "snapshot", status: 503, failure: "expected HTTP 200", snippet: '{"error":"Experience store is not configured"}' }], { withSnapshot: true });
assert.equal(snap503.exitCode, 1); assert.ok(snap503.lines.includes("snapshot: HTTP 503 — failed")); assert.ok(snap503.lines.at(-1)!.startsWith("Summary: 1 of 3 routes failed"));
assert.equal(formatOriginReport(O, [pOk, lOk], { withSnapshot: true }).exitCode, 1, "flag on without a snapshot probe fails");
console.log("origin snapshot  -> --with-snapshot parsing; two URLs by default, three with the flag; snapshot ok / contract failure / swap / 503; default report unchanged");

console.log("OK");