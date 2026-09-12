"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { LedgerAsset, applyEvent, markAcquired, readLedger } from "@/lib/ledger";

const CLUSTER = "cluster:A";
const CONTAINER = "container:founder-music";
const AGENT = "Agent A · ECMcCready";

export default function ProvePage() {
  const [assets, setAssets] = useState<LedgerAsset[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState("");

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
          agent: AGENT,
          cluster: CLUSTER,
          paid: false,
        }),
      }).catch(() => {});
      setNote("Settled in this browser. Live paid stays false until Stripe is live.");
    }
    if (paid === "0") setNote("Checkout canceled.");
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
          agent: AGENT,
          cluster: CLUSTER,
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
        body: JSON.stringify({ assetId: asset.id, title: asset.title, cluster: CLUSTER }),
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
        <p className="text-emerald-400 mb-3">A cluster · Music · founder</p>
        <h1 className="text-3xl font-bold mb-3">Proven content</h1>
        <p className="text-zinc-400 mb-8">
          Contained as {CONTAINER}. Same IDs Learn measures as Agent A.
        </p>
        <div className="space-y-6">
          {assets.map((asset) => (
            <div key={asset.id} className="bg-zinc-900/60 border border-emerald-800 rounded-2xl p-6">
              <p className="text-xs text-emerald-400 mb-2">{CLUSTER} · official single</p>
              <h2 className="text-xl font-semibold mb-4">{asset.title}</h2>
              <p className="text-sm text-zinc-400 mb-1">id {asset.id}</p>
              <p className="text-sm text-zinc-400 mb-1">container {CONTAINER}</p>
              <p className="text-sm text-zinc-400 mb-1">agent {AGENT}</p>
              <p className="text-sm text-zinc-400 mb-1">domain Music</p>
              <p className="text-sm text-zinc-400 mb-1">creator {asset.creator}</p>
              <p className="text-sm text-zinc-400 mb-5">state {asset.state}</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => acquire(asset)}
                  disabled={busy === asset.id || asset.state === "escrow" || asset.state === "settled"}
                  className="h-11 px-6 rounded-full bg-emerald-600 text-sm disabled:opacity-50"
                >
                  {asset.state === "escrow" || asset.state === "settled"
                    ? "Acquired"
                    : busy === asset.id
                    ? "Acquiring..."
                    : "Acquire"}
                </button>
                <button
                  onClick={() => buy(asset)}
                  className="h-11 px-6 rounded-full border border-zinc-700 text-sm"
                >
                  Buy
                </button>
                <Link
                  href={"/measurements"}
                  className="h-11 px-6 rounded-full border border-zinc-700 text-sm inline-flex items-center"
                >
                  Measure in A
                </Link>
              </div>
            </div>
          ))}
        </div>
        {note ? <p className="mt-6 text-sm text-emerald-400">{note}</p> : null}
      </main>
    </div>
  );
}