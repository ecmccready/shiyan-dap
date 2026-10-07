
"use client";

import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { SAAS } from "@/product/saas";

export default function SaasPricingPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="SaaS" />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-emerald-400 text-xs uppercase tracking-widest mb-3">
          Commercial model
        </p>
        <h1 className="text-3xl font-bold mb-3">The fundamental unit is the Run.</h1>
        <p className="text-zinc-400 max-w-2xl mb-8">
          A customer pays Aethel Node to run valuable operational work and improve
          its outcome. Price shape: {SAAS.commercial.shape}. A receipt that has
          not settled is not customer value. Current Safety Φ is not a settled charge.
        </p>

        <ul className="space-y-3 mb-8">
          {SAAS.commercial.lines.map((line) => (
            <li key={line.id} className="border border-zinc-800 rounded-2xl p-4 text-sm">
              <p className="font-medium">{line.label}</p>
              <p className="text-zinc-400 mt-1">{line.price}</p>
            </li>
          ))}
        </ul>

        <section className="border border-zinc-800 rounded-2xl p-5 mb-8 text-sm text-zinc-400">
          <p className="text-emerald-400 text-xs mb-2">What is not priced here</p>
          <p>Number of AI conversations. An unsettled Stripe receipt. A B2 identity with no printed z and e. A tie on final e.</p>
        </section>

        <nav className="flex flex-wrap gap-4 text-sm">
          <Link className="underline" href="/saas">SaaS frame</Link>
          <Link className="underline" href="/workbench">Charge a Safety run</Link>
          <Link className="underline" href="/offer">Music offer</Link>
        </nav>
      </main>
    </div>
  );
}