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
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-zinc-400">Loading playlists…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-zinc-800/80">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="font-semibold tracking-tight text-lg">
              Shiyan Yishu
            </Link>
            <span className="text-zinc-500 text-sm">Label Playlist</span>
          </div>
          <nav className="flex items-center gap-6">
            <Link href="/home" className="text-sm text-zinc-400 hover:text-white">Home</Link>
            <Link href="/marketplace" className="text-sm text-zinc-400 hover:text-white">Marketplace</Link>
            <Link href="/tokens" className="text-sm text-zinc-400 hover:text-white">Tokens</Link>
            <Link href="/single" className="text-sm text-zinc-400 hover:text-white">Single</Link>
            <Link href="/bot" className="text-sm text-zinc-400 hover:text-white">Grok Bot</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Label Playlist</h1>
        <p className="text-zinc-400 mb-8">
          z-axis settlement rail. The playlist is the checkout.
        </p>

        {emergence && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5">
              <p className="text-xs text-zinc-500 mb-1">x Acquire</p>
              <p className="text-lg font-semibold">{emergence.x}</p>
              <p className="text-xs text-zinc-500 mt-1">Social Transmedia</p>
            </div>
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5">
              <p className="text-xs text-zinc-500 mb-1">y Retain</p>
              <p className="text-lg font-semibold">{emergence.y}</p>
              <p className="text-xs text-zinc-500 mt-1">Marketplace</p>
            </div>
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5">
              <p className="text-xs text-zinc-500 mb-1">z Transfer</p>
              <p className="text-lg font-semibold">{emergence.z}</p>
              <p className="text-xs text-zinc-500 mt-1">Playlist rail · acc {emergence.accumulated}</p>
            </div>
          </div>
        )}

        {playlists.length === 0 ? (
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-12 text-center">
            <p className="text-zinc-400">No playlists yet. Submit a Music idea on Home.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {playlists.map((playlist) => (
              <div
                key={playlist.id}
                className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6"
              >
                <h2 className="text-xl font-semibold mb-2">{playlist.name}</h2>
                <p className="text-sm text-zinc-400 mb-4">
                  Owner: {playlist.owner} · Domain: {playlist.domain}
                </p>
                <p className="text-sm text-emerald-400 mb-3">
                  {playlist.clusterIds?.length || 0} cluster
                  {playlist.clusterIds?.length === 1 ? "" : "s"}
                </p>
                <div className="space-y-2">
                  {(playlist.clusterIds || []).map((id: string) => (
                    <div
                      key={id}
                      className="text-xs px-3 py-2 rounded-lg bg-zinc-800 text-zinc-300"
                    >
                      {id}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}