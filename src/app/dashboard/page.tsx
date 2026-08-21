"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Domain =
  | "music"
  | "visual"
  | "text"
  | "professional"
  | "social-transmedia"
  | "blockchain-games"
  | "animation";

const domainList: Domain[] = [
  "music",
  "visual",
  "social-transmedia",
  "blockchain-games",
  "animation",
  "professional",
];

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
            <span className="text-zinc-500 text-sm">Dashboard</span>
          </div>

          <nav className="flex items-center gap-8">
  <Link href="/dashboard" className="text-sm text-zinc-400 hover:text-white transition-colors duration-200">
    Dashboard
  </Link>
  <Link href="/marketplace" className="text-sm text-zinc-400 hover:text-white transition-colors duration-200">
    Marketplace
  </Link>
  <Link href="/tokens" className="text-sm text-zinc-400 hover:text-white transition-colors duration-200">
    Tokens
  </Link>
  <Link href="/nfts" className="text-sm text-zinc-400 hover:text-white transition-colors duration-200">
    My NFTs
  </Link>
  <Link href="/upload" className="text-sm text-zinc-400 hover:text-white transition-colors duration-200">
    Upload
  </Link>
  <Link href="/track/shiyan-yishu" className="text-sm text-zinc-400 hover:text-white transition-colors duration-200">
    Music Track →
  </Link>
</nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12 space-y-12">
        {/* Domain Switcher */}
        <div>
          <h2 className="text-sm text-zinc-400 mb-4">Domain</h2>
          <div className="flex flex-wrap gap-3">
            {domainList.map((d) => (
              <button
                key={d}
                onClick={() => setDomain(d)}
                className={`px-4 h-9 rounded-full text-sm transition-colors ${
                  domain === d
                    ? "bg-emerald-600 text-white"
                    : "bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* Score */}
        <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-2xl p-8">
          <p className="text-sm text-emerald-400 mb-3">Inverting Policy</p>
          <p className="text-4xl font-bold">
            π<sub className="text-2xl">inv</sub> = {data.pi_inv}
          </p>
          <p className="text-zinc-400 mt-2">
            Loss (ℓ) = {data.ell} · Model: {data.model?.provider || "mock"}
          </p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
            <p className="text-sm text-zinc-400 mb-1">Domain</p>
            <p className="text-lg font-semibold">{data.domain}</p>
          </div>
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
            <p className="text-sm text-zinc-400 mb-1">Model Provider</p>
            <p className="text-lg font-semibold">
              {data.model?.provider || "mock"}
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              Confidence: {data.model?.confidence ?? "—"}
            </p>
          </div>
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
            <p className="text-sm text-zinc-400 mb-1">Self Improvement</p>
            <p className="text-lg font-semibold">
              {data.self_improvement?.avg_pi_inv
                ? Number(data.self_improvement.avg_pi_inv).toFixed(3)
                : "—"}
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              Outcomes: {data.self_improvement?.count ?? 0}
            </p>
          </div>
        </div>

        {/* Miller Pyramid */}
        <section>
          <h2 className="text-lg font-semibold mb-6 text-emerald-400">
            Miller Pyramid
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {data.pyramid &&
              Object.entries(data.pyramid).map(([key, value]: any) => (
                <div
                  key={key}
                  className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6"
                >
                  <h3 className="text-sm font-medium text-emerald-400 mb-1">
                    {value.level}
                  </h3>
                  <p className="text-xs text-zinc-500 mb-4">
                    {value.description}
                  </p>
                  <div className="text-sm text-zinc-300 space-y-1.5">
                    {value.content &&
                      Object.entries(value.content).map(([k, v]) => (
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
            <h3 className="text-sm font-medium text-blue-400 mb-3">Cluster</h3>
            <p className="text-lg font-semibold">{data.cluster?.name}</p>
            <p className="text-sm text-zinc-400 mt-3">
              Tags: {data.cluster?.tags?.join(" · ")}
            </p>
          </div>

          <div className="bg-zinc-900/60 border border-purple-900/30 rounded-2xl p-6">
            <h3 className="text-sm font-medium text-purple-400 mb-3">
              Policy Extension
            </h3>
            <p className="font-semibold">{data.policyExtension?.policy_name}</p>
            <p className="text-sm text-zinc-400 mt-2">
              {data.policyExtension?.action}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}