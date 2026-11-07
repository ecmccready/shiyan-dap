"use client";

import React, { useState } from "react";
import Link from "next/link";

export default function ContractPage() {
  const [agreed, setAgreed] = useState(false);
  const [contractId, setContractId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const contract = {
    objective: "Reduce next-action error against a declared baseline.",
    baseline: "Current measured e and Φ on the reference task.",
    successMetric: "Δe ≤ −0.05 and Φ improvement with full reproducibility hash.",
    acceptanceThreshold: "Independent verification returns PASS and human reviewer records disposition.",
    acceptableEvidence: "Server-persisted run, trial hashes, evidence pack, and replay verification link.",
  };

  async function agree() {
    setError(null);
    try {
      const res = await fetch("/api/contract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contract),
      });

      if (!res.ok) throw new Error("Failed to record contract");

      const data = await res.json();
      setContractId(data.contract.id);
      setAgreed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }

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
            <div>{contract.objective}</div>
          </div>

          <div>
            <div className="text-sm text-zinc-400 mb-1">Baseline</div>
            <div>{contract.baseline}</div>
          </div>

          <div>
            <div className="text-sm text-zinc-400 mb-1">Success metric</div>
            <div>{contract.successMetric}</div>
          </div>

          <div>
            <div className="text-sm text-zinc-400 mb-1">Acceptance threshold</div>
            <div>{contract.acceptanceThreshold}</div>
          </div>

          <div>
            <div className="text-sm text-zinc-400 mb-1">Acceptable evidence</div>
            <div>{contract.acceptableEvidence}</div>
          </div>
        </div>

        {!agreed ? (
          <button
            onClick={agree}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded"
          >
            Agree to proof contract
          </button>
        ) : (
          <div className="text-emerald-400">
            Contract recorded as {contractId}. Work may begin.
          </div>
        )}

        {error && <p className="text-red-400 text-sm mt-4">{error}</p>}

        <p className="text-xs text-zinc-500 mt-10">
          Front door: /workbench/journey
        </p>

        <Link
          href="/workbench/flywheel"
          className="inline-block border border-zinc-700 hover:border-zinc-500 text-white px-6 py-2 rounded mt-6"
        >
          Founder Reference Flywheel
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