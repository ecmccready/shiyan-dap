import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import CopyValue from "@/components/CopyValue";
import { ASSET_SECTIONS as SECTIONS, buildAssetsInventory } from "@/lib/assets-inventory";

// Read-only asset-mapping stub (Phase 3, parity with /workbench/audit). Static text; no fetch, no writes, no CMS.


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
        <p className="mb-4 text-sm text-zinc-400">
          Inventory:<CopyValue value={JSON.stringify(buildAssetsInventory(), null, 2)} label="inventory JSON" toast="Asset map inventory JSON copied" firstUsePulseKey="aethel.assets.copyInventory.pulsed" />
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
