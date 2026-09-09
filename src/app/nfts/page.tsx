"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { LedgerAsset, markAcquired, readLedger, wasAcquired } from "@/lib/ledger";

export default function ProvePage() {
  const [assets, setAssets] = useState<LedgerAsset[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    setAssets(
      readLedger().map((a) =>
        wasAcquired(a.id) ? { ...a, buyer: "This session", state: "reserved" } : a
      )
    );
  }, []);

  const acquire = async (asset: LedgerAsset) => {
    setBusy(asset.id);
    try {
      await fetch("/api/bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Acquire " + asset.title, domain: "music" }),
      });
    } catch {}
    markAcquired(asset.id);
    setAssets((prev) => prev.map((a) => (a.id === asset.id ? { ...a, buyer: "This session", state: "reserved" } : a)));
    setBusy(null);
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Prove" />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-emerald-400 mb-3">Prove</p>
        <h1 className="text-3xl font-bold mb-3">Tokenized assets</h1>
        <p className="text-zinc-400 mb-8">Founder First Single stays first. Any upload can be acquired on the same ledger.</p>
        <div className="space-y-6">
          {assets.map((asset) => (
            <div key={asset.id} className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
              <p className="text-xs text-emerald-400 mb-2">{asset.founder ? "Founder proof" : "Creator project"}</p>
              <h2 className="text-xl font-semibold mb-4">{asset.title}</h2>
              <p className="text-sm text-zinc-400 mb-1">Asset ID {asset.id}</p>
              <p className="text-sm text-zinc-400 mb-1">Creator {asset.creator}</p>
              <p className="text-sm text-zinc-400 mb-1">Source {asset.source}</p>
              <p className="text-sm text-zinc-400 mb-1">Buyer {asset.buyer}</p>
              <p className="text-sm text-zinc-400 mb-5">State {asset.state}</p>
              <button onClick={() => acquire(asset)} disabled={busy === asset.id || asset.state === "reserved"} className="h-11 px-6 rounded-full bg-emerald-600 text-sm disabled:opacity-50">
                {asset.state === "reserved" ? "Acquired" : busy === asset.id ? "Acquiring..." : "Acquire"}
              </button>
            </div>
          ))}
        </div>
        <Link href="/upload" className="inline-block mt-8 text-sm text-zinc-500">Open another project</Link>
      </main>
    </div>
  );
}
