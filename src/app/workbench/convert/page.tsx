"use client";

import React, { useState } from "react";

export default function ConvertPage() {
  const [ready, setReady] = useState(false);

  return (
    <div className="min-h-screen bg-black text-white">
      <main className="max-w-3xl mx-auto px-6 py-16">
        <p className="text-xs uppercase tracking-widest text-emerald-400 mb-4">
          Aethel Node · Conversion
        </p>

        <h1 className="text-4xl font-semibold mb-6">Prove the outcome. Then decide.</h1>

        <p className="text-zinc-300 mb-10">
          Evidence has been verified and reviewed. The metamorphic check confirms identity stability under drift. The customer can now accept the result and purchase the demonstrated outcome.
        </p>

        <div className="border border-zinc-800 rounded-xl p-6 bg-zinc-950 mb-8 space-y-4">
          <div>
            <div className="text-sm text-zinc-400">Opportunity</div>
            <div>Robotics lead · Long-horizon task reliability</div>
          </div>
          <div>
            <div className="text-sm text-zinc-400">Evidence</div>
            <div className="font-mono">ev_demo_1 · Verified · Accepted</div>
          </div>
          <div>
            <div className="text-sm text-zinc-400">Measured improvement</div>
            <div>Δe −0.05 · Φ 0.87 · Full reproducibility</div>
          </div>
          <div>
            <div className="text-sm text-zinc-400">Metamorphic check</div>
            <div>Predicted 0.88 → emergent 0.847 · Φ 0.1612 · Converged</div>
          </div>
        </div>

        {!ready ? (
          <button
            onClick={() => setReady(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded"
          >
            Accept result and proceed to purchase
          </button>
        ) : (
          <div className="text-emerald-400">
            Result accepted. Commercial conversion is now available.
          </div>
        )}

        <p className="text-xs text-zinc-500 mt-10">
          Front door: /workbench/journey · Payment follows proof.
        </p>
      </main>
    </div>
  );
}