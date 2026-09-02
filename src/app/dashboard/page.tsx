"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Domain =
  | "music"
  | "music-video"
  | "visual"
  | "text"
  | "esports"
  | "social-transmedia"
  | "gameplay"
  | "animation"
  | "real-estate";

const domainList: Domain[] = [
  "music",
  "music-video",
  "visual",
  "social-transmedia",
  "gameplay",
  "animation",
  "real-estate",
  "esports",
];

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [domain, setDomain] = useState<Domain>("music");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/agent?domain=${domain}&path=deep`)
      .then((res) => res.json())
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [domain]);

  if (loading) {
    return <div className="min-h-screen bg-black text-white flex items-center justify-center"><p className="text-zinc-400">Loading agentic memory…</p></div>;
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-zinc-800/80">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="font-semibold tracking-tight text-lg">Shiyan Yishu</Link>
            <span className="text-zinc-500 text-sm">Dashboard</span>
          </div>
          <nav className="flex items-center gap-6">
            <Link href="/home" className="text-sm text-zinc-400 hover:text-white">Home</Link>
            <Link href="/marketplace" className="text-sm text-zinc-400 hover:text-white">Marketplace</Link>
            <Link href="/playlist" className="text-sm text-zinc-400 hover:text-white">Playlist</Link>
            <Link href="/single" className="text-sm text-zinc-400 hover:text-white">Single</Link>
            <Link href="/bot" className="text-sm text-zinc-400 hover:text-white">Grok Bot</Link>
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-12 space-y-10">
        <div className="flex flex-wrap gap-3">
          {domainList.map((d) => (
            <button key={d} onClick={() => setDomain(d)} className={`px-4 h-9 rounded-full text-sm ${domain === d ? "bg-emerald-600 text-white" : "bg-zinc-900 text-zinc-400 border border-zinc-800"}`}>
              {d}
            </button>
          ))}
        </div>
        <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-2xl p-8">
          <p className="text-sm text-emerald-400 mb-3">Inverting Policy</p>
          <p className="text-4xl font-bold">π<sub className="text-2xl">inv</sub> = {data?.pi_inv}</p>
          <p className="text-zinc-400 mt-2">Path: {data?.model?.path} · Secondary: {data?.model?.secondaryProvider || "none"}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6"><p className="text-sm text-zinc-400">Domain</p><p className="text-lg font-semibold">{data?.domain}</p></div>
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6"><p className="text-sm text-zinc-400">Provider</p><p className="text-lg font-semibold">{data?.model?.provider}</p></div>
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6"><p className="text-sm text-zinc-400">Disagreement</p><p className="text-lg font-semibold">{data?.model?.disagreement ?? 0}</p></div>
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6"><p className="text-sm text-zinc-400">Emergence z</p><p className="text-lg font-semibold">{data?.emergence?.z ?? "—"}</p></div>
        </div>
      </main>
    </div>
  );
}