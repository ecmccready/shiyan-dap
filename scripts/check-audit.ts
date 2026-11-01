// Run: npx tsx scripts/check-audit.ts
// Checks the pure audit inventory builder (aethel.audit.inventory.v1). No network, no writes.
import assert from "node:assert/strict";
import { buildAuditInventory, validateAuditInventory, AUDIT_SECTIONS, AUDIT_INVENTORY_SCHEMA } from "../src/lib/audit-inventory";

const inv = buildAuditInventory();
assert.equal(AUDIT_INVENTORY_SCHEMA, "aethel.audit.inventory.v1");
assert.equal(inv.schema, AUDIT_INVENTORY_SCHEMA);
assert.equal(inv.path, "/workbench/audit");
assert.equal(inv.sections.length, 4);
assert.deepEqual(inv.sections.map((s) => [s.title, s.href]), [
  ["Medicare Know-trail packs", "/workbench/medicare"],
  ["Medicare HITL packs", "/workbench/medicare"],
  ["Look-back insight packs", "/workbench/status"],
  ["Shareable view URLs", "/workbench/offer#evidence-packs"],
]);
assert.deepEqual(inv.sections[0].items, ["⧉ Provenance", "⧉ Baselines", "⧉ DQ", "⧉ Evidence", "⧉ Investigation"]);
assert.equal(inv.sections[1].items.length, 7);
assert.equal(inv.sections[2].items.length, 7);
for (const s of inv.sections) { assert.ok(s.link.length > 0); assert.ok(s.items.length > 0); }
assert.match(inv.note, /Read-only/);
assert.match(inv.note, /synthetic/);
// Pure + defensive copy
inv.sections[0].items.push("mutated");
assert.equal(AUDIT_SECTIONS[0].items.length, 5);
assert.deepEqual(buildAuditInventory(), buildAuditInventory());
// JSON round-trip (what Copy inventory JSON puts on the clipboard)
assert.deepEqual(JSON.parse(JSON.stringify(buildAuditInventory(), null, 2)), buildAuditInventory());
// Custom sections
assert.equal(buildAuditInventory([]).sections.length, 0);
// validateAuditInventory: clean / soft-warn / hard-error
{ const v = validateAuditInventory(buildAuditInventory()); assert.ok(v.ok); assert.deepEqual(v.errors, []); assert.deepEqual(v.warnings, []); }
{ const v = validateAuditInventory(JSON.parse(JSON.stringify(buildAuditInventory()))); assert.ok(v.ok); assert.equal(v.warnings.length, 0); }
for (const bad of [null, 1, "x", []]) assert.equal(validateAuditInventory(bad).ok, false);
{ const v = validateAuditInventory({ ...buildAuditInventory(), schema: "nope" }); assert.equal(v.ok, false); assert.match(v.errors[0], /^schema/); }
{ const v = validateAuditInventory({ ...buildAuditInventory(), sections: {} }); assert.equal(v.ok, false); assert.ok(v.errors.includes("sections: expected array")); }
{ const v = validateAuditInventory({ ...buildAuditInventory(), path: 5 }); assert.ok(v.errors.includes("path: expected string")); }
{ const inv = buildAuditInventory() as any; inv.sections[1].title = 3; inv.sections[2].items = ["ok", 7]; inv.sections[3].href = undefined; inv.sections.push("x");
  const v = validateAuditInventory(inv); assert.equal(v.ok, false);
  for (const e of ["sections[1].title: expected string", "sections[2].items: expected strings", "sections[3].href: expected string", "sections[4]: expected object"]) assert.ok(v.errors.includes(e), e); }
{ const { path, note, ...rest } = buildAuditInventory(); const inv = { ...rest, sections: rest.sections.map(({ link, ...s }) => s) };
  const v = validateAuditInventory(inv); assert.ok(v.ok); assert.ok(v.warnings.includes("path: missing (soft-compat)")); assert.ok(v.warnings.includes("note: missing (soft-compat)")); assert.ok(v.warnings.includes("sections[0].link: missing (soft-compat)")); }
{ const v = validateAuditInventory({ ...buildAuditInventory(), path: "/elsewhere", sections: [] }); assert.ok(v.ok); assert.ok(v.warnings.includes('path: expected "/workbench/audit" (soft-compat)')); assert.ok(v.warnings.includes("sections: empty")); }
{ const v = validateAuditInventory({ ...buildAuditInventory(), sections: [{ title: "t", href: "/h", link: "l", items: [] }] }); assert.ok(v.ok); assert.ok(v.warnings.includes("sections[0].items: empty")); }
console.log("check-audit: OK (schema, 4 sections, titles/hrefs, items, purity, JSON round-trip, validateAuditInventory)");

// First-use pulse wiring on /workbench/audit Copy inventory JSON (static source check)
import { readFileSync } from "node:fs";
{
  const page = readFileSync(new URL("../src/app/workbench/audit/page.tsx", import.meta.url), "utf8");
  assert.ok(page.includes('firstUsePulseKey="aethel.audit.copyInventory.pulsed"'), "audit Copy inventory JSON has first-use pulse key");
  const cv = readFileSync(new URL("../src/components/CopyValue.tsx", import.meta.url), "utf8");
  assert.ok(cv.includes("sessionStorage") && cv.includes("data-first-use-pulse"), "CopyValue supports first-use pulse");
}
