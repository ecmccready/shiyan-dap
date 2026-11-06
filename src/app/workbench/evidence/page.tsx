"use client";

import React, { useEffect, useState } from "react";

type Evidence = {
  id: string;
  run_id: string;
  hash: string;
  baseline: string;
  measured_e: number;
  measured_phi: number;
  verified: boolean;
  reviewed: boolean;
  created_at: string;
};

export default function EvidencePage() {
  const [evidence, setEvidence] = useState<Evidence | null>(null);

  useEffect(() => {
    // In production this fetches from /api/evidence.
    // Fixture matches the shape the API will return.
    setEvidence({
      id: "ev_demo_1",
      run_id: "run_20261105_001",
      hash: "a1b2c3d4e5f6",
      baseline: "Current measured e and Φ",
      measured_e: 0.12,
      measured_phi: 0.87,
      verified: true,
      reviewed: false,
      created_at: new Date().toISOString(),
    });
  }, []);

  if (!evidence) return null;

  return (
    <div className="min-h-screen bg-black text-white">
      <main className="max-w-3xl mx-auto px-6 py-16">
        <p className="text-xs uppercase tracking-widest text-emerald-400 mb-4">
          Aethel Node · Authoritative Evidence
        </p>

        <h1 className="text-4xl font-semibold mb-6">Evidence that can be checked</h1>

        <p className="text-zinc-300 mb-10">
          Runs are persisted server-side. Inputs, outputs, versions, timestamps, test results and provenance are recorded. Verification is reproducible. Independent review is available.
        </p>

        <div className="border border-zinc-800 rounded-xl p-6 bg-zinc-950 space-y-4">
          <div className="flex justify-between">
            <div>
              <div className="text-sm text-zinc-400">Run</div>
              <div className="font-mono">{evidence.run_id}</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-zinc-400">Hash</div>
              <div className="font-mono text-sm">{evidence.hash}</div>
            </div>
          </div>

          <div>
            <div className="text-sm text-zinc-400">Baseline</div>
            <div>{evidence.baseline}</div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-zinc-400">Measured e</div>
              <div>{evidence.measured_e}</div>
            </div>
            <div>
              <div className="text-sm text-zinc-400">Measured Φ</div>
              <div>{evidence.measured_phi}</div>
            </div>
          </div>

          <div className="flex gap-4 text-sm">
            <div className={evidence.verified ? "text-emerald-400" : "text-zinc-500"}>
              {evidence.verified ? "Verified" : "Not verified"}
            </div>
            <div className={evidence.reviewed ? "text-emerald-400" : "text-zinc-500"}>
              {evidence.reviewed ? "Reviewed" : "Awaiting review"}
            </div>
          </div>
        </div>

        <p className="text-xs text-zinc-500 mt-10">
          Front door: /workbench/journey · Prove the outcome. Then decide.
        </p>
      </main>
    </div>
  );
}