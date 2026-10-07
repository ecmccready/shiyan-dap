"use client";

import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

const ENGINE = ["A", "B", "Run", "Measurement"];
const COMMERCIAL = ["Organization", "Workspace", "Workbench", "Usage", "Billing", "Marketplace"];

export default function EngineLayerPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="SaaS" />
      <main className="max-w-3xl mx-auto px-6 py-12 space-y-6">
        <p className="text-emerald-400 text-xs uppercase tracking-widest">Keep</p>
        <h1 className="text-3xl font-bold">Engine, separate from the commercial layer.</h1>
        <p className="text-zinc-400">
          The engine stays A, B, Run, and Measurement. The business can change around it.
          Self() does not read prior Runs. A tie is not a win.
        </p>
        <section className="border border-zinc-800 rounded-2xl p-5">
          <p className="text-emerald-400 text-xs mb-2">Engine</p>
          <p>{ENGINE.join(" ↔ ")}</p>
        </section>
        <section className="border border-zinc-800 rounded-2xl p-5">
          <p className="text-emerald-400 text-xs mb-2">Commercial layer</p>
          <p>{COMMERCIAL.join(" → ")}</p>
        </section>
        <nav className="flex flex-wrap gap-4 text-sm">
          <Link className="underline" href="/saas">SaaS frame</Link>
          <Link className="underline" href="/saas/pricing">Pricing</Link>
          <Link className="underline" href="/workbench">Workbench B</Link>
          <Link className="underline" href="/workbench/domains">Later domains</Link>
        </nav>
      </main>
    </div>
  );
}