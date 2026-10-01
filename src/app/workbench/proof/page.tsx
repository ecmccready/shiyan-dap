"use client";

import { useMemo } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { StepRec, YAction, freshPlant, loadCase, stepLoop } from "@/lib/closed-loop";

type RunCard = {
  id: string;
  action: string;
  outcome: string;
  error: string;
  experience: string;
  steps: number;
  escalates: number;
  e1: number;
};

function play(caseId: string, prior: StepRec[]): { card: RunCard; steps: StepRec[] } {
  const skip = new Set(prior.filter((s) => s.reduced <= 0).map((s) => s.y));
  const seen = new Set<YAction>();
  const order: YAction[] = [];
  for (const s of prior.filter((x) => x.reduced > 0 && x.gate !== "ESCALATE")) {
    if (seen.has(s.y)) continue;
    seen.add(s.y);
    order.push(s.y);
  }
  let plant = prior.length
    ? loadCase(Object.assign(freshPlant(prior[0].case_id), { M: { ...freshPlant().M, ledger: prior } }), caseId)
    : freshPlant(caseId);
  const steps: StepRec[] = [];
  for (let i = 0; i < 4; i++) {
    const y = order[i];
    if (y && skip.has(y)) break;
    const out = stepLoop(plant, { namer: "grok_bot", y });
    if (prior.length && out.rec.reduced <= 0) break;
    steps.push(out.rec);
    plant = out.plant;
    if (out.rec.reduced <= 0) break;
  }
  const last = steps[steps.length - 1];
  return {
    steps,
    card: {
      id: prior.length ? "002" : "001",
      action: steps.map((s) => s.y).join(" → ") || "none",
      outcome: last?.z ?? "no measurement",
      error: last ? `${steps[0].e} → ${last.e_next}` : "none",
      experience: prior.length ? "001" : steps.some((s) => s.reduced > 0) ? "YES" : "NO",
      steps: steps.length,
      escalates: steps.filter((s) => s.gate === "ESCALATE").length,
      e1: last?.e_next ?? 0,
    },
  };
}

export default function ProofPage() {
  const demo = useMemo(() => {
    const first = play("case-incomplete-pack", []);
    const cold = play("case-missing-measurements", []);
    const second = play("case-missing-measurements", first.steps);
    const delta = Number((second.card.e1 - cold.card.e1).toFixed(3));
    const better = second.card.steps < cold.card.steps || second.card.escalates < cold.card.escalates || delta < 0;
    return { first: first.card, cold: cold.card, second: second.card, delta, better };
  }, []);

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Workbench B" />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-emerald-400 text-xs uppercase tracking-widest mb-3">One demonstration</p>
        <h1 className="text-3xl font-bold mb-3">Run → Experience → Run</h1>
        <p className="text-zinc-400 max-w-2xl mb-8">
          Safety only. No new vertical. Δe = e2 − e1 against the cold second run. Negative means the experience made it better.
        </p>

        <pre className="text-sm bg-zinc-950 border border-zinc-800 rounded-2xl p-5 mb-4 leading-7 text-zinc-200">{`RUN #${demo.first.id}
Action: ${demo.first.action}
Outcome: ${demo.first.outcome}
Error: ${demo.first.error}
Experience created: ${demo.first.experience}`}</pre>

        <p className="text-center text-emerald-400 mb-4">↓</p>

        <pre className="text-sm bg-zinc-950 border border-zinc-800 rounded-2xl p-5 mb-8 leading-7 text-zinc-200">{`RUN #${demo.second.id}
Experience used: #${demo.second.experience}
Action: ${demo.second.action}
Outcome: ${demo.second.outcome}
Error: ${demo.second.error}
Δe: ${demo.delta}`}</pre>

        <section className="border border-zinc-800 rounded-2xl p-5 mb-8 text-sm">
          <p className="text-emerald-400 text-xs mb-2">Falsifiable check</p>
          <p className="text-zinc-300">
            Cold second run: {demo.cold.steps} steps, {demo.cold.escalates} ESCALATE, e {demo.cold.error}.
            With #001: {demo.second.steps} steps, {demo.second.escalates} ESCALATE.
          </p>
          <p className="text-zinc-500 mt-2">
            {demo.better
              ? "Run 002 is better because Run 001 produced experience."
              : "Run 002 did not get better. Do not claim the mechanism."}
          </p>
        </section>

        <nav className="flex flex-wrap gap-4 text-sm">
          <Link className="underline" href="/workbench">Workbench B</Link>
          <Link className="underline" href="/workbench/safety">Diagnostic</Link>
        </nav>
      </main>
    </div>
  );
}