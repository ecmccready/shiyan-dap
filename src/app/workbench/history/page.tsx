"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

type StoredRun = {
  run_id: string;
  plant: string;
  reference: string;
  phi: string;
  exported_at: string;
  commercial?: { cost?: string; latency?: string };
};

export default function HistoryPage() {
  const [runs, setRuns] = useState<StoredRun[]>([]);

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("aethel_client_runs") || "[]");
    setRuns(stored);
  }, []);

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Workbench B" />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-emerald-400 text-xs uppercase tracking-widest mb-3">
          History
        </p>
        <h1 className="text-3xl font-bold mb-3">Inspectable Runs</h1>
        <p className="text-zinc-400 max-w-2xl mb-6">
          Every closed Run is a permanent record. Identifier, reference version, sequence, final e, Φ, cost, and latency.
          A closed Run is not a charge. An unsettled receipt is not revenue.
        </p>
        <p className="text-zinc-500 text-sm mb-8">
          Client pipeline Runs export from{" "}
          <Link className="underline" href="/workbench/client">/workbench/client</Link>.
          Public proof remains on the{" "}
          <Link className="underline" href="/workbench/optimus">Optimus plant</Link>.
        </p>

        {runs.length === 0 ? (
          <section className="border border-zinc-800 rounded-2xl p-5 mb-8 text-sm text-zinc-400">
            No client Runs stored in this browser yet. Export one from the client pipeline.
          </section>
        ) : (
          runs.map((r) => (
            <section key={r.run_id} className="border border-zinc-800 rounded-2xl p-5 mb-6 text-sm text-zinc-300">
              <p><span className="text-white">Run:</span> {r.run_id}</p>
              <p><span className="text-white">Plant:</span> {r.plant}</p>
              <p><span className="text-white">Reference:</span> {r.reference}</p>
              <p><span className="text-white">Φ:</span> {r.phi}</p>
              <p><span className="text-white">Exported:</span> {r.exported_at}</p>
              {r.commercial && (
                <p className="text-zinc-500 text-xs mt-2">
                  cost: {r.commercial.cost} · latency: {r.commercial.latency}
                </p>
              )}
            </section>
          ))
        )}

        <section className="border border-zinc-800 rounded-2xl p-5 mb-8 text-sm text-zinc-300">
          <p className="mb-3">
            Runs stored in this browser are inspectable here. Server-side permanent records are the next plant.
          </p>
          <p className="text-zinc-500 text-xs">
            Same sealed sequence as Safety and Optimus. Φ stays inside the plant that produced it.
            Not a diagnosis. No PHI.
          </p>
        </section>

        <nav className="flex flex-wrap gap-4 text-sm mt-8">
          <Link className="underline" href="/workbench">Workbench B</Link>
          <Link className="underline" href="/workbench/client">Client pipeline</Link>
          <Link className="underline" href="/workbench/optimus">Optimus pipeline</Link>
          <Link className="underline" href="/workbench/offer">Offer</Link>
          <Link className="underline" href="/workbench/proof">Safety proof</Link>
          <Link className="underline" href="/workbench/network">Actor network</Link>
        </nav>
      </main>
    </div>
  );
}