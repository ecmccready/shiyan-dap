"use client";

import { useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

export default function EmergenceClient() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/agent?domain=music", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input, path: "fast" }),
      });
      const data = await res.json();
      setResult(
        data.text || data.z || data.message || "A named the next action from z."
      );
    } catch {
      setResult("A could not reach the agent rail.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Emergence" />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-3">ECMcCready&apos;s Emergence</h1>
        <p className="text-emerald-400 mb-8">Beyond here be dragons!</p>

        <div className="flex flex-wrap gap-3 mb-8">
          <Link
            href="/workbench"
            className="h-12 px-6 rounded-full bg-emerald-600 text-sm inline-flex items-center"
          >
            Workbench
          </Link>
          <Link
            href="/workbench/marketplace"
            className="h-12 px-6 rounded-full bg-emerald-600 text-sm inline-flex items-center"
          >
            Marketplace
          </Link>
          <Link
            href="/playlist"
            className="h-12 px-6 rounded-full bg-emerald-600 text-sm inline-flex items-center"
          >
            Playlist
          </Link>
        </div>

        <form onSubmit={send} className="flex flex-col sm:flex-row gap-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Grok Bot for the next action"
            className="flex-1 h-12 rounded-full bg-zinc-900 border border-zinc-800 px-5"
          />
          <button
            type="submit"
            className="h-12 px-6 rounded-full border border-zinc-700 text-sm"
          >
            {loading ? "…" : "Grok Bot"}
          </button>
        </form>

        {result ? <p className="text-zinc-300 mt-6">{result}</p> : null}
      </main>
    </div>
  );
}
