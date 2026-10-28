"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import { loadAcquisitionServer, newRunId, recordStartServer } from "@/lib/level4/acquisition";

export default function WorkbenchHome() {
  const router = useRouter();
  const [starts, setStarts] = useState<number | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  useEffect(() => {
    async function loadStarts() {
      const data = await loadAcquisitionServer();
      setStarts(data.starts);
    }
    void loadStarts();
  }, []);

  async function beginGuidedRun() {
    setStarting(true);
    setStartError(null);
    try {
      const id = newRunId();
      const count = await recordStartServer(id);
      if (count !== null) setStarts(count);
      window.sessionStorage.setItem("aethel-active-run-id", id);
      router.push(`/workbench/autonomous?run=${id}`);
    } catch {
      setStartError("Could not start the run. Please try again.");
      setStarting(false);
    }
  }

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

        <section id="guided-run" className="scroll-mt-6 mt-8 rounded-2xl border border-emerald-900/70 p-5">
          <header className="mb-4 space-y-1">
            <h2 className="text-xl font-semibold">Start a durable run</h2>
            <p className="text-sm text-zinc-400">
              Set a measurable goal. Actions are safety-checked and recorded, and run progress can be resumed after interruption.
            </p>
          </header>
          <div className="grid gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-xl border border-zinc-800 p-4">
              <p className="font-medium">1. Goal</p>
              <p className="mt-1 text-zinc-400">Reduce final error under explicit safety and budget limits.</p>
            </div>
            <div className="rounded-xl border border-zinc-800 p-4">
              <p className="font-medium">2. Step</p>
              <p className="mt-1 text-zinc-400">Each action is pre-checked, applied once, and recorded.</p>
            </div>
            <div className="rounded-xl border border-zinc-800 p-4">
              <p className="font-medium">3. Result</p>
              <p className="mt-1 text-zinc-400">Verified outcome appears in history. Leave and return; progress is kept.</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={beginGuidedRun}
              disabled={starting}
              className="inline-flex h-11 items-center rounded-full bg-emerald-500 px-5 text-sm font-medium text-black disabled:cursor-wait disabled:opacity-60"
            >
              {starting ? "Starting run…" : "Create run"}
            </button>
            <p className="text-xs text-zinc-500">Guided starts so far: {starts ?? "…"}</p>
            <Link href="/workbench/status" className="text-sm text-emerald-400 underline">
              Level 4 status
            </Link>
          </div>
          {startError && <p role="alert" className="mt-3 text-sm text-red-400">{startError}</p>}
        </section>

        <nav aria-label="Workbench resources" className="mt-10 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <section className="rounded-2xl border border-zinc-800 p-5">
            <h2 className="text-xs uppercase tracking-wide text-zinc-500">1 · Run &amp; review</h2>
            <div className="mt-3 grid gap-2">
              <Link className="underline" href="/workbench/review">Review</Link>
              <Link className="underline" href="/workbench/history">History</Link>
              <Link className="underline" href="/workbench/self">Level 3 Self()</Link>
            </div>
          </section>
          <section className="rounded-2xl border border-zinc-800 p-5">
            <h2 className="text-xs uppercase tracking-wide text-zinc-500">2 · Proof</h2>
            <div className="mt-3 grid gap-2">
              <Link className="underline" href="/workbench/proof">Safety proof</Link>
              <Link className="underline" href="/workbench/compare">Peer proof</Link>
              <Link className="underline" href="/workbench/shiyan">Shiyan + Model 3 proof</Link>
              <Link className="underline" href="/workbench/network">Actor network</Link>
            </div>
          </section>
          <section className="rounded-2xl border border-zinc-800 p-5">
            <h2 className="text-xs uppercase tracking-wide text-zinc-500">3 · Commercial</h2>
            <div className="mt-3 grid gap-2">
              <Link className="underline" href="/workbench/marketplace">Marketplace</Link>
              <Link className="underline" href="/workbench/client">Client pipeline</Link>
              <Link className="underline" href="/workbench/pilot">Pilot</Link>
              <Link className="underline" href="/workbench/offer">Offer</Link>
              <Link className="underline" href="/workbench/offer">Offer (public)</Link>
              <Link className="underline" href="/workbench/autonomous?roe_drive=1">ROE · Reciprocal Optimization Engine</Link>
            </div>
          </section>
        </nav>
      </main>
    </div>
  );
}
