"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import RailLinks from "@/components/RailLinks";
import { LedgerAsset, readLedger, wasAcquired } from "@/lib/ledger";

const classes = [
  { title: "Song", href: "/single", note: "Music wedge" },
  { title: "Playlist", href: "/playlist", note: "Transfer rail" },
  { title: "Video", href: "/single", note: "Same asset, new surface" },
];

export default function MarketplacePage() {
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
      <SiteHeader section="Marketplace" />
      <main className="max-w-6xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-3">Music Marketplace</h1>
        <p className="text-zinc-400 max-w-3xl mb-8">
          Creators put work on the ledger. Buyers acquire it. Music is first. The same rails can carry video, writing, and other AI-native work later.
        </p>
        <div className="mb-10">
          <RailLinks />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {classes.map((item) => (
            <Link key={item.title} href={item.href} className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-8 hover:border-emerald-700">
              <h2 className="text-2xl font-semibold">{item.title}</h2>
              <p className="text-sm text-zinc-500 mt-2">{item.note}</p>
            </Link>
          ))}
        </div>
        <h2 className="text-lg font-semibold mb-4">On the shelf</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {assets.map((asset) => (
            <div key={asset.id} className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
              <p className="text-xs text-emerald-400 mb-2">{asset.founder ? "Founder proof" : "Creator project"}</p>
              <h3 className="text-xl font-semibold mb-2">{asset.title}</h3>
              <p className="text-sm text-zinc-400">{asset.creator} · {asset.state}</p>
              <Link href="/nfts" className="inline-flex mt-5 h-10 px-5 rounded-full bg-emerald-600 text-white text-sm items-center">
                {asset.state === "reserved" ? "View proof" : "Acquire"}
              </Link>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}