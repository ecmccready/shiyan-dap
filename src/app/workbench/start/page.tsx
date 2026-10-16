"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { recordStart, loadStarts } from "@/lib/level4/acquisition";

export default function StartPage() {
  const router = useRouter();
  const [starts, setStarts] = useState(0);

  useEffect(() => {
    setStarts(loadStarts());
  }, []);

  function begin() {
    recordStart();
    setStarts(loadStarts());
    router.push("/workbench/autonomous");
  }

  return (
    <main className="mx-auto max-w-xl space-y-8 p-8">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-neutral-500">Aethel Node</p>
        <h1 className="text-2xl font-semibold">Start a durable run</h1>
        <p className="text-neutral-700">
          One clear path from goal to verified result. The system plans, acts, checks safety, records evidence, and can resume after interruption.
        </p>
      </header>

      <section className="space-y-3 text-sm">
        <div className="rounded border p-4">
          <p className="font-medium">1. Goal</p>
          <p className="text-neutral-600">Reduce final error under explicit safety and budget limits.</p>
        </div>
        <div className="rounded border p-4">
          <p className="font-medium">2. Step</p>
          <p className="text-neutral-600">Each action is pre-checked, applied once, and recorded.</p>
        </div>
        <div className="rounded border p-4">
          <p className="font-medium">3. Result</p>
          <p className="text-neutral-600">Verified outcome appears in history. You can leave and return; progress is kept.</p>
        </div>
      </section>

      <button
        onClick={begin}
        className="rounded bg-neutral-900 px-5 py-2.5 text-sm text-white"
      >
        Begin guided run
      </button>

      <p className="text-xs text-neutral-500">Guided starts so far: {starts}</p>
      <p className="text-xs text-neutral-500">
        No algorithm knowledge required. Safety and recovery are enforced before any action is applied.
      </p>
    </main>
  );
}