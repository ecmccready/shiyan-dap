// Run: npx tsx scripts/check-audit.ts
// Checks the pure audit inventory builder (aethel.audit.inventory.v1). No network, no writes.
import assert from "node:assert/strict";
import { buildAuditInventory, AUDIT_SECTIONS, AUDIT_INVENTORY_SCHEMA } from "../src/lib/audit-inventory";

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
console.log("check-audit: OK (schema, 4 sections, titles/hrefs, items, purity, JSON round-trip)");
