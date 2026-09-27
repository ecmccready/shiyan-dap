"use client";

import { useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

export default function HomePage() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");

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
        data.text ||
          data.z ||
          data.message ||
          "A named the next action from z."
      );
    } catch {
      setResult("A could not reach the agent rail.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-emerald-400 mb-3">Workspace A · controller</p>
        <h1 className="text-3xl font-bold mb-3">Workspace A</h1>
        <p className="text-zinc-400 max-w-2xl mb-8">
          Music is the first vertical, not the product boundary. A is the
          controller: Self() writes z from the ledger and names y. Workbench
          measurement still produces z. You Buy as B — Workspace B is a
          potential customer in scope, not an environment-only role.
          Healthcare, enterprise agentic, and general-purpose SaaS pathways
          are commercial intent. /offer is the Buy as B rail.
        </p>

        <div className="flex flex-wrap gap-3 mb-8">
          <Link
            href="/workspace"
            className="h-12 px-6 rounded-full bg-emerald-600 text-sm inline-flex items-center"
          >
            Workspace A
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
            Playlists
          </Link>
          <Link
            href="/single"
            className="h-12 px-6 rounded-full bg-emerald-600 text-sm inline-flex items-center"
          >
            Songs
          </Link>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 mb-8">
          <p className="text-sm text-zinc-400 mb-4">
            Workbench is linked inside Workspace A. It measures z. It is not
            a home-page rail. Buyer B stays in scope on /offer.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/workbench"
              className="h-11 px-6 rounded-full bg-emerald-600 text-sm inline-flex items-center"
            >
              Open Workbench inside A
            </Link>
            <Link
              href="/offer"
              className="h-11 px-6 rounded-full border border-zinc-700 text-sm inline-flex items-center"
            >
              Buy as B
            </Link>
          </div>
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