"use client";

import { useEffect, useState } from "react";
import { loadAcquisitionServer } from "@/lib/level4/acquisition";
import Level4Shell from "@/components/Level4Shell";
import LatestVerified from "@/components/LatestVerified";
import RunEndpoints from "@/components/RunEndpoints";
import AnchorRoot from "@/components/AnchorRoot";
import ShareSection from "@/components/ShareSection";
import CopyLedgerLine from "@/components/CopyLedgerLine";
import CopyEvidencePack from "@/components/CopyEvidencePack";
import HolographicDensity from "@/components/HolographicDensity";
import BenchmarkTable from "@/components/BenchmarkTable";
import {
  loadExperienceServer,
  latestVerified,
  type ExperienceEntry,
} from "@/lib/level4/experience-client";

export default function StatusPage() {
  const [starts, setStarts] = useState<number | null>(null);
  const [activeRun, setActiveRun] = useState<string | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [experience, setExperience] = useState<ExperienceEntry[]>([]);
  const [loadingExp, setLoadingExp] = useState(true);
  const [loadingStarts, setLoadingStarts] = useState(true);

  useEffect(() => {
    async function load() {
      const data = await loadAcquisitionServer();
      setStarts(data.starts);
      setLoadingStarts(false);
      setRecent(data.recent);
      if (typeof window !== "undefined") {
        setActiveRun(window.sessionStorage.getItem("aethel-active-run-id"));
      }
      setExperience(await loadExperienceServer());
      setLoadingExp(false);
    }
    load();
  }, []);

  const latest = latestVerified(experience);

  return (
    <Level4Shell>
    <main className="mx-auto max-w-2xl space-y-8 p-6">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-zinc-500">Level 4</p>
        <h1 className="text-2xl font-semibold">Durability status</h1>
        <p className="text-zinc-300">
          Run records, guided-start counters, and verified experience persist in Upstash and survive reloads and redeploys.
        </p>
        <p className="text-sm">
          <a href="/workbench/outcome" className="underline text-emerald-400">
            Declare an outcome
          </a>
          {" — external client path."}
        </p>
        <p className="text-sm">
          <a href="/workbench/result" className="underline text-emerald-400">
            Latest result
          </a>
        </p>
      </header>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2" aria-label="Live counters">
        <div className="rounded-xl border border-zinc-800 p-4">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Guided starts recorded</p>
          {loadingStarts ? (
            <p className="mt-1 h-8 w-16 rounded bg-zinc-800 animate-pulse" aria-label="Loading guided-start count" />
          ) : (
            <p className="mt-1 text-3xl font-semibold font-mono">{starts ?? "—"}</p>
          )}
          <p className="text-xs text-zinc-500">from /api/level4/acquisition</p>
        </div>
        <div className="rounded-xl border border-zinc-800 p-4">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Verified steps stored</p>
          {loadingExp ? (
            <p className="mt-1 h-8 w-16 rounded bg-zinc-800 animate-pulse" aria-label="Loading verified steps" />
          ) : (
            <p className="mt-1 text-3xl font-semibold font-mono">{experience.length}</p>
          )}
          <p className="text-xs text-zinc-500">from /api/level4/experience</p>
        </div>
      </section>

      <LatestVerified entry={latest} total={experience.length} loading={loadingExp} />
      <ShareSection runId={latest?.run_id} />
      <CopyLedgerLine runId={latest?.run_id} iteration={latest?.iteration} />
      <CopyEvidencePack entry={latest} />
      <HolographicDensity distance={latest?.tensor_distance ?? null} />

      <section className="rounded-xl border border-zinc-800 p-4 text-sm">
        <p className="font-medium">Measured outcome</p>
        <p className="text-zinc-400">
          Demo goal: reduce final e below 0.16 under safety constraints. Φ is recorded when verified results are eligible.
        </p>
      </section>

      <section className="rounded-xl border border-zinc-800 p-4 text-sm space-y-2">
        <p className="font-medium">Current &amp; recent runs</p>
        {activeRun && (
          <p className="text-zinc-300">
            Current browser run:{" "}
            <a href={`/workbench/autonomous?run=${activeRun}`} className="underline">
              {activeRun}
            </a>
          </p>
        )}
        {recent.filter((id) => id !== activeRun).length > 0 ? (
          <div className="mt-2">
            <p className="font-medium">Recent runs</p>
            <ul className="list-disc list-inside">
              {recent.filter((id) => id !== activeRun).map((id) => (
                <li key={id}>
                  <a href={`/workbench/autonomous?run=${id}`} className="underline">
                    {id}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : !activeRun ? <p className="text-zinc-400">No recent runs recorded.</p> : null}
      </section>

      <BenchmarkTable />
      <section className="rounded-xl border border-zinc-800 p-4">
        <p className="mb-3 text-sm font-medium">Verify &amp; export</p>
        <RunEndpoints variant="inline" />
      </section>
      <AnchorRoot />

      {experience.length > 1 && (
        <section className="rounded-xl border border-zinc-800 p-4 text-sm">
          <p className="font-medium">Recent verified steps</p>
          <ul className="mt-2 space-y-1 text-xs font-mono text-zinc-300">
            {experience.slice(-5).map((e) => (
              <li key={`${e.run_id}:${e.iteration}`}>
                {e.run_id} · iter {e.iteration} · e={e.e ?? "—"}
                {typeof e.delta_e === "number" ? ` · Δe=${e.delta_e}` : ""} · eligible={String(e.eligible)}
                {e.tensor_commitment ? ` · T=${e.tensor_commitment.slice(0, 15)}…` : ""}
                {typeof e.tensor_distance === "number" ? ` · T_dist=${e.tensor_distance.toFixed(3)}` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
    </Level4Shell>
  );
}