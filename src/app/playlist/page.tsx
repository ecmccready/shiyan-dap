"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function PlaylistPage() {
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/playlist")
      .then((res) => res.json())
      .then((data) => {
        setPlaylists(data.playlists || []);
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
            <Link href="/home" className="text-sm text-zinc-400 hover:text-white transition-colors">
              Home
            </Link>
            <Link href="/marketplace" className="text-sm text-zinc-400 hover:text-white transition-colors">
              Marketplace
            </Link>
            <Link href="/tokens" className="text-sm text-zinc-400 hover:text-white transition-colors">
              Tokens
            </Link>
            <Link href="/bot" className="text-sm text-zinc-400 hover:text-white transition-colors">
              Grok Bot
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Label Playlist</h1>
        <p className="text-zinc-400 mb-10">
          Music clusters collected into the launch-vehicle playlist.
        </p>

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