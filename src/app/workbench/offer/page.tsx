"use client";

import React from "react";
import Link from "next/link";

export default function OfferPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <main className="max-w-3xl mx-auto px-6 py-16">
        <p className="text-xs uppercase tracking-widest text-emerald-400 mb-4">
          Aethel Node · Commercial Offer
        </p>

        <h1 className="text-4xl font-semibold mb-6">Offer from demonstrated outcome</h1>

        <p className="text-zinc-300 mb-10">
          The offer is generated from the verified and reviewed evidence, including the metamorphic perturbation result. The customer sees the result before deciding to purchase.
        </p>

        <div className="border border-zinc-800 rounded-xl p-6 bg-zinc-950 mb-8 space-y-4">
          <div>
            <div className="text-sm text-zinc-400">Opportunity</div>
            <div>Robotics lead · Long-horizon task reliability</div>
          </div>
          <div>
            <div className="text-sm text-zinc-400">Demonstrated outcome</div>
            <div>Δe −0.05 · Φ 0.87 · Full reproducibility · Independent review accepted</div>
          </div>
          <div>
            <div className="text-sm text-zinc-400">Metamorphic check</div>
            <div>Predicted 0.88 → emergent 0.847 · Φ 0.1612 · Converged under high-entropy drift</div>
          </div>
          <div>
            <div className="text-sm text-zinc-400">Proposed commercial terms</div>
            <div>Enterprise subscription + usage-based execution + agreed outcome-based pilot fee</div>
          </div>
        </div>

        <div className="flex gap-4">
          <Link
            href="/workbench/convert"
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded"
          >
            Proceed to conversion
          </Link>
          <Link
            href="/workbench/proof"
            className="border border-zinc-700 hover:border-zinc-500 text-white px-6 py-2 rounded"
          >
            Inspect proof pack
          </Link>
          <Link
            href="/workbench/flywheel"
            className="border border-zinc-700 hover:border-zinc-500 text-white px-6 py-2 rounded"
          >
            Founder Reference Flywheel (Live)
          </Link>
        </div>

        <p className="text-xs text-zinc-500 mt-10">
          Payment follows proof. Front door: /workbench/journey
        </p>

        <div className="mt-10 border-t border-zinc-800 pt-6">
          <div className="text-xs uppercase tracking-widest text-emerald-400 mb-2">Platform contract</div>
          <div className="text-sm text-zinc-400">
            Aethel Node Extension Architecture v1.1. A third-party Workbench produces ExperienceRecord, VerificationResult, MetamorphicResult, and NextActionProposal without modifying the core engine.
          </div>
        </div>
      </main>
    </div>
  );
}