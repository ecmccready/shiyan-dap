"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import RailLinks from "@/components/RailLinks";
import { LedgerAsset, applyEvent, readLedger } from "@/lib/ledger";

export default function MarketPage() {
  const [assets, setAssets] = useState<LedgerAsset[]>([]);

  useEffect(() => {
    setAssets(readLedger());
  }, []);

  const list = (id: string) => {
    applyEvent(id, "LIST");
    setAssets(readLedger());
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Market" />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-emerald-400 mb-3">KNOW</p>
        <h1 className="text-3xl font-bold mb-3">Music Marketplace</h1>
        <p className="text-zinc-400 mb-8">
          Internal ledger. User A lists. User B acquires. No chain.
        </p>
        <div className="mb-8">
          <RailLinks />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {assets.map((asset) => (
            <div key={asset.id} className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
              <p className="text-xs text-emerald-400 mb-2">{asset.founder ? "User A · founder" : "User B · creator"}</p>
              <h2 className="text-lg font-semibold mb-2">{asset.title}</h2>
              <p className="text-sm text-zinc-500 mb-1">Owner {asset.owner}</p>
              <p className="text-sm text-zinc-500 mb-4">State {asset.state}</p>
              {asset.state === "unlisted" || asset.state === "cancelled" ? (
                <button onClick={() => list(asset.id)} className="h-11 px-5 rounded-full bg-emerald-600 text-sm">
                  LIST
                </button>
              ) : (
                <Link href="/nfts" className="h-11 px-5 rounded-full border border-zinc-700 text-sm inline-flex items-center">
                  Prove
                </Link>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}