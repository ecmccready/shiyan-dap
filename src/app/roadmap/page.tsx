"use client";

import { useState } from "react";
import Level4Shell from "@/components/Level4Shell";

const PRIORITIES = [
  {
    title: "Make Aethel Node a durable, bounded autonomous system",
    detail:
      "Build on the existing Level 4 implementation so a run can plan, act, observe, verify, learn, and safely resume after interruption without losing its state or repeating unintended actions.",
  },
  {
    title: "What the development should deliver",
    items: [
      "One connected path from Workspace goal to Workbench execution.",
      "Durable state and checkpoint recovery after a process restart.",
      "Idempotent handling of retried actions, with safeguards against duplicate side effects.",
      "Safety and budget enforcement before each permitted action.",
      "Verified results recorded in the existing run history and eligible experience store.",
      "An end-to-end test proving recovery, safety, and completion—not just a successful demo.",
    ],
  },
];

const SPINE = [
  {
    n: 1,
    title: "Connect the product spine.",
    detail:
      "Ensure Workspace, Workbench, Runs, Self(), safety and history operate as one consistent system.",
  },
  {
    n: 2,
    title: "Finish Level 4 reliability.",
    detail:
      "Prioritize recovery, action safety and end-to-end tests using the existing architecture.",
  },
  {
    n: 3,
    title: "Make the product acquisition-ready.",
    detail:
      "Give new users a clear starting point, a guided first run, an understandable result and a reason to return. Make the product's benefit demonstrable without requiring them to understand the underlying algorithm.",
  },
  {
    n: 4,
    title: "Invest in acquisition.",
    detail:
      "Once the product is coherent and ready to receive traffic, invest in distribution, onboarding and consumer acquisition. Measure what happens next rather than assuming demand.",
  },
];

export default function RoadmapPage() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <Level4Shell>
    <main className="max-w-3xl mx-auto px-6 py-10 space-y-10">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-zinc-500">Workbench · Level 4</p>
        <h1 className="text-3xl font-semibold">Durable bounded autonomous system</h1>
        <p className="text-zinc-300">
          Next architectural milestone on the existing Level 4 controller, safety gate, and history. Not declared complete until recovery, idempotency, and an end-to-end proof are demonstrated.
        </p>
        <p className="text-sm">
          <a href="/workbench/start" className="underline text-emerald-400 hover:text-emerald-300">
            Start a guided run
          </a>
          {" — clear path from goal to verified result."}
        </p>
        <p className="text-sm">
          <a href="/workbench/spine" className="underline text-emerald-400 hover:text-emerald-300">
            Product spine
          </a>
          {" — Workspace, Workbench, Runs, Self(), safety, and history as one system."}
        </p>
        <p className="text-sm">
          <a href="/workbench/status" className="underline text-emerald-400 hover:text-emerald-300">
            Level 4 status
          </a>
          {" — current surfaces, measured outcome, acquisition readiness."}
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="text-xl font-medium">Priority</h2>
        {PRIORITIES.map((p, i) => (
          <div key={i} className="border rounded-lg p-4 space-y-3">
            <h3 className="font-medium">{p.title}</h3>
            {p.detail && <p className="text-zinc-300">{p.detail}</p>}
            {p.items && (
              <ol className="list-decimal list-inside space-y-1 text-sm text-neutral-800">
                {p.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            )}
          </div>
        ))}
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-medium">Product spine & acquisition</h2>
        {SPINE.map((s) => (
          <div key={s.n} className="border-l-2 border-zinc-700 pl-4">
            <button
              className="text-left w-full"
              onClick={() => setOpen(open === s.n ? null : s.n)}
            >
              <span className="font-medium">{s.n}. {s.title}</span>
            </button>
            {open === s.n && <p className="mt-1 text-sm text-zinc-300">{s.detail}</p>}
          </div>
        ))}
      </section>

      <section className="text-sm text-zinc-500 border-t border-zinc-800 pt-6">
        <p>Builds on existing: ControllerRecord + history, safety-gate, persist, /workbench/autonomous, /workbench/autonomous/proof.</p>
        <p>End-to-end proof required before acquisition investment.</p>
      </section>
    </main>
    </Level4Shell>
  );
}