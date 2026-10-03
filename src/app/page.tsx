"use client";

import { useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

export default function HomePage() {
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
      <SiteHeader />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-emerald-400 mb-3">
          First single · Shiyan Yishu · proves the Assist
        </p>
        <h1 className="text-3xl font-bold mb-3">Shiyan AI Assist</h1>
        <p className="text-zinc-300 max-w-2xl mb-4">
          The system that takes a creation to release, reads the audience,
          and names the next best action.
        </p>
        <p className="text-zinc-500 max-w-2xl mb-8 text-sm">
          Class underneath: Aethel Node. Workbench B is the environment.
          Marketplace lists experience. Playlist and Songs are the Music rail.
          The function is the loop: A acts, B measures z, e falls.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-8">
          <div className="border border-zinc-800 rounded-2xl p-4">
            <p className="text-xs text-zinc-500">Music</p>
            <p className="font-semibold">Singles</p>
          </div>
          <div className="border border-zinc-800 rounded-2xl p-4">
            <p className="text-xs text-zinc-500">Story</p>
            <p className="font-semibold">Content</p>
          </div>
          <div className="border border-zinc-800 rounded-2xl p-4">
            <p className="text-xs text-zinc-500">Creator</p>
            <p className="font-semibold">Campaigns</p>
          </div>
        </div>
        <p className="text-sm text-zinc-400 mb-8">
          Music + Story + Creator → Audience → Sales → Learning
        </p>

        <div className="flex flex-wrap gap-3 mb-8">
          <Link href="/loop" className="h-12 px-6 rounded-full bg-emerald-600 text-sm inline-flex items-center">
            Step the loop
          </Link>
          <Link href="/single" className="h-12 px-6 rounded-full bg-zinc-800 text-sm inline-flex items-center">
            Songs
          </Link>
          <Link href="/workbench" className="h-12 px-6 rounded-full border border-zinc-700 text-sm inline-flex items-center">
            Workbench
          </Link>
          <Link href="/marketplace" className="h-12 px-6 rounded-full border border-zinc-700 text-sm inline-flex items-center">
            Marketplace
          </Link>
        </div>

        <form onSubmit={send} className="flex flex-col sm:flex-row gap-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Assist for the next action"
            className="flex-1 h-12 rounded-full bg-zinc-900 border border-zinc-800 px-5"
          />
          <button type="submit" className="h-12 px-6 rounded-full border border-zinc-700 text-sm">
            {loading ? "…" : "Assist"}
          </button>
        </form>

        {result ? <p className="text-zinc-300 mt-6">{result}</p> : null}
      </main>
    </div>
  );
}