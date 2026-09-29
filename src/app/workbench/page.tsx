"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import {
  LoopPlant,
  Namer,
  freshPlant,
  namerLabel,
  persistPlant,
  readPersistedPlant,
} from "@/lib/closed-loop";

export default function HomePage() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [plant, setPlant] = useState<LoopPlant | null>(null);
  const [namer, setNamer] = useState<Namer>("grok_bot");

  useEffect(() => {
    setPlant(readPersistedPlant() || freshPlant());
  }, []);

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

  async function act() {
    if (!plant) return;
    const res = await fetch("/api/loop/step", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plant, namer }),
    });
    const data = await res.json();
    setPlant(data.plant);
    persistPlant(data.plant);
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-emerald-400 mb-3">Workspace A · controller</p>
        <h1 className="text-3xl font-bold mb-3">Workspace A</h1>
        <p className="text-zinc-400 max-w-2xl mb-8">
          model-portable autonomous Workspace that uses Workbenches as
          environments, turns actions into measurable experience, maintains a
          state z, predicts outcomes, measures error, and uses Self() to
          select/revise the next action: Grok fast, Hy4 deep, and Grok Bot
          orchestrate.
        </p>

        <div className="flex flex-wrap gap-3 mb-8">
          <Link
            href="/workspace"
            className="h-12 px-6 rounded-full bg-emerald-600 text-sm inline-flex items-center"
          >
            Workspace
          </Link>
          <Link
            href="/marketplace"
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
          <Link
            href="/single"
            className="h-12 px-6 rounded-full bg-emerald-600 text-sm inline-flex items-center"
          >
            Songs
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

        <p className="text-xs text-zinc-500 mt-3">
          First vertical is music. Workbench opens from Workspace, not from
          this home rail.
        </p>

        {result ? <p className="text-zinc-300 mt-6">{result}</p> : null}

        <button
          onClick={act}
          className="mt-8 text-xs text-zinc-600 underline"
        >
          {namerLabel(namer)} step
        </button>
      </main>
    </div>
  );
}
