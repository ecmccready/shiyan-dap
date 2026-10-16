"use client";

import { useEffect, useState } from "react";

type ExperienceEntry = {
  run_id: string;
  iteration: number;
  e: number | null;
  verified_at: string;
  eligible: boolean;
};

export default function ResultPage() {
  const [experience, setExperience] = useState<ExperienceEntry[]>([]);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/level4/experience");
      if (res.ok) setExperience(await res.json());
    }
    load();
  }, []);

  const latest = experience[experience.length - 1];

  return (
    <main className="mx-auto max-w-xl space-y-8 p-8">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-neutral-500">Result</p>
        <h1 className="text-2xl font-semibold">Verified outcome</h1>
        <p className="text-neutral-700">
          The latest eligible result from a bounded, safety-checked run.
        </p>
      </header>

      {!latest ? (
        <p className="text-sm text-neutral-600">No verified result yet.</p>
      ) : (
        <section className="rounded border p-4 text-sm space-y-2">
          <p><span className="font-medium">Run</span> {latest.run_id}</p>
          <p><span className="font-medium">Iteration</span> {latest.iteration}</p>
          <p><span className="font-medium">Final e</span> {latest.e ?? "—"}</p>
          <p><span className="font-medium">Eligible</span> {String(latest.eligible)}</p>
          <p className="text-xs text-neutral-500">{latest.verified_at}</p>
        </section>
      )}

      <p className="text-sm">
        <a href="/workbench/outcome" className="underline text-blue-600">Declare another outcome</a>
        {" · "}
        <a href="/workbench/status" className="underline text-blue-600">Full status</a>
      </p>
    </main>
  );
}