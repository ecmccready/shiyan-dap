"use client";

import { useState } from "react";
import Link from "next/link";

interface Message {
  role: "user" | "bot";
  content: string;
  suggestedActions?: string[];
}

export default function BotPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "bot",
      content:
        "I’m the Grok Bot sitting on top of your Clusters. I can help you Explore, Buy, Sell, or Trade. What would you like to do?",
      suggestedActions: ["Explore Clusters", "Buy", "Sell", "Trade"],
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;

    const userMessage: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          mode: "simulated",
        }),
      });

      const data = await res.json();

      const botMessage: Message = {
        role: "bot",
        content: data.reply || "I didn’t catch that.",
        suggestedActions: data.suggestedActions,
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "bot", content: "Something went wrong. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleSuggestion = (action: string) => {
    sendMessage(action);
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-800/80">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="font-semibold tracking-tight text-lg">
              Shiyan Yishu
            </Link>
            <span className="text-zinc-500 text-sm">Grok Bot</span>
          </div>
          <nav className="flex items-center gap-6">
            <Link
              href="/marketplace"
              className="text-sm text-zinc-400 hover:text-white transition-colors"
            >
              Marketplace
            </Link>
            <Link
              href="/tokens"
              className="text-sm text-zinc-400 hover:text-white transition-colors"
            >
              Tokens
            </Link>
            <Link
              href="/dashboard"
              className="text-sm text-zinc-400 hover:text-white transition-colors"
            >
              Dashboard
            </Link>
          </nav>
        </div>
      </header>

      {/* Chat Area */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-8 flex flex-col">
        <div className="flex-1 space-y-6 overflow-y-auto mb-6">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-5 py-3 ${
                  msg.role === "user"
                    ? "bg-emerald-600 text-white"
                    : "bg-zinc-900 border border-zinc-800 text-zinc-100"
                }`}
              >
                <p className="text-sm leading-relaxed">{msg.content}</p>

                {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {msg.suggestedActions.map((action) => (
                      <button
                        key={action}
                        onClick={() => handleSuggestion(action)}
                        className="text-xs px-3 py-1.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                      >
                        {action}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-3">
                <p className="text-sm text-zinc-400">Thinking…</p>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about Buy, Sell, Trade, or explore clusters…"
            className="flex-1 h-12 rounded-full bg-zinc-900 border border-zinc-800 px-5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="h-12 px-6 rounded-full bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 disabled:opacity-50 transition-colors"
          >
            Send
          </button>
        </form>
      </main>
    </div>
  );
}