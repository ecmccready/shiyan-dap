"use client";

import React, { useEffect, useState } from "react";

import type { ExperienceRecord, NextActionProposal } from "@/core/interfaces";

export default function FlywheelPage() {
  const [experience, setExperience] = useState<ExperienceRecord | null>(null);
  const [proposal, setProposal] = useState<NextActionProposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch("/api/flywheel", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Verified memory could not be read. No recommendation was made.");
        const data: { latest: ExperienceRecord | null; proposal: NextActionProposal } = await response.json();
        if (!controller.signal.aborted) {
          setExperience(data.latest);
          setProposal(data.proposal);
        }
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Memory request failed.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, []);

  return (
    <div className="min-h-screen bg-black text-white">
      <main className="max-w-3xl mx-auto px-6 py-16">
        <p className="text-xs uppercase tracking-widest text-emerald-400 mb-4">
          Aethel Node · Founder Reference Flywheel
        </p>

        <h1 className="text-4xl font-semibold mb-6">Append-only verified memory</h1>

        <p className="text-zinc-300 mb-10">
          One complete cycle: Shiyan DAP → Aethel executes → Verifies → Hugging Face remembers → ROE improves next action.
        </p>

        <p className="text-xs text-zinc-500 mb-8">
          Reading this server’s local HF-shaped memory store; no remote Hugging Face upload is implied.
        </p>
        {loading && <p role="status" className="text-zinc-400 mb-8">Loading verified memory…</p>}
        {error && <p role="alert" className="text-red-400 mb-8">{error}</p>}
        {!loading && !error && !experience && (
          <p className="text-zinc-400 mb-8">No eligible experience is stored here yet. No fixture or field evidence is substituted.</p>
        )}
        {experience && <div className="border border-zinc-800 rounded-xl p-6 bg-zinc-950 space-y-4 mb-8">
          <div>
            <div className="text-sm text-zinc-400">Experience</div>
            <div className="font-mono">{experience.experience_id}</div>
          </div>
          <div>
            <div className="text-sm text-zinc-400">Goal</div>
            <div>{experience.goal}</div>
          </div>
          <div>
            <div className="text-sm text-zinc-400">Action taken</div>
            <div>{experience.action}</div>
          </div>
          <div>
            <div className="text-sm text-zinc-400">Reuse eligibility</div>
            <div className={experience.reuse_eligibility ? "text-emerald-400" : "text-zinc-400"}>
              {experience.reuse_eligibility ? "Eligible" : "Not eligible"}
            </div>
          </div>
          <div>
            <div className="text-sm text-zinc-400">Revision</div>
            <div>{experience.revision}</div>
          </div>
          <div>
            <div className="text-sm text-zinc-400">Replay verdict · verifier</div>
            <div>{experience.verification.replay_verdict} · {experience.verification.verifier_version}</div>
          </div>
          <div>
            <div className="text-sm text-zinc-400">Metamorphic verification</div>
            <div>{experience.metamorphic.transformation} · seed {experience.metamorphic.seed}</div>
            <div>{experience.metamorphic.expected_relation}</div>
            <div className="whitespace-pre-wrap break-words">{experience.metamorphic.result}</div>
            <div>Converged: {experience.metamorphic.converged ? "Yes" : "No / not established in legacy record"}</div>
          </div>
          <div>
            <div className="text-sm text-zinc-400">Outcome · delta_e</div>
            <div className="whitespace-pre-wrap break-words">{experience.observed_outcome}</div>
            <div>{experience.delta_e}</div>
          </div>
          <div>
            <div className="text-sm text-zinc-400">Source · run · timestamp</div>
            <div className="break-words">{experience.provenance.source} · {experience.provenance.run_id} · {new Date(experience.provenance.timestamp).toLocaleString("en-US", { timeZone: "America/Los_Angeles", timeZoneName: "short" })}</div>
          </div>
        </div>}

        {proposal && <div className="border border-zinc-800 rounded-xl p-6 bg-zinc-950">
          <div className="text-sm text-zinc-400 mb-1">ROE recommended next action</div>
          <div className="font-semibold">{proposal.action}</div>
          <div className="text-xs text-zinc-500 mt-2">
            {proposal.reason}
          </div>
          <div className="text-xs text-zinc-500 mt-2">
            {proposal.experience_id ? `Informed by experience ${proposal.experience_id}` : "No experience cited"}
          </div>
          <div className="text-xs text-zinc-500 mt-2">
            Evidence used: {proposal.evidence_used.join(", ") || "None"}
          </div>
        </div>}

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