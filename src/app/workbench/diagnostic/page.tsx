"use client";

import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

const READINGS = [
  ["e", "Diagnostic error."],
  ["Δe", "Reduction in diagnostic error."],
  ["Proof", "Evidence supporting a measured improvement."],
  ["Experience", "Reusable procedure, recorded only when final e decreases."],
  ["Audit", "Record of why the action occurred."],
];

export default function DiagnosticReadingPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Workbench" />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <p className="text-xs uppercase tracking-[0.18em] text-emerald-400">Diagnostic overview</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Aethel Diagnostic Workbench</h1>
        <p className="mt-4 text-sm leading-6 text-zinc-400">
          Healthcare diagnostics is the context for this evidence gate, not a medical diagnosis. Do not enter production PHI.
        </p>
        <section className="mt-6 rounded-2xl border border-zinc-800 p-5">
          <h2 className="text-sm font-medium">How to read the evidence</h2>
          <dl className="mt-4 divide-y divide-zinc-800 text-sm">
            {READINGS.map(([term, meaning]) => (
              <div key={term} className="grid gap-1 py-3 sm:grid-cols-[7rem_1fr] sm:gap-4">
                <dt className="font-medium text-white">{term}</dt>
                <dd className="text-zinc-400">{meaning}</dd>
              </div>
            ))}
          </dl>
        </section>
        <p className="mt-5 text-sm leading-6 text-zinc-500">
          Recorded Safety values are 0.014, 0.065, and 0.065. The watched run tied at 0.235 and was refused.
          Live peer Φ does not replace these recorded values.
        </p>
        <nav className="mt-8 flex flex-wrap gap-4 text-sm text-zinc-400">
          <Link className="underline" href="/workbench/safety">Safety plant</Link>
          <Link className="underline" href="/workbench/diagnostic/reference">Evidence-gate reference</Link>
          <Link className="underline" href="/workbench/proof">Proof</Link>
          <Link className="underline" href="/audit">Audit</Link>
          <Link className="underline" href="/workbench/watch">Watched run</Link>
        </nav>
      </main>
    </div>
  );
}