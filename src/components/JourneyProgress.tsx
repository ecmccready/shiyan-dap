"use client";

import Link from "next/link";
import { JOURNEY_STEPS } from "@/lib/journey";
import { useBenefit } from "@/lib/benefit-record";
import type { ExperienceEntry } from "@/lib/level4/experience-client";

/**
 * Compact four-step indicator for the run on this page. The step is read from what is recorded:
 * no run → step 1; a run whose goal threshold was not met → step 2; an eligible run → step 3;
 * an eligible run with a self-reported benefit saved in this browser → step 4. It does not mean a pilot was approved.
 */
export default function JourneyProgress({ entry }: { entry: ExperienceEntry | null }) {
  const benefit = useBenefit(entry?.run_id);
  const current = !entry ? 1 : !entry.eligible ? 2 : benefit ? 4 : 3;
  const why: Record<number, string> = {
    1: "No run is recorded yet: declare an outcome to start.",
    2: "A run is recorded but did not meet the goal threshold, so there is no verified outcome to validate yet.",
    3: "An eligible run is recorded: verify it and export the evidence pack.",
    4: "A self-reported benefit is saved in this browser for this run. This does not mean a pilot was approved.",
  };
  return (
    <nav aria-label="Proof-to-pilot journey" data-journey-progress data-journey-current={current} className="rounded-xl border border-zinc-800 p-3 text-xs space-y-2">
      <ol className="flex flex-wrap gap-x-4 gap-y-1">
        {JOURNEY_STEPS.map((s) => {
          const state = s.step < current ? "done" : s.step === current ? "current" : "next";
          return (
            <li key={s.step} aria-current={state === "current" ? "step" : undefined} className={state === "current" ? "text-emerald-400 font-medium" : state === "done" ? "text-zinc-300" : "text-zinc-500"}>
              {state === "done" ? "✓ " : ""}{s.step}.{" "}
              {s.step === 3 ? <span>{s.name}</span> : <Link href={s.primary} className="underline">{s.name}</Link>}
            </li>
          );
        })}
      </ol>
      <p className="text-zinc-500">{why[current]}</p>
    </nav>
  );
}
