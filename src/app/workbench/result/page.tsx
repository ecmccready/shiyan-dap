"use client";

import { useEffect, useState } from "react";
import Level4Shell from "@/components/Level4Shell";
import LatestVerified from "@/components/LatestVerified";
import {
  loadExperienceServer,
  latestVerified,
  type ExperienceEntry,
} from "@/lib/level4/experience-client";

export default function ResultPage() {
  const [experience, setExperience] = useState<ExperienceEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadExperienceServer().then((list) => {
      setExperience(list);
      setLoading(false);
    });
  }, []);

  return (
    <Level4Shell>
      <main className="mx-auto max-w-xl space-y-8 p-8">
        <header className="space-y-2">
          <p className="text-sm uppercase tracking-wide text-zinc-500">Result</p>
          <h1 className="text-2xl font-semibold">Verified outcome</h1>
          <p className="text-zinc-300">
            The latest eligible result from a bounded, safety-checked run, read from the durable experience store.
          </p>
        </header>

        <LatestVerified entry={latestVerified(experience)} total={experience.length} loading={loading} />

        <p className="text-sm">
          <a href="/workbench/outcome" className="underline text-emerald-400">Declare another outcome</a>
          {" · "}
          <a href="/workbench/status" className="underline text-emerald-400">Full status</a>
        </p>
      </main>
    </Level4Shell>
  );
}
