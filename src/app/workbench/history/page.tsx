"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import LatestVerified from "@/components/LatestVerified";
import { useHydrated } from "@/lib/use-hydrated";
import {
  loadExperienceServer,
  latestVerified,
  type ExperienceEntry,
} from "@/lib/level4/experience-client";

type StoredRun = {
  id: string;
  case_id?: string;
  sequence?: string;
  e?: number;
  phi?: number | null;
  created_at?: string;
};

function readStoredRuns(): StoredRun[] {
  try {
    const raw = localStorage.getItem("aethel-client-runs");
    return raw ? (JSON.parse(raw) as StoredRun[]) : [];
  } catch {
    return [];
  }
}

export default function HistoryPage() {
  const hydrated = useHydrated();
  const runs = hydrated ? readStoredRuns() : [];
  const [experience, setExperience] = useState<ExperienceEntry[]>([]);
  const [loadingExp, setLoadingExp] = useState(true);

  useEffect(() => {
    let live = true;
    loadExperienceServer().then((list) => {
      if (!live) return;
      setExperience(list);
      setLoadingExp(false);
    });
    return () => {
      live = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Workbench" />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-emerald-400 text-xs uppercase tracking-widest mb-3">
          History
        </p>
        <h1 className="text-3xl font-bold mb-3">Inspectable Runs</h1>
        <p className="text-zinc-400 max-w-2xl mb-6">
          Every closed Run is a permanent record. Identifier, reference version, sequence, final e, Φ, cost, and latency. A closed Run is not a charge. An unsettled receipt is not revenue.
        </p>

        <p className="text-sm text-zinc-300 mb-6">
          Client pipeline Runs export from <Link className="underline" href="/workbench/client">/workbench/client</Link>. Public proof remains on the <Link className="underline" href="/workbench/shiyan">Shiyan plant</Link>.
        </p>

        <h2 className="text-lg font-semibold mb-3">Level 4 · server record</h2>
        <div className="mb-8">
          <LatestVerified entry={latestVerified(experience)} total={experience.length} loading={loadingExp} />
        </div>

        <h2 className="text-lg font-semibold mb-3">Client pipeline · this browser</h2>
        {runs.length === 0 ? (
          <section className="border border-zinc-800 rounded-2xl p-5 text-sm text-zinc-400 mb-6">
            No client pipeline Runs exported in this browser.
          </section>
        ) : (
          runs.map((run) => (
            <section key={run.id} className="border border-zinc-800 rounded-2xl p-5 mb-4 text-sm">
              <p className="font-mono text-xs text-zinc-500 mb-1">{run.id}</p>
              <p>{run.case_id}</p>
              <p className="text-zinc-400">{run.sequence}</p>
              <p>e {run.e} · Φ {run.phi ?? "—"}</p>
            </section>
          ))
        )}

        <section className="border border-zinc-800 rounded-2xl p-5 text-sm text-zinc-400 mb-8">
          <p>Level 4 verified results are stored on the server. Client pipeline exports are stored in this browser.</p>
          <p className="mt-2">Same sealed sequence as Safety and Shiyan. Φ stays inside the plant that produced it. Not a diagnosis. No PHI.</p>
        </section>

        <nav className="flex flex-wrap gap-4 text-sm">
          <Link className="underline" href="/workbench">Workbench</Link>
          <Link className="underline" href="/workbench/client">Client pipeline</Link>
          <Link className="underline" href="/workbench/shiyan">Shiyan pipeline</Link>
          <Link className="underline" href="/workbench/offer">Offer</Link>
          <Link className="underline" href="/workbench/proof">Safety proof</Link>
          <Link className="underline" href="/workbench/network">Actor network</Link>
        </nav>
      </main>
    </div>
  );
}