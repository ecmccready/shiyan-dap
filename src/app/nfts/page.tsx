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
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-zinc-400">Loading your NFTs…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-zinc-800/80">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="font-semibold tracking-tight text-lg">
              Shiyan Yishu
            </Link>
            <span className="text-zinc-500 text-sm">My NFTs</span>
          </div>

          <nav className="flex items-center gap-8">
  <Link href="/dashboard" className="text-sm text-zinc-400 hover:text-white transition-colors duration-200">
    Dashboard
  </Link>
  <Link href="/marketplace" className="text-sm text-zinc-400 hover:text-white transition-colors duration-200">
    Marketplace
  </Link>
  <Link href="/tokens" className="text-sm text-zinc-400 hover:text-white transition-colors duration-200">
    Tokens
  </Link>
  <Link href="/nfts" className="text-sm text-zinc-400 hover:text-white transition-colors duration-200">
    My NFTs
  </Link>
  <Link href="/upload" className="text-sm text-zinc-400 hover:text-white transition-colors duration-200">
    Upload
  </Link>
  <Link href="/track/shiyan-yishu" className="text-sm text-zinc-400 hover:text-white transition-colors duration-200">
    Music Track →
  </Link>
  <Link
  href="/measurements"
  className="text-sm text-zinc-400 hover:text-white transition-colors duration-200"
>
  Measurements
</Link>
<Link
  href="/bot"
  className="text-sm text-zinc-400 hover:text-white transition-colors duration-200"
>
  Grok Bot
</Link>
</nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight mb-2">My NFTs</h1>
          <p className="text-zinc-400">
            Clusters you have minted from the Missing Middle Marketplace.
          </p>
        </div>

        {nfts.length === 0 ? (
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-12 text-center">
            <p className="text-zinc-400 mb-4">No NFTs minted yet.</p>
            <Link
              href="/marketplace"
              className="inline-block px-6 h-11 leading-[44px] rounded-full bg-purple-600 text-white text-sm font-medium hover:bg-purple-500 transition-colors"
            >
              Go to Marketplace
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {nfts.map((nft) => (
              <div
                key={nft.id}
                className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <h2 className="text-lg font-semibold">
                    {nft.metadata?.name || "Unnamed Cluster"}
                  </h2>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-purple-900/50 text-purple-300">
                    {nft.status}
                  </span>
                </div>

                <p className="text-sm text-zinc-400 mb-4 line-clamp-2">
                  {nft.metadata?.description}
                </p>

                <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                  <div>
                    <p className="text-zinc-500 text-xs">Domain</p>
                    <p>{nft.metadata?.properties?.domain}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500 text-xs">Owner</p>
                    <p>{nft.owner}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500 text-xs">π<sub>inv</sub></p>
                    <p>{nft.metadata?.properties?.pi_inv}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500 text-xs">Minted</p>
                    <p className="text-xs">
                      {new Date(nft.mintedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {nft.metadata?.properties?.tags?.map(
                    (tag: string, i: number) => (
                      <span
                        key={`${tag}-${i}`}
                        className="text-xs px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-300"
                      >
                        {tag}
                      </span>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}