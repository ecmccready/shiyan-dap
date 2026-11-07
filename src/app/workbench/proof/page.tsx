"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

type ProofPack = {
  id: string;
  hash: string;
  run_id: string;
  predicted: number;
  emergent: number;
  phi: number;
  converged: boolean;
  created_at: string;
};

export default function ProofPage() {
  const [pack, setPack] = useState<ProofPack | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/metamorphic")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load proof pack");
        return res.json();
      })
      .then((data) => setPack(data.pack))
      .catch((err) => setError(err.message));
  }, []);

  function exportPack() {
    if (!pack) return;
    const blob = new Blob([JSON.stringify(pack, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${pack.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white">
        <main className="max-w-3xl mx-auto px-6 py-16">
          <p className="text-red-400">{error}</p>
        </main>
      </div>
    );
  }

  if (!pack) {
    return (
      <div className="min-h-screen bg-black text-white">
        <main className="max-w-3xl mx-auto px-6 py-16">
          <p className="text-zinc-400">Loading proof pack…</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <main className="max-w-3xl mx-auto px-6 py-16">
        <p className="text-xs uppercase tracking-widest text-emerald-400 mb-4">
          Aethel Node · Proof Pack
        </p>

        <h1 className="text-4xl font-semibold mb-6">High-entropy proof pack</h1>

        <p className="text-zinc-300 mb-10">
          Generated from the metamorphic perturbation. The pack is content-hashed and can be validated independently. It records predicted vs emergent observation and whether system identity (Φ) held under drift.
        </p>

        <div className="border border-zinc-800 rounded-xl p-6 bg-zinc-950 space-y-4">
          <div className="flex justify-between">
            <div>
              <div className="text-sm text-zinc-400">Pack</div>
              <div className="font-mono">{pack.id}</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-zinc-400">Hash</div>
              <div className="font-mono text-sm">{pack.hash}</div>
            </div>
          </div>

          <div>
            <div className="text-sm text-zinc-400">Run</div>
            <div className="font-mono">{pack.run_id}</div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-zinc-400">Predicted</div>
              <div>{pack.predicted}</div>
            </div>
            <div>
              <div className="text-sm text-zinc-400">Emergent observed</div>
              <div>{pack.emergent}</div>
            </div>
            <div>
              <div className="text-sm text-zinc-400">Φ (.self())</div>
              <div>{pack.phi}</div>
            </div>
            <div>
              <div className="text-sm text-zinc-400">Converged</div>
              <div className={pack.converged ? "text-emerald-400" : "text-red-400"}>
                {pack.converged ? "Yes" : "No"}
              </div>
            </div>
          </div>

          <div className="text-xs text-zinc-500">
            Created {new Date(pack.created_at).toLocaleString()}
          </div>
        </div>

        <button
          onClick={exportPack}
          className="mt-6 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded"
        >
          Export proof pack
        </button>

        <Link
          href="/workbench/flywheel"
          className="inline-block border border-zinc-700 hover:border-zinc-500 text-white px-6 py-2 rounded mt-4"
        >
          Founder Reference Flywheel (Live)
        </Link>

        <p className="text-xs text-zinc-500 mt-10">
          Front door: /workbench/journey · Prove the outcome. Then decide.
        </p>

        <div className="mt-10 border-t border-zinc-800 pt-6">
          <div className="text-xs uppercase tracking-widest text-emerald-400 mb-2">Platform contract</div>
          <div className="text-sm text-zinc-400">
            Aethel Node Extension Architecture v1.1. A third-party Workbench produces ExperienceRecord, VerificationResult, MetamorphicResult, and NextActionProposal without modifying the core engine.
          </div>
        </div>

        <div className="mt-6 border border-zinc-800 rounded-xl p-5 bg-zinc-950">
          <div className="text-xs uppercase tracking-widest text-emerald-400 mb-2">Live telemetry</div>
          <div className="text-sm text-zinc-400">
            POST /api/v1/telemetry with predicted and observed values. The metamorphic engine evaluates Φ under drift. POST /api/v1/proof hashes and stores the result as an experience record.
          </div>
        </div>

        <div className="mt-6 border border-zinc-800 rounded-xl p-5 bg-zinc-950">
          <div className="text-xs uppercase tracking-widest text-emerald-400 mb-2">Drift review</div>
          <div className="text-sm text-zinc-400">
            When Φ does not converge, the telemetry response includes review_flag: "DRIFT_EXCEEDED". Flag the runtime for human review.
          </div>
        </div>

        <div className="mt-6 border border-zinc-800 rounded-xl p-5 bg-zinc-950">
          <div className="text-xs uppercase tracking-widest text-emerald-400 mb-2">Automated proof</div>
          <div className="text-sm text-zinc-400">
            POST /api/v1/proof hashes the telemetry result and stores it as an experience record. The proof is content-hashed and available for inspection.
          </div>
        </div>

        <div className="mt-6 border border-zinc-800 rounded-xl p-5 bg-zinc-950">
          <div className="text-xs uppercase tracking-widest text-emerald-400 mb-2">Live middleware</div>
          <div className="text-sm text-zinc-400">
            /api/v1/telemetry accepts predicted and observed values. The metamorphic engine evaluates Φ under drift. Non-converged runs return review_flag: "DRIFT_EXCEEDED". /api/v1/proof hashes and stores the result as an experience record.
          </div>
        </div>
      </main>
    </div>
  );
}