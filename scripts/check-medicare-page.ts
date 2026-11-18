/**
 * Regression: /workbench/medicare must render real content (header + Domains dropdown + Know/Show/Do surfaces),
 * not an empty placeholder. The page once shipped as a pasted snippet whose rows state was never filled, so it
 * rendered an empty <div> on the dark workbench layout: selecting "Medicare" from the Domains dropdown showed a
 * black screen. Static source checks plus a pure check that the fixture the page renders yields content.
 */
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DOMAIN_ITEMS } from "../src/lib/domains/groups";
import { FIXTURE_EVIDENCE, FIXTURE_INVESTIGATION } from "../src/lib/medicare/fixture";

const pg = readFileSync(join(__dirname, "../src/app/workbench/medicare/page.tsx"), "utf8");
let n = 0; const ok = (c: unknown, m: string) => { assert.ok(c, m); n++; console.log("ok", m); };

ok(DOMAIN_ITEMS.some((i) => i.href === "/workbench/medicare"), "Domains dropdown lists /workbench/medicare");
ok(/export default function \w+/.test(pg), "page has a default export");
ok(pg.includes("<SiteHeader"), "page renders SiteHeader (Domains dropdown stays reachable)");
ok(pg.includes("<main"), "page renders a <main> content region");
ok(pg.includes("@/lib/medicare/fixture"), "page sources its rows from the committed fixture module");
ok(!/useState<any\[\]>\(\[\]\)/.test(pg), "no never-filled empty rows state");
ok(!pg.includes("{/* existing"), "no placeholder '{/* existing … */}' comments");
for (const c of ["<MedicareStatusChips", "<MedicareDispositionStub", "<MedicareReviewProgress", "<MedicareReviewTimer", "<CopyLiveInvestigation", "<MedicarePilotChip", '<EvidencePacksChip scope="medicare" />'])
  ok(pg.includes(c), `page mounts ${c}`);
for (const k of ["provenance", "dq", "baselines", "investigation", "evidence"]) ok(pg.includes(`kind="${k}" ids={MEDICARE_REPORT_IDS}`), `copy ${k} passes report ids`);
ok(/SYNTHETIC/.test(pg), "page labels the data as SYNTHETIC");
ok(FIXTURE_EVIDENCE.items.length > 0 && FIXTURE_INVESTIGATION.entries.length === FIXTURE_EVIDENCE.items.length, "fixture yields evidence items and one report entry each");
ok(FIXTURE_INVESTIGATION.evidence.pack_verified, "fixture evidence pack verifies");
console.log(`medicare page: ${n} checks PASS`);
