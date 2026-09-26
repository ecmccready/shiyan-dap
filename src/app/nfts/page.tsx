"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { LedgerAsset, markAcquired, readLedger } from "@/lib/ledger";
import { yFromAsset } from "@/lib/outcomes";

const CLUSTER_A = "cluster:A";
const CONTAINER_A = "container:founder-music";
const AGENT_A = "Workspace A · controller";

export default function ProvePage() {
  const [assets, setAssets] = useState<LedgerAsset[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    setAssets(readLedger().filter((row) => row.id.startsWith("cl_")));
  }, []);

  const acquire = async (asset: LedgerAsset) => {
    setBusy(asset.id);
    try {
      await fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetId: asset.id,
          title: asset.title,
          action: "PROVE_ASSET",
          agent: AGENT_A,
          cluster: CLUSTER_A,
        }),
      });
    } catch {}
    markAcquired(asset.id);
    setAssets(readLedger().filter((row) => row.id.startsWith("cl_")));
    setBusy(null);
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Prove" />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-emerald-400 mb-3">A pipeline · Prove</p>
        <h1 className="text-3xl font-bold mb-3">Proven content</h1>
        <p className="text-zinc-400 mb-8">
          Workspace A records proof on the ledger and writes z. Workbench B is
          the environment A acts on, not a customer. There is no Buy as B rail.
        </p>

        <div className="bg-zinc-900/60 border border-emerald-800 rounded-2xl p-6 mb-6">
          <p className="text-xs text-emerald-400 mb-2">
            {CLUSTER_A} · {CONTAINER_A}
          </p>
          <h2 className="text-2xl font-semibold mb-1">{AGENT_A}</h2>
          <p className="text-sm text-zinc-500">
            {assets.length} assets in the A catalog
          </p>
        </div>

        <div className="space-y-4">
          {assets.map((asset) => {
            const y = yFromAsset(asset.state);
            return (
              <div
                key={asset.id}
                className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6"
              >
                <h3 className="text-xl font-semibold mb-3">{asset.title}</h3>
                <p className="text-sm text-zinc-400 mb-1">id {asset.id}</p>
                <p className="text-sm text-zinc-400 mb-1">state {asset.state}</p>
                <p className="text-sm text-zinc-400 mb-5">
                  f(A) {y.settlement} · proof {y.acquisition}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => acquire(asset)}
                    disabled={
                      busy === asset.id ||
                      asset.state === "escrow" ||
                      asset.state === "settled"
                    }
                    className="h-11 px-6 rounded-full bg-emerald-600 text-sm disabled:opacity-50"
                  >
                    {asset.state === "escrow" || asset.state === "settled"
                      ? "Proven"
                      : "Prove"}
                  </button>
                  <Link
                    href="/measurements"
                    className="h-11 px-6 rounded-full border border-zinc-700 text-sm inline-flex items-center"
                  >
                    Learn
                  </Link>
                  <Link
                    href="/bot"
                    className="h-11 px-6 rounded-full border border-zinc-700 text-sm inline-flex items-center"
                  >
                    Act
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}