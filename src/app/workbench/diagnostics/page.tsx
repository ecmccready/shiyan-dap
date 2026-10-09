"use client";

import { useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { NETWORK, missingHandoffs } from "@/lib/network/context";

const STEPS = [
  { y: "mark_boundary", z: "pack boundary marked", e: 1.399 },
  { y: "complete_field", z: "provenance field filled", e: 0.82 },
  { y: "request_independent_check", z: "missing handoff closed", e: 0.216 },
  { y: "seal_pack", z: "gate HOLD", e: 0.151 },
];

export default function DiagnosticsPage() {
  const [shown, setShown] = useState(0);
  const e = shown === 0 ? 1.399 : STEPS[shown - 1].e;
  const delta = Number((1.399 - e).toFixed(3));
  const phi = Number((0.216 - 0.151).toFixed(3));
  const closed = shown >= STEPS.length;

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Diagnostics" />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <p className="text-xs uppercase tracking-[0.18em] text-emerald-400">Flagship fixture</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Evidence gate, not a diagnosis.</h1>
        <p className="mt-4 text-sm leading-6 text-zinc-400">
          Healthcare diagnostics is the context. The plant remains the Safety evidence gate. {NETWORK.not} A controls policy. N describes actors. B executes. Measurement decides improvement.
        </p>
        <p className="mt-4 text-sm">R = (N {NETWORK.id}, A, B Safety, y, z, e {e}, Δe {delta}, Φ {closed ? phi : "—"})</p>
        <p className="mt-2 text-sm text-amber-200">Missing before reuse: {missingHandoffs().map((r) => r.to).join(", ") || "none"}.</p>
        <ol className="mt-6 space-y-2">
          {STEPS.map((step, i) => (
            <li key={step.y} className={`rounded-2xl border px-4 py-3 text-sm ${i < shown ? "border-zinc-700" : "border-zinc-900 text-zinc-600"}`}>
              y = {step.y}
              <span className="float-right tabular-nums">e {i < shown ? step.e : "—"}</span>
              {i < shown && <span className="mt-1 block text-xs text-zinc-500">z · {step.z}</span>}
            </li>
          ))}
        </ol>
        <button
          onClick={() => setShown((n) => Math.min(STEPS.length, n + 1))}
          disabled={closed}
          className="mt-5 h-11 rounded-full bg-emerald-500 px-5 text-sm font-medium text-black disabled:opacity-40"
        >
          {closed ? "Measured" : "Next action"}
        </button>
        {closed && (
          <p className="mt-4 text-sm text-emerald-300">
            Accepted on this plant only. Cold final 0.216, reuse 0.151, Φ {phi}. The closed handoff is context. It is not causation. Not a listing. Not revenue.
          </p>
        )}
        <nav className="mt-8 flex flex-wrap gap-4 text-sm text-zinc-400">
          <Link className="underline" href="/workbench">Safety proof</Link>
          <Link className="underline" href="/workbench/network">Network</Link>
          <Link className="underline" href="/workbench/control">Control A</Link>
        </nav>
      </main>
    </div>
  );
}