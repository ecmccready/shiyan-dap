"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { mergeInventory, proofInventory } from "@/lib/proof-catalog";

export default function MarketplacePage() {
  const [inventory, setInventory] = useState<any[]>(proofInventory);

  useEffect(() => {
    fetch("/api/marketplace")
      .then((res) => res.json())
      .then((data) => setInventory(mergeInventory(data.inventory)))
      .catch(() => setInventory(proofInventory));
  }, []);

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Marketplace" />
      <main className="max-w-6xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-6">Music Marketplace</h1>
        <div className="flex flex-wrap gap-3 mb-10">
          <Link href="/playlist" className="h-11 px-6 rounded-full bg-emerald-600 text-white text-sm font-medium inline-flex items-center">Playlist</Link>
          <Link href="/single" className="h-11 px-6 rounded-full border border-zinc-700 text-zinc-300 text-sm font-medium inline-flex items-center">Songs</Link>
          <Link href="/" className="h-11 px-6 rounded-full border border-zinc-700 text-zinc-300 text-sm font-medium inline-flex items-center">Shiyan AI Assist</Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {inventory.map((cluster) => (
            <div key={cluster.id} className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
              <h2 className="text-lg font-semibold">{cluster.name}</h2>
              <p className="text-sm text-zinc-400 mt-1">{cluster.domain} · {cluster.owner}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
