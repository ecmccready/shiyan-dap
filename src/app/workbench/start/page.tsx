"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { recordStartServer, newRunId, loadAcquisitionServer } from "@/lib/level4/acquisition";
import Level4Shell from "@/components/Level4Shell";

export default function StartPage() {
  const router = useRouter();
  const [starts, setStarts] = useState<number | null>(null);

  useEffect(() => {
    async function load() {
      const data = await loadAcquisitionServer();
      setStarts(data.starts);
    }
    load();
  }, []);

  async function begin() {
    const id = newRunId();
    const count = await recordStartServer(id);
    if (count !== null) setStarts(count);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("aethel-active-run-id", id);
    }
    router.push(`/workbench/autonomous?run=${id}`);
  }

  return (
    <Level4Shell>
    <main className="mx-auto max-w-xl space-y-8 p-8">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-zinc-500">Aethel Node</p>
        <h1 className="text-2xl font-semibold">Start a durable run</h1>
        <p className="text-zinc-300">
          One clear path from goal to verified result. The system plans, acts, checks safety, records evidence, and can resume after interruption.
        </p>
      </header>

      <section className="space-y-3 text-sm">
        <div className="rounded-xl border border-zinc-800 p-4">
          <p className="font-medium">1. Goal</p>
          <p className="text-zinc-400">Reduce final error under explicit safety and budget limits.</p>
        </div>
        <div className="rounded-xl border border-zinc-800 p-4">
          <p className="font-medium">2. Step</p>
          <p className="text-zinc-400">Each action is pre-checked, applied once, and recorded.</p>
        </div>
        <div className="rounded-xl border border-zinc-800 p-4">
          <p className="font-medium">3. Result</p>
          <p className="text-zinc-400">Verified outcome appears in history. You can leave and return; progress is kept.</p>
        </div>
      </section>

      <button
        onClick={begin}
        className="rounded-full bg-emerald-600 px-5 py-2.5 text-sm text-white"
      >
        Begin guided run
      </button>

      <p className="text-xs text-zinc-500">Guided starts so far: {starts ?? "…"}</p>
      <p className="text-sm">
        <a href="/workbench/status" className="underline text-emerald-400">
          Level 4 status
        </a>
        {" — current surfaces and measured outcome."}
      </p>
      <p className="text-xs text-zinc-500">
        No algorithm knowledge required. Safety and recovery are enforced before any action is applied.
      </p>
    </main>
    </Level4Shell>
  );
}