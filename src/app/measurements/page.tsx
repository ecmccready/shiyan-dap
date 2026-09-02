"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function MeasurementsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/agent?domain=music&path=deep")
      .then((res) => res.json())
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="min-h-screen bg-black text-white flex items-center justify-center"><p className="text-zinc-400">Loading measurements…</p></div>;
  }

  const metrics = data?.self_improvement || {};

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-zinc-800/80">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="font-semibold tracking-tight text-lg">Shiyan Yishu</Link>
            <span className="text-zinc-500 text-sm">Measurements</span>
          </div>
          <nav className="flex items-center gap-6">
            <Link href="/home" className="text-sm text-zinc-400 hover:text-white">Home</Link>
            <Link href="/single" className="text-sm text-zinc-400 hover:text-white">Single</Link>
            <Link href="/playlist" className="text-sm text-zinc-400 hover:text-white">Playlist</Link>
            <Link href="/marketplace" className="text-sm text-zinc-400 hover:text-white">Marketplace</Link>
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight mb-2">.self() Measurements</h1>
        <p className="text-zinc-400 mb-10">The protocol measures itself from domain input and disagreement.</p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6"><p className="text-sm text-zinc-400">Outcomes</p><p className="text-2xl font-semibold">{metrics.count ?? 0}</p></div>
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6"><p className="text-sm text-zinc-400">Avg π<sub>inv</sub></p><p className="text-2xl font-semibold">{metrics.avg_pi_inv ?? "—"}</p></div>
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6"><p className="text-sm text-zinc-400">Path</p><p className="text-2xl font-semibold">{data?.model?.path}</p></div>
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6"><p className="text-sm text-zinc-400">z</p><p className="text-2xl font-semibold">{data?.emergence?.z ?? "—"}</p></div>
        </div>
      </main>
    </div>
  );
}