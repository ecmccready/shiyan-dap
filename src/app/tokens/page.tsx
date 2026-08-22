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

  const createDemoToken = async () => {
    const res = await fetch("/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        symbol: "SYSH",
        name: "Shiyan Yishu Token",
        domain: "music",
        owner: "ECMcCready",
        initialSupply: 1000,
        price: 1.5,
      }),
    });
    const data = await res.json();
    if (data.success) {
      setMessage(`Created token: ${data.token.symbol}`);
      loadTokens();
    }
  };

  const executeAction = async (
    tokenId: string,
    action: "buy" | "sell" | "trade"
  ) => {
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
    if (data.success) {
      setMessage(
        `${action.toUpperCase()} successful — ${data.transaction.amount} tokens for $${data.transaction.total}`
      );
      loadTokens();
    } else {
      setMessage(data.error || "Transaction failed");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-zinc-400">Loading tokens…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-zinc-800/80">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="font-semibold tracking-tight text-lg">
              Shiyan Yishu
            </Link>
            <span className="text-zinc-500 text-sm">Tokens</span>
          </div>
          <nav className="flex items-center gap-8">
            <Link
              href="/marketplace"
              className="text-sm text-zinc-400 hover:text-white transition-colors"
            >
              Marketplace
            </Link>
            <Link
              href="/nfts"
              className="text-sm text-zinc-400 hover:text-white transition-colors"
            >
              My NFTs
            </Link>
            <Link
              href="/dashboard"
              className="text-sm text-zinc-400 hover:text-white transition-colors"
            >
              Dashboard
              <Link
  href="/measurements"
  className="text-sm text-zinc-400 hover:text-white transition-colors duration-200"
>
  Measurements
</Link>
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">Tokens</h1>
            <p className="text-zinc-400">
              Buy · Sell · Trade across every domain
            </p>
          </div>
          <button
            onClick={createDemoToken}
            className="h-11 px-6 rounded-full bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 transition-colors"
          >
            Create Demo Token
          </button>
        </div>

        {message && (
          <div className="mb-6 p-4 rounded-xl bg-zinc-900 border border-zinc-800 text-sm">
            {message}
          </div>
        )}

        {tokens.length === 0 ? (
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-12 text-center">
            <p className="text-zinc-400 mb-4">No tokens yet.</p>
            <button
              onClick={createDemoToken}
              className="h-11 px-6 rounded-full bg-emerald-600 text-white text-sm font-medium"
            >
              Create First Token
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {tokens.map((token) => (
              <div
                key={token.id}
                className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-semibold">{token.symbol}</h2>
                    <p className="text-sm text-zinc-400">{token.name}</p>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-300">
                    {token.domain}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-4 text-sm mb-6">
                  <div>
                    <p className="text-zinc-500 text-xs">Price</p>
                    <p className="font-medium">${token.price}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500 text-xs">Balance</p>
                    <p className="font-medium">{token.balance}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500 text-xs">Owner</p>
                    <p className="font-medium text-sm">{token.owner}</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => executeAction(token.id, "buy")}
                    className="flex-1 h-10 rounded-full bg-emerald-600/90 text-white text-sm font-medium hover:bg-emerald-500"
                  >
                    Buy
                  </button>
                  <button
                    onClick={() => executeAction(token.id, "sell")}
                    className="flex-1 h-10 rounded-full bg-amber-600/90 text-white text-sm font-medium hover:bg-amber-500"
                  >
                    Sell
                  </button>
                  <button
                    onClick={() => executeAction(token.id, "trade")}
                    className="flex-1 h-10 rounded-full bg-purple-600/90 text-white text-sm font-medium hover:bg-purple-500"
                  >
                    Trade
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}