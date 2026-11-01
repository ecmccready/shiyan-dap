import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

// Read-only asset-mapping stub (Phase 3, parity with /workbench/audit). Static text; no fetch, no writes, no CMS.

const SECTIONS = [
  { title: "Medicare (Know → Show → Do)", href: "/workbench/medicare", link: "Medicare workbench", items: ["Synthetic fixture rows (no live CMS)", "Provenance, baselines, DQ", "Evidence + investigation packs", "HITL dispositions + notes"] },
  { title: "Look-back insight", href: "/workbench/status", link: "Look-back", items: ["Run paths + steps", "Compare, summary, verdict", "Gaps + roles"] },
  { title: "Marketplace", href: "/workbench/marketplace", link: "Marketplace", items: ["Φ listings index", "Known peers + capabilities", "View surfaces JSON"] },
  { title: "Offer", href: "/workbench/offer", link: "Offer", items: ["Evidence packs catalog", "Shareable view URLs (lb_*, m_*)", "Peer-visible note"] },
];

export default function AssetsPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Workbench" />
      <main className="max-w-4xl mx-auto px-6 py-12" data-asset-mapping>
        <p className="text-emerald-400 text-xs uppercase tracking-widest mb-3">Assets · read-only</p>
        <h1 className="text-3xl font-bold mb-3">Where the node&apos;s assets live today</h1>
        <p className="text-zinc-400 max-w-2xl mb-8">
          A map of the surfaces that produce or show assets. This page sends, stores and changes nothing.
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
          Also: <Link className="underline text-emerald-400" href="/workbench/audit">Audit summary</Link>; raw ledger asset map at <a className="underline text-emerald-400" href="/api/v1/ledger/assets">/api/v1/ledger/assets</a> (JSON).
        </p>
        <p className="text-zinc-500 text-xs">
          Detected pattern ≠ verified conclusion. Medicare data is a synthetic fixture (no live CMS fetch). Display only.
        </p>
      </main>
    </div>
  );
}
