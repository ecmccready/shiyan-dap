import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

// Read-only Diagnostics Compliance stub at /workbench/compliance (/workbench/diagnostics is a legacy redirect) (Phase 3, parity with /workbench/audit and /workbench/assets). Static text; no fetch, no writes, no CMS.

const SECTIONS = [
  { title: "Medicare (Know → Do)", items: ["Provenance, baselines, DQ", "Evidence + investigation", "HITL dispositions"], href: "/workbench/medicare", link: "Medicare workbench" },
  { title: "Look-back (Know)", items: ["ROE look-back insight", "Gaps, roles, ⑂ divergence"], href: "/workbench/status", link: "Look-back" },
  { title: "Audit summary (Know)", items: ["Read-only audit catalog", "Inventory JSON"], href: "/workbench/audit", link: "Audit summary" },
  { title: "Asset map (Do)", items: ["Where assets live", "Inventory JSON"], href: "/workbench/assets", link: "Asset map" },
  { title: "Marketplace (Do)", items: ["Known peers + capabilities", "View surfaces JSON"], href: "/workbench/marketplace", link: "Marketplace" },
];

export default function CompliancePage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Workbench" />
      <main className="max-w-4xl mx-auto px-6 py-12" data-diagnostics-compliance>
        <p className="text-sky-400 text-xs uppercase tracking-widest mb-3">Diagnostics · compliance · read-only</p>
        <h1 className="text-3xl font-bold mb-3">Where the node&apos;s compliance checks live today</h1>
        <p className="text-zinc-400 max-w-2xl mb-8">
          A map of the know / do surfaces a reviewer checks. This page sends, stores and changes nothing.
        </p>
        <div className="grid sm:grid-cols-2 gap-4 mb-8">
          {SECTIONS.map((s) => (
            <section key={s.title} className="border border-zinc-800 rounded-2xl p-5 text-sm text-zinc-300">
              <h2 className="text-white font-semibold mb-2">{s.title}</h2>
              <ul className="list-disc pl-5 mb-3 space-y-0.5">
                {s.items.map((i) => <li key={i}>{i}</li>)}
              </ul>
              <Link className="underline text-sky-400" href={s.href}>{s.link} →</Link>
            </section>
          ))}
        </div>
        <p className="text-zinc-500 text-xs">
          Detected pattern ≠ verified conclusion. Medicare data is a synthetic fixture (no live CMS fetch). Display only.
        </p>
      </main>
    </div>
  );
}
