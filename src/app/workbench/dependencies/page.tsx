"use client";

import { useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { NETWORK } from "@/lib/network/context";

const EDGES = [
  { from: "operator", to: "pack", need: "handoff", blocked: false },
  { from: "grok_bot", to: "pack", need: "names y", blocked: false },
  { from: "pack", to: "reference", need: "scored against", blocked: false },
  { from: "pack", to: "independent-check", need: "handoff", blocked: true },
];

export default function DependenciesPage() {
  const [documented, setDocumented] = useState(false);
  const blocked = EDGES.filter((edge) => edge.blocked && !documented);
  const e = documented ? 0.151 : 1.399;

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Dependencies" />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <p className="text-xs uppercase tracking-[0.18em] text-emerald-400">{NETWORK.id}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          {blocked.length ? "seal_pack is blocked." : "The block is lifted. e did not get a new plant."}
        </h1>
        <p className="mt-4 text-sm leading-6 text-zinc-400">
          A names y. The network says which handoff is missing. B does not seal while that edge is open. Documenting it is a context change, not a measurement.
        </p>
        <ul className="mt-8 space-y-2 text-sm">
          {EDGES.map((edge) => {
            const open = edge.blocked && !documented;
            return (
              <li key={`${edge.from}-${edge.to}`} className="rounded-2xl border border-zinc-800 px-4 py-3">
                {edge.from} → {edge.to}
                <span className="mt-1 block text-xs text-zinc-500">{edge.need} · {open ? "blocks seal_pack" : "documented"}</span>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-sm tabular-nums">e {e.toFixed(3)} · {documented ? "sealed replay 0.151" : "not sealed"}</p>
        <button
          onClick={() => setDocumented(true)}
          disabled={documented}
          className="mt-5 h-11 rounded-full bg-white px-5 text-sm font-medium text-black disabled:opacity-40"
        >
          {documented ? "Handoff recorded" : "Document independent-check"}
        </button>
        <p className="mt-4 text-sm text-amber-200">
          {documented
            ? "Block lifted. The 0.151 is the sealed provenance replay, not a new z. Not causation. Not revenue."
            : "Blocked. Missing handoff is not an error win. Self() does not read this page."}
        </p>
        <nav className="mt-8 flex flex-wrap gap-4 text-sm text-zinc-400">
          <Link className="underline" href="/workbench/reused">Context check</Link>
          <Link className="underline" href="/workbench/network">Network</Link>
          <Link className="underline" href="/workbench/proof">Safety proof</Link>
        </nav>
      </main>
    </div>
  );
}