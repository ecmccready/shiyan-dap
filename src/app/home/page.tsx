"use client";
import { useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
export default function AssistPage() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/agent?domain=music", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input, path: "fast" }),
      });
      setResult(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="02 Assist" />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-emerald-400 mb-3">Protocol 02</p>
        <h1 className="text-3xl font-bold mb-2">AI Assist</h1>
        <p className="text-zinc-400 mb-8">Understands the project and decides what matters next.</p>
        <form onSubmit={handleSubmit}>
          <textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="Paste the song, hook, or what is missing..." rows={4} className="w-full rounded-2xl bg-zinc-900 border border-zinc-800 px-5 py-4 text-sm mb-4" />
          <button type="submit" disabled={loading || !input.trim()} className="h-11 px-8 rounded-full bg-emerald-600 text-white text-sm font-medium disabled:opacity-50">
            {loading ? "Analyzing…" : "Analyze project"}
          </button>
        </form>
        {result && (
          <div className="mt-8 bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
            <p className="text-emerald-400 text-sm mb-2">Analysis</p>
            <p className="text-lg font-semibold mb-4">{result.cluster?.name || "Project cluster"}</p>
            <Link href="/bot" className="h-10 px-5 rounded-full bg-emerald-600 text-white text-sm font-medium inline-flex items-center">03 Act →</Link>
          </div>
        )}
      </main>
    </div>
  );
}
