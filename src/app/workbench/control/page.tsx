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
powershell
git add -- src/lib/network/context.ts src/app/workbench/control/page.tsx
powershell
git commit -m "Add Control A and the documented actor network"
powershell
git push origin HEAD
Commit 2 — the network page
Save as src/app/workbench/network/page.tsx.

tsx
"use client";

import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { NETWORK, missingHandoffs } from "@/lib/network/context";

export default function NetworkPage() {
  const missing = missingHandoffs();
  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Network" />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <p className="text-xs uppercase tracking-[0.18em] text-emerald-400">{NETWORK.id} · {NETWORK.version}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Actor network</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          Human, technical, and evidence actors, plus documented relationships. This layer informs A. It does not override permissions, the safety gate, or the evidence required to claim improvement.
        </p>
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {NETWORK.actors.map((actor) => (
            <article key={actor.id} className="rounded-3xl border border-zinc-800 p-5">
              <p className="text-xs uppercase tracking-wider text-emerald-400">{actor.kind}</p>
              <h2 className="mt-1 text-lg font-medium">{actor.id}</h2>
              <p className="mt-2 text-sm text-zinc-400">{actor.role}</p>
            </article>
          ))}
        </div>
        <section className="mt-8 rounded-3xl border border-zinc-800 p-5">
          <h2 className="text-lg font-medium">Relationships</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {NETWORK.relations.map((rel) => (
              <li key={`${rel.from}-${rel.to}`} className="rounded-2xl border border-zinc-800 px-4 py-3">
                {rel.from} → {rel.to}
                <span className="mt-1 block text-xs text-zinc-500">{rel.kind} · {rel.documented ? "documented" : "missing handoff"}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-amber-200">
            {missing.length} missing handoff. That is context for y. It is not causation, and it is not Φ.
          </p>
        </section>
        <p className="mt-6 text-sm text-zinc-500">{NETWORK.not}</p>
        <nav className="mt-8 flex gap-4 text-sm text-zinc-400">
          <Link className="underline" href="/workbench/control">Control A</Link>
          <Link className="underline" href="/workbench/diagnostics">Diagnostics</Link>
        </nav>
      </main>
    </div>
  );
}
powershell
git add -- src/app/workbench/network/page.tsx
powershell
git commit -m "Show the actor network as context"
powershell
git push origin HEAD
Commit 3 — diagnostics fixture
Save as src/app/workbench/diagnostics/page.tsx.

tsx
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
