"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function PlaylistPage() {
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [emergence, setEmergence] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/playlist").then((res) => res.json()),
      fetch("/api/agent?domain=music&path=fast").then((res) => res.json()),
    ])
      .then(([playlistData, agentData]) => {
        setPlaylists(playlistData.playlists || []);
        setEmergence(agentData.emergence || null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="min-h-screen bg-black text-white flex items-center justify-center"><p className="text-zinc-400">Loading playlists…</p></div>;
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-zinc-800/80">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="font-semibold tracking-tight text-lg">Shiyan Yishu</Link>
            <span className="text-zinc-500 text-sm">Label Playlist</span>
          </div>
          <nav className="flex items-center gap-6">
            <Link href="/home" className="text-sm text-zinc-400 hover:text-white">Home</Link>
            <Link href="/single" className="text-sm text-zinc-400 hover:text-white">Single</Link>
            <Link href="/marketplace" className="text-sm text-zinc-400 hover:text-white">Marketplace</Link>
            <Link href="/bot" className="text-sm text-zinc-400 hover:text-white">Grok Bot</Link>
          </nav>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Label Playlist</h1>
        <p className="text-zinc-400 mb-8">z-axis settlement rail. The playlist is the checkout.</p>
        {emergence && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5"><p className="text-xs text-zinc-500">x Acquire</p><p className="text-lg font-semibold">{emergence.x}</p></div>
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5"><p className="text-xs text-zinc-500">y Retain</p><p className="text-lg font-semibold">{emergence.y}</p></div>
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5"><p className="text-xs text-zinc-500">z Transfer</p><p className="text-lg font-semibold">{emergence.z}</p></div>
          </div>
        )}
        {playlists.map((playlist) => (
          <div key={playlist.id} className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 mb-6">
            <h2 className="text-xl font-semibold mb-2">{playlist.name}</h2>
            <p className="text-sm text-emerald-400">{playlist.clusterIds?.length || 0} clusters</p>
          </div>
        ))}
      </main>
    </div>
  );
}