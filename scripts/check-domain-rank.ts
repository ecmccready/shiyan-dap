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
console.log("OK");
