"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { FIRST_SINGLE_URL, mergePlaylists, proofPlaylists } from "@/lib/proof-catalog";

export default function PlaylistPage() {
  const [playlists, setPlaylists] = useState<any[]>(proofPlaylists);
  const [message, setMessage] = useState("");

  const load = async () => {
    try {
      const data = await fetch("/api/playlist").then((res) => res.json());
      setPlaylists(mergePlaylists(data.playlists));
    } catch {
      setPlaylists(proofPlaylists);
    }
  };

  useEffect(() => { load(); }, []);

  const license = async (id: string, use: string) => {
    const res = await fetch("/api/playlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, use }) });
    const data = await res.json();
    setMessage(data.message || "License prepared");
    load();
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="B2B Playlist" />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-2">Label Playlist</h1>
        <p className="text-zinc-400 mb-8">Proof first. Compiled B2B bundle for sync, games, and labels.</p>
        <a href={FIRST_SINGLE_URL} target="_blank" rel="noreferrer" className="inline-flex h-9 px-4 rounded-full bg-emerald-600 text-white text-xs font-medium items-center mb-8">Open Shiyan Yishu</a>
        {message && <div className="mb-6 p-4 rounded-xl bg-zinc-900 border border-zinc-800 text-sm">{message}</div>}
        {playlists.map((playlist) => (
          <div key={playlist.id} className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 mb-6">
            <h2 className="text-xl font-semibold">{playlist.name}</h2>
            <p className="text-sm text-zinc-400 mt-1">{playlist.productType} · {playlist.license}</p>
            <div className="flex flex-wrap gap-3 mt-5">
              <button onClick={() => license(playlist.id, "sync")} className="h-10 px-4 rounded-full bg-emerald-600 text-white text-sm">License for Sync</button>
              <button onClick={() => license(playlist.id, "game")} className="h-10 px-4 rounded-full bg-amber-600 text-white text-sm">License for Games</button>
              <button onClick={() => license(playlist.id, "label")} className="h-10 px-4 rounded-full bg-zinc-800 text-white text-sm">License for Labels</button>
              <Link href="/bot" className="h-10 px-4 rounded-full border border-zinc-700 text-zinc-300 text-sm inline-flex items-center">Grok Bot</Link>
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}
