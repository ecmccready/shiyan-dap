"use client";

import React from "react";
import Link from "next/link";

const STEPS = [
  { label: "Front door", href: "/workbench/journey", desc: "Prove the outcome. Then decide." },
  { label: "Opportunity", href: "/workbench/opportunity", desc: "Persist prospect, problem, baseline and success conditions." },
  { label: "Acquisition", href: "/workbench/acquisition", desc: "Qualify prospects and approve outreach." },
  { label: "Proof contract", href: "/workbench/contract", desc: "Agree what counts as success before work begins." },
  { label: "Execution", href: "/workbench/execute", desc: "Global or Developer path. Includes metamorphic Φ check." },
  { label: "Evidence", href: "/workbench/evidence", desc: "Authoritative, reproducible, independently reviewable." },
  { label: "Proof pack", href: "/workbench/proof", desc: "High-entropy pack from predicted-vs-emergent and Φ stability." },
  { label: "Disposition", href: "/workbench/review", desc: "Human review against the proof contract." },
  { label: "Conversion", href: "/workbench/convert", desc: "Accept the result and purchase the demonstrated outcome." },
  { label: "Recursive improvement", href: "/workbench/loop", desc: "Verified experience, including metamorphic emergence, feeds the next cycle." },
  { label: "Status", href: "/workbench/status", desc: "Current state of the loop." },
  { label: "Founder Reference Flywheel", href: "/workbench/flywheel", desc: "Append-only verified memory. Live. ROE improves the next action." },
];

export default function EnginePage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <main className="max-w-3xl mx-auto px-6 py-16">
        <p className="text-xs uppercase tracking-widest text-emerald-400 mb-4">
          Aethel Node · Proof-to-Payment Engine
        </p>

        <h1 className="text-4xl font-semibold mb-6">The complete loop</h1>

        <p className="text-zinc-300 mb-10">
          Acquire, demonstrate, execute, verify, review and convert. The ROE path now injects a controlled metamorphic perturbation and records whether system identity (Φ) holds under high-entropy drift. Verified experience feeds the next cycle. Every step is inspectable. Evidence is authoritative. Payment follows proof.
        </p>

        <div className="space-y-4">
          {STEPS.map((step) => (
            <Link
              key={step.href}
              href={step.href}
              className="block border border-zinc-800 rounded-xl p-5 bg-zinc-950 hover:border-zinc-600 transition-colors"
            >
              <div className="font-semibold">{step.label}</div>
              <div className="text-sm text-zinc-400 mt-1">{step.desc}</div>
            </Link>
          ))}
        </div>

        <p className="text-xs text-zinc-500 mt-10">
          Recursive improvement: verified experience from this loop, including metamorphic emergence, feeds the next cycle.
        </p>

        <div className="mt-10 border-t border-zinc-800 pt-6">
          <div className="text-xs uppercase tracking-widest text-emerald-400 mb-2">Platform contract</div>
          <div className="text-sm text-zinc-400">
            Aethel Node Extension Architecture v1.1. Level 4 = authoritative execution and verification. Hugging Face = durable, versioned founder experience archive. ROE = retrieval, qualification and next-action selection. Flywheel = live, inspectable presentation.
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

        <div className="mt-6 border border-zinc-800 rounded-xl p-5 bg-zinc-950">
          <div className="text-xs uppercase tracking-widest text-emerald-400 mb-2">Live middleware</div>
          <div className="text-sm text-zinc-400">
            /api/v1/telemetry accepts predicted and observed values. The metamorphic engine evaluates Φ under drift. Non-converged runs return review_flag: "DRIFT_EXCEEDED". /api/v1/proof hashes and stores the result as an experience record.
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