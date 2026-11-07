"use client";

import React, { useState } from "react";
import Link from "next/link";

export default function ReviewPage() {
  const [disposition, setDisposition] = useState<"accept" | "reject" | "revise" | null>(null);
  const [note, setNote] = useState("");
  const [recorded, setRecorded] = useState(false);

  async function record() {
    if (!disposition) return;

    const res = await fetch("/api/disposition", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        evidence_id: "ev_demo_1",
        disposition,
        note,
      }),
    });

    if (res.ok) setRecorded(true);
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <main className="max-w-3xl mx-auto px-6 py-16">
        <p className="text-xs uppercase tracking-widest text-emerald-400 mb-4">
          Aethel Node · Human Disposition
        </p>

        <h1 className="text-4xl font-semibold mb-6">Record disposition</h1>

        <p className="text-zinc-300 mb-10">
          Independent review against the proof contract. Only reviewed evidence advances to acquisition.
        </p>

        <div className="border border-zinc-800 rounded-xl p-6 bg-zinc-950 mb-8">
          <div className="text-sm text-zinc-400 mb-1">Evidence</div>
          <div className="font-mono">ev_demo_1 · run_20261105_001</div>
          <div className="text-sm text-zinc-400 mt-2">Hash a1b2c3d4e5f6 · Verified</div>
        </div>

        <div className="space-y-4 mb-6">
          <div className="flex gap-3">
            {(["accept", "reject", "revise"] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDisposition(d)}
                className={`px-4 py-2 rounded text-sm capitalize ${
                  disposition === d
                    ? "bg-emerald-600 text-white"
                    : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                }`}
              >
                {d}
              </button>
            ))}
          </div>

          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Reviewer note (optional)"
            rows={3}
            className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm"
          />
        </div>

        {!recorded ? (
          <button
            onClick={record}
            disabled={!disposition}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-6 py-2 rounded"
          >
            Record disposition
          </button>
        ) : (
          <div className="text-emerald-400">Disposition recorded. Evidence is now reviewed.</div>
        )}

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

        <div className="mt-6 border border-zinc-800 rounded-xl p-5 bg-zinc-950">
          <div className="text-xs uppercase tracking-widest text-emerald-400 mb-2">Live middleware</div>
          <div className="text-sm text-zinc-400">
            /api/v1/telemetry accepts predicted and observed values. The metamorphic engine evaluates Φ under drift. Non-converged runs return review_flag: "DRIFT_EXCEEDED". /api/v1/proof hashes and stores the result as an experience record.
          </div>
        </div>
      </main>
    </div>
  );
}