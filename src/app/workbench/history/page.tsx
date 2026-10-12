"use client";

import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

export default function HistoryPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Workbench B" />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-emerald-400 text-xs uppercase tracking-widest mb-3">
          History
        </p>
        <h1 className="text-3xl font-bold mb-3">Inspectable Runs</h1>
        <p className="text-zinc-400 max-w-2xl mb-6">
          Every closed Run is a permanent record. Identifier, reference version, sequence, final e, Φ, cost, and latency.
          A closed Run is not a charge. An unsettled receipt is not revenue.
        </p>
        <p className="text-zinc-500 text-sm mb-8">
          Client pipeline Runs export from{" "}
          <Link className="underline" href="/workbench/client">/workbench/client</Link>.
          Public proof remains on the{" "}
          <Link className="underline" href="/workbench/optimus">Optimus plant</Link>.
        </p>

        <section className="border border-zinc-800 rounded-2xl p-5 mb-8 text-sm text-zinc-300">
          <p className="mb-3">
            Runs stored in this browser are inspectable here. Server-side permanent records are the next plant.
          </p>
          <p className="text-zinc-500 text-xs">
            Same sealed sequence as Safety and Optimus. Φ stays inside the plant that produced it.
            Not a diagnosis. No PHI.
          </p>
        </section>

        <nav className="flex flex-wrap gap-4 text-sm mt-8">
          <Link className="underline" href="/workbench">Workbench B</Link>
          <Link className="underline" href="/workbench/client">Client pipeline</Link>
          <Link className="underline" href="/workbench/optimus">Optimus pipeline</Link>
          <Link className="underline" href="/workbench/offer">Offer</Link>
          <Link className="underline" href="/workbench/proof">Safety proof</Link>
          <Link className="underline" href="/workbench/network">Actor network</Link>
        </nav>
      </main>
    </div>
  );
}