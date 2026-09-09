"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import RailLinks from "@/components/RailLinks";
import { LedgerAsset, readLedger, wasAcquired } from "@/lib/ledger";

export default function TrackPage() {
  const [assets, setAssets] = useState<LedgerAsset[]>([]);

  useEffect(() => {
    setAssets(
      readLedger().map((a) =>
        wasAcquired(a.id) ? { ...a, buyer: "This session", state: "reserved" } : a
      )
    );
  }, []);

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Measure" />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-emerald-400 mb-3">Audience response</p>
        <h1 className="text-3xl font-bold mb-3">Track</h1>
        <p className="text-zinc-400 mb-8">
          Watch the work after release. Response is acquire, license, and return — not likes.
        </p>
        <div className="mb-10">
          <RailLinks />
        </div>
        <div className="space-y-4">
          {assets.map((asset) => (
            <div key={asset.id} className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
              <p className="text-xs text-emerald-400 mb-2">{asset.founder ? "Founder proof" : "Creator project"}</p>
              <h2 className="text-xl font-semibold mb-2">{asset.title}</h2>
              <p className="text-sm text-zinc-400 mb-5">{asset.state} · {asset.buyer}</p>
              <Link href="/measurements" className="h-10 px-5 rounded-full bg-emerald-600 text-white text-sm inline-flex items-center">
                Open traction
              </Link>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}