"use client";

import { useState } from "react";
import Link from "next/link";

type InputDomain = "social-transmedia" | "music";

export default function SocialTransmediaHome() {
  const [input, setInput] = useState("");
  const [domain, setDomain] = useState<InputDomain>("music");
  const [loading, setLoading] = useState(false);
  const [refining, setRefining] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const currentInput = input;
    setLoading(true);
    setRefining(false);
    setResult(null);

    try {
      const res = await fetch(`/api/agent?domain=${domain}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: currentInput,
          path: "fast",
        }),
      });

      const data = await res.json();

      const entry = {
        input: currentInput,
        timestamp: new Date().toISOString(),
        cluster: data.cluster,
        pi_inv: data.pi_inv,
        policy: data.policyExtension,
        domain: data.domain,
        model: data.model,
        adSignal: data.adSignal,
        sovereignty: data.sovereignty,
        token: data.token,
        playlist: data.playlist,
        refined: false,
      };

      setResult(entry);
      setHistory((prev) => [entry, ...prev]);
      setInput("");
      setLoading(false);

      setRefining(true);
      const deepRes = await fetch(`/api/agent?domain=${domain}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: currentInput,
          path: "deep",
        }),
      });
      const deepData = await deepRes.json();

      const refined = {
        ...entry,
        cluster: deepData.cluster,
        pi_inv: deepData.pi_inv,
        policy: deepData.policyExtension,
        model: deepData.model,
        adSignal: deepData.adSignal,
        sovereignty: deepData.sovereignty,
        token: deepData.token || entry.token,
        playlist: deepData.playlist || entry.playlist,
        refined: true,
      };

      setResult(refined);
      setHistory((prev) => [refined, ...prev.slice(1)]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefining(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-zinc-800/80">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="font-semibold tracking-tight text-lg">
              Shiyan Yishu
            </Link>
            <span className="text-zinc-500 text-sm">Creator Input Home</span>
          </div>
          <nav className="flex items-center gap-6">
            <Link href="/dashboard" className="text-sm text-zinc-400 hover:text-white transition-colors">
              Dashboard
            </Link>
            <Link href="/marketplace" className="text-sm text-zinc-400 hover:text-white transition-colors">
              Marketplace
            </Link>
            <Link href="/tokens" className="text-sm text-zinc-400 hover:text-white transition-colors">
              Tokens
            </Link>
            <Link href="/bot" className="text-sm text-zinc-400 hover:text-white transition-colors">
              Grok Bot
            </Link>
            <Link href="/measurements" className="text-sm text-zinc-400 hover:text-white transition-colors">
              Measurements
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
            You keep the data. The protocol may learn. You own the asset.
          </p>
        </div>

        <div className="flex gap-3 mb-6">
          <button
            onClick={() => setDomain("music")}
            className={`px-4 h-9 rounded-full text-sm transition-colors ${
              domain === "music"
                ? "bg-emerald-600 text-white"
                : "bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-white"
            }`}
          >
            Music
          </button>
          <button
            onClick={() => setDomain("social-transmedia")}
            className={`px-4 h-9 rounded-full text-sm transition-colors ${
              domain === "social-transmedia"
                ? "bg-emerald-600 text-white"
                : "bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-white"
            }`}
          >
            Social Transmedia
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mb-12">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              domain === "music"
                ? "Share a lyric, hook, playlist idea, or AI-generated track concept..."
                : "Share a story, scene, campaign fragment, or transmedia idea..."
            }
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

        {result && (
          <div className="mb-12 bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm text-emerald-400">Latest Cluster</h2>
              <span className="text-xs px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-300">
                {result.model?.path || "fast"}
                {refining ? " · refining…" : result.refined ? " · refined" : ""}
              </span>
            </div>
            <p className="text-lg font-semibold mb-2">{result.cluster?.name}</p>
            <p className="text-sm text-zinc-400 mb-2">
              Domain: {result.domain} · π<sub>inv</sub>: {result.pi_inv}
              {result.model?.disagreement != null && (
                <> · disagreement: {result.model.disagreement}</>
              )}
            </p>
            {result.sovereignty && (
              <p className="text-xs text-zinc-500 mb-2">
                Data owner: {result.sovereignty.dataOwner} · Protocol owner:{" "}
                {result.sovereignty.protocolOwner} · User keeps data:{" "}
                {result.sovereignty.userKeepsData ? "yes" : "no"}
              </p>
            )}
            {result.token && (
              <p className="text-xs text-emerald-400 mb-2">
                Music token created: {result.token.symbol} · ${result.token.price}
              </p>
            )}
            {result.playlist && (
              <p className="text-xs text-zinc-400 mb-4">
                Added to playlist: {result.playlist.name}
              </p>
            )}
            <div className="flex flex-wrap gap-3 mt-2 mb-4">
              <Link
                href="/marketplace"
                className="h-9 px-4 rounded-full bg-amber-600 text-white text-xs font-medium flex items-center"
              >
                List in Marketplace
              </Link>
              <Link
                href="/tokens"
                className="h-9 px-4 rounded-full bg-emerald-600 text-white text-xs font-medium flex items-center"
              >
                Open Tokens
              </Link>
              <Link
                href="/bot"
                className="h-9 px-4 rounded-full bg-zinc-800 text-white text-xs font-medium flex items-center"
              >
                Ask Grok Bot to Buy
              </Link>
            </div>
            <p className="text-sm text-zinc-300 mb-2">
              <span className="text-zinc-500">Policy:</span> {result.policy?.policy_name}
            </p>
            <p className="text-sm text-zinc-300">
              <span className="text-zinc-500">Action:</span> {result.policy?.action}
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
                    {entry.domain} · π<sub>inv</sub>: {entry.pi_inv} ·{" "}
                    {entry.model?.path || "fast"}
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