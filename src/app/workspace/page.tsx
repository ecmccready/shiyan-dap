"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import {
  LoopPlant,
  Namer,
  YAction,
  Y_ACTIONS,
  freshPlant,
  namerLabel,
  persistPlant,
  readPersistedPlant,
} from "@/lib/closed-loop";

export default function WorkspacePage() {
  const [plant, setPlant] = useState<LoopPlant | null>(null);
  const [namer, setNamer] = useState<Namer>("grok_fast");
  const [note, setNote] = useState("A is ready. Open Workbench when you need the plant.");

  useEffect(() => {
    setPlant(readPersistedPlant() || freshPlant());
  }, []);

  async function nameY(y?: YAction) {
    if (!plant) return;
    const res = await fetch("/api/loop/step", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plant,
        namer: y ? "operator" : namer,
        y,
      }),
    });
    const data = await res.json();
    setPlant(data.plant);
    persistPlant(data.plant);
    setNote(
      `Self() via ${namerLabel(data.named_by)} wrote y=${data.rec.y}. Measured ${data.rec.z}. e ${data.rec.e} → ${data.rec.e_next}.`
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Workspace" />
      <div className="border-b border-zinc-800">
        <nav className="max-w-4xl mx-auto px-6 py-3 flex flex-wrap gap-4 text-sm">
          <Link href="/workbench" className="text-emerald-400 hover:text-white">
            Workbench
          </Link>
          <Link href="/workbench/safety" className="text-zinc-400 hover:text-white">
            Safety
          </Link>
          <Link href="/nfts" className="text-zinc-400 hover:text-white">
            Music rail
          </Link>
        </nav>
      </div>
      <main className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-emerald-400 mb-3">Workspace A · controller</p>
        <h1 className="text-3xl font-bold mb-3">Workspace A</h1>
        <p className="text-zinc-400 mb-8">
          Task, policy, evaluator, memory, Self(). Workbench is the
          environment A acts on. It is linked here only.
        </p>

        <div className="flex flex-wrap gap-2 mb-6">
          {(["grok_fast", "hy4_deep", "grok_bot"] as Namer[]).map((id) => (
            <button
              key={id}
              onClick={() => setNamer(id)}
              className={`h-10 px-4 rounded-full text-sm border ${
                namer === id
                  ? "bg-emerald-600 border-emerald-600"
                  : "border-zinc-700"
              }`}
            >
              {namerLabel(id)}
            </button>
          ))}
          <button
            onClick={() => nameY()}
            className="h-10 px-5 rounded-full bg-white text-black text-sm"
          >
            Self() names y
          </button>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 mb-6">
          <p className="text-sm text-zinc-300 mb-3">{note}</p>
          <p className="text-xs text-zinc-500 font-mono">
            last_z={plant?.M.last_z ?? "—"} · last_e={plant?.M.last_e ?? "—"} ·
            t={plant?.t ?? 0}
          </p>
        </div>

        <p className="text-xs uppercase tracking-widest text-zinc-500 mb-3">
          Operator may override y
        </p>
        <div className="flex flex-wrap gap-2 mb-8">
          {Y_ACTIONS.map((y) => (
            <button
              key={y}
              onClick={() => nameY(y)}
              className="h-10 px-4 rounded-full border border-zinc-700 text-sm"
            >
              {y}
            </button>
          ))}
        </div>

        {plant && plant.M.ledger.length > 0 ? (
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-zinc-500">
                  <th className="text-left py-2">t</th>
                  <th className="text-left py-2">namer</th>
                  <th className="text-left py-2">y</th>
                  <th className="text-left py-2">e→</th>
                  <th className="text-left py-2">Δe</th>
                  <th className="text-left py-2">z</th>
                </tr>
              </thead>
              <tbody>
                {plant.M.ledger.map((r) => (
                  <tr key={r.t} className="border-t border-zinc-800">
                    <td className="py-2">{r.t}</td>
                    <td className="py-2">{r.namer}</td>
                    <td className="py-2">{r.y}</td>
                    <td className="py-2">
                      {r.e}→{r.e_next}
                    </td>
                    <td className="py-2">{r.reduced}</td>
                    <td className="py-2 font-mono text-xs">{r.z}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </main>
    </div>
  );
}
