"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function TokensPage() {
  const [tokens, setTokens] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const loadTokens = async () => {
    try {
      const res = await fetch("/api/token");
      const data = await res.json();
      setTokens(data.tokens || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTokens();
  }, []);

  const executeAction = async (tokenId: string, action: "buy" | "sell" | "trade") => {
    const res = await fetch("/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        tokenId,
        from: "ECMcCready",
        to: action === "buy" ? "ECMcCready" : "Marketplace",
        amount: 10,
      }),
    });
    const data = await res.json();
    setMessage(data.success ? `${action.toUpperCase()} successful` : data.error || "Failed");
    if (data.success) loadTokens();
  };

  if (loading) {
    return <div className="min-h-screen bg-black text-white flex items-center justify-center"><p className="text-zinc-400">Loading tokens…</p></div>;
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-zinc-800/80">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="font-semibold tracking-tight text-lg">Shiyan Yishu</Link>
            <span className="text-zinc-500 text-sm">Tokens</span>
          </div>
          <nav className="flex items-center gap-6">
            <Link href="/marketplace" className="text-sm text-zinc-400 hover:text-white">Marketplace</Link>
            <Link href="/playlist" className="text-sm text-zinc-400 hover:text-white">Playlist</Link>
            <Link href="/single" className="text-sm text-zinc-400 hover:text-white">Single</Link>
            <Link href="/bot" className="text-sm text-zinc-400 hover:text-white">Grok Bot</Link>
            <Link href="/home" className="text-sm text-zinc-400 hover:text-white">Home</Link>
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Tokens</h1>
        <p className="text-zinc-400 mb-8">Buy · Sell · Trade across every domain</p>
        {message && <div className="mb-6 p-4 rounded-xl bg-zinc-900 border border-zinc-800 text-sm">{message}</div>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {tokens.map((token) => (
            <div key={token.id} className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
              <h2 className="text-xl font-semibold">{token.symbol}</h2>
              <p className="text-sm text-zinc-400 mb-4">{token.name}</p>
              <p className="text-sm mb-4">${token.price} · Balance {token.balance}</p>
              <div className="flex gap-3">
                <button onClick={() => executeAction(token.id, "buy")} className="flex-1 h-10 rounded-full bg-emerald-600 text-white text-sm">Buy</button>
                <button onClick={() => executeAction(token.id, "sell")} className="flex-1 h-10 rounded-full bg-amber-600 text-white text-sm">Sell</button>
                <button onClick={() => executeAction(token.id, "trade")} className="flex-1 h-10 rounded-full bg-purple-600 text-white text-sm">Trade</button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}