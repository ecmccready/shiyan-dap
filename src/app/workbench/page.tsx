"use client";

import { useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { Namer, namerLabel } from "@/lib/closed-loop";
import { SAFETY_B, safetyFlywheel, type Arm } from "@/product/proof";
import { createRun, type OutcomeRun } from "@/product/run";

type Phase = "empty" | "setup" | "running" | "closed" | "error";

const CASES = [
  { id: "case-incomplete-evidence", title: "Incomplete evidence pack" },
  { id: "case-missing-measurements", title: "Missing measurements" },
  { id: "case-provenance-gap", title: "Provenance gap" },
] as const;

const LOOP = [
  ["Give A a task", "Objective and reference, not a prompt."],
  ["Let B execute", "Workbench B steps y. A only names y."],
  ["Measure", "z is observed. e is distance to the reference."],
  ["Improve", "Reuse only if final e falls. A tie is not a win."],
  ["Preserve", "The Run is the evidence. Export it."],
];

export default function WorkbenchPage() {
  const [phase, setPhase] = useState<Phase>("empty");
  const [namer, setNamer] = useState<Namer>("grok_bot");
  const [run, setRun] = useState<OutcomeRun | null>(null);

  function start() {
    setPhase("setup");
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Workbench B" />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-emerald-400 text-xs uppercase tracking-widest mb-3">
          One commercial B
        </p>
        <h1 className="text-3xl font-bold mb-3">One Run. Measured. Kept.</h1>
        <p className="text-zinc-400 max-w-2xl mb-6">
          Give A a task. Let B execute it. Measure the result. Improve the next run. Preserve the evidence.
          Customers are not buying an AI or a state machine. They are buying that loop.
        </p>

        <nav className="flex flex-wrap gap-4 text-sm mb-8">
          <Link className="underline" href="/workbench/client">Client pipeline</Link>
          <Link className="underline" href="/workbench/optimus">Optimus + Model 3 proof</Link>
          <Link className="underline" href="/workbench/proof">Safety proof</Link>
          <Link className="underline" href="/workbench/network">Actor network</Link>
          <Link className="underline" href="/workbench/compare">Peer proof</Link>
          <Link className="underline" href="/workbench/repeat">Repeat</Link>
          <Link className="underline" href="/workbench/history">History</Link>
        </nav>

        {phase === "empty" && (
          <button
            onClick={start}
            className="h-12 shrink-0 rounded-full bg-emerald-500 px-6 text-sm font-medium text-black"
          >
            Create Run
          </button>
        )}

        <section className="mt-10 space-y-6">
          {LOOP.map(([title, body], i) => (
            <div key={title} className="border border-zinc-800 rounded-2xl p-5">
              <p className="text-emerald-400 text-xs uppercase tracking-widest mb-1">
                0{i + 1}
              </p>
              <h2 className="text-lg font-semibold mb-1">{title}</h2>
              <p className="text-zinc-400 text-sm">{body}</p>
            </div>
          ))}
        </section>

        <section className="mt-10 border border-zinc-800 rounded-2xl p-5">
          <p className="text-emerald-400 text-xs uppercase tracking-widest mb-2">
            Killer metric · Δe
          </p>
          <h2 className="text-lg font-semibold mb-2">Intelligence is reduction of error</h2>
          <p className="text-zinc-400 text-sm">
            Φ is the change in final error between a cold run and a reuse run on the same reference.
            A lower final e is the claim. A shorter path is a note. A tie is not a win.
          </p>
        </section>
      </main>
    </div>
  );
}