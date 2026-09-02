"use client";

import Link from "next/link";

export default function SinglePackagePage() {
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
        <p className="text-sm text-emerald-400 mb-3">Launch vehicle · in development</p>
        <h1 className="text-4xl font-bold tracking-tight mb-4">
          Shiyan Yishu — First Single
        </h1>
        <p className="text-zinc-400 text-lg max-w-2xl mb-10 leading-relaxed">
          A song + story can become an owned asset before the finished audio
          exists. You keep the data. The protocol may learn. You own the asset.
          Settlement happens on the playlist, not on a streaming middleman.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5">
            <p className="text-xs text-zinc-500 mb-1">x Acquire</p>
            <p className="font-semibold">Social Transmedia</p>
            <p className="text-sm text-zinc-400 mt-2">Share the song + story.</p>
          </div>
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5">
            <p className="text-xs text-zinc-500 mb-1">y Retain</p>
            <p className="font-semibold">Marketplace</p>
            <p className="text-sm text-zinc-400 mt-2">Cluster becomes inventory.</p>
          </div>
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5">
            <p className="text-xs text-zinc-500 mb-1">z Transfer</p>
            <p className="font-semibold">Playlist rail</p>
            <p className="text-sm text-zinc-400 mt-2">The playlist is the checkout.</p>
          </div>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-8 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div>
              <p className="text-zinc-500 mb-1">What this is</p>
              <p>A pre-production single package that can be listed, tokenized, and settled.</p>
            </div>
            <div>
              <p className="text-zinc-500 mb-1">Who owns the data</p>
              <p>The creator. Protocol owner: ECMcCready.</p>
            </div>
            <div>
              <p className="text-zinc-500 mb-1">How money moves</p>
              <p>Attention writes. Grok Bot can Buy / Sell / Trade. Playlist settles.</p>
            </div>
            <div>
              <p className="text-zinc-500 mb-1">Status</p>
              <p>Public protocol proof. Not a finished store yet.</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link href="/home" className="h-11 px-6 rounded-full bg-emerald-600 text-white text-sm font-medium flex items-center">
            Add a song or story
          </Link>
          <Link href="/playlist" className="h-11 px-6 rounded-full bg-amber-600 text-white text-sm font-medium flex items-center">
            Open Playlist
          </Link>
          <Link href="/marketplace" className="h-11 px-6 rounded-full bg-zinc-800 text-white text-sm font-medium flex items-center">
            View Marketplace
          </Link>
        </div>
      </main>
    </div>
  );
}