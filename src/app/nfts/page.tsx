"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function MyNFTsPage() {
  const [nfts, setNfts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/nft")
      .then((res) => res.json())
      .then((data) => {
        setNfts(data.nfts || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="min-h-screen bg-black text-white flex items-center justify-center"><p className="text-zinc-400">Loading your NFTs…</p></div>;
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-zinc-800/80">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="font-semibold tracking-tight text-lg">Shiyan Yishu</Link>
            <span className="text-zinc-500 text-sm">My NFTs</span>
          </div>
          <nav className="flex items-center gap-6">
            <Link href="/marketplace" className="text-sm text-zinc-400 hover:text-white">Marketplace</Link>
            <Link href="/playlist" className="text-sm text-zinc-400 hover:text-white">Playlist</Link>
            <Link href="/single" className="text-sm text-zinc-400 hover:text-white">Single</Link>
            <Link href="/home" className="text-sm text-zinc-400 hover:text-white">Home</Link>
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight mb-2">My NFTs</h1>
        <p className="text-zinc-400 mb-10">Clusters minted from the Missing Middle Marketplace.</p>
        {nfts.length === 0 ? (
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-12 text-center">
            <p className="text-zinc-400 mb-4">No NFTs minted yet.</p>
            <Link href="/marketplace" className="inline-block px-6 h-11 leading-[44px] rounded-full bg-purple-600 text-white text-sm">Go to Marketplace</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {nfts.map((nft) => (
              <div key={nft.id} className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
                <h2 className="text-lg font-semibold">{nft.metadata?.name || "Unnamed Cluster"}</h2>
                <p className="text-sm text-zinc-400 mt-2">{nft.owner}</p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}