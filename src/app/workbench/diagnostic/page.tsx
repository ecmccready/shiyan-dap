"use client";

import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

const READING = [
  ["e", "diagnostic error"],
  ["Δe", "reduction in diagnostic error"],
  ["Proof", "evidence supporting the improvement"],
  ["Experience", "reusable diagnostic procedure, only if final e falls"],
  ["Audit", "why the action occurred"],
];

export default function DiagnosticReadingPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Workbench" />
      <main className="max-w-3xl mx-auto px-6 py-12 space-y-6">
        <p className="text-emerald-400 text-xs uppercase tracking-widest">Reading, not a new company</p>
        <h1 className="text-3xl font-bold">Aethel Diagnostic Workbench</h1>
        <p className="text-zinc-400">
          Not because Aethel Node has to become a healthcare company. Because a diagnostic reading makes the loop legible.
          This is an evidence gate. Not a diagnosis. No production PHI.
        </p>
        <ul className="border border-zinc-800 rounded-2xl p-5 text-sm space-y-3">
          {READING.map(([term, meaning]) => (
            <li key={term}><span className="text-white">{term}</span> = {meaning}</li>
          ))}
        </ul>
        <p className="text-zinc-500 text-sm">
          The recorded Safety rows stay 0.014, 0.065, 0.065. The watched Run tied at 0.235 and was refused.
          A live peer Φ does not overwrite those rows.
        </p>
        <nav className="flex flex-wrap gap-4 text-sm">
          <Link className="underline" href="/workbench/safety">Safety plant</Link>
          <Link className="underline" href="/workbench/proof">Proof</Link>
          <Link className="underline" href="/audit">Audit</Link>
          <Link className="underline" href="/workbench/watch">Watched Run</Link>
        </nav>
      </main>
    </div>
  );
}