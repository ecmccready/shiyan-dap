"use client";

import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

const PATH = [
  ["Network", "independent-check missing", "context, not e"],
  ["Propose", "request_independent_check named", "no z"],
  ["Execute", "z returned, e 0.216, Δe 0", "not the drop"],
  ["Seal", "seal_pack, e 0.151, Φ 0.065", "sealed replay"],
  ["Record", "R = (N, A, B, y, z, e, Δe, Φ)", "page-local handoff does not rewrite it"],
];

export default function ChainPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Chain" />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <p className="text-xs uppercase tracking-[0.18em] text-emerald-400">Claim boundary</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">The path is visible. The drop stays sealed.</h1>
        <p className="mt-4 text-sm leading-6 text-zinc-400">
          A names y. N can block it. B returns z. Only seal_pack lowers e on this pack. The actor network does not replace that contract.
        </p>
        <ol className="mt-8 space-y-2">
          {PATH.map(([name, did, bound]) => (
            <li key={name} className="rounded-2xl border border-zinc-800 px-4 py-3 text-sm">
              <span className="text-emerald-400">{name}</span>
              <span className="mt-1 block">{did}</span>
              <span className="mt-1 block text-xs text-zinc-500">{bound}</span>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm text-amber-200">
          Safety rows stay 0.014, 0.065, 0.065. Not a diagnosis. Not causation. Not revenue.
        </p>
        <nav className="mt-8 flex flex-wrap gap-4 text-sm text-zinc-400">
          <Link className="underline" href="/workbench/seal">Seal</Link>
          <Link className="underline" href="/workbench/graph">Graph</Link>
          <Link className="underline" href="/workbench/proof">Safety proof</Link>
        </nav>
      </main>
    </div>
  );
}