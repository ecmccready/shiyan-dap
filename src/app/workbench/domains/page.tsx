"use client";

import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

const LATER = [
  "manufacturing",
  "supply chain",
  "financial operations",
  "IT/SecOps",
  "enterprise workflows",
  "AI evaluation",
];

export default function DomainsPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Workbench" />
      <main className="max-w-3xl mx-auto px-6 py-12 space-y-6">
        <p className="text-emerald-400 text-xs uppercase tracking-widest">Generic B</p>
        <h1 className="text-3xl font-bold">The vertical demonstrates the engine. It does not imprison it.</h1>
        <p className="text-zinc-400">
          Music and Safety are the plants that exist. A new Workbench speaks MCP. It does not fork Controller A.
          Named below is not built, and not measured.
        </p>
        <ul className="border border-zinc-800 rounded-2xl p-5 text-sm space-y-2">
          {LATER.map((domain) => (
            <li key={domain}>{domain} · not built</li>
          ))}
        </ul>
        <p className="text-zinc-500 text-sm">
          Safety remains the buyer-facing proof. No new vertical until that comparison stays on /workbench/proof.
        </p>
        <nav className="flex flex-wrap gap-4 text-sm">
          <Link className="underline" href="/workbench">Safety plant</Link>
          <Link className="underline" href="/workbench/diagnostic">Diagnostic reading</Link>
          <Link className="underline" href="/saas/engine">Engine layer</Link>
        </nav>
      </main>
    </div>
  );
}