import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

// Read-only audit summary (Phase 3 enterprise stub). Static text; no fetch, no writes, no CMS.
const SECTIONS: { title: string; href: string; link: string; items: string[] }[] = [
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

export default function AuditPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Workbench" />
      <main className="max-w-4xl mx-auto px-6 py-12" data-audit-summary>
        <p className="text-emerald-400 text-xs uppercase tracking-widest mb-3">Audit · read-only</p>
        <h1 className="text-3xl font-bold mb-3">What an audit / evidence pack can include today</h1>
        <p className="text-zinc-400 max-w-2xl mb-8">
          A summary of the packs the node already produces. Each is copied locally from its page; this page sends, stores and changes nothing.
        </p>
        <div className="grid sm:grid-cols-2 gap-4 mb-8">
          {SECTIONS.map((s) => (
            <section key={s.title} className="border border-zinc-800 rounded-2xl p-5 text-sm text-zinc-300">
              <h2 className="text-white font-semibold mb-2">{s.title}</h2>
              <ul className="list-disc pl-5 mb-3 space-y-0.5">
                {s.items.map((i) => <li key={i}>{i}</li>)}
              </ul>
              <Link className="underline text-emerald-400" href={s.href}>{s.link} →</Link>
            </section>
          ))}
        </div>
        <p className="text-sm text-zinc-400 mb-2">
          Also: peers advertise these surfaces on <Link className="underline text-emerald-400" href="/workbench/marketplace">Marketplace</Link>; run-level misdiagnosis rollup on <Link className="underline text-emerald-400" href="/workbench/global">Global</Link>.
        </p>
        <p className="text-zinc-500 text-xs">
          Detected pattern ≠ verified conclusion. Medicare data is a synthetic fixture (no live CMS fetch). Display only.
        </p>
      </main>
    </div>
  );
}
