"use client";

import { useEffect, useState } from "react";
import RoeLookbackNote from "@/components/RoeLookbackNote";
import Link from "next/link";
import { loadAcquisitionServer } from "@/lib/level4/acquisition";
import Level4Shell from "@/components/Level4Shell";
import BenchmarkTable from "@/components/BenchmarkTable";
import CopyVerificationSummary from "@/components/CopyVerificationSummary";
import {
  loadExperienceServer,
  latestVerified,
  fmtE,
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
      try {
        setActiveRun(window.sessionStorage.getItem("aethel-active-run-id"));
      } catch {
        setActiveRun(null);
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

      <section className="rounded-xl border border-zinc-800 p-4 text-sm" aria-label="Latest verified result">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-medium">Latest verified result</p>
          <a href="/workbench/result" className="text-emerald-400 underline">Full proof &amp; exports</a>
        </div>
        {loadingExp ? (
          <p className="mt-2 text-xs text-zinc-500">Loading verified experience…</p>
        ) : latest ? (
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
            <dt className="text-zinc-500">Run</dt>
            <dd className="font-mono text-xs break-all">
              <a href={`/workbench/autonomous?run=${encodeURIComponent(latest.run_id)}`} className="underline">
                {latest.run_id}
              </a>
            </dd>
            <dt className="text-zinc-500">Final e</dt>
            <dd className="font-mono">{fmtE(latest.e)}</dd>
            {typeof latest.delta_e === "number" && (
              <>
                <dt className="text-zinc-500">Δe</dt>
                <dd className="font-mono">{fmtE(latest.delta_e)}</dd>
              </>
            )}
            {typeof latest.phi === "number" && (
              <>
                <dt className="text-zinc-500">Φ vs cold</dt>
                <dd className="font-mono">{fmtE(latest.phi)}</dd>
              </>
            )}
            <dt className="text-zinc-500">Eligible</dt>
            <dd>{latest.eligible ? "yes" : "no"}</dd>
          </dl>
        ) : (
          <p className="mt-2 text-zinc-400">No verified results have been recorded yet.</p>
        )}
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

      <RoeLookbackNote />

      <section data-status-external-confirmation className="rounded-xl border border-zinc-800 p-4 text-sm text-zinc-300">
        <p className="text-xs text-emerald-400">External confirmation</p>
        <p className="mt-2">
          The claims an outside party can check today, and what is not yet confirmed, are in the{" "}
          <Link className="underline" href="/#outside-verification">&quot;What an outside party can verify today&quot; block on the homepage</Link>
          {" "}and in <Link className="underline" href="/workbench/offer">/workbench/offer</Link>. The runs and counts on this page were made by us, and no outside party has reviewed or replicated them.
        </p>
        <CopyVerificationSummary />
      </section>
    </main>
    </Level4Shell>
  );
}