"use client";

import React from "react";
import Link from "next/link";

export default function LoopPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <main className="max-w-3xl mx-auto px-6 py-16">
        <p className="text-xs uppercase tracking-widest text-emerald-400 mb-4">
          Aethel Node · Recursive Improvement
        </p>

        <h1 className="text-4xl font-semibold mb-6">The endogenous loop</h1>

        <p className="text-zinc-300 mb-10">
          Verified experience, including identity stability under metamorphic drift, feeds the next development and execution cycle. The system observes itself, evaluates what worked, and retains only what qualifies for reuse.
        </p>

        <div className="space-y-6 border border-zinc-800 rounded-xl p-6 bg-zinc-950 mb-8">
          <div className="text-center">
            <div className="font-semibold">Metamorphic result</div>
            <div className="text-sm text-zinc-400 mt-1">Φ 0.1612 · Converged under high-entropy drift</div>
          </div>
          <div className="text-center text-zinc-500">↓</div>
          <div className="text-center">
            <div className="font-semibold">Verified experience</div>
            <div className="text-sm text-zinc-400 mt-1">Recorded, hashed, independently reviewable</div>
          </div>
          <div className="text-center text-zinc-500">↓</div>
          <div className="text-center">
            <div className="font-semibold">Next cycle</div>
            <div className="text-sm text-zinc-400 mt-1">ROE uses the experience to inform the next action</div>
          </div>
          <div className="text-center text-emerald-400 text-2xl">↻</div>
        </div>

        <div className="flex gap-4">
          <Link
            href="/workbench/proof"
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded"
          >
            Inspect proof pack
          </Link>
          <Link
            href="/workbench/flywheel"
            className="border border-zinc-700 hover:border-zinc-500 text-white px-6 py-2 rounded"
          >
            Founder Reference Flywheel (Live)
          </Link>
          <Link
            href="/workbench/journey"
            className="border border-zinc-700 hover:border-zinc-500 text-white px-6 py-2 rounded"
          >
            Back to front door
          </Link>
        </div>

        <p className="text-xs text-zinc-500 mt-10">
          Recursive improvement: the metamorphic emergence is part of what the system retains.
        </p>

        <div className="mt-10 border-t border-zinc-800 pt-6">
          <div className="text-xs uppercase tracking-widest text-emerald-400 mb-2">Platform contract</div>
          <div className="text-sm text-zinc-400">
            Aethel Node Extension Architecture v1.1. Level 4 = authoritative execution and verification. Hugging Face = durable, versioned founder experience archive. ROE = retrieval, qualification and next-action selection. Flywheel = live, inspectable presentation.
          </div>
        </div>
      </main>
    </div>
  );
}