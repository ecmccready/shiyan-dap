"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import {
  LoopPlant,
  Namer,
  freshPlant,
  namerLabel,
  persistPlant,
  readPersistedPlant,
} from "@/lib/closed-loop";

export default function HomePage() {
  const [plant, setPlant] = useState<LoopPlant | null>(null);
  const [namer, setNamer] = useState<Namer>("grok_bot");
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState("One loop. Models only name y.");

  useEffect(() => {
    setPlant(readPersistedPlant() || freshPlant());
  }, []);

  async function act() {
    if (!plant) return;
    setBusy(true);
    try {
      const res = await fetch("/api/loop/step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plant, namer }),
      });
      const data = await res.json();
      setPlant(data.plant); persistPlant(data.plant);
      setFlash(
        `${namerLabel(namer)} named y=${data.rec.y}. e ${data.rec.e} → ${data.rec.e_next} (${data.rec.reduced >= 0 ? "−" : "+"}${Math.abs(data.rec.reduced)}). ${data.rec.z}`
      );
    } catch {
      setFlash("Loop step failed. The plant is still local.");
    }
    setBusy(false);
  }

  const last = plant?.M.ledger[0];

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader />
      <main className="max-w-5xl mx-auto px-6 py-12">
        <p className="text-emerald-400 text-xs uppercase tracking-widest mb-3">
          One closed loop · not three products
        </p>
        <h1 className="text-4xl font-bold mb-4">A acts. B transitions. z is measured.</h1>
        <p className="text-zinc-400 max-w-3xl mb-8">
          That loop is the product. Intelligence is the measured reduction of
          e on B. Task, policy, evaluator, memory, and Self() live in A and
          name y. B is the environment — a safety reference pack first, music
          rail still on /nfts. z is |B′| after W(B,y). z is not an LLM
          opinion. Grok fast, Hy4 deep, and Grok Bot are interchangeable
          namers of y inside A. They do not sit outside the loop.
        </p>

        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 mb-8 overflow-x-auto">
          <p className="font-mono text-sm text-emerald-300 whitespace-nowrap">
            z<sub>t</sub>
            <span className="text-zinc-500"> —Self() in A→ </span>
            y<sub>t</sub>
            <span className="text-zinc-500"> —W(B,y)→ </span>
            B′<sub>t+1</sub>
            <span className="text-zinc-500"> measure </span>
            z<sub>t+1</sub>, e<sub>t</sub>
            <span className="text-zinc-500"> —M→ </span>
            z-next
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3 mb-10">
          <section className="border border-zinc-800 rounded-2xl p-5">
            <p className="text-xs text-emerald-400 mb-2">A · controller</p>
            <p className="text-zinc-300 text-sm">
              Task · Policy · Evaluator · Memory · Self(). Names y. Not a
              separate product.
            </p>
            <Link href="/workspace" className="text-sm underline mt-3 inline-block">
              Open A inside the loop
            </Link>
          </section>
          <section className="border border-zinc-800 rounded-2xl p-5">
            <p className="text-xs text-emerald-400 mb-2">B · environment</p>
            <p className="text-zinc-300 text-sm">
              W(B,y) is the world transition. Not a customer. Not a
              clinician. Generates experience for A.
            </p>
            <Link href="/workbench" className="text-sm underline mt-3 inline-block">
              Open B inside the loop
            </Link>
          </section>
          <section className="border border-zinc-800 rounded-2xl p-5">
            <p className="text-xs text-emerald-400 mb-2">z · e · measured</p>
            <p className="text-zinc-300 text-sm">
              z is measured state after the transition. e versus the
              reference label is what can list.
            </p>
            <Link href="/marketplace" className="text-sm underline mt-3 inline-block">
              List e
            </Link>
          </section>
        </div>

        <section className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 mb-8">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
            <div>
              <p className="text-xs text-emerald-400 mb-1">Live plant</p>
              <h2 className="text-xl font-semibold">
                {plant ? plant.case_id : "loading"}
              </h2>
              <p className="text-sm text-zinc-500">
                t={plant?.t ?? 0} · e={plant?.M.last_e ?? "—"} ·{" "}
                {plant?.M.last_z ?? "no measurement yet"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
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
                onClick={act}
                disabled={busy || !plant}
                className="h-10 px-5 rounded-full bg-white text-black text-sm"
              >
                {busy ? "…" : "Act"}
              </button>
            </div>
          </div>
          <p className="text-sm text-zinc-300 mb-4">{flash}</p>
          {last ? (
            <p className="text-xs text-zinc-500 font-mono">
              last y={last.y} gate={last.gate} reduced={last.reduced} z=
              {last.z_value}
            </p>
          ) : null}
        </section>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/loop"
            className="h-12 px-6 rounded-full bg-emerald-600 text-sm inline-flex items-center"
          >
            Run the loop
          </Link>
          <Link
            href="/workbench/safety"
            className="h-12 px-6 rounded-full bg-emerald-600 text-sm inline-flex items-center"
          >
            Diagnostic Safety plant
          </Link>
          <Link
            href="/nfts"
            className="h-12 px-6 rounded-full border border-zinc-700 text-sm inline-flex items-center"
          >
            Music rail
          </Link>
          <Link
            href="/architecture"
            className="h-12 px-6 rounded-full border border-zinc-700 text-sm inline-flex items-center"
          >
            Spec
          </Link>
        </div>
      </main>
    </div>
  );
}
