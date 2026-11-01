// Run: npx tsx scripts/check-compliance.ts
// Checks the pure compliance inventory builder (aethel.compliance.inventory.v1). No network, no writes.
import assert from "node:assert/strict";
import { buildComplianceInventory, validateComplianceInventory, COMPLIANCE_SECTIONS, COMPLIANCE_INVENTORY_SCHEMA } from "../src/lib/compliance-inventory";

const inv = buildComplianceInventory();
assert.equal(COMPLIANCE_INVENTORY_SCHEMA, "aethel.compliance.inventory.v1");
assert.equal(inv.schema, COMPLIANCE_INVENTORY_SCHEMA);
assert.equal(inv.path, "/workbench/compliance");
assert.deepEqual(inv.sections.map((s) => s.href), ["/workbench/medicare", "/workbench/status", "/workbench/audit", "/workbench/assets", "/workbench/marketplace"]);
for (const s of inv.sections) { assert.ok(s.link.length > 0); assert.ok(s.items.length > 0); }
assert.match(inv.note, /Read-only/); assert.match(inv.note, /synthetic/);
inv.sections[0].items.push("mutated");
assert.equal(COMPLIANCE_SECTIONS[0].items.length, 3);
assert.deepEqual(JSON.parse(JSON.stringify(buildComplianceInventory())), buildComplianceInventory());
assert.equal(buildComplianceInventory([]).sections.length, 0);
{ const v = validateComplianceInventory(buildComplianceInventory()); assert.ok(v.ok); assert.deepEqual(v.warnings, []); }
for (const bad of [null, 1, "x", []]) assert.equal(validateComplianceInventory(bad).ok, false);
assert.equal(validateComplianceInventory({ ...buildComplianceInventory(), schema: "aethel.assets.inventory.v1" }).ok, false);
{ const v = validateComplianceInventory({ ...buildComplianceInventory(), path: "/workbench/assets" }); assert.ok(v.ok); assert.equal(v.warnings.length, 1); }
{ const x = buildComplianceInventory() as any; x.sections[1].title = 3; x.sections.push("x");
  const v = validateComplianceInventory(x); assert.ok(v.errors.includes("sections[1].title: expected string")); assert.ok(v.errors.includes("sections[5]: expected object")); }
console.log("check-compliance: OK");
