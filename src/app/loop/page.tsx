"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import {
  LoopPlant,
  Namer,
  SAFETY_PACK,
  freshPlant,
  loadCase,
  namerLabel,
  persistPlant,
  readPersistedPlant,
} from "@/lib/closed-loop";

export default function LoopPage() {
  const [plant, setPlant] = useState<LoopPlant | null>(null);
  const [namer, setNamer] = useState<Namer>("grok_bot");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPlant(readPersistedPlant() || freshPlant());
  }, []);

  const series = useMemo(
    () => (plant ? [...plant.M.ledger].reverse() : []),
    [plant]
  );

  async function tick(times = 1) {
    if (!plant) return;
    setBusy(true);
    let current = plant;
    for (let i = 0; i < times; i++) {
      const res = await fetch("/api/loop/step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plant: current, namer }),
      });
      const data = await res.json();
      current = data.plant;
    }
    setPlant(current); persistPlant(current);
    setBusy(false);
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Closed loop" />
      <main className="max-w-5xl mx-auto px-6 py-12">
        <p className="text-emerald-400 text-xs uppercase tracking-widest mb-3">
          Collapse it to one loop
        </p>
        <h1 className="text-3xl font-bold mb-3">The loop is the AI</h1>
        <p className="text-zinc-400 max-w-3xl mb-8">
          A acts, B transitions, z is the measured state. Grok / Hy4 / Grok
          Bot are interchangeable orchestrators inside A. Models do not sit
          outside it. Ship the measured reduction of e on B.
        </p>

        <div className="flex flex-wrap gap-2 mb-6">
          {SAFETY_PACK.map((c) => (
            <button
              key={c.id}
              onClick={() =>
                setPlant((p) => (p ? loadCase(p, c.id) : freshPlant(c.id)))
              }
              className={`h-10 px-3 rounded-full text-xs border ${
                plant?.case_id === c.id
                  ? "bg-emerald-600 border-emerald-600"
                  : "border-zinc-700"
              }`}
            >
              {c.title}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 mb-8">
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
            onClick={() => tick(1)}
            disabled={busy}
            className="h-10 px-5 rounded-full bg-white text-black text-sm"
          >
            {busy ? "…" : "Step"}
          </button>
          <button
            onClick={() => tick(5)}
            disabled={busy}
            className="h-10 px-5 rounded-full border border-zinc-700 text-sm"
          >
            Step ×5
          </button>
          <button
            onClick={() => setPlant(freshPlant(plant?.case_id))}
            className="h-10 px-5 rounded-full border border-zinc-700 text-sm"
          >
            Reset plant
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-3 mb-8">
          <div className="border border-zinc-800 rounded-2xl p-5">
            <p className="text-xs text-zinc-500">t</p>
            <p className="text-2xl">{plant?.t ?? 0}</p>
          </div>
          <div className="border border-zinc-800 rounded-2xl p-5">
            <p className="text-xs text-zinc-500">e on B</p>
            <p className="text-2xl">{plant?.M.last_e ?? "—"}</p>
          </div>
          <div className="border border-zinc-800 rounded-2xl p-5">
            <p className="text-xs text-zinc-500">last y</p>
            <p className="text-2xl">{plant?.M.last_y ?? "—"}</p>
          </div>
        </div>

        {series.length > 0 ? (
          <section className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 mb-8">
            <p className="text-xs text-emerald-400 mb-4">e over t</p>
            <div className="flex items-end gap-1 h-24">
              {series.map((r) => (
                <div
                  key={r.t}
                  title={`t=${r.t} e=${r.e_next}`}
                  className="flex-1 bg-emerald-500/80 rounded-t"
                  style={{ height: `${Math.max(6, (1.8 - r.e_next) * 40)}px` }}
                />
              ))}
            </div>
          </section>
        ) : null}

        {plant && plant.M.ledger.length > 0 ? (
          <div className="overflow-x-auto border border-zinc-800 rounded-2xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-zinc-500">
                  <th className="text-left p-3">t</th>
                  <th className="text-left p-3">namer</th>
                  <th className="text-left p-3">y</th>
                  <th className="text-left p-3">gate</th>
                  <th className="text-left p-3">e</th>
                  <th className="text-left p-3">e′</th>
                  <th className="text-left p-3">Δe</th>
                  <th className="text-left p-3">z</th>
                </tr>
              </thead>
              <tbody>
                {plant.M.ledger.map((r) => (
                  <tr key={r.t} className="border-t border-zinc-800">
                    <td className="p-3">{r.t}</td>
                    <td className="p-3">{r.namer}</td>
                    <td className="p-3">{r.y}</td>
                    <td className="p-3">{r.gate}</td>
                    <td className="p-3">{r.e}</td>
                    <td className="p-3">{r.e_next}</td>
                    <td className="p-3">{r.reduced}</td>
                    <td className="p-3 font-mono text-xs">{r.z}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-zinc-500">Step the loop to write memory M.</p>
        )}

        <p className="text-sm text-zinc-500 mt-8">
          Music still proves on{" "}
          <Link className="underline" href="/nfts">
            /nfts
          </Link>
          . e listings live on{" "}
          <Link className="underline" href="/marketplace">
            /marketplace
          </Link>
          .
        </p>
      </main>
    </div>
  );
}
