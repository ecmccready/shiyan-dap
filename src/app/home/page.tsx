"use client";
import { useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { setLocalAttention } from "@/lib/emergence";

export default function AssistPage() {
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
      <SiteHeader section="02 Assist" />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-emerald-400 mb-3">Protocol 02</p>
        <h1 className="text-3xl font-bold mb-2">AI Assist</h1>
        <p className="text-zinc-400 mb-4">Grok answers first. Hy4 refines. Hugging Face stores the learning loop.</p>
        <div className="flex flex-wrap gap-2 mb-8">
          <span className="px-3 h-8 rounded-full border border-zinc-800 text-xs inline-flex items-center">Grok = fast</span>
          <span className="px-3 h-8 rounded-full border border-zinc-800 text-xs inline-flex items-center">Hy4 = deep</span>
          <span className="px-3 h-8 rounded-full border border-zinc-800 text-xs inline-flex items-center">Hugging Face = ML memory</span>
        </div>
        <form onSubmit={handleSubmit}>
          <textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="Paste the song, hook, or what is missing..." rows={4} className="w-full rounded-2xl bg-zinc-900 border border-zinc-800 px-5 py-4 text-sm mb-4" />
          <button type="submit" disabled={loading || !input.trim()} className="h-11 px-8 rounded-full bg-emerald-600 text-white text-sm font-medium disabled:opacity-50">
            {loading ? "Grok analyzing…" : refining ? "Hy4 refining…" : "Analyze project"}
          </button>
        </form>
        {result && (
          <div className="mt-8 bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
            <p className="text-emerald-400 text-sm mb-2">{result.pathLabel || result.model?.path} {refining ? "· Hy4 running" : ""}</p>
            <p className="text-lg font-semibold mb-2">{result.cluster?.name || "Project cluster"}</p>
            <p className="text-sm text-zinc-400 mb-4">Provider: {result.model?.provider || "grok"} · secondary: {result.model?.secondaryProvider || "hy4"}</p>
            <Link href="/bot" className="h-10 px-5 rounded-full bg-emerald-600 text-white text-sm font-medium inline-flex items-center">03 Act →</Link>
          </div>
        )}
      </main>
    </div>
  );
}
