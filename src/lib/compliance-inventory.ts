// Pure compliance inventory builder (Phase 3, parity with assets-inventory). Static catalog; no fetch, no writes, no CMS.
export type ComplianceSection = { title: string; href: string; link: string; items: string[] };

export const COMPLIANCE_SECTIONS: ComplianceSection[] = [
  { title: "Medicare (Know → Do)", items: ["Provenance, baselines, DQ", "Evidence + investigation", "HITL dispositions"], href: "/workbench/medicare", link: "Medicare workbench" },
  { title: "Look-back (Know)", items: ["ROE look-back insight", "Gaps, roles, ⑂ divergence"], href: "/workbench/status", link: "Look-back" },
  { title: "Audit summary (Know)", items: ["Read-only audit catalog", "Inventory JSON"], href: "/workbench/audit", link: "Audit summary" },
  { title: "Asset map (Do)", items: ["Where assets live", "Inventory JSON"], href: "/workbench/assets", link: "Asset map" },
  { title: "Marketplace (Do)", items: ["Known peers + capabilities", "View surfaces JSON"], href: "/workbench/marketplace", link: "Marketplace" },
];

export const COMPLIANCE_INVENTORY_SCHEMA = "aethel.compliance.inventory.v1";

export function buildComplianceInventory(sections: ComplianceSection[] = COMPLIANCE_SECTIONS) {
  return {
    schema: COMPLIANCE_INVENTORY_SCHEMA,
    path: "/workbench/compliance",
    sections: sections.map((s) => ({ title: s.title, href: s.href, link: s.link, items: [...s.items] })),
    note: "Read-only catalog. Detected pattern ≠ verified conclusion. Medicare data is a synthetic fixture.",
  };
}

/** Pure: shape check for an `aethel.compliance.inventory.v1` object (same rules as validateAssetsInventory). Never throws. */
export function validateComplianceInventory(json: unknown): { ok: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = []; const warnings: string[] = [];
  if (!json || typeof json !== "object" || Array.isArray(json)) return { ok: false, errors: ["compliance inventory: expected a JSON object"], warnings };
  const o = json as Record<string, unknown>;
  if (o.schema !== COMPLIANCE_INVENTORY_SCHEMA) errors.push(`schema: expected "${COMPLIANCE_INVENTORY_SCHEMA}"`);
  if (o.path === undefined) warnings.push("path: missing (soft-compat)");
  else if (typeof o.path !== "string") errors.push("path: expected string");
  else if (o.path !== "/workbench/compliance" && o.path !== "/workbench/compliance/") warnings.push('path: expected "/workbench/compliance" (soft-compat)');
  if (o.note === undefined) warnings.push("note: missing (soft-compat)");
  else if (typeof o.note !== "string") errors.push("note: expected string");
  if (!Array.isArray(o.sections)) errors.push("sections: expected array");
  else {
    if (o.sections.length === 0) warnings.push("sections: empty");
    o.sections.forEach((s, i) => {
      const p = `sections[${i}]`;
      if (!s || typeof s !== "object" || Array.isArray(s)) { errors.push(`${p}: expected object`); return; }
      const r = s as Record<string, unknown>;
      for (const k of ["title", "href"] as const) if (typeof r[k] !== "string") errors.push(`${p}.${k}: expected string`);
      if (r.link === undefined) warnings.push(`${p}.link: missing (soft-compat)`);
      else if (typeof r.link !== "string") errors.push(`${p}.link: expected string`);
      if (!Array.isArray(r.items)) errors.push(`${p}.items: expected array`);
      else if (r.items.length === 0) warnings.push(`${p}.items: empty`);
      else if (r.items.some((x) => typeof x !== "string")) errors.push(`${p}.items: expected strings`);
    });
  }
  return { ok: errors.length === 0, errors, warnings };
}
