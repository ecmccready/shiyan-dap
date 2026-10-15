"use client";

import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

export default function ReviewPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Workbench" />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-emerald-400 text-xs uppercase tracking-widest mb-3">
          Review
        </p>
        <h1 className="text-3xl font-bold mb-3">Aethel Node · inspectable surface</h1>
        <p className="text-zinc-400 max-w-2xl mb-8">
          Developmental stack is the product. Public packs are the proof. Client reference is the next plant.
          All claims are measured. Φ only when final e falls.
        </p>

        <section className="border border-zinc-800 rounded-2xl p-5 mb-6 text-sm text-zinc-300">
          <h2 className="text-white font-semibold mb-2">Commercial proposition</h2>
          <p>Buyer: organization responsible for quality, cost, or reliability of repeated workflows.</p>
          <p>Product: workbench that executes, scores against a reference, and records reproducible evidence.</p>
          <p>Primary metric: change in final error, Φ, alongside success, cost, latency, and safety.</p>
          <p className="mt-2">
            <Link className="underline" href="/workbench/offer">Offer</Link>
          </p>
        </section>

        <section className="border border-zinc-800 rounded-2xl p-5 mb-6 text-sm text-zinc-300">
          <h2 className="text-white font-semibold mb-2">Public proof</h2>
          <p>Model 3 2018 sealed reference. Shiyan 2026 pipeline criteria. Same sealed sequence. Positive Φ.</p>
          <p className="mt-2">
            <Link className="underline" href="/workbench/optimus">Shiyan + Model 3</Link>
            {" · "}
            <Link className="underline" href="/workbench/proof">Safety proof</Link>
          </p>
        </section>

        <section className="border border-zinc-800 rounded-2xl p-5 mb-6 text-sm text-zinc-300">
          <h2 className="text-white font-semibold mb-2">Client pipeline</h2>
          <p>Same workbench. Client supplies reference. Export stores inspectable Run on History.</p>
          <p className="mt-2">
            <Link className="underline" href="/workbench/client">Client pipeline</Link>
            {" · "}
            <Link className="underline" href="/workbench/history">History</Link>
          </p>
        </section>

        <section className="border border-zinc-800 rounded-2xl p-5 mb-6 text-sm text-zinc-300">
          <h2 className="text-white font-semibold mb-2">Verified sequences</h2>
          <p>Marketplace lists sequences that have already lowered final e. Not settled. Not revenue.</p>
          <p className="mt-2">
            <Link className="underline" href="/workbench/marketplace">Marketplace</Link>
          </p>
        </section>

        <section className="border border-zinc-800 rounded-2xl p-5 mb-6 text-sm text-zinc-300">
          <h2 className="text-white font-semibold mb-2">Request a scored pack</h2>
          <p>
            Supply the repeated workflow and the objective reference. The workbench scores it.
            Export the Run. Inspect it on History. Same loop as the public proof.
          </p>
        </section>

        <section className="border border-zinc-800 rounded-2xl p-5 text-sm text-zinc-500">
          <p>
            Not a diagnosis. No PHI. Not revenue until a client settles.
            Healthcare diagnostics remains a higher-risk, later vertical.
            Level 4 is the current architectural milestone: operate autonomously within constraints.
          </p>
        </section>

        <nav className="flex flex-wrap gap-4 text-sm mt-8">
          <Link className="underline" href="/workbench">Workbench</Link>
          <Link className="underline" href="/workbench/offer">Offer</Link>
          <Link className="underline" href="/workbench/network">Actor network</Link>
          <Link className="underline" href="/workbench/compare">Peer proof</Link>
        </nav>
      </main>
    </div>
  );
}