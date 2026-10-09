"use client";

import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { NETWORK } from "@/lib/network/context";

const R = {
  N: `${NETWORK.id} · ${NETWORK.version}`,
  A: "aethel / A",
  B: "Safety",
  y: "mark_boundary → complete_field → request_independent_check → seal_pack",
  z: "z=0.227 after seal_pack, dominate=uncertainty, gate=HOLD",
  e: "0.216 → 0.151",
  delta: "1.248 within the stored run",
  phi: "0.065 on the sealed pack",
};

export default function RecordPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Record" />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <p className="text-xs uppercase tracking-[0.18em] text-emerald-400">Versioned context</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">R = (N, A, B, y, z, e, Δe, Φ)</h1>
        <p className="mt-4 text-sm leading-6 text-zinc-400">
          The page-local handoff is not this record. N is the network version the sealed pack was scored against. A later documented edge does not rewrite it.
        </p>
        <dl className="mt-8 divide-y divide-zinc-800 rounded-3xl border border-zinc-800 text-sm">
          {Object.entries(R).map(([k, v]) => (
            <div key={k} className="grid gap-1 px-4 py-3 sm:grid-cols-3">
              <dt className="text-xs uppercase tracking-wider text-zinc-500">{k}</dt>
              <dd className="text-zinc-200 sm:col-span-2">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-sm text-amber-200">
          Δe 1.248 and Φ 0.065 remain different numbers. The gate is HOLD. Not a diagnosis. Not causation. Not revenue.
        </p>
        <nav className="mt-8 flex flex-wrap gap-4 text-sm text-zinc-400">
          <Link className="underline" href="/workbench/dependencies">Dependencies</Link>
          <Link className="underline" href="/workbench/reused">Context check</Link>
          <Link className="underline" href="/workbench/proof">Safety proof</Link>
        </nav>
      </main>
    </div>
  );
}