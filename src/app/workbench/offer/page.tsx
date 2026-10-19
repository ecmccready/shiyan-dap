"use client";

import WhatYouGet from "@/components/WhatYouGet";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

export default function OfferPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Workbench" />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-emerald-400 text-xs uppercase tracking-widest mb-3">
          Solicitation
        </p>
        <h1 className="text-3xl font-bold mb-3">Aethel Node · workbench offer</h1>
        <p className="text-zinc-400 max-w-2xl mb-8">
          Aethel Node proves that the next action is no longer a misdiagnosis. Know which AI workflow works, prove that it works, and reuse it only when the measured evidence supports doing so.
        </p>

        <section className="border border-zinc-800 rounded-2xl p-5 mb-8 text-sm text-zinc-300 space-y-3">
          <p><span className="text-white">Buyer:</span> Organization responsible for the quality, cost, or reliability of repeated workflows.</p>
          <p><span className="text-white">Product:</span> Workbench that executes tasks, scores outcomes against a reference, and records reproducible evidence.</p>
          <p><span className="text-white">Primary metric:</span> Change in final error, Φ, alongside task success, cost, latency, and safety.</p>
          <p><span className="text-white">Business model:</span> Subscription for the workbench, usage-based execution, later paid access to verified reusable workflows.</p>
        </section>

        <h2 className="text-xl font-semibold mb-3">Public proof</h2>
        <p className="text-zinc-400 text-sm mb-4">
          Sealed reference packs on the plant. Every step is gated, measured for error e, and recorded. Φ only when final e falls.
        </p>
        <nav className="flex flex-wrap gap-4 text-sm mb-8">
          <Link className="underline" href="/workbench/shiyan">Shiyan + Model 3 proof</Link>
          <Link className="underline" href="/workbench/proof">Safety proof</Link>
        </nav>

        <h2 className="text-xl font-semibold mb-3">Client pipeline</h2>
        <p className="text-zinc-400 text-sm mb-4">
          Same workbench. Client supplies the repeated workflow and the objective reference. Export stores an inspectable Run.
        </p>
        <nav className="flex flex-wrap gap-4 text-sm mb-8">
          <Link className="underline" href="/workbench/client">Client pipeline</Link>
          <Link className="underline font-medium text-emerald-400" href="/workbench/pilot">Request a pilot →</Link>
          <Link className="underline" href="/workbench/history">History</Link>
        </nav>
        <p className="text-xs text-zinc-500 -mt-6 mb-8">
          Pilot pricing: set per pilot against the measured Φ; no charge on ties or regressions. Check the evidence first on{" "}
          <Link className="underline" href="/workbench/status">status</Link>.
        </p>

        <div className="mb-8"><WhatYouGet /></div>

        <h2 className="text-xl font-semibold mb-3">Verified sequences</h2>
        <p className="text-zinc-400 text-sm mb-4">
          Listings of sequences that have already lowered final e. Not settled. Not revenue.
        </p>
        <nav className="flex flex-wrap gap-4 text-sm mb-8">
          <Link className="underline" href="/workbench/marketplace">Marketplace</Link>
        </nav>

        <section className="border border-zinc-800 rounded-2xl p-5 text-sm text-zinc-300 mb-8">
          <p className="mb-3">
            Developmental stack is the product. Public packs are the proof. Client reference is the next plant.
            Exported Runs are inspectable on History. Verified sequences are listed on the Marketplace.
          </p>
          <p className="text-zinc-500 text-xs">
            Not a diagnosis. No PHI. Not revenue until a client settles. A lower error score is necessary but not sufficient. Healthcare diagnostics remains a higher-risk, later vertical.
          </p>
        </section>

        <nav className="flex flex-wrap gap-4 text-sm mt-8">
          <Link className="underline" href="/workbench">Workbench</Link>
          <Link className="underline" href="/workbench/network">Actor network</Link>
          <Link className="underline" href="/workbench/compare">Peer proof</Link>
          <Link className="underline" href="/workbench/review">Review</Link>
        </nav>
      </main>
    </div>
  );
}