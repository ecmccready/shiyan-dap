"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import RailLinks from "@/components/RailLinks";
import { LedgerAsset, readLedger, wasAcquired } from "@/lib/ledger";

export default function MeasurePage() {
  const [assets, setAssets] = useState<LedgerAsset[]>([]);

  useEffect(() => {
    setAssets(
      readLedger().map((a) =>
        wasAcquired(a.id) ? { ...a, buyer: "This session", state: "reserved" } : a
      )
    );
  }, []);

  const reserved = assets.filter((a) => a.state === "reserved").length;

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Measure" />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-emerald-400 mb-3">Measure</p>
        <h1 className="text-3xl font-bold mb-3">Traction</h1>
        <p className="text-zinc-400 mb-8">
          Count assets and acquires. This is structural activity, not social metrics.
        </p>
        <div className="mb-10">
          <RailLinks />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
            <p className="text-xs text-zinc-500 mb-2">Assets on ledger</p>
            <p className="text-3xl font-bold">{assets.length}</p>
          </div>
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
            <p className="text-xs text-zinc-500 mb-2">Acquires</p>
            <p className="text-3xl font-bold">{reserved}</p>
          </div>
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
            <p className="text-xs text-zinc-500 mb-2">Paid buyers</p>
            <p className="text-3xl font-bold">0</p>
          </div>
        </div>
        <div className="space-y-4">
          {assets.map((asset) => (
            <div key={asset.id} className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold">{asset.title}</p>
                <p className="text-sm text-zinc-500">{asset.state} · {asset.buyer}</p>
              </div>
              <Link href="/nfts" className="h-10 px-4 rounded-full bg-emerald-600 text-white text-sm inline-flex items-center">Open</Link>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}