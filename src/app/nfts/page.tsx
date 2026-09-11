"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { LedgerAsset, markAcquired, readLedger } from "@/lib/ledger";

export default function ProvePage() {
  const [assets, setAssets] = useState<LedgerAsset[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    setAssets(readLedger());
    const paid = new URLSearchParams(window.location.search).get("paid");
    if (paid === "1") setNote("Stripe returned success. Live paid is still false until sk_live.");
    if (paid === "0") setNote("Checkout canceled.");
  }, []);

  const acquire = async (asset: LedgerAsset) => {
    setBusy(asset.id);
    try {
      await fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId: asset.id, title: asset.title, action: "INITIATE_TRADE" }),
      });
    } catch {}
    markAcquired(asset.id);
    setAssets(readLedger());
    setBusy(null);
  };

  const buy = async (asset: LedgerAsset) => {
    setNote("Opening Stripe for " + asset.title);
    try {
      const res = await fetch("/api/checkout", { method: "POST" });
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
        <p className="text-emerald-400 mb-3">Prove</p>
        <h1 className="text-3xl font-bold mb-3">Tokenized assets</h1>
        <p className="text-zinc-400 mb-8">
          First Single and Sleep Terrors. Acquire is INITIATE_TRADE. Buy is Stripe. MIDI can come later.
        </p>
        <div className="space-y-6">
          {assets.map((asset) => (
            <div key={asset.id} className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
              <p className="text-xs text-emerald-400 mb-2">{asset.founder ? "Official single" : "Creator project"}</p>
              <h2 className="text-xl font-semibold mb-4">{asset.title}</h2>
              <p className="text-sm text-zinc-400 mb-1">Asset ID {asset.id}</p>
              <p className="text-sm text-zinc-400 mb-1">Creator {asset.creator}</p>
              <p className="text-sm text-zinc-400 mb-1">Buyer {asset.buyer}</p>
              <p className="text-sm text-zinc-400 mb-5">State {asset.state}</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => acquire(asset)}
                  disabled={busy === asset.id || asset.state === "escrow" || asset.state === "settled"}
                  className="h-11 px-6 rounded-full bg-emerald-600 text-sm disabled:opacity-50"
                >
                  {asset.state === "escrow" || asset.state === "settled" ? "Acquired" : busy === asset.id ? "Acquiring..." : "Acquire"}
                </button>
                <button onClick={() => buy(asset)} className="h-11 px-6 rounded-full border border-zinc-700 text-sm">
                  Buy
                </button>
                <Link href="/playlist" className="h-11 px-6 rounded-full border border-zinc-700 text-sm inline-flex items-center">
                  Transfer
                </Link>
              </div>
            </div>
          ))}
        </div>
        {note && <p className="mt-6 text-sm text-emerald-400">{note}</p>}
      </main>
    </div>
  );
}