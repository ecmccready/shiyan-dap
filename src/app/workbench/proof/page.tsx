"use client";

import { useMemo } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { StepRec, YAction, freshPlant, stepLoop } from "@/lib/closed-loop";

const CASES = [
  "case-incomplete-pack",
  "case-missing-measurements",
  "case-provenance-gap",
] as const;

type Card = {
  id: string;
  action: string;
  outcome: string;
  error: string;
  e1: number;
  steps: number;
  escalates: number;
};

function orderFrom(prior: StepRec[]): YAction[] {
  const seen = new Set<YAction>();
  const out: YAction[] = [];
  for (const s of prior) {
    if (s.reduced > 0 && s.gate !== "ESCALATE" && !seen.has(s.y)) {
      seen.add(s.y);
      out.push(s.y);
    }
  }
  for (const s of prior) {
    if (s.reduced > 0 && !seen.has(s.y)) {
      seen.add(s.y);
      out.push(s.y);
    }
  }
  return out;
}

function play(caseId: string, prior: StepRec[], reuse: boolean) {
  const order = reuse ? orderFrom(prior) : [];
  let plant = freshPlant(caseId);
  const steps: StepRec[] = [];
  for (let i = 0; i < 4; i++) {
    const out = stepLoop(plant, { namer: "grok_bot", y: order[i] });
    if (reuse && out.rec.reduced <= 0) break;
    steps.push(out.rec);
    plant = out.plant;
    if (out.rec.reduced <= 0) break;
  }
  const last = steps[steps.length - 1];
  const card: Card = {
    id: String(CASES.indexOf(caseId as (typeof CASES)[number]) + 1).padStart(3, "0"),
    action: steps.map((s) => s.y).join(" → ") || "none",
    outcome: last?.z ?? "no measurement",
    error: last ? `${steps[0].e} → ${last.e_next}` : "none",
    e1: last?.e_next ?? plant.M.last_e,
    steps: steps.length,
    escalates: steps.filter((s) => s.gate === "ESCALATE").length,
  };
  return { card, steps };
}

export default function ProofPage() {
  const demo = useMemo(() => {
    const first = play(CASES[0], [], false);
    let prior = first.steps.filter((s) => s.reduced > 0);
    const checks = CASES.slice(1).map((id) => {
      const cold = play(id, [], false);
      const reuse = play(id, prior, true);
      const delta = Number((reuse.card.e1 - cold.card.e1).toFixed(3));
      const better =
        reuse.card.steps < cold.card.steps ||
        reuse.card.escalates < cold.card.escalates ||
        delta < 0;
      prior = [...reuse.steps.filter((s) => s.reduced > 0), ...prior];
      return { id, cold: cold.card, reuse: reuse.card, delta, better };
    });
    return { first: first.card, checks, won: checks.every((c) => c.better) };
  }, []);

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Workbench B" />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-emerald-400 text-xs uppercase tracking-widest mb-3">Safety · one B</p>
        <h1 className="text-3xl font-bold mb-3">Run → Experience → Run</h1>
        <p className="text-zinc-400 max-w-2xl mb-8">
          Experience skips a y that did not reduce e and prefers a y that reached HOLD.
          Better means fewer steps, fewer ESCALATE gates, or a lower final e.
        </p>
        <pre className="text-sm bg-zinc-950 border border-zinc-800 rounded-2xl p-5 mb-4 leading-7">{`RUN #001
Action: ${demo.first.action}
Outcome: ${demo.first.outcome}
Error: ${demo.first.error}
Experience created: YES`}</pre>
        {demo.checks.map((c) => (
          <section key={c.id}>
            <p className="text-center text-emerald-400 my-4">↓</p>
            <pre className="text-sm bg-zinc-950 border border-zinc-800 rounded-2xl p-5 leading-7">{`RUN #${c.reuse.id}
Experience used: #001
Action: ${c.reuse.action}
Outcome: ${c.reuse.outcome}
Error: ${c.reuse.error}
Δe: ${c.delta}`}</pre>
            <p className="text-sm text-zinc-500 mt-3">
              Cold: {c.cold.steps} steps, {c.cold.escalates} ESCALATE.
              With experience: {c.reuse.steps} steps, {c.reuse.escalates} ESCALATE.
              {c.better ? " Better." : " Not better."}
            </p>
          </section>
        ))}
        <p className="text-sm text-zinc-400 mt-8">
          {demo.won
            ? "Later runs are better because Run 001 produced experience."
            : "Later runs did not get better. Do not claim the flywheel."}
        </p>
        <nav className="flex flex-wrap gap-4 text-sm mt-8">
          <Link className="underline" href="/workbench">Workbench B</Link>
          <Link className="underline" href="/workbench/safety">Diagnostic</Link>
        </nav>
      </main>
    </div>
  );
}