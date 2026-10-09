"use client";

import { useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { closeRun, createRun, type OutcomeRun } from "@/product/run";

export default function KeepPage() {
  const [run, setRun] = useState<OutcomeRun | null>(null);

  function keep() {
    const opened = createRun({
      org: "aethel",
      workspace: "A",
      workbench: "Safety",
      objective: "Context N-safety-evidence · 2026-10-09. Evidence only. No diagnosis.",
    });
    setRun(closeRun(opened));
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Keep" />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <p className="text-xs uppercase tracking-[0.18em] text-emerald-400">This browser</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Keep the context. Do not copy Φ.</h1>
        <p className="mt-4 text-sm leading-6 text-zinc-400">
          This writes a closed Run into the same browser history as the Workbench. The objective names the network version. The sealed 0.065 is not copied onto the Run.
        </p>
        <button
          onClick={keep}
          disabled={Boolean(run)}
          className="mt-5 h-11 rounded-full bg-white px-5 text-sm font-medium text-black disabled:opacity-40"
        >
          {run ? "Kept" : "Keep in this browser"}
        </button>
        {run && (
          <dl className="mt-6 divide-y divide-zinc-800 rounded-3xl border border-zinc-800 text-sm">
            <Row k="id" v={run.id} />
            <Row k="N" v="N-safety-evidence · 2026-10-09" />
            <Row k="e" v={`${run.e0} → ${run.e_now}`} />
            <Row k="Δe" v={String(run.delta_e)} />
            <Row k="Φ" v="not copied" />
          </dl>
        )}
        <p className="mt-4 text-sm text-amber-200">
          This browser only. A private window will not see it. Not a server record. Not revenue.
        </p>
        <nav className="mt-8 flex flex-wrap gap-4 text-sm text-zinc-400">
          <Link className="underline" href="/workbench/history">History</Link>
          <Link className="underline" href="/workbench/context">Context</Link>
          <Link className="underline" href="/workbench/record">Sealed record</Link>
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