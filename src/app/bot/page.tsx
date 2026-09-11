"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import RailLinks from "@/components/RailLinks";

const chips = [
  { label: "Buy", href: "/nfts" },
  { label: "Sell", href: "/marketplace" },
  { label: "Trade", href: "/playlist" },
  { label: "Music", href: "/single" },
  { label: "AI Content", href: "/#ai-content" },
];

export default function BotPage() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [log, setLog] = useState<string[]>([
    "I am the Grok Bot. Explore, Buy, Sell, or Trade Music and AI content.",
    "P2P states: unlisted → listed → escrow → settled | cancelled.",
  ]);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message) return;
    setInput("");
    setLog((prev) => [...prev, "You: " + message]);
    try {
      const res = await fetch("/api/bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, domain: "music" }),
      });
      const data = await res.json();
      setLog((prev) => [...prev, data.reply || "Next: Buy on Prove. Sell on Marketplace. Trade on Playlist."]);
    } catch {
      setLog((prev) => [...prev, "Buy /nfts. Sell /marketplace. Trade /playlist. Music /single. AI Content /."]);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    send(input);
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Act" />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-emerald-400 mb-3">DO</p>
        <h1 className="text-3xl font-bold mb-3">Grok Bot</h1>
        <p className="text-zinc-400 mb-8">Explore, Buy, Sell, or Trade Music and AI content.</p>
        <div className="mb-8">
          <RailLinks />
        </div>
        <div className="space-y-3 mb-6">
          {log.map((line, i) => (
            <p key={i} className="text-sm text-zinc-300">{line}</p>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 mb-6">
          {chips.map((chip) => (
            <button
              key={chip.label}
              onClick={() => {
                send(chip.label);
                router.push(chip.href);
              }}
              className="h-10 px-4 rounded-full border border-zinc-700 text-sm"
            >
              {chip.label}
            </button>
          ))}
        </div>
        <form onSubmit={onSubmit} className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 px-4"
          />
          <button className="h-12 px-6 rounded-full bg-emerald-600 text-sm">Send</button>
        </form>
      </main>
    </div>
  );
}