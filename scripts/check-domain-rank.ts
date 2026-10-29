// Run: npx tsx scripts/check-domain-rank.ts
// Checks the Domains dropdown join/rank and the ?reuse= hand-off against fixture records (no network, no writes).
import assert from "node:assert/strict";
import { DOMAIN_GROUPS } from "../src/lib/domains/groups";
import { rankDomainGroups, hrefFor, phiSuffix } from "../src/lib/domains/experience-rank";
import { chooseDurableSource } from "../src/lib/level4/reuse-handoff";
import { REUSE_SEQUENCE, measureActions, coldBaseline } from "../src/lib/level4/measured";
import type { ExperienceEntry } from "../src/lib/level4/experience-client";

const SEQ = REUSE_SEQUENCE as string[];
const e = measureActions(REUSE_SEQUENCE).e;
const cold = coldBaseline(SEQ.length);
const phi = Number((cold - e).toFixed(3));
const mk = (run: string, i: number, extra: Partial<ExperienceEntry> = {}): ExperienceEntry => ({
  run_id: run,
  iteration: i + 1,
  e: i === SEQ.length - 1 ? e : 0.5,
  verified_at: `2026-10-28T00:0${i}:00.000Z`,
  eligible: i === SEQ.length - 1,
  state: i === SEQ.length - 1 ? "COMPLETE" : "CONTINUE",
  y: SEQ[i],
  phi: i === SEQ.length - 1 ? phi : -0.1,
  tensor_distance: 0,
  ...extra,
});
const run = (id: string, extra: Partial<ExperienceEntry> = {}) => SEQ.map((_, i) => mk(id, i, extra));
const items = (g: ReturnType<typeof rankDomainGroups>) => g.flatMap((x) => x.items);
const find = (g: ReturnType<typeof rankDomainGroups>, label: string) => items(g).find((i) => i.label === label)!;

// 1. No data: static order, four groups, no annotations.
const empty = rankDomainGroups(DOMAIN_GROUPS, []);
assert.deepEqual(empty.map((g) => g.label), ["Know", "Know How", "Show", "Do"]);
assert.deepEqual(empty.map((g) => g.items.map((i) => i.href)), DOMAIN_GROUPS.map((g) => g.items.map((i) => i.href)));
assert.ok(items(empty).every((i) => i.phi === null));
console.log("no records     -> static order, no annotation");

// 2. Eligible run: annotated and ranked first inside its group; ROE (needs selector records) stays unannotated.
const list = [...run("run_a")];
const ranked = rankDomainGroups(DOMAIN_GROUPS, list);
assert.equal(find(ranked, "Level 4 run").phi, phi);
assert.equal(ranked[1].items[0].label, "Level 4 run");
assert.equal(find(ranked, "ROE · Reciprocal Optimization Engine").phi, null);
assert.deepEqual(ranked[0].items.slice(0, 2).map((i) => i.label), ["Diagnostics", "Safety"]);
assert.equal(ranked[2].items[0].label, "Result");
assert.equal(phiSuffix(find(ranked, "Level 4 run")), ` · Φ ${phi.toFixed(3)}`);
console.log(`eligible run   -> Level 4 run first with Φ ${phi}; ROE unannotated`);

// 3. Ineligible / non-positive / tensor-failing records never annotate.
for (const bad of [{ eligible: false }, { state: "CONTINUE" }, { phi: 0 }, { phi: -0.1 }, { tensor_distance: 99 }]) {
  const r = rankDomainGroups(DOMAIN_GROUPS, run("run_bad", bad as Partial<ExperienceEntry>));
  assert.ok(items(r).every((i) => i.phi === null), JSON.stringify(bad));
}
console.log("ineligible     -> never annotated (eligible=false, not COMPLETE, Φ<=0, tensor over ε)");

// 4. ROE item uses only selector records; highest Φ wins with a tie going to the later run.
const roe = rankDomainGroups(DOMAIN_GROUPS, [...run("run_a"), ...run("run_roe", { selector: "roe_step_aware" })]);
assert.equal(find(roe, "ROE · Reciprocal Optimization Engine").sourceRunId, "run_roe");
assert.equal(find(roe, "Level 4 run").sourceRunId, "run_roe");
console.log("tie            -> later record wins; ROE joins only selector records");

// 5. Reuse hand-off href: only the Level 4 run item carries ?reuse=.
assert.equal(hrefFor(find(ranked, "Level 4 run")), "/workbench/autonomous?reuse=run_a");
assert.equal(hrefFor(find(ranked, "Diagnostics")), "/workbench/diagnostic");
assert.equal(hrefFor(find(empty, "Level 4 run")), "/workbench/autonomous");
console.log("reuse href     -> /workbench/autonomous?reuse=run_a (others unchanged)");

// 6. Hand-off resolution.
const permitted = [...SEQ, "hold"];
const thr = 0.16;
const ok = chooseDurableSource(list, permitted, "run_new", thr, "run_a");
assert.equal(ok.reuse?.status, "applied");
assert.equal(ok.plan?.run_id, "run_a");
assert.deepEqual(ok.plan?.sequence, SEQ);
const none = chooseDurableSource(list, permitted, "run_new", thr, null);
assert.equal(none.reuse, null);
assert.equal(none.plan?.run_id, "run_a");
const missing = chooseDurableSource(list, permitted, "run_new", thr, "run_missing");
assert.equal(missing.reuse?.status, "fallback");
assert.equal(missing.plan?.run_id, "run_a"); // falls back to the best durable plan
const self = chooseDurableSource(list, permitted, "run_a", thr, "run_a");
assert.equal(self.reuse?.status, "fallback");
const badId = chooseDurableSource(list, permitted, "run_new", thr, "../etc");
assert.equal(badId.reuse?.status, "fallback");
const notPermitted = chooseDurableSource(list, ["hold"], "run_new", thr, "run_a");
assert.equal(notPermitted.reuse?.status, "fallback");
assert.equal(notPermitted.plan, null); // nothing usable: caller keeps the built-in sequence
const strict = chooseDurableSource(list, permitted, "run_new", 0.0001, "run_a");
assert.equal(strict.reuse?.status, "fallback"); // fails the replay vet against a tighter goal
console.log("hand-off       -> applied; missing / self / bad id / not permitted / vet failure all fall back with a reason");

// 7. Marketplace in the Do group: annotated, ranked first in Do, hands off ?reuse= for highlighting.
assert.deepEqual(DOMAIN_GROUPS.map((g) => g.label), ["Know", "Know How", "Show", "Do"]);
assert.deepEqual(
  DOMAIN_GROUPS[3].items.map((i) => i.href),
  ["/workbench#guided-run", "/workbench/outcome", "/workbench/client", "/workbench/offer", "/workbench/pilot", "/workbench/marketplace"],
);
assert.equal(items(empty).filter((i) => i.href === "/workbench/marketplace").length, 1, "listed once");
assert.equal(find(empty, "Marketplace").phi, null);
assert.equal(hrefFor(find(empty, "Marketplace")), "/workbench/marketplace"); // no data: plain navigation
const mk2 = rankDomainGroups(DOMAIN_GROUPS, list);
assert.equal(mk2[3].items[0].label, "Marketplace"); // annotated -> first in Do
assert.deepEqual(mk2[3].items.slice(1).map((i) => i.label), ["Start a durable run", "Declare an outcome", "Client pipeline", "Offer", "Pilot"]);
assert.equal(find(mk2, "Marketplace").phi, phi);
assert.equal(phiSuffix(find(mk2, "Marketplace")), ` · Φ ${phi.toFixed(3)}`);
assert.equal(hrefFor(find(mk2, "Marketplace")), "/workbench/marketplace?reuse=run_a");
assert.equal(hrefFor(find(mk2, "Level 4 run")), "/workbench/autonomous?reuse=run_a", "Level 4 run unchanged");
const bad2 = rankDomainGroups(DOMAIN_GROUPS, run("run_bad", { eligible: false }));
assert.equal(find(bad2, "Marketplace").phi, null, "ineligible never annotates Marketplace");
console.log("marketplace    -> Do group, first when annotated (Φ " + phi + "), href /workbench/marketplace?reuse=run_a; plain path with no data");
// 8. Global · misdiagnosis in Know: annotated with the best eligible Φ like Diagnostics and Safety; plain navigation, no ?reuse=.
assert.equal(find(empty, "Global · misdiagnosis").phi, null);
assert.equal(hrefFor(find(empty, "Global · misdiagnosis")), "/workbench/global");
assert.equal(find(mk2, "Global · misdiagnosis").phi, phi);
assert.equal(phiSuffix(find(mk2, "Global · misdiagnosis")), ` · Φ ${phi.toFixed(3)}`);
assert.equal(hrefFor(find(mk2, "Global · misdiagnosis")), "/workbench/global", "no reuse hand-off");
assert.deepEqual(mk2[0].items.slice(0, 3).map((i) => i.label), ["Diagnostics", "Safety", "Global · misdiagnosis"], "annotated Know items first, static order on equal Φ");
assert.equal(find(bad2, "Global · misdiagnosis").phi, null, "ineligible never annotates Global");
console.log("global         -> Know group, annotated (Φ " + phi + "), href /workbench/global, no ?reuse=");
// 9. Medicare · Public Data Intelligence: in Know right after Global · misdiagnosis, no experience join (no Φ), plain navigation.
const know = DOMAIN_GROUPS[0].items.map((i) => i.label);
assert.equal(know.indexOf("Medicare · Public Data Intelligence"), know.indexOf("Global · misdiagnosis") + 1, "right after Global");
const med = DOMAIN_GROUPS[0].items.find((i) => i.href === "/workbench/medicare");
assert.ok(med); assert.equal(med!.experience, undefined, "no experience field");
assert.equal(find(mk2, "Medicare · Public Data Intelligence").phi, null, "never annotated");
assert.equal(hrefFor(find(mk2, "Medicare · Public Data Intelligence")), "/workbench/medicare");
assert.equal(items(empty).filter((i) => i.href === "/workbench/medicare").length, 1, "listed once");
console.log("medicare       -> Know group after Global, href /workbench/medicare, no Φ");
console.log("OK");
