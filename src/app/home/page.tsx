"use client";

import { useState } from "react";
import Link from "next/link";
import { setLocalAttention } from "@/lib/emergence";

type InputDomain = "social-transmedia" | "music" | "music-video";

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
        body: JSON.stringify({ input: currentInput, path: "fast" }),
      });
      const data = await res.json();
      if (data.adSignal?.attentionScore) setLocalAttention(data.adSignal.attentionScore);
      const entry = {
        input: currentInput,
        cluster: data.cluster,
        pi_inv: data.pi_inv,
        domain: data.domain,
        model: data.model,
        sovereignty: data.sovereignty,
        token: data.token,
        playlist: data.playlist,
        emergence: data.emergence,
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
        body: JSON.stringify({ input: currentInput, path: "deep" }),
      });
      const deepData = await deepRes.json();
      if (deepData.adSignal?.attentionScore) setLocalAttention(deepData.adSignal.attentionScore);
      const refined = {
        ...entry,
        cluster: deepData.cluster,
        pi_inv: deepData.pi_inv,
        model: deepData.model,
        sovereignty: deepData.sovereignty,
        token: deepData.token || entry.token,
        playlist: deepData.playlist || entry.playlist,
        emergence: deepData.emergence || entry.emergence,
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
            <Link href="/" className="font-semibold tracking-tight text-lg">Shiyan Yishu</Link>
            <span className="text-zinc-500 text-sm">Creator Input Home</span>
          </div>
          <nav className="flex items-center gap-6">
            <Link href="/marketplace" className="text-sm text-zinc-400 hover:text-white">Marketplace</Link>
            <Link href="/playlist" className="text-sm text-zinc-400 hover:text-white">Playlist</Link>
            <Link href="/single" className="text-sm text-zinc-400 hover:text-white">Single</Link>
            <Link href="/bot" className="text-sm text-zinc-400 hover:text-white">Grok Bot</Link>
            <Link href="/dashboard" className="text-sm text-zinc-400 hover:text-white">Dashboard</Link>
          </nav>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Your Narrative Home</h1>
        <p className="text-zinc-400 mb-8">You keep the data. The protocol may learn. You own the asset.</p>
        <div className="flex flex-wrap gap-3 mb-6">
          {(["music", "music-video", "social-transmedia"] as InputDomain[]).map((d) => (
            <button
              key={d}
              onClick={() => setDomain(d)}
              className={`px-4 h-9 rounded-full text-sm ${
                domain === d ? "bg-emerald-600 text-white" : "bg-zinc-900 text-zinc-400 border border-zinc-800"
              }`}
            >
              {d === "music" ? "Music" : d === "music-video" ? "Music Video" : "Social Transmedia"}
            </button>
          ))}
        </div>
        <form onSubmit={handleSubmit} className="mb-12">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Share a lyric, hook, playlist idea, or AI-generated track concept..."
            rows={4}
            className="w-full rounded-2xl bg-zinc-900 border border-zinc-800 px-5 py-4 text-sm text-white placeholder:text-zinc-500 focus:outline-none"
          />
          <div className="mt-4 flex justify-end">
            <button type="submit" disabled={loading || !input.trim()} className="h-11 px-8 rounded-full bg-emerald-600 text-white text-sm font-medium disabled:opacity-50">
              {loading ? "Structuring…" : "Submit to Protocol"}
            </button>
          </div>
        </form>
        {result && (
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm text-emerald-400">Latest Cluster</h2>
              <span className="text-xs px-2.5 py-1 rounded-full bg-zinc-800">{result.model?.path}{refining ? " · refining…" : result.refined ? " · refined" : ""}</span>
            </div>
            <p className="text-lg font-semibold mb-2">{result.cluster?.name}</p>
            <p className="text-sm text-zinc-400 mb-2">Domain: {result.domain} · π<sub>inv</sub>: {result.pi_inv}</p>
            {result.emergence && (
              <p className="text-xs text-emerald-400 mb-3">x {result.emergence.x} · y {result.emergence.y} · z {result.emergence.z}</p>
            )}
            <div className="flex flex-wrap gap-3">
              <Link href="/single" className="h-9 px-4 rounded-full bg-emerald-600 text-white text-xs font-medium flex items-center">Open Single</Link>
              <Link href="/playlist" className="h-9 px-4 rounded-full bg-amber-600 text-white text-xs font-medium flex items-center">Playlist</Link>
              <Link href="/marketplace" className="h-9 px-4 rounded-full bg-zinc-800 text-white text-xs font-medium flex items-center">Marketplace</Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}