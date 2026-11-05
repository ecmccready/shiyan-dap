"use client";

import React from "react";

export default function ExecutePage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <main className="max-w-3xl mx-auto px-6 py-16">
        <p className="text-xs uppercase tracking-widest text-emerald-400 mb-4">
          Aethel Node · Workbench Execution
        </p>

        <h1 className="text-4xl font-semibold mb-6">Connect and run</h1>

        <p className="text-zinc-300 mb-10">
          Execution is bound to the proof contract. Global produces traceable diagnostic evidence. Developer runs acceptance tests against the connected repository and compares baseline versus regression.
        </p>

        <div className="grid gap-6 md:grid-cols-2">
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

        <div className="mt-10 border-t border-zinc-800 pt-6">
          <p className="text-sm text-zinc-400">
            Both paths record inputs, outputs, versions, timestamps and provenance. Evidence is persisted server-side and available for independent verification.
          </p>
        </div>

        <p className="text-xs text-zinc-500 mt-10">
          Front door: /workbench/journey
        </p>
      </main>
    </div>
  );
}