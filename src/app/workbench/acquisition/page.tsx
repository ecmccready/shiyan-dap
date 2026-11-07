"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

type Opportunity = {
  id: string;
  prospect: string;
  problem: string;
  proposedValue: string;
  objective: string;
  baseline: string;
  successMetric: string;
  acceptanceThreshold: string;
  status?: string;
};

export default function AcquisitionPage() {
  const [records, setRecords] = useState<Opportunity[]>([]);
  const [approved, setApproved] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setRecords([
      {
        id: "opp_demo_1",
        prospect: "Robotics lead",
        problem: "Long-horizon task reliability and intervention reduction",
        proposedValue: "Measured reduction in interventions with verified evidence, including Φ stability under metamorphic drift",
        objective: "Reduce next-action error against baseline",
        baseline: "Current measured e and Φ",
        successMetric: "Δe ≤ −0.05 with full reproducibility and Φ convergence under high-entropy drift",
        acceptanceThreshold: "Independent verification PASS + human disposition",
      },
    ]);
  }, []);

  function approve(id: string) {
    setApproved((prev) => ({ ...prev, [id]: true }));
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <main className="max-w-4xl mx-auto px-6 py-16">
        <p className="text-xs uppercase tracking-widest text-emerald-400 mb-4">
          Aethel Node · Acquisition Agent
        </p>

        <h1 className="text-4xl font-semibold mb-6">Opportunity qualification</h1>

        <p className="text-zinc-300 mb-10">
          Opportunity records appear here. The agent matches them to Global or Developer Workbench and drafts an offer that can include the metamorphic Φ stability evidence. Human approval is required before outreach. Acquisition remains gated until the five evidence conditions are met.
        </p>

        <div className="mb-8">
          <Link
            href="/workbench/conditions"
            className="inline-block border border-zinc-700 hover:border-zinc-500 text-white px-6 py-2 rounded text-sm"
          >
            View five evidence conditions
          </Link>
          <Link
            href="/workbench/flywheel"
            className="inline-block border border-zinc-700 hover:border-zinc-500 text-white px-6 py-2 rounded text-sm"
          >
            Founder Reference Flywheel
          </Link>
        </div>

        <div className="space-y-6">
          {records.map((opp) => (
            <div key={opp.id} className="border border-zinc-800 rounded-xl p-6 bg-zinc-950">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="font-semibold">{opp.prospect}</div>
                  <div className="text-sm text-zinc-400">{opp.id}</div>
                </div>
                <span className="text-xs bg-zinc-800 px-2 py-1 rounded">Developer Workbench</span>
              </div>

              <div className="mb-3">
                <div className="text-sm text-zinc-400">Problem</div>
                <div>{opp.problem}</div>
              </div>

              <div className="mb-3">
                <div className="text-sm text-zinc-400">Proposed value</div>
                <div>{opp.proposedValue}</div>
              </div>

              <div className="mb-4">
                <div className="text-sm text-zinc-400">Success conditions</div>
                <div className="text-sm">{opp.successMetric} · {opp.acceptanceThreshold}</div>
              </div>

              {approved[opp.id] ? (
                <div className="text-emerald-400 text-sm">Approved for outreach</div>
              ) : (
                <button
                  onClick={() => approve(opp.id)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded text-sm"
                >
                  Approve outreach
                </button>
              )}
            </div>
          ))}
        </div>

        <p className="text-xs text-zinc-500 mt-10">
          Fixture data. Real records will appear once the opportunity API is durable. Metamorphic evidence is available at /workbench/proof.
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
      </main>
    </div>
  );
}