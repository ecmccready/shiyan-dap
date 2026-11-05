"use client";

import React, { useState } from "react";

export default function ContractPage() {
  const [agreed, setAgreed] = useState(false);

  return (
    <div className="min-h-screen bg-black text-white">
      <main className="max-w-3xl mx-auto px-6 py-16">
        <p className="text-xs uppercase tracking-widest text-emerald-400 mb-4">
          Aethel Node · Proof Contract
        </p>

        <h1 className="text-4xl font-semibold mb-6">Agree the success conditions</h1>

        <p className="text-zinc-300 mb-10">
          Before any work begins, both parties agree what counts as success, how it will be measured, and what evidence is acceptable.
        </p>

        <div className="space-y-6 border border-zinc-800 rounded-xl p-6 bg-zinc-950 mb-8">
          <div>
            <div className="text-sm text-zinc-400 mb-1">Objective</div>
            <div>Reduce next-action error against a declared baseline.</div>
          </div>

          <div>
            <div className="text-sm text-zinc-400 mb-1">Baseline</div>
            <div>Current measured e and Φ on the reference task.</div>
          </div>

          <div>
            <div className="text-sm text-zinc-400 mb-1">Success metric</div>
            <div>Δe ≤ −0.05 and Φ improvement with full reproducibility hash.</div>
          </div>

          <div>
            <div className="text-sm text-zinc-400 mb-1">Acceptance threshold</div>
            <div>Independent verification returns PASS and human reviewer records disposition.</div>
          </div>

          <div>
            <div className="text-sm text-zinc-400 mb-1">Acceptable evidence</div>
            <div>Server-persisted run, trial hashes, evidence pack, and replay verification link.</div>
          </div>
        </div>

        {!agreed ? (
          <button
            onClick={() => setAgreed(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded"
          >
            Agree to proof contract
          </button>
        ) : (
          <div className="text-emerald-400">
            Contract agreed. Work may begin. Evidence will be measured against these conditions.
          </div>
        )}

        <p className="text-xs text-zinc-500 mt-10">
          Front door: /workbench/journey
        </p>
      </main>
    </div>
  );
}