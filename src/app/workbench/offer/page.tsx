"use client";

export default function OfferPage() {
  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <p className="text-xs uppercase tracking-wide text-neutral-500">Solicitation</p>
      <h1 className="text-2xl font-semibold">Aethel Node · workbench offer</h1>

      <p>
        Aethel Node proves that the next action is no longer a misdiagnosis. Know which SI (Super Intelligence) workflow works, prove that it works, and reuse it only when the measured evidence supports doing so.
      </p>

      {/* Primary CTA — proof journey first */}
      <div className="my-6 p-4 border rounded bg-neutral-50">
        <p className="font-medium">Start the proof journey</p>
        <p className="text-sm text-neutral-600 mt-1">
          One guided experience that reads live engine data, shows recorded runs, and walks through objective, experiment, measurement, verification, disposition and acquisition readiness.
        </p>
        <a
          href="/workbench/journey"
          className="inline-block mt-3 px-4 py-2 bg-black text-white rounded text-sm"
        >
          Open proof journey →
        </a>
      </div>

      <p>
        Pilot proposition · Know → Know How → Show → Do
      </p>
      <ol className="list-decimal pl-5 space-y-1 text-sm">
        <li>Know. Provenance-hashed source data.</li>
        <li>Know How. Deterministic checks; measured error reduction (Δe, Φ) against a recorded baseline.</li>
        <li>Show. Source-linked evidence pack with a recomputable hash.</li>
        <li>Do. Human-in-the-loop dispositions and a tamper-evident hand-off pack.</li>
      </ol>

      <p>First concrete case: <a className="underline" href="/workbench/medicare">Medicare · Public Data Intelligence</a> (SI-operated, synthetic fixture today, no live CMS fetch).</p>
      <p>Second case: <a className="underline" href="/workbench/robotics">Long-horizon robotics policies</a> (synthetic fixture, same four-stage graph and look-back ranking).</p>
      <p>Persistent-autonomy benchmark: <a className="underline" href="/workbench/robotics/benchmark">Long-horizon robotics protocol</a> (synthetic protocol; measures predicted-vs-actual, intervention rate, and look-back vs greedy).</p>
      <p>Value summary: <a className="underline" href="/workbench/robotics/value">Long-horizon robotics value</a> (shareable reference for customer acquisition).</p>
      <p>Experiment runner: <a className="underline" href="/workbench/robotics/experiment">Persistent-autonomy experiment</a> (deterministic simulator, repeated trials, downloadable evidence pack).</p>
      <p>Acquisition: <a className="underline" href="/workbench/acquisition">Acquisition Intelligence</a> (synthetic opportunities, each linked to an evidence-pack hash and originating run).</p>

      <p className="text-sm text-neutral-600">
        Detected pattern ≠ verified conclusion: findings are inputs for human review, not fraud, misconduct or clinical findings. Commercial licensing available from the owner. Display only; nothing is sent or stored.
      </p>

      <h2 className="text-lg font-medium mt-8">Evidence packs a reviewer can copy today</h2>
      <p>
        Want the whole inventory in one place? <a className="underline" href="/workbench/audit">See the audit summary →</a> (read-only).
      </p>
      <p>
        Need the Phase 3 asset map? <a className="underline" href="/workbench/assets">See the asset map →</a> (read-only).
      </p>
      <p>
        Need Phase 3 diagnostics compliance? <a className="underline" href="/workbench/compliance">See compliance →</a> (read-only).
      </p>

      <h2 className="text-lg font-medium mt-8">External confirmation</h2>
      <p>What an outside party can check today, without the team narrating it:</p>
      <ul className="list-disc pl-5 text-sm space-y-1">
        <li>Three Safety-proof error wins on <a className="underline" href="/workbench/proof">/workbench/proof</a>.</li>
        <li>Recorded Level 4 runs can be replayed at <a className="underline" href="/api/level4/verify">/api/level4/verify</a>.</li>
        <li>The MCP commercial case on the peer / compare surfaces.</li>
        <li>The evidence-pack export on <a className="underline" href="/workbench/result">/workbench/result</a> and the Φ &gt; 0 pilot checklist on <a className="underline" href="/workbench/pilot">/workbench/pilot</a>.</li>
      </ul>
      <p className="text-sm text-neutral-600 mt-2">
        Not yet externally confirmed: no paid pilot, no third-party attestation, self-reported economic benefit only, anchor is a dry run.
      </p>

      <h2 className="text-lg font-medium mt-8">Buyer / product / metric</h2>
      <p>Buyer: Organization responsible for the quality, cost, or reliability of repeated workflows.</p>
      <p>Product: Workbench that executes tasks, scores outcomes against a reference, and records reproducible evidence.</p>
      <p>Primary metric: Change in final error, Φ, alongside task success, cost, latency, and safety.</p>
      <p>Business model: Subscription for the workbench, usage-based execution, later paid access to verified reusable workflows.</p>
    </main>
  );
}