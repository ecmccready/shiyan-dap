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
console.log("OK");