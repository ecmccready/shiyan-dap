"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

const places = [
  { href: "/workspace", label: "Workspace" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/playlist", label: "Playlist" },
];

export default function HomePage() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/agent?domain=music", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input, path: "fast" }),
      });
      const data = await res.json().catch(() => ({}));
      setResult(
        data.nextAction || data.z || data.text || "Open Workspace and measure."
      );
    } catch {
      setResult("Open /bot. z is written from the ledger.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader />
      <main className="max-w-4xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-bold mb-4">
          Creator work into market action.
        </h1>
        <p className="text-zinc-400 max-w-2xl mb-8">
          Shiyan is Workspace A: Self() writes z from the ledger and
          names the next action. Music is the first vertical. B is
          the workbench, not a customer. Diagnostic safety is created
          from the workbench.
        </p>
        <div className="flex flex-wrap gap-3 mb-12">
          {places.map((place) => (
            <Link
              key={place.href}
              href={place.href}
              className="h-12 px-6 rounded-full bg-emerald-600 text-sm inline-flex items-center"
            >
              {place.label}
            </Link>
          ))}
        </div>
        <form onSubmit={send} className="flex flex-col sm:flex-row gap-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Grok Bot for the next action"
            className="flex-1 h-12 rounded-full bg-zinc-900 border border-zinc-800 px-5"
          />
          <button className="h-12 px-6 rounded-full border border-zinc-700 text-sm">
            {loading ? "…" : "Grok Bot"}
          </button>
        </form>
        <p className="text-xs text-zinc-500 mt-3">
          Or open{" "}
          <Link className="underline" href="/bot">
            /bot
          </Link>
        </p>
        {result ? <p className="text-zinc-300 mt-6">{result}</p> : null}
      </main>
    </div>
  );
}