"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

type MetamorphicResult = {
  step: number;
  observedValue: number;
  predictedValue: number;
  phi: number;
  converged: boolean;
};

export default function ExecutePage() {
  const [result, setResult] = useState<MetamorphicResult | null>(null);

  useEffect(() => {
    // Fixture that matches the MetamorphicEngine output shape.
    // In production this can be read from the experiment run artifact.
    setResult({
      step: 2,
      observedValue: 0.847,
      predictedValue: 0.88,
      phi: 0.1612,
      converged: true,
    });
  }, []);

  return (
    <div className="min-h-screen bg-black text-white">
      <main className="max-w-3xl mx-auto px-6 py-16">
        <p className="text-xs uppercase tracking-widest text-emerald-400 mb-4">
          Aethel Node · Workbench Execution
        </p>

        <h1 className="text-4xl font-semibold mb-6">Connect and run</h1>

        <p className="text-zinc-300 mb-10">
          Execution is bound to the proof contract. Global produces traceable diagnostic evidence. Developer runs acceptance tests against the connected repository and compares baseline versus regression. The ROE path now includes a metamorphic perturbation check.
        </p>

        <div className="grid gap-6 md:grid-cols-2 mb-10">
          <div className="border border-zinc-800 rounded-xl p-6 bg-zinc-950">
            <h2 className="font-semibold mb-3">Global</h2>
            <p className="text-sm text-zinc-400 mb-4">
              Investigate a defined diagnostic problem and produce source-linked, reviewable evidence.
            </p>
            <ul className="text-sm space-y-1 text-zinc-300">
              <li>Defined problem</li>
              <li>Traceable findings</li>
              <li>Human review disposition</li>
            </ul>
          </div>

          <div className="border border-zinc-800 rounded-xl p-6 bg-zinc-950">
            <h2 className="font-semibold mb-3">Developer</h2>
            <p className="text-sm text-zinc-400 mb-4">
              Connect the repository, define acceptance tests, run TDD, and compare results.
            </p>
            <ul className="text-sm space-y-1 text-zinc-300">
              <li>Repository: github.com/ecmccready/shiyan-dap</li>
              <li>Acceptance tests defined</li>
              <li>Baseline vs regression</li>
            </ul>
          </div>
        </div>

        {result && (
          <div className="border border-zinc-800 rounded-xl p-6 bg-zinc-950">
            <h2 className="font-semibold mb-4">Metamorphic perturbation · Φ stability</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-zinc-400">Step</div>
                <div>{result.step}</div>
              </div>
              <div>
                <div className="text-zinc-400">Converged</div>
                <div className={result.converged ? "text-emerald-400" : "text-red-400"}>
                  {result.converged ? "Yes" : "No"}
                </div>
              </div>
              <div>
                <div className="text-zinc-400">Predicted</div>
                <div>{result.predictedValue}</div>
              </div>
              <div>
                <div className="text-zinc-400">Emergent observed</div>
                <div>{result.observedValue}</div>
              </div>
              <div>
                <div className="text-zinc-400">New Φ (.self())</div>
                <div>{result.phi}</div>
              </div>
            </div>
            <p className="text-xs text-zinc-500 mt-4">
              Dice rolled against the deterministic anchor. Identity variance under high-entropy drift is recorded.
            </p>
          </div>
        )}

        <Link
          href="/workbench/flywheel"
          className="inline-block border border-zinc-700 hover:border-zinc-500 text-white px-6 py-2 rounded mt-6"
        >
          Founder Reference Flywheel
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
      </main>
    </div>
  );
}