"use client";

import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { NETWORK, missingHandoffs } from "@/lib/network/context";

export default function NetworkPage() {
  const missing = missingHandoffs();
  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Network" />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <p className="text-xs uppercase tracking-[0.18em] text-emerald-400">{NETWORK.id} · {NETWORK.version}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Actor network</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          Human, technical, and evidence actors, plus documented relationships. This layer informs A. It does not override permissions, the safety gate, or the evidence required to claim improvement.
        </p>
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {NETWORK.actors.map((actor) => (
            <article key={actor.id} className="rounded-3xl border border-zinc-800 p-5">
              <p className="text-xs uppercase tracking-wider text-emerald-400">{actor.kind}</p>
              <h2 className="mt-1 text-lg font-medium">{actor.id}</h2>
              <p className="mt-2 text-sm text-zinc-400">{actor.role}</p>
            </article>
          ))}
        </div>
        <section className="mt-8 rounded-3xl border border-zinc-800 p-5">
          <h2 className="text-lg font-medium">Relationships</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {NETWORK.relations.map((rel) => (
              <li key={`${rel.from}-${rel.to}`} className="rounded-2xl border border-zinc-800 px-4 py-3">
                {rel.from} → {rel.to}
                <span className="mt-1 block text-xs text-zinc-500">{rel.kind} · {rel.documented ? "documented" : "missing handoff"}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-amber-200">
            {missing.length} missing handoff. That is context for y. It is not causation, and it is not Φ.
          </p>
        </section>
        <p className="mt-6 text-sm text-zinc-500">{NETWORK.not}</p>
        <nav className="mt-8 flex gap-4 text-sm text-zinc-400">
          <Link className="underline" href="/workbench/control">Control A</Link>
          <Link className="underline" href="/workbench/diagnostics">Diagnostics</Link>
        </nav>
      </main>
    </div>
  );
}