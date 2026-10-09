"use client";

import { useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { missingHandoffs } from "@/lib/network/context";

export default function ProposePage() {
  const [proposed, setProposed] = useState(false);
  const missing = missingHandoffs();
  const y = missing[0] ? `request_${missing[0].to.replace("-", "_")}` : "hold";

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Propose" />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <p className="text-xs uppercase tracking-[0.18em] text-emerald-400">Self() proposal</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">A proposal is not a measurement.</h1>
        <p className="mt-4 text-sm leading-6 text-zinc-400">
          Self() may name the next y from the missing edge. B has not executed it on this page. e stays the sealed provenance reading.
        </p>
        <dl className="mt-8 divide-y divide-zinc-800 rounded-3xl border border-zinc-800 text-sm">
          <Row k="Missing edge" v={missing.map((r) => r.to).join(", ") || "none"} />
          <Row k="Proposed y" v={proposed ? y : "not named"} />
          <Row k="z" v="not measured on this page" />
          <Row k="e" v="0.216 → 0.151 sealed" />
          <Row k="Φ" v="0.065 sealed pack" />
        </dl>
        <button
          onClick={() => setProposed(true)}
          disabled={proposed}
          className="mt-5 h-11 rounded-full bg-white px-5 text-sm font-medium text-black disabled:opacity-40"
        >
          {proposed ? "y named" : "Let Self() name y"}
        </button>
        <p className="mt-4 text-sm text-amber-200">
          {proposed
            ? "y is named. z was not produced. The proposal does not lower e and does not close the edge."
            : "No y yet. The missing edge is context. Self() does not read a prior Run from this page."}
        </p>
        <nav className="mt-8 flex flex-wrap gap-4 text-sm text-zinc-400">
          <Link className="underline" href="/workbench/graph">Graph</Link>
          <Link className="underline" href="/workbench/dependencies">Dependencies</Link>
          <Link className="underline" href="/workbench/proof">Safety proof</Link>
        </nav>
      </main>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="grid gap-1 px-4 py-3 sm:grid-cols-3">
      <dt className="text-xs uppercase tracking-wider text-zinc-500">{k}</dt>
      <dd className="text-zinc-200 sm:col-span-2">{v}</dd>
    </div>
  );
}