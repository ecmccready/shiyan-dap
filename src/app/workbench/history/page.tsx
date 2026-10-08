"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { readRuns, type OutcomeRun } from "@/product/run";

const JOURNEY = ["CREATE RUN", "Objective", "A proposes", "B executes", "z", "e", "Δe", "PROOF", "REUSE", "NEW RUN"];

export default function HistoryPage() {
  const [runs, setRuns] = useState<OutcomeRun[] | null>(null);

  useEffect(() => {
    setRuns(readRuns());
  }, []);

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="History" />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <p className="text-xs uppercase tracking-[0.18em] text-emerald-400">Persistent on this browser</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Run history</h1>
        <p className="mt-4 text-sm leading-6 text-zinc-400">
          A closed Run stays in this browser. Refresh keeps it. Another browser does not. This is not an organization record and not a receipt.
        </p>
        <ol className="mt-6 flex gap-2 overflow-x-auto text-xs text-zinc-400">
          {JOURNEY.map((step) => (
            <li key={step} className="shrink-0 rounded-full border border-zinc-800 px-3 py-1">{step}</li>
          ))}
        </ol>

        {runs === null && <p className="mt-8 text-sm text-zinc-500">Reading local history.</p>}

        {runs?.length === 0 && (
          <section className="mt-8 rounded-3xl border border-dashed border-zinc-700 p-8">
            <p className="text-lg font-medium">No Run kept yet</p>
            <p className="mt-2 text-sm text-zinc-500">Create one on the Workbench. It appears here after it is stored.</p>
            <Link href="/workbench" className="mt-4 inline-block text-sm underline">Create Run</Link>
          </section>
        )}

        {runs && runs.length > 0 && (
          <ul className="mt-8 space-y-3">
            {runs.map((run) => (
              <li key={run.id} className="rounded-3xl border border-zinc-800 p-5">
                <p className="text-xs text-zinc-500">{run.id}</p>
                <h2 className="mt-1 text-lg font-medium">{run.objective}</h2>
                <p className="mt-2 text-sm text-zinc-400">{run.workbench} · {run.status}</p>
                <p className="mt-2 text-sm tabular-nums">e {run.e0} → {run.e_now} · Δe {run.delta_e}</p>
                <Link href={`/workbench/run/${run.id}`} className="mt-3 inline-block text-sm underline">Open record</Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}