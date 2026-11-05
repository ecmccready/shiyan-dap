"use client";

import React from "react";

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
        </p>

        <section className="mb-12">
          <h2 className="text-xl font-medium mb-4">The commercial loop</h2>
          <ol className="list-decimal pl-5 space-y-3 text-zinc-300">
            <li><strong>Acquire</strong> — Identify a prospect and a measurable problem.</li>
            <li><strong>Demonstrate</strong> — Shiyan DAP serves as the live reference implementation.</li>
            <li><strong>Connect</strong> — Customer connects their own repository or data.</li>
            <li><strong>Understand</strong> — Workspace A analyses objectives, architecture and constraints.</li>
            <li><strong>Execute</strong> — Workbench B runs approved tasks, tests and experiments.</li>
            <li><strong>Verify</strong> — ROE measures changes against a declared baseline. Evidence is recorded and reproducible.</li>
            <li><strong>Learn</strong> — Verified experience informs the next cycle.</li>
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
            <li>A commercial model tied to demonstrable outcomes.</li>
          </ul>
        </section>

        <p className="text-sm text-zinc-500 border-t border-zinc-800 pt-6">
          You are not selling a GitHub connector. You are selling the whole operating system for turning problems into executed, measured and verifiable outcomes.
        </p>
      </main>
    </div>
  );
}