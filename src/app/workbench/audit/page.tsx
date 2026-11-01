import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import CopyValue from "@/components/CopyValue";
import { AUDIT_SECTIONS as SECTIONS, buildAuditInventory } from "@/lib/audit-inventory";

// Read-only audit summary (Phase 3 enterprise stub). Static text; no fetch, no writes, no CMS.

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
        <p className="mb-4 text-sm text-zinc-400">
          Inventory:<CopyValue value={JSON.stringify(buildAuditInventory(), null, 2)} label="inventory JSON" toast="Audit inventory JSON copied" />
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
