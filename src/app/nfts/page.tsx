"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { LedgerAsset, applyEvent, markAcquired, readLedger } from "@/lib/ledger";
import { yFromAsset } from "@/lib/outcomes";

const CLUSTER_A = "cluster:A";
const CLUSTER_B = "cluster:B";
const CONTAINER_A = "container:founder-music";
const CONTAINER_B = "container:new-customer";
const AGENT_A = "Agent A · ECMcCready";
const AGENT_B = "Agent B · potential customer";

export default function ProvePage() {
  const [assets, setAssets] = useState<LedgerAsset[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [openA, setOpenA] = useState(true);
  const [openB, setOpenB] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paid = params.get("paid");
    const asset = params.get("asset");
    if (paid === "1" && asset) {
      applyEvent(asset, "EXECUTE_SETTLEMENT");
      fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetId: asset,
          action: "EXECUTE_SETTLEMENT",
          agent: AGENT_A,
          cluster: CLUSTER_A,
          paid: false,
        }),
      }).catch(() => {});
      setNote("Settled in this browser. Live paid stays false until Stripe is live.");
    }
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
          action: "INITIATE_TRADE",
          agent: AGENT_A,
          cluster: CLUSTER_A,
        }),
      });
    } catch {}
    markAcquired(asset.id);
    setAssets(readLedger().filter((row) => row.id.startsWith("cl_")));
    setBusy(null);
  };

  const buy = async (asset: LedgerAsset) => {
    if (asset.state === "listed") markAcquired(asset.id);
    setNote("Opening Stripe for " + asset.title);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId: asset.id, title: asset.title, cluster: CLUSTER_A }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setNote(data.error || "Checkout failed");
    } catch {
      setNote("Checkout failed");
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Prove" />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-emerald-400 mb-3">P2P State Machine · Y vector</p>
        <h1 className="text-3xl font-bold mb-3">Proven content</h1>
        <p className="text-zinc-400 mb-8">
          Click a cluster to expand. A holds founder Music. B is the next customer seat.
        </p>
        <button
          onClick={() => setOpenA((v) => !v)}
          className="w-full text-left bg-zinc-900/60 border border-emerald-800 rounded-2xl p-6 mb-6"
        >
          <p className="text-xs text-emerald-400 mb-2">
            {CLUSTER_A} · {CONTAINER_A} · {openA ? "open" : "closed"}
          </p>
          <h2 className="text-2xl font-semibold mb-1">{AGENT_A}</h2>
          <p className="text-sm text-zinc-500">Domain Music · {assets.length} contained assets</p>
        </button>
        {openA ? (
          <div className="space-y-4 mb-10 pl-2 border-l border-emerald-800">
            {assets.map((asset) => {
              const y = yFromAsset(asset.state);
              return (
                <div key={asset.id} className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
                  <h3 className="text-xl font-semibold mb-3">{asset.title}</h3>
                  <p className="text-sm text-zinc-400 mb-1">id {asset.id}</p>
                  <p className="text-sm text-zinc-400 mb-1">state {asset.state}</p>
                  <p className="text-sm text-zinc-400 mb-5">
                    Y settlement {y.settlement} · acquisition {y.acquisition} · audience {y.audience_response} · conversion {y.conversion} · revenue {y.revenue} · retention {y.retention}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => acquire(asset)}
                      disabled={busy === asset.id || asset.state === "escrow" || asset.state === "settled"}
                      className="h-11 px-6 rounded-full bg-emerald-600 text-sm disabled:opacity-50"
                    >
                      {asset.state === "escrow" || asset.state === "settled" ? "Acquired" : "Acquire"}
                    </button>
                    <button
                      onClick={() => buy(asset)}
                      className="h-11 px-6 rounded-full border border-zinc-700 text-sm"
                    >
                      Buy
                    </button>
                    <Link
                      href="/measurements"
                      className="h-11 px-6 rounded-full border border-zinc-700 text-sm inline-flex items-center"
                    >
                      Next B
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
        <button
          onClick={() => setOpenB((v) => !v)}
          className="w-full text-left bg-zinc-900/40 border border-dashed border-zinc-600 rounded-2xl p-6"
        >
          <p className="text-xs text-emerald-400 mb-2">
            {CLUSTER_B} · {CONTAINER_B} · {openB ? "open" : "closed"}
          </p>
          <h2 className="text-2xl font-semibold mb-1">{AGENT_B}</h2>
          <p className="text-sm text-zinc-500">Placeholder. No second live customer yet.</p>
        </button>
        {openB ? (
          <div className="mt-4 bg-zinc-900/40 border border-dashed border-zinc-700 rounded-2xl p-6">
            <p className="text-sm text-zinc-400 mb-4">
              Next best B is the first non-founder user who Create → Prove → Learn → Act. Until then B stays simulated.
            </p>
            <p className="text-sm text-zinc-500 mb-4">Y 0→0 · no_movement · not a live buyer</p>
            <Link href="/measurements" className="h-11 px-6 rounded-full border border-zinc-700 text-sm inline-flex items-center">
              Open B on Learn
            </Link>
          </div>
        ) : null}
        {note ? <p className="mt-6 text-sm text-emerald-400">{note}</p> : null}
      </main>
    </div>
  );
}