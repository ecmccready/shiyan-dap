"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function VisualTrackPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/agent?domain=visual")
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
        <p className="text-zinc-400">Loading visual agentic memory…</p>
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
            <span className="text-zinc-500 text-sm">Visual Vertical</span>
          </div>

          <nav className="flex items-center gap-8">
            <Link
              href="/dashboard"
              className="text-sm text-zinc-400 hover:text-white transition-colors duration-200"
            >
              Dashboard
            </Link>
            <Link
              href="/track/shiyan-yishu"
              className="text-sm text-zinc-400 hover:text-white transition-colors duration-200"
            >
              Music Track
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
          <h1 className="text-4xl font-bold tracking-tight">
            Generative Visual Demonstration
          </h1>
          <p className="text-zinc-400 mt-2">
            Second vertical • Domain: {data.domain}
          </p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12 space-y-14">
        {/* Score */}
        <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-2xl p-8">
          <p className="text-sm text-emerald-400 mb-3">Inverting Policy</p>
          <p className="text-4xl font-bold">
            π<sub className="text-2xl">inv</sub> = {data.pi_inv}
          </p>
          <p className="text-zinc-400 mt-2">
            Loss (ℓ) = {data.ell} • Model: {data.model?.provider}
          </p>
        </div>

        {/* Pyramid */}
        <section>
          <h2 className="text-lg font-semibold mb-6 text-emerald-400">
            Miller Pyramid (Visual Domain)
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
            <h3 className="text-sm font-medium text-blue-400 mb-3">Cluster</h3>
            <p className="text-lg font-semibold">{data.cluster.name}</p>
            <p className="text-sm text-zinc-400 mt-3">
              Tags: {data.cluster.tags.join(" · ")}
            </p>
          </div>

          <div className="bg-zinc-900/60 border border-purple-900/30 rounded-2xl p-6">
            <h3 className="text-sm font-medium text-purple-400 mb-3">
              Policy Extension
            </h3>
            <p className="font-semibold">{data.policyExtension.policy_name}</p>
            <p className="text-sm text-zinc-400 mt-2">
              {data.policyExtension.action}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}