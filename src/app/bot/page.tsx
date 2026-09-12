"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import { readZ } from "@/lib/outcomes";

const chips = [
  { label: "Buy", href: "/nfts" },
  { label: "Sell", href: "/marketplace" },
  { label: "Trade", href: "/playlist" },
  { label: "Music", href: "/single" },
  { label: "AI Content", href: "/" },
];

export default function BotPage() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [z, setZ] = useState("Measure an asset.");
  const [log, setLog] = useState<string[]>([]);

  useEffect(() => {
    const next = readZ();
    setZ(next);
    setLog([
      "I am the Grok Bot. Explore, Buy, Sell, or Trade Music and AI content.",
      "z: " + next,
    ]);
  }, []);

  const send = (e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setLog((rows) => [...rows, "You: " + text, "z: " + z]);
    setInput("");
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Act" />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-emerald-400 mb-3">DO</p>
        <h1 className="text-3xl font-bold mb-3">Grok Bot</h1>
        <p className="text-zinc-400 mb-8">
          Explore, Buy, Sell, or Trade Music and AI content. z comes from Learn.
        </p>
        <div className="flex flex-wrap gap-2 mb-8">
          {chips.map((chip) => (
            <button
              key={chip.label}
              onClick={() => router.push(chip.href)}
              className="h-11 px-5 rounded-full border border-zinc-700 text-sm"
            >
              {chip.label}
            </button>
          ))}
        </div>
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 mb-6 space-y-2">
          {log.map((line, i) => (
            <p key={i} className="text-sm text-zinc-300">
              {line}
            </p>
          ))}
        </div>
        <form onSubmit={send} className="flex gap-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 h-12 rounded-full bg-zinc-900 border border-zinc-800 px-5"
          />
          <button className="h-12 px-6 rounded-full bg-emerald-600 text-sm">Send</button>
        </form>
      </main>
    </div>
  );
}