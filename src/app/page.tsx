"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

const rails = [
  { href: "/upload", label: "Create" },
  { href: "/nfts", label: "Prove" },
  { href: "/measurements", label: "Learn" },
  { href: "/bot", label: "Act" },
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
      setResult(data.nextAction || data.z || data.text || "Open Learn and measure.");
    } catch {
      setResult("Open Learn. z is written there.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader />
      <main className="max-w-4xl mx-auto px-6 py-16">
        <p className="text-emerald-400 mb-4">
          A/B Agents · P2P State Machine · All Domains
        </p>
        <h1 className="text-4xl font-bold mb-4">
          Creator work into market action.
        </h1>
        <p className="text-zinc-400 max-w-2xl mb-8">
          Shiyan AI Assist is the AI system that helps an independent creator take a creation to release, audience response and next best action. Music is the first vertical. A/B agents simulate P2P signals across domains. Y stays a vector.
        </p>
        <div className="flex flex-wrap gap-3 mb-12">
          {rails.map((rail) => (
            <Link
              key={rail.href}
              href={rail.href}
              className="h-12 px-6 rounded-full bg-emerald-600 text-sm inline-flex items-center"
            >
              {rail.label}
            </Link>
          ))}
        </div>
        <form onSubmit={send} className="flex flex-col sm:flex-row gap-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask for the next action"
            className="flex-1 h-12 rounded-full bg-zinc-900 border border-zinc-800 px-5"
          />
          <button className="h-12 px-6 rounded-full border border-zinc-700 text-sm">
            {loading ? "…" : "Ask"}
          </button>
        </form>
        {result ? <p className="text-zinc-300 mt-6">{result}</p> : null}
      </main>
    </div>
  );
}