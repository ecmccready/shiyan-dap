"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { newRunId, recordStartServer } from "@/lib/level4/acquisition";
import Level4Shell from "@/components/Level4Shell";

export default function OutcomeClient() {
  const router = useRouter();
  const [goal, setGoal] = useState("reduce final e below 0.16 under safety constraints");
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  async function start(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const declaredGoal = goal.trim();
    if (!declaredGoal || starting) return;

    setStarting(true);
    setStartError(null);
    try {
      const id = newRunId();
      await recordStartServer(id);
      window.sessionStorage.setItem("aethel-active-run-id", id);
      window.sessionStorage.setItem("aethel-declared-goal", declaredGoal);
      router.push(`/workbench/autonomous?run=${id}`);
    } catch {
      setStartError("Could not prepare the run in this browser. Check browser storage and try again.");
      setStarting(false);
    }
  }

  return (
    <Level4Shell>
      <main className="mx-auto max-w-xl space-y-8 p-8">
        <header className="space-y-2">
          <p className="text-sm uppercase tracking-wide text-zinc-500">Run setup</p>
          <h1 className="text-2xl font-semibold">Declare an outcome</h1>
          <p className="text-zinc-300">
            Set a measurable goal. The run applies safety and budget checks to each action.
          </p>
        </header>

        <form onSubmit={start} className="space-y-4">
          <label className="block text-sm" htmlFor="desired-outcome">
            Desired outcome
            <textarea
              id="desired-outcome"
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-800 p-2 text-sm"
              rows={3}
              required
            />
          </label>

          <button
            type="submit"
            disabled={!goal.trim() || starting}
            className="rounded-full bg-emerald-600 px-5 py-2.5 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {starting ? "Starting run…" : "Start measured run"}
          </button>
          {startError && <p role="alert" className="text-sm text-red-400">{startError}</p>}
        </form>

        <p className="text-xs text-zinc-500">
          Your declared goal and run ID are kept in this browser session and passed to the run.
        </p>
      </main>
    </Level4Shell>
  );
}
