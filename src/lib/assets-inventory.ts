// Pure asset-map inventory builder (Phase 3, parity with audit-inventory). Static catalog; no fetch, no writes, no CMS.
export type AssetSection = { title: string; href: string; link: string; items: string[] };

export const ASSET_SECTIONS: AssetSection[] = [
  { title: "Medicare (Know → Show → Do)", href: "/workbench/medicare", link: "Medicare workbench", items: ["Synthetic fixture rows (no live CMS)", "Provenance, baselines, DQ", "Evidence + investigation packs", "HITL dispositions + notes"] },
  { title: "Look-back insight", href: "/workbench/status", link: "Look-back", items: ["Run paths + steps", "Compare, summary, verdict", "Gaps + roles"] },
  { title: "Marketplace", href: "/workbench/marketplace", link: "Marketplace", items: ["Φ listings index", "Known peers + capabilities", "View surfaces JSON"] },
  { title: "Offer", href: "/workbench/offer", link: "Offer", items: ["Evidence packs catalog", "Shareable view URLs (lb_*, m_*)", "Peer-visible note"] },
];

export const ASSETS_INVENTORY_SCHEMA = "aethel.assets.inventory.v1";

export function buildAssetsInventory(sections: AssetSection[] = ASSET_SECTIONS) {
  return {
    schema: ASSETS_INVENTORY_SCHEMA,
    path: "/workbench/assets",
    sections: sections.map((s) => ({ title: s.title, href: s.href, link: s.link, items: [...s.items] })),
    note: "Read-only catalog. Detected pattern ≠ verified conclusion. Medicare data is a synthetic fixture.",
  };
}

/** Pure: shape check for an `aethel.assets.inventory.v1` object (same rules as validateAuditInventory). Never throws. */
export function validateAssetsInventory(json: unknown): { ok: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = []; const warnings: string[] = [];
  if (!json || typeof json !== "object" || Array.isArray(json)) return { ok: false, errors: ["assets inventory: expected a JSON object"], warnings };
  const o = json as Record<string, unknown>;
  if (o.schema !== ASSETS_INVENTORY_SCHEMA) errors.push(`schema: expected "${ASSETS_INVENTORY_SCHEMA}"`);
  if (o.path === undefined) warnings.push("path: missing (soft-compat)");
  else if (typeof o.path !== "string") errors.push("path: expected string");
  else if (o.path !== "/workbench/assets" && o.path !== "/workbench/assets/") warnings.push('path: expected "/workbench/assets" (soft-compat)');
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
