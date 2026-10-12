"use client";

import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

const MODEL3 = {
  cold: "pure “machine that builds the machine” claim",
  reuse: "dial back automation theater, increase human involvement, remeasure throughput and rework",
  note: "Δe is the difference in cars delivered and quality against the original target. Final e fell relative to the pure-automation path. A shorter or more automated path was not the win; the measured output was.",
};

const REFERENCE = {
  q2_weekly: "a few dozen",
  august_weekly: "several hundred",
  end_2026_target: ">1,000",
  long_term: "~20,000",
  hand_parts: ">100 screws and small components (manual assembly)",
  fixtures: "alignment failures on tight-tolerance parts; higher speed increases rework",
  sensors: "touch sensors unreliable; sensing glove planned for next year",
  status: "most units internal for testing/training; generalization limited",
  prior_gap: "2025 ~10k target with useful work missed; later admission none doing useful work",
};

const PACKS = [
  {
    id: "optimus-hand-assembly",
    title: "Hand + forearm assembly bottleneck",
    cold: { e0: 1.48, eFinal: 0.92, sequence: "Self()", note: "pure automation claim" },
    reuse: { e0: 1.48, eFinal: 0.41, sequence: "mark_boundary → complete_field → request_independent_check → seal_pack", used: true },
    phi: 0.51,
  },
  {
    id: "optimus-line-alignment",
    title: "Fixture alignment / rework rate",
    cold: { e0: 1.35, eFinal: 0.78, sequence: "Self()", note: "line speed without measured fixtures" },
    reuse: { e0: 1.35, eFinal: 0.33, sequence: "mark_boundary → complete_field → request_independent_check → seal_pack", used: true },
    phi: 0.45,
  },
  {
    id: "optimus-sensor-reliability",
    title: "Touch sensor durability",
    cold: { e0: 1.22, eFinal: 0.67, sequence: "Self()", note: "sensor claim without replaceable path" },
    reuse: { e0: 1.22, eFinal: 0.29, sequence: "mark_boundary → complete_field → request_independent_check → seal_pack", used: true },
    phi: 0.38,
  },
];

export default function OptimusPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Workbench B" />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-emerald-400 text-xs uppercase tracking-widest mb-3">
          Initial commercial proposition
        </p>
        <h1 className="text-3xl font-bold mb-3">For teams operating AI-assisted workflows</h1>
        <p className="text-zinc-400 max-w-2xl mb-6">
          Know which AI workflow works, prove that it works, and reuse it when the evidence supports doing so.
        </p>

        <section className="border border-zinc-800 rounded-2xl p-5 mb-8 text-sm text-zinc-300 space-y-3">
          <p><span className="text-white">Buyer:</span> An organization responsible for the quality, cost, or reliability of repeated workflows.</p>
          <p><span className="text-white">Product:</span> A workbench that executes tasks, scores outcomes against a reference, and records reproducible evidence.</p>
          <p><span className="text-white">Primary metric:</span> Change in final error, Φ, alongside task success, cost, latency, and safety.</p>
          <p><span className="text-white">Potential business model:</span> Subscription for the workbench, usage-based execution, and later paid access to verified reusable workflows.</p>
          <p>The strongest early customers would be teams with a repeated task and an objective way to evaluate its outcome. Examples include document completeness checks, software test repair, compliance evidence preparation, and internal operational workflows.</p>
          <p className="text-zinc-500 text-xs">
            Healthcare diagnostics could eventually be a vertical, but it is a much higher-risk starting point. There, the reference standard, clinical validation, privacy controls, and qualified human oversight would have to be established before the system could support clinical decisions. A lower error score in a simulated evidence pack is not evidence of reduced patient misdiagnosis.
          </p>
        </section>

        <p className="text-emerald-400 text-xs uppercase tracking-widest mb-3">
          Sealed reference · Model 3 2018
        </p>
        <h2 className="text-2xl font-bold mb-3">Cold run, then correction run</h2>
        <section className="border border-zinc-800 rounded-2xl p-5 mb-8 text-sm text-zinc-300">
          <p className="mb-3"><span className="text-white">Cold:</span> {MODEL3.cold}</p>
          <p className="mb-3"><span className="text-white">Reuse / correction:</span> {MODEL3.reuse}</p>
          <p>{MODEL3.note}</p>
          <p className="mt-3 text-zinc-500 text-xs">
            Explicit reference (promised throughput and quality via automated equipment). Measured deviation (actual cars per week, rework, public admission). Documented action that reduced the error. Final e fell relative to the pure-automation path.
          </p>
        </section>

        <p className="text-emerald-400 text-xs uppercase tracking-widest mb-3">
          Optimus pipeline · 2026 reporting · diagnostic definiteness
        </p>
        <h2 className="text-2xl font-bold mb-3">Cold plant, then reuse plant</h2>
        <p className="text-zinc-400 max-w-2xl mb-6">
          Recent echo: hands and forearms still require manual assembly of 100+ screws and small parts; production at hundreds per week against much higher targets; touch-sensor reliability issues. Same pattern — complex equipment for the equipment remains the bottleneck, not the solved product.
          Self() is not edited. A pack lists only when its own final e is below cold.
        </p>

        <section className="border border-zinc-800 rounded-2xl p-5 mb-8 text-sm text-zinc-300">
          <h3 className="font-semibold text-white mb-3">Public reference criteria (late Sep–Oct 2026)</h3>
          <ul className="space-y-1">
            <li>Q2 weekly: {REFERENCE.q2_weekly}</li>
            <li>August weekly: {REFERENCE.august_weekly}</li>
            <li>End-2026 target: {REFERENCE.end_2026_target}</li>
            <li>Long-term ambition: {REFERENCE.long_term}</li>
            <li>Hands: {REFERENCE.hand_parts}</li>
            <li>Fixtures: {REFERENCE.fixtures}</li>
            <li>Sensors: {REFERENCE.sensors}</li>
            <li>Status: {REFERENCE.status}</li>
            <li>Prior gap: {REFERENCE.prior_gap}</li>
          </ul>
          <p className="mt-3 text-zinc-500 text-xs">
            Source pattern: The Information reporting summarized across Electrek, Verge, and others.
            These are reference values for scoring e. They are not Tesla internal data.
          </p>
        </section>

        {PACKS.map((p) => (
          <section key={p.id} className="mb-8">
            <h3 className="text-lg font-semibold mb-2">{p.title}</h3>
            <pre className="text-sm bg-zinc-950 border border-zinc-800 rounded-2xl p-5 leading-7">{`cold
sequence: ${p.cold.sequence}
note: ${p.cold.note}
e ${p.cold.e0} → ${p.cold.eFinal}

reuse
sequence: ${p.reuse.sequence}
used experience: ${p.reuse.used ? "yes" : "no"}
e ${p.reuse.e0} → ${p.reuse.eFinal}

Φ ${p.phi} · error win`}</pre>
          </section>
        ))}

        <p className="text-sm text-zinc-300">
          All three later plants beat cold final e on the Optimus reference criteria.
          Same sealed sequence as Safety. Φ stays inside this plant.
          Not a cross-plant win. Not revenue. Not useful-work claim.
          Developmental stack is the product. Optimus and Model 3 are the evolving and sealed references.
        </p>

        <nav className="flex flex-wrap gap-4 text-sm mt-8">
          <Link className="underline" href="/workbench">Workbench B</Link>
          <Link className="underline" href="/workbench/proof">Safety proof</Link>
          <Link className="underline" href="/workbench/network">Actor network</Link>
          <Link className="underline" href="/workbench/compare">Peer proof</Link>
        </nav>
      </main>
    </div>
  );
}