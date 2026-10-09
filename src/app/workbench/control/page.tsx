"use client";

import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

const RULES = [
  "Only documented actors and relationships can influence policy.",
  "Permissions and safety constraints remain authoritative.",
  "Network changes are recorded and auditable.",
  "Reuse checks whether the prior experience applies to the new context.",
  "Improvement is claimed only when the defined outcome measurement supports it.",
  "An observed relationship is not proof of causation.",
];

export default function ControlPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Control A" />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <p className="text-xs uppercase tracking-[0.18em] text-emerald-400">Global control</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Aethel Node — Control A</h1>
        <p className="mt-3 text-sm text-zinc-400">Policy, orchestration, goals, constraints. A names y. A does not import B.</p>
        <ol className="mt-8 space-y-3">
          {["Control A", "Actor network N", "Workbench B", "z, e, Δe, Φ", "Self() proposes the next y, then the plant measures"].map((step, i) => (
            <li key={step} className="rounded-2xl border border-zinc-800 px-4 py-3 text-sm">
              <span className="text-emerald-400">0{i + 1}</span> {step}
            </li>
          ))}
        </ol>
        <section className="mt-8">
          <h2 className="text-lg font-medium">Rules</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-zinc-300">
            {RULES.map((rule) => <li key={rule}>{rule}</li>)}
          </ol>
        </section>
        <p className="mt-6 text-sm text-zinc-500">R = (N, A, B, y, z, e, Δe, Φ). N is context. It is not e.</p>
        <nav className="mt-8 flex flex-wrap gap-4 text-sm text-zinc-400">
          <Link className="underline" href="/workbench/network">Network</Link>
          <Link className="underline" href="/workbench/diagnostics">Diagnostics</Link>
          <Link className="underline" href="/workbench">Safety proof</Link>
        </nav>
      </main>
    </div>
  );
}