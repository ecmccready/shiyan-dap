"use client";
import { useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { setLocalAttention } from "@/lib/emergence";

export default function HomePage() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [refining, setRefining] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const currentInput = input;
    setLoading(true);
    setRefining(false);
    setResult(null);
    try {
      const fastRes = await fetch("/api/agent?domain=music", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: currentInput, path: "fast" }),
      });
      const fastData = await fastRes.json();
      if (fastData.adSignal?.attentionScore) setLocalAttention(fastData.adSignal.attentionScore);
      setResult({ ...fastData, pathLabel: "Grok fast" });
      setInput("");
      setLoading(false);
      setRefining(true);
      const deepRes = await fetch("/api/agent?domain=music", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: currentInput, path: "deep" }),
      });
      const deepData = await deepRes.json();
      if (deepData.adSignal?.attentionScore) setLocalAttention(deepData.adSignal.attentionScore);
      setResult({ ...fastData, ...deepData, pathLabel: "Hy4 deep" });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefining(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader />
      <main className="max-w-4xl mx-auto px-6 pt-16 pb-20">
        <p className="text-xs tracking-[0.28em] uppercase text-emerald-400 mb-5">Shiyan</p>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.05]">
          Creator work into market action.
        </h1>
        <p className="text-zinc-300 text-lg mt-8 leading-relaxed">
          Shiyan AI Assist — the AI system that helps an independent creator take a creation to release, audience response and next best action.
        </p>
        <p className="text-zinc-500 mt-4">
          Creator SaaS. Music is the first vertical. Create → Prove → Learn → Act.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/upload" className="h-11 px-6 rounded-full bg-emerald-600 text-sm inline-flex items-center">
            Create
          </Link>
          <Link href="/nfts" className="h-11 px-6 rounded-full border border-zinc-700 text-sm inline-flex items-center">
            Prove
          </Link>
          <Link href="/measurements" className="h-11 px-6 rounded-full border border-zinc-700 text-sm inline-flex items-center">
            Learn
          </Link>
          <Link href="/bot" className="h-11 px-6 rounded-full border border-zinc-700 text-sm inline-flex items-center">
            Act
          </Link>
        </div>
        <form id="ai-content" onSubmit={handleSubmit} className="mt-12 bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
          <p className="text-sm text-emerald-400 mb-3">Next action · Grok fast · Hy4 deep</p>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste the work, hook, or project..."
            rows={4}
            className="w-full rounded-2xl bg-black border border-zinc-800 px-5 py-4 text-sm mb-4"
          />
          <button type="submit" disabled={loading || !input.trim()} className="h-11 px-8 rounded-full bg-emerald-600 text-white text-sm font-medium disabled:opacity-50">
            {loading ? "Grok analyzing..." : refining ? "Hy4 refining..." : "Get next action"}
          </button>
        </form>
        {result && (
          <div className="mt-6 bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
            <p className="text-emerald-400 text-sm mb-2">{result.pathLabel} {refining ? "· Hy4 running" : ""}</p>
            <p className="text-lg font-semibold mb-4">{result.cluster?.name || "Next action"}</p>
            <Link href="/upload" className="h-10 px-5 rounded-full bg-emerald-600 text-white text-sm font-medium inline-flex items-center">
              Put it on the ledger
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}