"use client";

import { useEffect, useState } from "react";
import { loadAcquisitionServer } from "@/lib/level4/acquisition";
import Level4Shell from "@/components/Level4Shell";
import LatestVerified from "@/components/LatestVerified";
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

  useEffect(() => {
    async function load() {
      const data = await loadAcquisitionServer();
      setStarts(data.starts);
      setRecent(data.recent);
      if (typeof window !== "undefined") {
        setActiveRun(window.sessionStorage.getItem("aethel-active-run-id"));
      }
      setExperience(await loadExperienceServer());
      setLoadingExp(false);
    }
    load();
  }, []);

  const items = [
    { surface: "/roadmap", status: "live", note: "durability + acquisition priorities" },
    { surface: "/workbench/start", status: "live", note: "guided first run" },
    { surface: "/workbench/outcome", status: "live", note: "external client declares a measurable goal" },
    { surface: "/workbench/result", status: "live", note: "simple external verified result" },
    { surface: "/workbench/spine", status: "live", note: "product spine view" },
    { surface: "/workbench/autonomous", status: "live", note: "checkpoint, idempotency, precheck, verified, server record" },
    { surface: "/workbench/autonomous/proof", status: "live", note: "recovery + gate proof" },
  ];

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

      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.surface} className="rounded-xl border border-zinc-800 p-4">
            <a href={item.surface} className="font-medium underline">
              {item.surface}
            </a>
            <p className="text-sm text-zinc-400">{item.note}</p>
          </li>
        ))}
      </ul>

      <section className="rounded-xl border border-zinc-800 p-4 text-sm">
        <p className="font-medium">Measured outcome</p>
        <p className="text-zinc-400">
          Demo goal: reduce final e below 0.16 under safety constraints. Φ is recorded when verified results are eligible.
        </p>
      </section>

      <section className="rounded-xl border border-zinc-800 p-4 text-sm space-y-2">
        <p className="font-medium">Acquisition readiness</p>
        <ul className="list-disc list-inside text-zinc-400">
          <li>Clear starting point: /workbench/start</li>
          <li>Guided first run that ends in a verified result</li>
          <li>Understandable outcome without algorithm knowledge</li>
          <li>Reason to return: progress survives reload via server record</li>
        </ul>
        <p className="text-zinc-300">Guided starts recorded: {starts ?? "…"}</p>
        {activeRun && (
          <p className="text-zinc-300">
            Active run:{" "}
            <a href={`/workbench/autonomous?run=${activeRun}`} className="underline">
              {activeRun}
            </a>
          </p>
        )}
        {recent.length > 0 && (
          <div className="mt-2">
            <p className="font-medium">Recent runs</p>
            <ul className="list-disc list-inside">
              {recent.map((id) => (
                <li key={id}>
                  <a href={`/workbench/autonomous?run=${id}`} className="underline">
                    {id}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <LatestVerified entry={latestVerified(experience)} total={experience.length} loading={loadingExp} />

      {experience.length > 1 && (
        <section className="rounded-xl border border-zinc-800 p-4 text-sm">
          <p className="font-medium">Recent verified steps</p>
          <ul className="mt-2 space-y-1 text-xs font-mono text-zinc-300">
            {experience.slice(-5).map((e) => (
              <li key={`${e.run_id}:${e.iteration}`}>
                {e.run_id} · iter {e.iteration} · e={e.e ?? "—"}
                {typeof e.delta_e === "number" ? ` · Δe=${e.delta_e}` : ""} · eligible={String(e.eligible)}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
    </Level4Shell>
  );
}