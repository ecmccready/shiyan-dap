"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function PlaylistPage() {
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [emergence, setEmergence] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const playlistData = await fetch("/api/playlist").then((res) => res.json());
    setPlaylists(playlistData.playlists || []);
    setEmergence({ x: 0.8, y: 0.54, z: 1.2, accumulated: 0.2 });
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const license = async (id: string, use: string) => {
    const res = await fetch("/api/playlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, use }),
    });
    const data = await res.json();
    setMessage(data.message || "License prepared");
    load();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-zinc-400">Loading playlist bundle…</p>
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
            <Link href="/single" className="text-sm text-zinc-400 hover:text-white">Single</Link>
            <Link href="/upload" className="text-sm text-zinc-400 hover:text-white">Upload</Link>
            <Link href="/marketplace" className="text-sm text-zinc-400 hover:text-white">Marketplace</Link>
            <Link href="/bot" className="text-sm text-zinc-400 hover:text-white">Grok Bot</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Label Playlist</h1>
        <p className="text-zinc-400 mb-8">
          Not a song list. A compiled bundle for sync, games, and labels.
          Businesses license the playlist. The engine splits pay.
        </p>

        {emergence && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5">
              <p className="text-xs text-zinc-500">x Acquire</p>
              <p className="text-lg font-semibold">{emergence.x}</p>
            </div>
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5">
              <p className="text-xs text-zinc-500">y Retain</p>
              <p className="text-lg font-semibold">{emergence.y}</p>
            </div>
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5">
              <p className="text-xs text-zinc-500">z Transfer</p>
              <p className="text-lg font-semibold">{emergence.z}</p>
            </div>
          </div>
        )}

        {message && (
          <div className="mb-6 p-4 rounded-xl bg-zinc-900 border border-zinc-800 text-sm">
            {message}
          </div>
        )}

        {playlists.map((playlist) => (
          <div
            key={playlist.id}
            className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 mb-6"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold">{playlist.name}</h2>
                <p className="text-sm text-zinc-400 mt-1">
                  {playlist.productType} · {playlist.license} ·{" "}
                  {playlist.b2bReady ? "B2B ready" : "assembling"}
                </p>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-amber-900/40 text-amber-300">
                z rail
              </span>
            </div>

                        <p className="text-sm text-emerald-400 mb-3">
              {playlist.clusterIds?.length || 0} packaged cluster
              {playlist.clusterIds?.length === 1 ? "" : "s"}
            </p>
            <div className="space-y-2 mb-5">
              {(playlist.clusterIds || []).map((id: string) => (
                <div
                  key={id}
                  className="text-xs px-3 py-2 rounded-lg bg-zinc-800 text-zinc-300"
                >
                  {id}
                </div>
              ))}
            </div>

            <div className="space-y-2 mb-5">
              {(playlist.attribution || []).map((row: any) => (
                <p key={row.owner} className="text-xs text-zinc-400">
                  Attribution · {row.owner} · {Math.round(row.share * 100)}%
                </p>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => license(playlist.id, "sync")}
                className="h-10 px-4 rounded-full bg-emerald-600 text-white text-sm"
              >
                License for Sync
              </button>
              <button
                onClick={() => license(playlist.id, "game")}
                className="h-10 px-4 rounded-full bg-amber-600 text-white text-sm"
              >
                License for Games
              </button>
              <button
                onClick={() => license(playlist.id, "label")}
                className="h-10 px-4 rounded-full bg-zinc-800 text-white text-sm"
              >
                License for Labels
              </button>
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}