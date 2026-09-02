"use client";

import { useState } from "react";
import Link from "next/link";

interface Message {
  role: "user" | "bot";
  content: string;
  suggestedActions?: string[];
  transaction?: { action: string; amount: number; total: number } | null;
}

export default function BotPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "bot",
      content: "I’m the Grok Bot sitting on top of your Clusters. I can help you Explore, Buy, Sell, or Trade Music and AI content.",
      suggestedActions: ["Acquire", "Retain", "Transfer", "Buy"],
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, domain: "music", mode: "simulated" }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          role: "bot",
          content: data.reply || "I didn’t catch that.",
          suggestedActions: data.suggestedActions,
          transaction: data.transaction || null,
        },
      ]);
    } catch {
      setMessages((prev) => [...prev, { role: "bot", content: "Something went wrong." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <header className="border-b border-zinc-800/80">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="font-semibold tracking-tight text-lg">Shiyan Yishu</Link>
            <span className="text-zinc-500 text-sm">Grok Bot</span>
          </div>
          <nav className="flex items-center gap-6">
            <Link href="/home" className="text-sm text-zinc-400 hover:text-white">Home</Link>
            <Link href="/playlist" className="text-sm text-zinc-400 hover:text-white">Playlist</Link>
            <Link href="/single" className="text-sm text-zinc-400 hover:text-white">Single</Link>
            <Link href="/marketplace" className="text-sm text-zinc-400 hover:text-white">Marketplace</Link>
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-8 flex flex-col">
        <div className="flex-1 space-y-6 mb-6">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-5 py-3 ${msg.role === "user" ? "bg-emerald-600" : "bg-zinc-900 border border-zinc-800"}`}>
                <p className="text-sm">{msg.content}</p>
                {msg.transaction && (
                  <p className="text-xs text-emerald-400 mt-2">
                    {msg.transaction.action.toUpperCase()} · {msg.transaction.amount} · ${msg.transaction.total}
                  </p>
                )}
                {msg.suggestedActions && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {msg.suggestedActions.map((action) => (
                      <button key={action} onClick={() => sendMessage(action)} className="text-xs px-3 py-1.5 rounded-full bg-zinc-800">
                        {action}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(input);
          }}
          className="flex gap-3"
        >
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Try acquire, retain, transfer, or buy…" className="flex-1 h-12 rounded-full bg-zinc-900 border border-zinc-800 px-5 text-sm" />
          <button disabled={loading || !input.trim()} className="h-12 px-6 rounded-full bg-emerald-600 text-sm disabled:opacity-50">Send</button>
        </form>
      </main>
    </div>
  );
}