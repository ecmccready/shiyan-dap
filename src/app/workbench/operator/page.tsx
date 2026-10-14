"use client";

import { useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import {
  freshPlant,
  nameY,
  W,
  measureE,
  measureZ,
  caseById,
  type LoopPlant,
  type StepRec,
} from "@/lib/closed-loop";

export default function OperatorPage() {
  const [plant, setPlant] = useState<LoopPlant>(() => freshPlant());
  const [lastStep, setLastStep] = useState<StepRec | null>(null);
  const [log, setLog] = useState<string[]>([]);

  function runStep(which: "self" | "experience" = "experience") {
    const c = caseById(plant.case_id);
    const eBefore = measureE(plant.B, c);
    const named = nameY(plant, which);
    const B_next = W(plant.B, named.y);
    const eAfter = measureE(B_next, c);
    const z = measureZ(B_next, named.y);
    const reduced = Number((eBefore - eAfter).toFixed(3));

    const step: StepRec = {
      t: plant.t + 1,
      case_id: plant.case_id,
      namer: which === "self" ? "operator" : "operator",
      y: named.y,
      gate: "HOLD",
      B: plant.B,
      B_next,
      z: z.z,
      z_value: z.z_value,
      e: eBefore,
      e_next: eAfter,
      reduced,
      dominant: "missing",
      source: named.source,
    };

    const nextPlant: LoopPlant = {
      ...plant,
      t: plant.t + 1,
      B: B_next,
      M: {
        ...plant.M,
        ledger: [...plant.M.ledger, step],
        last_z: z.z,
        last_e: eAfter,
        last_y: named.y,
        last_dominant: step.dominant,
      },
    };

    setPlant(nextPlant);
    setLastStep(step);
    setLog((prev) => [
      `t=${step.t} y=${step.y} source=${step.source} e ${eBefore.toFixed(3)} → ${eAfter.toFixed(3)} reduced=${reduced}`,
      ...prev.slice(0, 9),
    ]);
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Workbench B · Operator" />
      <main className="max-w-4xl mx-auto px-6 py-12 space-y-8">
        <header>
          <p className="text-emerald-400 text-xs uppercase tracking-widest mb-3">Shared operator · actual execution</p>
          <h1 className="text-3xl font-bold mb-3">Receives state · selects action · executes · measures</h1>
          <p className="text-zinc-400 max-w-2xl">
            Calls the real closed-loop functions (nameY, W, measureE, measureZ) from src/lib/closed-loop.ts. Does not duplicate the algorithm. Self() still does not read prior Runs.
          </p>
          <Link href="/workbench/relative" className="text-emerald-400 text-sm hover:underline mt-2 inline-block">
            ← Mathematical specification
          </Link>
        </header>

        <section className="border border-zinc-800 rounded-2xl p-5 space-y-3 text-sm">
          <p><span className="text-white">Case:</span> {plant.case_id}</p>
          <p><span className="text-white">t:</span> {plant.t}</p>
          <p><span className="text-white">Current e:</span> {measureE(plant.B, caseById(plant.case_id)).toFixed(3)}</p>
          <p className="text-zinc-500 text-xs">Plant state is the real PlantB from the safety reference pack. Same measurement contract as the rest of the engine.</p>
        </section>

        <div className="flex gap-3">
          <button onClick={() => runStep("experience")} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-sm">
            Step (experience namer)
          </button>
          <button onClick={() => runStep("self")} className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-xl text-sm">
            Step (Self baseline)
          </button>
          <button onClick={() => { setPlant(freshPlant()); setLastStep(null); setLog([]); }} className="border border-zinc-700 px-4 py-2 rounded-xl text-sm">
            Reset
          </button>
        </div>

        {lastStep && (
          <section className="border border-zinc-800 rounded-2xl p-5 text-sm font-mono">
            <p>y = {lastStep.y}</p>
            <p>source = {lastStep.source}</p>
            <p>e {lastStep.e.toFixed(3)} → {lastStep.e_next.toFixed(3)}</p>
            <p>reduced = {lastStep.reduced}</p>
            <p className="text-zinc-400">{lastStep.z}</p>
          </section>
        )}

        {log.length > 0 && (
          <section className="border border-zinc-800 rounded-2xl p-5 text-xs font-mono space-y-1">
            {log.map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </section>
        )}

        <p className="text-xs text-zinc-500">
          Φ only when final e falls. Reuse refused on tie or increase. Not a claim of Level 3 autonomy. Not revenue. Developmental stack is the product.
        </p>

        <nav className="flex flex-wrap gap-4 text-sm">
          <Link href="/workbench/relative" className="underline">Mathematical specification</Link>
          <Link href="/workbench/optimus" className="underline">Shiyan plant</Link>
          <Link href="/workbench" className="underline">Workbench B</Link>
        </nav>
      </main>
    </div>
  );
}