"use client";

import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

const LOOP = [
  ["Give A a task", "Objective and reference, not a prompt."],
  ["Let B execute", "Workbench steps y. A only names y."],
  ["Measure", "z is observed. e is distance to the reference."],
  ["Improve", "Reuse only if final e falls. A tie is not a win."],
  ["Preserve", "The Run is the evidence. Export it."],
];

export default function WorkbenchPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Workbench" />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold mb-4">Aethel Node</h1>
        <p className="text-zinc-300 max-w-2xl mb-2">
          Aethel Node proves that the next action is no longer a misdiagnosis.
        </p>
        <p className="text-zinc-300 max-w-2xl mb-8">
          Persistent self-monitoring autonomous system that can accumulate verified experience, use that experience to
          improve future decisions, and retain its operational identity across runs.
        </p>

        <nav className="flex flex-col gap-3 text-sm mb-8">
          <div className="flex flex-wrap items-baseline gap-4">
            <span className="text-xs uppercase tracking-wide text-zinc-500 w-32 shrink-0">1 · Run &amp; review</span>
            <Link className="underline" href="/workbench/review">Review</Link>
            <Link className="underline" href="/workbench/history">History</Link>
            <Link className="underline" href="/workbench/self">Level 3 Self()</Link>
          </div>
          <div className="flex flex-wrap items-baseline gap-4">
            <span className="text-xs uppercase tracking-wide text-zinc-500 w-32 shrink-0">2 · Proof</span>
            <Link className="underline" href="/workbench/proof">Safety proof</Link>
            <Link className="underline" href="/workbench/compare">Peer proof</Link>
            <Link className="underline" href="/workbench/shiyan">Shiyan + Model 3 proof</Link>
            <Link className="underline" href="/workbench/network">Actor network</Link>
          </div>
          <div className="flex flex-wrap items-baseline gap-4">
            <span className="text-xs uppercase tracking-wide text-zinc-500 w-32 shrink-0">3 · Commercial</span>
            <Link className="underline" href="/workbench/marketplace">Marketplace</Link>
            <Link className="underline" href="/workbench/client">Client pipeline</Link>
            <Link className="underline" href="/workbench/pilot">Pilot</Link>
            <Link className="underline" href="/workbench/offer">Offer</Link>
            <Link className="underline" href="/offer">Offer (public)</Link>
          </div>
        </nav>

        <Link
          href="/workbench/start"
          className="inline-flex items-center h-12 shrink-0 rounded-full bg-emerald-500 px-6 text-sm font-medium text-black"
        >
          Create Run
        </Link>

        <section className="mt-10 space-y-6">
          {LOOP.map(([title, body], i) => (
            <div key={title} className="border border-zinc-800 rounded-2xl p-5">
              <p className="text-emerald-400 text-xs uppercase tracking-widest mb-1">
                0{i + 1}
              </p>
              <h2 className="text-lg font-semibold mb-1">{title}</h2>
              <p className="text-zinc-400 text-sm">{body}</p>
            </div>
          ))}
        </section>

        <section className="mt-10 border border-zinc-800 rounded-2xl p-5">
          <p className="text-emerald-400 text-xs uppercase tracking-widest mb-2">
            Killer metric · Δe
          </p>
          <h2 className="text-lg font-semibold mb-2">Intelligence is reduction of error</h2>
          <p className="text-zinc-400 text-sm">
            Φ is the change in final error between a cold run and a reuse run on the same reference.
            A lower final e is the claim. A shorter path is a note. A tie is not a win.
          </p>
        </section>
      </main>
    </div>
  );
}