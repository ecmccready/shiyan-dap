// Run: npx tsx scripts/check-assets.ts
// Checks the pure asset-map inventory builder (aethel.assets.inventory.v1). No network, no writes.
import assert from "node:assert/strict";
import { buildAssetsInventory, validateAssetsInventory, ASSET_SECTIONS, ASSETS_INVENTORY_SCHEMA } from "../src/lib/assets-inventory";

const inv = buildAssetsInventory();
assert.equal(ASSETS_INVENTORY_SCHEMA, "aethel.assets.inventory.v1");
assert.equal(inv.schema, ASSETS_INVENTORY_SCHEMA);
assert.equal(inv.path, "/workbench/assets");
assert.deepEqual(inv.sections.map((s) => s.href), ["/workbench/medicare", "/workbench/status", "/workbench/marketplace", "/workbench/offer"]);
for (const s of inv.sections) { assert.ok(s.link.length > 0); assert.ok(s.items.length > 0); }
assert.match(inv.note, /Read-only/); assert.match(inv.note, /synthetic/);
inv.sections[0].items.push("mutated");
assert.equal(ASSET_SECTIONS[0].items.length, 4);
assert.deepEqual(JSON.parse(JSON.stringify(buildAssetsInventory())), buildAssetsInventory());
assert.equal(buildAssetsInventory([]).sections.length, 0);
{ const v = validateAssetsInventory(buildAssetsInventory()); assert.ok(v.ok); assert.deepEqual(v.warnings, []); }
for (const bad of [null, 1, "x", []]) assert.equal(validateAssetsInventory(bad).ok, false);
assert.equal(validateAssetsInventory({ ...buildAssetsInventory(), schema: "aethel.audit.inventory.v1" }).ok, false);
{ const v = validateAssetsInventory({ ...buildAssetsInventory(), path: "/workbench/audit" }); assert.ok(v.ok); assert.equal(v.warnings.length, 1); }
{ const x = buildAssetsInventory() as any; x.sections[1].title = 3; x.sections.push("x");
  const v = validateAssetsInventory(x); assert.ok(v.errors.includes("sections[1].title: expected string")); assert.ok(v.errors.includes("sections[4]: expected object")); }
console.log("check-assets: OK");
