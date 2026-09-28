"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import {
  LoopPlant,
  SAFETY_PACK,
  freshPlant,
  loadCase,
  stepLoop,
  persistPlant,
  readPersistedPlant,
} from "@/lib/closed-loop";

export default function WorkbenchPage() {
  const [plant, setPlant] = useState<LoopPlant | null>(null);

  useEffect(() => {
    setPlant(readPersistedPlant() || freshPlant());
  }, []);

  function pick(id: string) {
    setPlant((p) => (p ? loadCase(p, id) : freshPlant(id)));
  }

  function transition() {
    if (!plant) return;
    const out = stepLoop(plant, { namer: "grok_bot" });
    setPlant(out.plant); persistPlant(out.plant);
  }

  const B = plant?.B;

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="B · environment" />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-emerald-400 text-xs uppercase tracking-widest mb-3">
          P2P state machine B · experience generator
        </p>
        <h1 className="text-3xl font-bold mb-3">Workbench B</h1>
        <p className="text-zinc-400 mb-8">
          B is the environment. W(B,y) is the world transition. This is not
          a customer and not a separate task-setter. Tasks, policy,
          evaluator, and memory live in A. B generates experience for A.
        </p>

        <pre className="text-xs bg-zinc-950 border border-zinc-800 rounded-2xl p-5 mb-8 overflow-auto leading-6">
{`Workspace A
  Task · Policy · Evaluator · Memory · Self()
        ↓
P2P Workbench B
        ↓
   Experience
        → A

Create safety workbench from here when Domain = safety.
Music rail remains /nfts.`}
        </pre>

        <div className="grid gap-3 md:grid-cols-2 mb-8">
          {SAFETY_PACK.map((c) => (
            <button
              key={c.id}
              onClick={() => pick(c.id)}
              className={`text-left border rounded-2xl p-4 ${
                plant?.case_id === c.id
                  ? "border-emerald-600 bg-zinc-900"
                  : "border-zinc-800"
              }`}
            >
              <p className="text-xs text-emerald-400 mb-1">{c.source}</p>
              <p className="font-medium">{c.title}</p>
              <p className="text-sm text-zinc-500 mt-1">{c.reference_gate}</p>
            </button>
          ))}
        </div>

        {B ? (
          <section className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 mb-8">
            <p className="text-xs text-emerald-400 mb-2">Current |B|</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              {Object.entries(B)
                .filter(([k]) => k !== "case_id")
                .map(([k, v]) => (
                  <p key={k}>
                    <span className="text-zinc-500">{k}</span> {String(v)}
                  </p>
                ))}
            </div>
            <p className="text-sm text-zinc-400 mt-4">
              {plant?.M.last_z ?? "No transition yet."}
            </p>
            <button
              onClick={transition}
              className="mt-4 h-11 px-5 rounded-full bg-emerald-600 text-sm"
            >
              Run W(B,y)
            </button>
          </section>
        ) : null}

        <nav className="flex flex-wrap gap-4 text-sm">
          <Link className="underline" href="/workspace">
            A
          </Link>
          <Link className="underline" href="/workbench/safety">
            Diagnostic Safety
          </Link>
          <Link className="underline" href="/nfts">
            Music rail
          </Link>
          <Link className="underline" href="/marketplace">
            Marketplace
          </Link>
        </nav>
      </main>
    </div>
  );
}
