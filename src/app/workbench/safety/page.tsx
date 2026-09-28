"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import {
  LoopPlant,
  SAFETY_PACK,
  caseById,
  freshPlant,
  loadCase,
  stepLoop,
  persistPlant,
  readPersistedPlant,
} from "@/lib/closed-loop";

export default function SafetyPage() {
  const [plant, setPlant] = useState<LoopPlant | null>(null);

  useEffect(() => {
    setPlant(readPersistedPlant() || freshPlant("case-contradictory-notes"));
  }, []);

  const c = plant ? caseById(plant.case_id) : SAFETY_PACK[1];
  const last = plant?.M.ledger[0];

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Diagnostic Safety" />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-emerald-400 text-xs uppercase tracking-widest mb-3">
          Experience pack on B · not a diagnosis
        </p>
        <h1 className="text-3xl font-bold mb-3">Diagnostic Safety Workbench</h1>
        <p className="text-zinc-400 mb-8">
          Misdiagnosis data is experience, and B’s job is generating
          experience for A. Enter the case as a task-policy-evaluator-memory
          record in A, then let B run W(B,y) and feed the outcome back up.
          Gates are HOLD / CLINICIAN_REVIEW / ESCALATE. No Diagnose button.
          No device claim.
        </p>

        <div className="flex flex-wrap gap-2 mb-6">
          {SAFETY_PACK.map((item) => (
            <button
              key={item.id}
              onClick={() =>
                setPlant((p) => (p ? loadCase(p, item.id) : freshPlant(item.id)))
              }
              className={`h-10 px-4 rounded-full text-sm border ${
                plant?.case_id === item.id
                  ? "bg-emerald-600 border-emerald-600"
                  : "border-zinc-700"
              }`}
            >
              {item.title}
            </button>
          ))}
        </div>

        <section className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 mb-6">
          <p className="text-xs text-emerald-400 mb-2">{c.source}</p>
          <h2 className="text-xl font-semibold mb-2">{c.title}</h2>
          <p className="text-zinc-300 mb-4">{c.presentation}</p>
          <p className="text-sm mb-4">
            Reference gate{" "}
            <b className="text-emerald-400">{c.reference_gate}</b>
            {" · "}
            {c.reference_note}
          </p>
          <p className="text-sm text-zinc-500 mb-2">Available</p>
          <ul className="text-sm mb-4">
            {c.available.map((k) => (
              <li key={k}>✓ {k}</li>
            ))}
          </ul>
          <p className="text-sm text-zinc-500 mb-2">Missing</p>
          <ul className="text-sm mb-4">
            {c.missing.length === 0 ? (
              <li>none</li>
            ) : (
              c.missing.map((k) => <li key={k}>✗ {k}</li>)
            )}
          </ul>
          {c.contradictions.length > 0 ? (
            <>
              <p className="text-sm text-zinc-500 mb-2">Contradictions</p>
              <ul className="text-sm">
                {c.contradictions.map((x) => (
                  <li key={x.source}>
                    {x.source}: {x.note}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>

        <section className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 mb-8">
          <p className="text-sm text-zinc-400 mb-3">
            Measured gate{" "}
            <b className="text-white">{last?.gate ?? "HOLD"}</b>
            {" · "}e={plant?.M.last_e ?? "—"} ·{" "}
            {plant?.M.last_z ?? "run a transition"}
          </p>
          <button
            onClick={() => {
              if (!plant) return;
              const out = stepLoop(plant, { namer: "hy4_deep" }); setPlant(out.plant); persistPlant(out.plant);
            }}
            className="h-11 px-5 rounded-full bg-emerald-600 text-sm"
          >
            Let B run W(B,y)
          </button>
          <p className="text-xs text-zinc-500 mt-4">
            Limitation: evidence gate only. Does not emit a diagnosis, does
            not eliminate misdiagnosis, makes no device claim. No production
            PHI.
          </p>
        </section>

        <nav className="flex flex-wrap gap-4 text-sm">
          <Link className="underline" href="/workspace">
            Back to A
          </Link>
          <Link className="underline" href="/loop">
            Closed loop
          </Link>
          <Link className="underline" href="/marketplace">
            List this e
          </Link>
        </nav>
      </main>
    </div>
  );
}
