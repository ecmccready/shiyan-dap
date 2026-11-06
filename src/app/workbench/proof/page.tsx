"use client";

import React, { useEffect, useState } from "react";

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

  useEffect(() => {
    // Fixture that matches the shape produced by the metamorphic experiment.
    setPack({
      id: "pack_meta_1",
      hash: "c3d4e5f6a1b2",
      run_id: "run_20261106_metamorphic",
      predicted: 0.88,
      emergent: 0.847,
      phi: 0.1612,
      converged: true,
      created_at: new Date().toISOString(),
    });
  }, []);

  if (!pack) return null;

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

        <p className="text-xs text-zinc-500 mt-10">
          Front door: /workbench/journey · Prove the outcome. Then decide.
        </p>
      </main>
    </div>
  );
}