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
