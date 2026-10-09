"use client";

import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { NETWORK, missingHandoffs } from "@/lib/network/context";

export default function GraphPage() {
  const missing = missingHandoffs();
  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Graph" />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <p className="text-xs uppercase tracking-[0.18em] text-emerald-400">Two readings</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">The network diagnostic is not e.</h1>
        <p className="mt-4 text-sm leading-6 text-zinc-400">
          A Run scores distance to the reference. The actor network names a missing edge. One can be open while the other has already fallen. ANT informs A. It does not override the gate.
        </p>
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <article className="rounded-3xl border border-zinc-800 p-5">
            <p className="text-xs uppercase tracking-wider text-emerald-400">Run</p>
            <p className="mt-2 text-2xl font-medium tabular-nums">0.216 → 0.151</p>
            <p className="mt-2 text-sm text-zinc-400">Φ 0.065 on the sealed provenance pack. Gate HOLD.</p>
          </article>
          <article className="rounded-3xl border border-zinc-800 p-5">
            <p className="text-xs uppercase tracking-wider text-amber-300">Network</p>
            <p className="mt-2 text-2xl font-medium">{missing.length} missing</p>
            <p className="mt-2 text-sm text-zinc-400">{missing.map((r) => r.to).join(", ")} on {NETWORK.id}. Not an error score.</p>
          </article>
        </div>
        <p className="mt-4 text-sm text-amber-200">
          Closing the edge on another page does not rewrite this reading. A missing handoff is not causation. Self() does not read this page.
        </p>
        <nav className="mt-8 flex flex-wrap gap-4 text-sm text-zinc-400">
          <Link className="underline" href="/workbench/record">Record</Link>
          <Link className="underline" href="/workbench/dependencies">Dependencies</Link>
          <Link className="underline" href="/workbench/proof">Safety proof</Link>
        </nav>
      </main>
    </div>
  );
}