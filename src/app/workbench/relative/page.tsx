"use client";

import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

export default function RelativeMovementPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Workbench B · Relative" />
      <main className="max-w-4xl mx-auto px-6 py-12 space-y-12">
        <header>
          <p className="text-emerald-400 text-xs uppercase tracking-widest mb-3">
            Relative-scope mathematics · reference algorithm
          </p>
          <h1 className="text-3xl font-bold mb-4">
            State → relative error → action → measured improvement → next action
          </h1>
          <p className="text-zinc-400 max-w-2xl">
            Common algorithmic core across Shiyan, Workspace A, Workbench B, and Run history. Φ only when final e falls. Self() can consume approved experience; baseline Self() remains memory-free for comparison.
          </p>
          <Link href="/workbench/self" className="text-emerald-400 text-sm hover:underline mt-2 inline-block">
            → Level 3 proof
          </Link>
        </header>

        {/* sections 1–5 remain exactly as in your current committed file */}

        <footer className="flex flex-wrap gap-4 text-sm">
          <Link href="/workbench/self" className="text-emerald-400 hover:underline">Level 3 proof →</Link>
          <Link href="/workbench/shiyan" className="text-emerald-400 hover:underline">← Shiyan plant</Link>
          <Link href="/workbench" className="text-emerald-400 hover:underline">Workbench B</Link>
          <Link href="/workbench/history" className="text-emerald-400 hover:underline">History</Link>
          <Link href="/workbench/marketplace" className="text-emerald-400 hover:underline">Marketplace</Link>
        </footer>
      </main>
    </div>
  );
}