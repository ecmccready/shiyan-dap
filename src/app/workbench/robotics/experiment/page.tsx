"use client";

import React from "react";
import Link from "next/link";

export default function RoboticsExperimentPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <main className="max-w-3xl mx-auto px-6 py-16">
        <p className="text-xs uppercase tracking-widest text-emerald-400 mb-4">
          Aethel Node · Robotics Experiment
        </p>

        <h1 className="text-4xl font-semibold mb-6">Persistent-autonomy experiment</h1>

        <p className="text-zinc-300 mb-10">
          Deterministic simulator for look-back versus greedy. The ROE path now includes a metamorphic perturbation that tests whether system identity (Φ) holds under high-entropy drift.
        </p>

        <div className="border border-zinc-800 rounded-xl p-6 bg-zinc-950 mb-8 space-y-4">
          <div>
            <div className="text-sm text-zinc-400">Baseline Φ</div>
            <div>0.159</div>
          </div>
          <div>
            <div className="text-sm text-zinc-400">Metamorphic check</div>
            <div>Predicted 0.88 → emergent 0.847 · New Φ 0.1612 · Converged</div>
          </div>
          <div>
            <div className="text-sm text-zinc-400">Evidence pack</div>
            <div className="font-mono">pack_meta_1 · c3d4e5f6a1b2</div>
          </div>
        </div>

        <p className="text-sm text-zinc-400">
          Run the experiment script locally to emit the dice roll. The high-entropy pack is available at{" "}
          <a href="/workbench/proof" className="text-emerald-400 hover:underline">/workbench/proof</a>.
        </p>

        <p className="text-xs text-zinc-500 mt-10">
          Front door: /workbench/journey · Prove the outcome. Then decide.
        </p>

        <Link
          href="/workbench/flywheel"
          className="inline-block border border-zinc-700 hover:border-zinc-500 text-white px-6 py-2 rounded mt-6"
        >
          Founder Reference Flywheel (Live)
        </Link>

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
      </main>
    </div>
  );
}