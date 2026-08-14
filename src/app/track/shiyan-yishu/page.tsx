"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function ShiyanYishuTrackPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/agent")
      .then((res) => res.json())
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-zinc-400">Loading agentic memory…</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-red-400">Agent failed to respond</p>
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
            <span className="text-zinc-500 text-sm">Track</span>
          </div>

          <nav className="flex items-center gap-8">
            <Link
              href="/dashboard"
              className="text-sm text-zinc-400 hover:text-white transition-colors duration-200"
            >
              Dashboard
            </Link>
            <Link
              href="/upload"
              className="text-sm text-zinc-400 hover:text-white transition-colors duration-200"
            >
              Upload
            </Link>
            <Link
              href="/"
              className="text-sm text-zinc-400 hover:text-white transition-colors duration-200"
            >
              Home
            </Link>
          </nav>
        </div>

        <div className="max-w-6xl mx-auto px-6 pb-10 pt-2">
  <h1 className="text-4xl font-bold tracking-tight">{data.title}</h1>
  <p className="text-zinc-400 mt-2">
    by {data.artist}
    {data.domain && (
      <span className="ml-3 text-xs text-emerald-500/80">
        · {data.domain}
      </span>
    )}
  </p>
</div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12 space-y-14">
        {/* Miller Pyramid */}
        <section>
          <h2 className="text-lg font-semibold mb-6 text-emerald-400 tracking-wide">
            Miller Pyramid
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {Object.entries(data.pyramid).map(([key, value]: any) => (
              <div
                key={key}
                className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6"
              >
                <h3 className="text-sm font-medium text-emerald-400 mb-1">
                  {value.level}
                </h3>
                <p className="text-xs text-zinc-500 mb-4">{value.description}</p>
                <div className="text-sm text-zinc-300 space-y-1.5">
                  {Object.entries(value.content).map(([k, v]) => (
                    <div key={k} className="flex gap-2">
                      <span className="text-zinc-500 shrink-0">{k}:</span>
                      <span className="break-words">
                        {Array.isArray(v) ? v.join(", ") : String(v)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Cluster + Policy */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
            <h3 className="text-sm font-medium text-blue-400 mb-3">
              Cluster (Show)
            </h3>
            <p className="text-lg font-semibold">{data.cluster.name}</p>
            <p className="text-xs text-zinc-500 mt-1">
              Size: {data.cluster.size} track
            </p>
            <p className="text-sm text-zinc-400 mt-4">
              Tags: {data.cluster.tags.join(" · ")}
            </p>
          </div>

          <div className="bg-zinc-900/60 border border-purple-900/30 rounded-2xl p-6">
            <h3 className="text-sm font-medium text-purple-400 mb-3">
              Policy Extension (B2B → Cluster)
            </h3>
            <p className="font-semibold">{data.policyExtension.policy_name}</p>
            <p className="text-sm text-zinc-400 mt-2">
              Similarity: {data.policyExtension.similarity_score}
            </p>
            <p className="text-sm text-zinc-400">
              {data.policyExtension.status}
            </p>
            <p className="text-xs text-zinc-500 mt-4 leading-relaxed">
              {data.policyExtension.action}
            </p>
          </div>
        </div>

        {/* Settlement */}
        <div className="bg-zinc-900/60 border border-amber-900/20 rounded-2xl p-6">
          <h3 className="text-sm font-medium text-amber-400 mb-5">
            Settlement
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
            <div>
              <p className="text-zinc-500 text-xs mb-1">Status</p>
              <p>{data.settlement.status}</p>
            </div>
            <div>
              <p className="text-zinc-500 text-xs mb-1">Artist Share</p>
              <p>{data.settlement.artist_share}</p>
            </div>
            <div>
              <p className="text-zinc-500 text-xs mb-1">Mock Revenue</p>
              <p>{data.settlement.mock_revenue}</p>
            </div>
            <div>
              <p className="text-zinc-500 text-xs mb-1">Artist Payout</p>
              <p className="text-emerald-400 font-medium">
                {data.settlement.artist_payout}
              </p>
            </div>
          </div>
        </div>

        {/* Score */}
        <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-2xl p-6">
          <h3 className="text-sm font-medium text-emerald-400 mb-2">
            Current Score
          </h3>
          <p className="text-3xl font-bold tracking-tight">
            π<sub className="text-xl">inv</sub> = {data.pi_inv}
          </p>
          <p className="text-zinc-400 text-sm mt-1">
            Loss (ℓ) = {data.ell}
          </p>
        </div>

        {/* Lyrics */}
        <section>
          <h2 className="text-lg font-semibold mb-6 text-zinc-200 tracking-wide">
            Lyrics
          </h2>
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-8 space-y-8">
            <div>
              <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">
                Verse 1
              </h3>
              <p className="text-[15px] leading-relaxed text-zinc-200 whitespace-pre-line">
                {data.lyrics.verse1}
              </p>
            </div>

            <div>
              <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">
                Chorus
              </h3>
              <p className="text-[15px] leading-relaxed text-zinc-100 font-medium whitespace-pre-line">
                {data.lyrics.chorus}
              </p>
            </div>

            <div>
              <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">
                Verse 2
              </h3>
              <p className="text-[15px] leading-relaxed text-zinc-200 whitespace-pre-line">
                {data.lyrics.verse2}
              </p>
            </div>

            {data.lyrics.verse3 && (
              <div>
                <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">
                  Verse 3
                </h3>
                <p className="text-[15px] leading-relaxed text-zinc-200 whitespace-pre-line">
                  {data.lyrics.verse3}
                </p>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}