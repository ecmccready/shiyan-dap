// Pure audit inventory builder (Phase 3). Static catalog; no fetch, no writes, no CMS.
export type AuditSection = { title: string; href: string; link: string; items: string[] };

export const AUDIT_SECTIONS: AuditSection[] = [
  {
    title: "Medicare Know-trail packs",
    href: "/workbench/medicare",
    link: "Medicare · Public Data Intelligence",
    items: ["⧉ Provenance", "⧉ Baselines", "⧉ DQ", "⧉ Evidence", "⧉ Investigation"],
  },
  {
    title: "Medicare HITL packs",
    href: "/workbench/medicare",
    link: "Medicare review",
    items: ["Case brief", "📦 Hand-off pack", "⧉ Dispositions", "⧉ Notes", "⧉ Statuses", "⧉ Progress", "⧉ All N rows"],
  },
  {
    title: "Look-back insight packs",
    href: "/workbench/status",
    link: "Status · look-back",
    items: ["⚖ Compare pack", "⧉ Summary", "⧉ Verdict", "⧉ Gaps", "⧉ Roles", "⧉ All N paths", "⧉ All N steps"],
  },
  {
    title: "Shareable view URLs",
    href: "/workbench/offer#evidence-packs",
    link: "Offer · evidence packs",
    items: ["Every pack carries view_url", "Look-back: lb_* (incl. lb_focus / lb_expand)", "Medicare: m_* (incl. m_target)", "⧉ View / ⇩ Apply view / ⇩ Apply link"],
  },
];

export const AUDIT_INVENTORY_SCHEMA = "aethel.audit.inventory.v1";

export function buildAuditInventory(sections: AuditSection[] = AUDIT_SECTIONS) {
  return {
    schema: AUDIT_INVENTORY_SCHEMA,
    path: "/workbench/audit",
    sections: sections.map((s) => ({ title: s.title, href: s.href, link: s.link, items: [...s.items] })),
    note: "Read-only catalog. Detected pattern ≠ verified conclusion. Medicare data is a synthetic fixture.",
  };
}

/** Pure: shape check for an `aethel.audit.inventory.v1` object (what Copy inventory JSON copies). Wrong schema / non-object / wrong type = error; missing optional field (path, link, note) or empty sections/items = warning. No fetch, no writes. */
export function validateAuditInventory(json: unknown): { ok: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = []; const warnings: string[] = [];
  if (!json || typeof json !== "object" || Array.isArray(json)) return { ok: false, errors: ["audit inventory: expected a JSON object"], warnings };
  const o = json as Record<string, unknown>;
  if (o.schema !== AUDIT_INVENTORY_SCHEMA) errors.push(`schema: expected "${AUDIT_INVENTORY_SCHEMA}"`);
  if (o.path === undefined) warnings.push("path: missing (soft-compat)");
  else if (typeof o.path !== "string") errors.push("path: expected string");
  else if (o.path !== "/workbench/audit" && o.path !== "/workbench/audit/") warnings.push('path: expected "/workbench/audit" (soft-compat)');
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
