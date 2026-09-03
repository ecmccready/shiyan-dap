"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function SinglePackagePage() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch("/api/agent?domain=music-video&path=fast")
      .then((res) => res.json())
      .then(setData)
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-zinc-800/80">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="font-semibold tracking-tight text-lg">
              Shiyan Yishu
            </Link>
            <span className="text-zinc-500 text-sm">First Single</span>
          </div>
          <nav className="flex items-center gap-6">
            <Link href="/home" className="text-sm text-zinc-400 hover:text-white">Home</Link>
            <Link href="/playlist" className="text-sm text-zinc-400 hover:text-white">Playlist</Link>
            <Link href="/marketplace" className="text-sm text-zinc-400 hover:text-white">Marketplace</Link>
            <Link href="/bot" className="text-sm text-zinc-400 hover:text-white">Grok Bot</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-sm text-emerald-400 mb-3">Launch vehicle · Music cash-flow</p>
        <h1 className="text-4xl font-bold tracking-tight mb-4">
          Shiyan Yishu — First Single
        </h1>
        <p className="text-zinc-400 text-lg max-w-2xl mb-10 leading-relaxed">
          The single can sell before the finished audio exists. You keep the
          data. Ads pay you and the engine. Playlist is the checkout.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5">
            <p className="text-xs text-zinc-500 mb-1">x Acquire</p>
            <p className="font-semibold">Social Transmedia</p>
          </div>
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5">
            <p className="text-xs text-zinc-500 mb-1">y Retain</p>
            <p className="font-semibold">Marketplace</p>
          </div>
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5">
            <p className="text-xs text-zinc-500 mb-1">z Transfer</p>
            <p className="font-semibold">Playlist rail</p>
          </div>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-8 mb-8">
          <p className="text-sm text-emerald-400 mb-4">Live cluster</p>
          <p className="text-xl font-semibold mb-2">
            {data?.cluster?.name || "Music Video × music video"}
          </p>
          <p className="text-sm text-zinc-400 mb-2">
            Owner: {data?.artist || "ECMcCready"} · Token: {data?.token?.symbol || "MVID"}
          </p>
          {data?.adPayout && (
            <p className="text-sm text-emerald-400 mb-2">
              Ad pay · User ${data.adPayout.userPayout} · Engine ${data.adPayout.enginePayout}
            </p>
          )}
          {data?.playlist && (
            <p className="text-sm text-zinc-400">
              Settles on: {data.playlist.name}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          <Link href="/home" className="h-11 px-6 rounded-full bg-emerald-600 text-white text-sm font-medium flex items-center">
            Add lyrics / hook
          </Link>
          <Link href="/playlist" className="h-11 px-6 rounded-full bg-amber-600 text-white text-sm font-medium flex items-center">
            Settle on Playlist
          </Link>
          <Link href="/marketplace" className="h-11 px-6 rounded-full bg-zinc-800 text-white text-sm font-medium flex items-center">
            List in Marketplace
          </Link>
        </div>
      </main>
    </div>
  );
}