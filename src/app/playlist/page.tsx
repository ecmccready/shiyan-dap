"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import RailLinks from "@/components/RailLinks";
import { LedgerAsset, readLedger, wasAcquired } from "@/lib/ledger";

export default function PlaylistPage() {
  const [assets, setAssets] = useState<LedgerAsset[]>([]);
  const [note, setNote] = useState("");

  useEffect(() => {
    setAssets(
      readLedger().map((a) =>
        wasAcquired(a.id) ? { ...a, buyer: "This session", state: "reserved" } : a
      )
    );
  }, []);

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Playlist" />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-3">Playlist</h1>
        <p className="text-zinc-400 mb-8 max-w-3xl">
          Transfer rail. The same assets from Upload and Marketplace move here for sync, games, and labels.
        </p>
        <div className="mb-10">
          <RailLinks />
        </div>
        <div className="space-y-6">
          {assets.map((asset) => (
            <div key={asset.id} className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
              <p className="text-xs text-emerald-400 mb-2">{asset.founder ? "Founder proof" : "Creator project"}</p>
              <h2 className="text-xl font-semibold mb-2">{asset.title}</h2>
              <p className="text-sm text-zinc-400 mb-5">{asset.id} · {asset.state}</p>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setNote("Licensed " + asset.title + " for sync")} className="h-10 px-4 rounded-full border border-zinc-700 text-sm">Sync</button>
                <button onClick={() => setNote("Licensed " + asset.title + " for games")} className="h-10 px-4 rounded-full border border-zinc-700 text-sm">Games</button>
                <button onClick={() => setNote("Licensed " + asset.title + " for labels")} className="h-10 px-4 rounded-full border border-zinc-700 text-sm">Labels</button>
                <Link href="/nfts" className="h-10 px-4 rounded-full bg-emerald-600 text-white text-sm inline-flex items-center">Acquire</Link>
              </div>
            </div>
          ))}
        </div>
        {note && <p className="mt-6 text-sm text-emerald-400">{note}</p>}
      </main>
    </div>
  );
}