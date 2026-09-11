"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import RailLinks from "@/components/RailLinks";
import { LedgerAsset, readLedger } from "@/lib/ledger";

export default function SongsPage() {
  const [assets, setAssets] = useState<LedgerAsset[]>([]);

  useEffect(() => {
    setAssets(readLedger().filter((a) => a.id === "cl_shiyan_yishu_001" || a.id === "cl_sleep_terrors_001"));
  }, []);

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Release" />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-emerald-400 mb-3">SHOW</p>
        <h1 className="text-3xl font-bold mb-3">Songs</h1>
        <p className="text-zinc-400 mb-8">First Single and Sleep Terrors. Listen lives at ecmccready.com/songs.</p>
        <div className="mb-8">
          <RailLinks />
        </div>
        <div className="space-y-4">
          {assets.map((asset) => (
            <div key={asset.id} className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
              <p className="text-xs text-emerald-400 mb-2">User A · {asset.creator}</p>
              <h2 className="text-xl font-semibold mb-3">{asset.title}</h2>
              <p className="text-sm text-zinc-500 mb-6">State {asset.state}</p>
              <div className="flex flex-wrap gap-2">
                <a href="http://ecmccready.com/songs" className="h-11 px-6 rounded-full bg-emerald-600 text-sm inline-flex items-center">
                  Play
                </a>
                <Link href="/nfts" className="h-11 px-6 rounded-full border border-zinc-700 text-sm inline-flex items-center">
                  Prove
                </Link>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}