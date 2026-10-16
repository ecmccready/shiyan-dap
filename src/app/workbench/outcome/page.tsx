"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { newRunId, recordStartServer } from "@/lib/level4/acquisition";

export default function OutcomePage() {
  const router = useRouter();
  const [goal, setGoal] = useState("reduce final e below 0.16 under safety constraints");

  async function start() {
    const id = newRunId();
    await recordStartServer(id);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("aethel-active-run-id", id);
      window.sessionStorage.setItem("aethel-declared-goal", goal);
    }
    router.push(`/workbench/autonomous?run=${id}`);
  }

  return (
    <main className="mx-auto max-w-xl space-y-8 p-8">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-neutral-500">External client</p>
        <h1 className="text-2xl font-semibold">Declare an outcome</h1>
        <p className="text-neutral-700">
          One measurable goal. The system runs under safety and budget limits and returns a verified result.
        </p>
      </header>

      <label className="block text-sm">
        Desired outcome
        <textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          className="mt-1 w-full rounded border p-2 text-sm"
          rows={3}
        />
      </label>

      <button
        onClick={start}
        className="rounded bg-neutral-900 px-5 py-2.5 text-sm text-white"
      >
        Start measured run
      </button>

      <p className="text-xs text-neutral-500">
        Progress is kept. You can leave and return. The result is recorded for reuse.
      </p>
    </main>
  );
}