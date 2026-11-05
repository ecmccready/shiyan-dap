"use client";

import React from "react";

export default function EvidencePage() {
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

        <div className="space-y-6">
          <div className="border border-zinc-800 rounded-xl p-6 bg-zinc-950">
            <h2 className="font-semibold mb-2">Persisted run</h2>
            <ul className="text-sm text-zinc-300 space-y-1">
              <li>Run ID and evidence hash</li>
              <li>Inputs and declared baseline</li>
              <li>Outputs and measured e / Φ</li>
              <li>Versions and timestamps</li>
              <li>Test results and provenance</li>
            </ul>
          </div>

          <div className="border border-zinc-800 rounded-xl p-6 bg-zinc-950">
            <h2 className="font-semibold mb-2">Reproducible verification</h2>
            <p className="text-sm text-zinc-400">
              Replay the run on a fresh plant. Independent checks return PASS, FAIL or SKIP. The evidence pack hash must match.
            </p>
          </div>

          <div className="border border-zinc-800 rounded-xl p-6 bg-zinc-950">
            <h2 className="font-semibold mb-2">Independent review</h2>
            <p className="text-sm text-zinc-400">
              Human reviewer records disposition against the proof contract. Only reviewed evidence advances to acquisition.
            </p>
          </div>
        </div>

        <p className="text-xs text-zinc-500 mt-10">
          Front door: /workbench/journey · Prove the outcome. Then decide.
        </p>
      </main>
    </div>
  );
}