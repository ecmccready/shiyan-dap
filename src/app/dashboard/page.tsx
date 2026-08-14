"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Domain = "music" | "visual" | "text" | "professional";

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [domain, setDomain] = useState<Domain>("music");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/agent?domain=${domain}`)
      .then((res) => res.json())
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [domain]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-zinc-400">Loading measurement dashboard…</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-red-400">Failed to load agent data</p>
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
            <span className="text-zinc-500 text-sm">Dashboard</span>
          </div>

          <nav className="flex items-center gap-8">
  <Link
    href="/upload"
    className="text-sm text-zinc-400 hover:text-white transition-colors duration-200"
  >
    Upload
  </Link>
  <Link
    href="/track/visual"
    className="text-sm text-zinc-400 hover:text-white transition-colors duration-200"
  >
    Visual
  </Link>
  <Link
    href="/track/shiyan-yishu"
    className="text-sm text-zinc-400 hover:text-white transition-colors duration-200"
  >
    Music Track →
  </Link>
</nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12 space-y-14">
        {/* Domain Switcher */}
        <div className="flex items-center gap-4">
          <span className="text-sm text-zinc-400">Domain:</span>
          <div className="flex gap-2">
            {(["music", "visual", "text", "professional"] as Domain[]).map(
              (d) => (
                <button
                  key={d}
                  onClick={() => setDomain(d)}
                  className={`px-4 py-1.5 rounded-full text-sm capitalize transition-colors duration-200 ${
                    domain === d
                      ? "bg-emerald-600 text-white"
                      : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white"
                  }`}
                >
                  {d}
                </button>
              )
            )}
          </div>
        </div>

        {/* Main Score */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 bg-emerald-950/20 border border-emerald-800/40 rounded-2xl p-8">
            <p className="text-sm text-emerald-400 mb-3">
              Current Inverting Policy
            </p>
            <p className="text-5xl font-bold tracking-tight">
              π<sub className="text-3xl">inv</sub> = {data.pi_inv}
            </p>
            <p className="text-zinc-400 mt-4 text-lg">
              Loss (ℓ) = {data.ell}
            </p>
            <p className="text-xs text-zinc-500 mt-5">
              Formula: π<sub>inv</sub>(c) = 1 − ℓ(c)
            </p>
          </div>

          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 flex flex-col justify-center">
            <p className="text-sm text-zinc-500 mb-1">Status</p>
            <p className="text-xl font-semibold text-emerald-400">Healthy</p>
            <p className="text-xs text-zinc-500 mt-3">
              Domain: {data.domain || "Music"}
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              Full loop completed successfully
            </p>
          </div>
        </section>

        {/* Key Metrics */}
        <section>
          <h2 className="text-lg font-semibold mb-6 text-zinc-200 tracking-wide">
            Key Metrics
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5">
              <p className="text-xs text-zinc-500 mb-1">Cluster Size</p>
              <p className="text-2xl font-bold">{data.cluster.size}</p>
              <p className="text-xs text-zinc-400 mt-2">{data.cluster.name}</p>
            </div>

            <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5">
              <p className="text-xs text-zinc-500 mb-1">Policy Similarity</p>
              <p className="text-2xl font-bold">
                {data.policyExtension.similarity_score}
              </p>
              <p className="text-xs text-zinc-400 mt-2">B2B → Cluster</p>
            </div>

            <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5">
              <p className="text-xs text-zinc-500 mb-1">Model Provider</p>
              <p className="text-2xl font-bold capitalize">
                {data.model?.provider || "mock"}
              </p>
              <p className="text-xs text-zinc-400 mt-2">
                Confidence: {data.model?.confidence ?? "—"}
              </p>
            </div>

            <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5">
              <p className="text-xs text-zinc-500 mb-1">Mock Payout</p>
              <p className="text-2xl font-bold text-emerald-400">
                {data.settlement.artist_payout}
              </p>
              <p className="text-xs text-zinc-400 mt-2">
                from {data.settlement.mock_revenue}
              </p>
            </div>
          </div>
        </section>

        {/* Detailed Cards */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
            <h3 className="text-sm font-medium text-blue-400 mb-4">Cluster</h3>
            <p className="font-semibold text-lg">{data.cluster.name}</p>
            <p className="text-sm text-zinc-400 mt-2">
              ID: {data.cluster.id}
            </p>
            <p className="text-sm text-zinc-400 mt-1">
              Members: {data.cluster.members.join(", ")}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {data.cluster.tags.map((tag: string, index: number) => (
                <span
                  key={`${tag}-${index}`}
                  className="text-xs px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-300"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <div className="bg-zinc-900/60 border border-purple-900/30 rounded-2xl p-6">
            <h3 className="text-sm font-medium text-purple-400 mb-4">
              Policy Extension
            </h3>
            <p className="font-semibold text-lg">
              {data.policyExtension.policy_name}
            </p>
            <p className="text-sm text-zinc-400 mt-2">
              Source: {data.policyExtension.source}
            </p>
            <p className="text-sm text-zinc-400 mt-1">
              Status: {data.policyExtension.status}
            </p>
            <p className="text-sm text-zinc-500 mt-5 leading-relaxed">
              {data.policyExtension.action}
            </p>
          </div>
        </section>

        {/* Settlement */}
        <section className="bg-zinc-900/60 border border-amber-900/20 rounded-2xl p-6">
          <h3 className="text-sm font-medium text-amber-400 mb-5">
            Settlement
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
            <div>
              <p className="text-zinc-500 text-xs mb-1">Status</p>
              <p>{data.settlement.status}</p>
            </div>
            <div>
              <p className="text-zinc-500 text-xs mb-1">Method</p>
              <p>{data.settlement.method}</p>
            </div>
            <div>
              <p className="text-zinc-500 text-xs mb-1">Platform Share</p>
              <p>{data.settlement.platform_share}</p>
            </div>
            <div>
              <p className="text-zinc-500 text-xs mb-1">Artist Payout</p>
              <p className="text-emerald-400 font-medium">
                {data.settlement.artist_payout}
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}