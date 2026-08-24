"use client";

import { useState } from "react";
import Link from "next/link";

export default function SocialTransmediaHome() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    setLoading(true);
    setResult(null);

    try {
      // Send input into the Social Transmedia domain of the agent
      const res = await fetch("/api/agent?domain=social-transmedia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // future: we can pass the actual user text more deeply
        }),
      });

      const data = await res.json();

      const entry = {
        input,
        timestamp: new Date().toISOString(),
        cluster: data.cluster,
        pi_inv: data.pi_inv,
        policy: data.policyExtension,
        domain: data.domain,
      };

      setResult(entry);
      setHistory((prev) => [entry, ...prev]);
      setInput("");
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-zinc-800/80">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="font-semibold tracking-tight text-lg">
              Shiyan Yishu
            </Link>
            <span className="text-zinc-500 text-sm">Social Transmedia Home</span>
          </div>
          <nav className="flex items-center gap-6">
            <Link
              href="/bot"
              className="text-sm text-zinc-400 hover:text-white transition-colors"
            >
              Grok Bot
            </Link>
            <Link
              href="/marketplace"
              className="text-sm text-zinc-400 hover:text-white transition-colors"
            >
              Marketplace
            </Link>
            <Link
              href="/dashboard"
              className="text-sm text-zinc-400 hover:text-white transition-colors"
            >
              Dashboard
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight mb-2">
            Your Narrative Home
          </h1>
          <p className="text-zinc-400">
            Input becomes structured Clusters. The protocol decides. You keep
            ownership.
          </p>
        </div>

        {/* Input Loop */}
        <form onSubmit={handleSubmit} className="mb-12">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Share a story, idea, scene, lyric, or fragment..."
            rows={4}
            className="w-full rounded-2xl bg-zinc-900 border border-zinc-800 px-5 py-4 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600 resize-none"
          />
          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="h-11 px-8 rounded-full bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 disabled:opacity-50 transition-colors"
            >
              {loading ? "Structuring…" : "Submit to Protocol"}
            </button>
          </div>
        </form>

        {/* Latest Result */}
        {result && (
          <div className="mb-12 bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
            <h2 className="text-sm text-emerald-400 mb-4">Latest Cluster</h2>
            <p className="text-lg font-semibold mb-2">{result.cluster?.name}</p>
            <p className="text-sm text-zinc-400 mb-4">
              Domain: {result.domain} · π<sub>inv</sub>: {result.pi_inv}
            </p>
            <p className="text-sm text-zinc-300 mb-2">
              <span className="text-zinc-500">Policy:</span>{" "}
              {result.policy?.policy_name}
            </p>
            <p className="text-sm text-zinc-300">
              <span className="text-zinc-500">Action:</span>{" "}
              {result.policy?.action}
            </p>
            <div className="flex flex-wrap gap-2 mt-4">
              {result.cluster?.tags?.map((tag: string, i: number) => (
                <span
                  key={i}
                  className="text-xs px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-300"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* History */}
        {history.length > 1 && (
          <div>
            <h2 className="text-lg font-semibold mb-5">Your Recent Clusters</h2>
            <div className="space-y-4">
              {history.slice(1).map((entry, i) => (
                <div
                  key={i}
                  className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-5"
                >
                  <p className="text-sm text-zinc-300 mb-2 line-clamp-2">
                    “{entry.input}”
                  </p>
                  <p className="text-sm font-medium">{entry.cluster?.name}</p>
                  <p className="text-xs text-zinc-500 mt-1">
                    π<sub>inv</sub>: {entry.pi_inv} ·{" "}
                    {new Date(entry.timestamp).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}