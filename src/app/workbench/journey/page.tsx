"use client";

import React from "react";
import Link from "next/link";

export default function JourneyPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <main className="max-w-3xl mx-auto px-6 py-16">
        <p className="text-xs uppercase tracking-widest text-emerald-400 mb-4">
          Aethel Node · Proof-to-Payment
        </p>

        <h1 className="text-4xl font-semibold mb-6 leading-tight">
          Prove the outcome.<br />Then decide.
        </h1>

        <p className="text-lg text-zinc-300 mb-10">
          Shiyan DAP is the first publicly inspectable proof of Aethel Node working end to end.
          You see the evidence. Then you decide whether to pay for the demonstrated outcome.
          The ROE path now includes a metamorphic perturbation that tests whether system identity (Φ) holds under high-entropy drift.
          Acquisition remains gated until the five evidence conditions are met.
        </p>

        <div className="mb-10 flex gap-4">
          <Link
            href="/workbench/proof"
            className="inline-block bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded"
          >
            Inspect metamorphic proof pack
          </Link>
          <Link
            href="/workbench/conditions"
            className="inline-block border border-zinc-700 hover:border-zinc-500 text-white px-6 py-2 rounded"
          >
            Five evidence conditions
          </Link>
          <Link
            href="/workbench/flywheel"
            className="inline-block border border-zinc-700 hover:border-zinc-500 text-white px-6 py-2 rounded"
          >
            Founder Reference Flywheel (Live)
          </Link>
        </div>

        <section className="mb-12">
          <h2 className="text-xl font-medium mb-4">The commercial loop</h2>
          <ol className="list-decimal pl-5 space-y-3 text-zinc-300">
            <li><strong>Acquire</strong> — Identify a prospect and a measurable problem.</li>
            <li><strong>Demonstrate</strong> — Shiyan DAP serves as the live reference implementation.</li>
            <li><strong>Connect</strong> — Customer connects their own repository or data.</li>
            <li><strong>Understand</strong> — Workspace A analyses objectives, architecture and constraints.</li>
            <li><strong>Execute</strong> — Workbench B runs approved tasks, tests and experiments. Includes metamorphic Φ check.</li>
            <li><strong>Verify</strong> — ROE measures changes against a declared baseline. Evidence is recorded and reproducible.</li>
            <li><strong>Learn</strong> — Verified experience, including identity stability under drift, informs the next cycle.</li>
            <li><strong>Convert</strong> — Customer sees the evidence, accepts the result and purchases.</li>
          </ol>
        </section>

        <section className="mb-12 border border-zinc-800 rounded-xl p-6 bg-zinc-950">
          <h2 className="text-xl font-medium mb-6">The recursive dynamics</h2>
          <div className="space-y-6 text-center">
            <div className="bg-zinc-900 rounded-lg p-4">
              <div className="font-semibold">Aethel Node platform</div>
              <div className="text-sm text-zinc-400">Orchestrates, measures and learns</div>
            </div>
            <div className="text-zinc-500">↓↑</div>
            <div className="bg-zinc-900 rounded-lg p-4">
              <div className="font-semibold">Shiyan DAP — reference repository</div>
              <div className="text-sm text-zinc-400">Builds, tests and verifies the platform itself</div>
            </div>
            <div className="text-zinc-500">↓↑</div>
            <div className="bg-zinc-900 rounded-lg p-4">
              <div className="font-semibold">Verified experience and improved capability</div>
              <div className="text-sm text-zinc-400">Feeds the next development and execution cycle</div>
            </div>
            <div className="text-emerald-400 text-2xl">↻</div>
            <div className="font-medium">Recursive improvement loop</div>
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-medium mb-4">What this sells</h2>
          <ul className="list-disc pl-5 space-y-2 text-zinc-300">
            <li>The complete autonomous enterprise workbench.</li>
            <li>Developer TDD and software verification.</li>
            <li>Global / Misdiagnosis as a specialist vertical.</li>
            <li>Acquisition intelligence and opportunity development.</li>
            <li>Evidence-based execution, measurement and learning.</li>
            <li>Identity stability (Φ) under metamorphic drift.</li>
            <li>A commercial model tied to demonstrable outcomes.</li>
          </ul>
        </section>

        <p className="text-sm text-zinc-500 border-t border-zinc-800 pt-6">
          You are not selling a GitHub connector. You are selling the whole operating system for turning problems into executed, measured and verifiable outcomes — including the ability to hold identity under unpredicted chaos.
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