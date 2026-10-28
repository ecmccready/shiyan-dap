"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import { newRunId, recordStartServer } from "@/lib/level4/acquisition";

export default function WorkbenchHome() {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  async function beginGuidedRun() {
    setStarting(true);
    setStartError(null);
    try {
      const id = newRunId();
      await recordStartServer(id);
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
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={beginGuidedRun}
              disabled={starting}
              className="inline-flex h-11 items-center rounded-full bg-emerald-500 px-5 text-sm font-medium text-black disabled:cursor-wait disabled:opacity-60"
            >
              {starting ? "Starting run…" : "Create run"}
            </button>
          </div>
          {startError && <p role="alert" className="mt-3 text-sm text-red-400">{startError}</p>}
        </section>
      </main>
    </div>
  );
}
