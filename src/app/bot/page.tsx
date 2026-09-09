"use client";
import { useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import RailLinks from "@/components/RailLinks";

const chips = ["Acquire Shiyan Yishu", "Retain", "Transfer", "Buy"];

export default function BotPage() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState(
    [{ role: "bot", text: "I am the Grok Bot. Explore, Buy, Sell, or Trade Music and AI content." }]
  );
  const [busy, setBusy] = useState(false);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || busy) return;
    setBusy(true);
    setMessages((prev) => [...prev, { role: "user", text: message }]);
    setInput("");
    try {
      const res = await fetch("/api/bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, domain: "music" }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "bot", text: data.reply || "Acquired on the ledger." }]);
    } catch {
      setMessages((prev) => [...prev, { role: "bot", text: "Open /nfts to acquire on the ledger." }]);
    }
    setBusy(false);
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Act" />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-emerald-400 mb-3">Grok Bot</p>
        <h1 className="text-3xl font-bold mb-3">Act</h1>
        <p className="text-zinc-400 mb-8">Explore, Buy, Sell, or Trade Music and AI content.</p>
        <div className="mb-8">
          <RailLinks />
        </div>
        <div className="space-y-4 mb-8">
          {messages.map((m, i) => (
            <div key={i} className={"max-w-xl rounded-2xl p-4 " + (m.role === "user" ? "ml-auto bg-emerald-600" : "bg-zinc-900 border border-zinc-800")}>
              <p className="text-sm">{m.text}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 mb-6">
          {chips.map((chip) => (
            <button key={chip} onClick={() => send(chip)} className="h-9 px-4 rounded-full border border-zinc-700 text-sm">
              {chip}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex gap-3"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Try acquire, retain, transfer, or buy"
            className="flex-1 h-11 rounded-full bg-zinc-900 border border-zinc-800 px-5 text-sm"
          />
          <button disabled={busy} className="h-11 px-6 rounded-full bg-emerald-600 text-sm">
            Send
          </button>
        </form>
        <Link href="/nfts" className="inline-block mt-8 text-sm text-zinc-500">
          Ledger is the proof
        </Link>
      </main>
    </div>
  );
}