"use client";

import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

const LISTINGS = [
  {
    id: "safety-sealed",
    title: "Safety evidence gate",
    sequence: "mark_boundary → complete_field → request_independent_check → seal_pack",
    phi: "0.014 / 0.065 / 0.065",
    status: "verified on plant · not settled",
  },
  {
    id: "shiyan-pipeline",
    title: "Shiyan pipeline reliability",
    sequence: "mark_boundary → complete_field → request_independent_check → seal_pack",
    phi: "0.51 / 0.45 / 0.38",
    status: "reference plant · not settled",
  },
];

export default function MarketplacePage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Workbench" />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-emerald-400 text-xs uppercase tracking-widest mb-3">
          Marketplace
        </p>
        <h1 className="text-3xl font-bold mb-3">Verified reusable workflows</h1>
        <p className="text-zinc-400 max-w-2xl mb-8">
          Later paid access to sequences that have already lowered final e on a reference.
          A listing is not a settled sale. An unsettled receipt is not revenue.
        </p>

        {LISTINGS.map((item) => (
          <section key={item.id} className="border border-zinc-800 rounded-2xl p-5 mb-6 text-sm text-zinc-300">
            <h2 className="text-lg font-semibold text-white mb-2">{item.title}</h2>
            <p className="mb-1"><span className="text-white">Sequence:</span> {item.sequence}</p>
            <p className="mb-1"><span className="text-white">Φ:</span> {item.phi}</p>
            <p className="text-zinc-500 text-xs">{item.status}</p>
          </section>
        ))}

        <p className="text-sm text-zinc-300 mb-8">
          Same sealed sequence as the Safety and Shiyan plants. Φ stays inside the plant that produced it.
          Not a diagnosis. No PHI. Not revenue.
        </p>

        <nav className="flex flex-wrap gap-4 text-sm">
          <Link className="underline" href="/workbench">Workbench</Link>
          <Link className="underline" href="/workbench/offer">Offer</Link>
          <Link className="underline" href="/workbench/client">Client pipeline</Link>
          <Link className="underline" href="/workbench/shiyan">Shiyan pipeline</Link>
          <Link className="underline" href="/workbench/history">History</Link>
        </nav>
      </main>
    </div>
  );
}