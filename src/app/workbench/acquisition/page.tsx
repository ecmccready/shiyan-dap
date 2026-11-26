"use client";

import React, { useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

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

const LOCAL_OPPORTUNITY: Opportunity = {
  id: "opp_demo_1",
  prospect: "Workload owner",
  problem: "A computational workload that may map to the ECP5 Versa",
  proposedValue: "A controlled assessment: baseline, 4D-SCP candidates, and a labeled proof package",
  objective: "Hand the workload to Stage 01 Discover",
  baseline: "Not yet measured on this record",
  successMetric: "Bit-exact simulation and a five-seed route, labeled separately from any physical measurement",
  acceptanceThreshold: "Human qualification only. Nothing is sent.",
};

export default function AcquisitionPage() {
  const records = [LOCAL_OPPORTUNITY];
  const [approved, setApproved] = useState<Record<string, boolean>>({});

  function approve(id: string) {
    setApproved((prev) => ({ ...prev, [id]: true }));
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader brand="Shiyan DAP" section="Acquisition" />
      <main className="max-w-4xl mx-auto px-6 py-16">
        <p className="text-xs uppercase tracking-widest text-emerald-400 mb-4">
          Aethel Node · Acquisition · semiconductor journey
        </p>

        <h1 className="text-4xl font-semibold mb-6">Qualify a workload, then hand it to Discover</h1>

        <p className="text-zinc-300 mb-6">
          Know what the workload is. Know how 4D-SCP and the Versa path work. Show the reference card and the ledger. Do: hand off to Stage 01 Discover. The agent does not redefine the semiconductor core. This page does not send email, messages, or outreach.
        </p>
        <ol className="mb-8 list-decimal space-y-1 pl-5 text-sm text-zinc-300">
          <li>Know — the workload and the constraint.</li>
          <li>Know-how — 4D-SCP exploration and the ECP5 Versa (LFE5UM-45F) target.</li>
          <li>Show — the v0.1.31 reference card and the Reference Data Ledger.</li>
          <li>Do — open Discover. Nothing is transmitted.</li>
        </ol>

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
                <span className="text-xs bg-zinc-800 px-2 py-1 rounded">Local fixture</span>
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
                <div className="text-sm text-emerald-400">
                  Qualified locally. Nothing was sent.{" "}
                  <Link className="underline" href="/assess">Hand off to Discover</Link>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => approve(opp.id)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded text-sm"
                >
                  Mark qualified locally
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
            When Φ does not converge, the telemetry response includes review_flag DRIFT_EXCEEDED. Flag the runtime for human review.
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
            /api/v1/telemetry accepts predicted and observed values. The metamorphic engine evaluates Φ under drift. Non-converged runs return review_flag DRIFT_EXCEEDED. /api/v1/proof hashes and stores the result as an experience record.
          </div>
        </div>

        <div className="mt-6 border border-zinc-800 rounded-xl p-5 bg-zinc-950">
          <div className="text-xs uppercase tracking-widest text-emerald-400 mb-2">Auto proof</div>
          <div className="text-sm text-zinc-400">
            Include auto_proof: true in the telemetry POST. The route hashes and stores the result as an experience record and returns experience_id and hash.
          </div>
        </div>

        <div className="mt-6 border border-zinc-800 rounded-xl p-5 bg-zinc-950">
          <div className="text-xs uppercase tracking-widest text-emerald-400 mb-2">Stream harness</div>
          <div className="text-sm text-zinc-400">
            scripts/stream-test-telemetry.ts posts two frames to /api/v1/telemetry. Start the dev server, then run npx tsx scripts/stream-test-telemetry.ts.
          </div>
        </div>
      </main>
    </div>
  );
}