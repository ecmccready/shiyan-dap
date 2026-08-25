"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function MeasurementsPage() {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const domains = [
      "music",
      "visual",
      "social-transmedia",
      "blockchain-games",
      "animation",
      "real-estate",
      "professional",
      "text",
    ];

    Promise.all(
      domains.map((d) =>
        fetch(`/api/agent?domain=${d}`).then((res) => res.json())
      )
    )
      .then(async () => {
        const res = await fetch("/api/agent?domain=music");
        const data = await res.json();
        setMetrics(data.self_improvement || null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-zinc-400">Collecting measurement data…</p>
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
            <span className="text-zinc-500 text-sm">Measurements</span>
          </div>

          <nav className="flex items-center gap-6">
            <Link
              href="/dashboard"
              className="text-sm text-zinc-400 hover:text-white transition-colors"
            >
              Dashboard
            </Link>
            <Link
              href="/marketplace"
              className="text-sm text-zinc-400 hover:text-white transition-colors"
            >
              Marketplace
            </Link>
            <Link
              href="/tokens"
              className="text-sm text-zinc-400 hover:text-white transition-colors"
            >
              Tokens
            </Link>
            <Link
              href="/nfts"
              className="text-sm text-zinc-400 hover:text-white transition-colors"
            >
              My NFTs
            </Link>
            <Link
              href="/bot"
              className="text-sm text-zinc-400 hover:text-white transition-colors"
            >
              Grok Bot
            </Link>
            <Link
              href="/home"
              className="text-sm text-zinc-400 hover:text-white transition-colors"
            >
              Home
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight mb-2">
            Deploy / Measurements
          </h1>
          <p className="text-zinc-400">
            Tracking the .self() improvement signal of the Generative Transform
            Protocol
          </p>
        </div>

        {!metrics || metrics.count === 0 ? (
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-12 text-center">
            <p className="text-zinc-400">
              No outcome data yet. Run the agent from the Dashboard to generate
              measurements.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-10">
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
                <p className="text-sm text-zinc-400 mb-1">Total Outcomes</p>
                <p className="text-3xl font-bold">{metrics.count}</p>
              </div>
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
                <p className="text-sm text-zinc-400 mb-1">
                  Average π<sub>inv</sub>
                </p>
                <p className="text-3xl font-bold text-emerald-400">
                  {metrics.avg_pi_inv ?? "—"}
                </p>
              </div>
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
                <p className="text-sm text-zinc-400 mb-1">
                  Latest π<sub>inv</sub>
                </p>
                <p className="text-3xl font-bold">
                  {metrics.latest_pi_inv ?? "—"}
                </p>
              </div>
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
                <p className="text-sm text-zinc-400 mb-1">Trend</p>
                <p
                  className={`text-2xl font-bold capitalize ${
                    metrics.trend === "improving"
                      ? "text-emerald-400"
                      : metrics.trend === "declining"
                      ? "text-red-400"
                      : "text-zinc-300"
                  }`}
                >
                  {metrics.trend?.replace("_", " ") || "—"}
                </p>
              </div>
            </div>

            <h2 className="text-lg font-semibold mb-5">Per-Domain Breakdown</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {metrics.domains &&
                Object.entries(metrics.domains).map(
                  ([domain, stats]: [string, any]) => (
                    <div
                      key={domain}
                      className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6"
                    >
                      <h3 className="font-medium mb-3">{domain}</h3>
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-400">Outcomes</span>
                        <span>{stats.count}</span>
                      </div>
                      <div className="flex justify-between text-sm mt-2">
                        <span className="text-zinc-400">
                          Avg π<sub>inv</sub>
                        </span>
                        <span className="text-emerald-400">
                          {stats.avg_pi_inv}
                        </span>
                      </div>
                    </div>
                  )
                )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}