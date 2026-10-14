"use client";

import { useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { freshPlant, type LoopPlant, type StepRec } from "@/lib/closed-loop";

export default function SelfPage() {
  const [plant, setPlant] = useState<LoopPlant>(() => freshPlant());
  const [last, setLast] = useState<{
    source: string;
    justification?: string;
    rec: StepRec;
    persisted: { id: string; phi: number } | null;
    note?: string;
  } | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  async function step(which: "self" | "experience") {
    setLoading(true);
    try {
      const res = await fetch("/api/loop/step/self", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plant, which }),
      });
      const text = await res.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Non-JSON response (${res.status}): ${text.slice(0, 180)}`);
      }
      if (!data.ok) throw new Error(data.error || "step failed");
      setPlant(data.plant);
      setLast(data);
      setLog((prev) => [
        `t=${data.rec.t} source=${data.source} y=${data.rec.y} reduced=${data.rec.reduced}${data.persisted ? ` persisted=${data.persisted.id}` : " (not persisted)"}`,
        ...prev.slice(0, 9),
      ]);
    } catch (err) {
      setLog((prev) => [`Error: ${String(err)}`, ...prev.slice(0, 9)]);
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Workbench B · Self()" />
      <main className="max-w-4xl mx-auto px-6 py-12 space-y-8">
        <header>
          <p className="text-emerald-400 text-xs uppercase tracking-widest mb-3">
            Level 3 · closed loop
          </p>
          <h1 className="text-3xl font-bold mb-3">
            Real Run writes experience · next Self() consumes it
          </h1>
          <p className="text-zinc-400 max-w-2xl">
            Baseline Self() does not read memory. Experience path calls SelfFromApproved, executes the step, and persists the Run only when reduced &gt; 0. That Run becomes eligible for the next call under the same client.
          </p>
        </header>

        <section className="border border-zinc-800 rounded-2xl p-5 text-sm">
          <p><span className="text-white">Case:</span> {plant.case_id}</p>
          <p><span className="text-white">t:</span> {plant.t}</p>
          <p className="text-xs text-zinc-500 mt-1">Plant state is real. Persistence uses the existing run-store.</p>
        </section>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => step("self")}
            disabled={loading}
            className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-xl text-sm disabled:opacity-50"
          >
            Step (baseline Self)
          </button>
          <button
            onClick={() => step("experience")}
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-sm disabled:opacity-50"
          >
            {loading ? "…" : "Step (from approved experience)"}
          </button>
          <button
            onClick={() => { setPlant(freshPlant()); setLast(null); setLog([]); }}
            className="border border-zinc-700 px-4 py-2 rounded-xl text-sm"
          >
            Reset plant
          </button>
        </div>

        {last && (
          <section className="border border-zinc-800 rounded-2xl p-5 text-sm font-mono space-y-1">
            <p>source = {last.source}{last.justification ? ` · ${last.justification}` : ""}</p>
            <p>y = {last.rec.y}</p>
            <p>e {last.rec.e.toFixed(3)} → {last.rec.e_next.toFixed(3)}</p>
            <p>reduced = {last.rec.reduced}</p>
            <p className="text-zinc-400">{last.persisted ? `persisted ${last.persisted.id} (Φ ${last.persisted.phi})` : "not persisted (reduced ≤ 0)"}</p>
            {last.note && <p className="text-zinc-500 text-xs">{last.note}</p>}
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
          Only Runs with reduced &gt; 0 are written to the store and become eligible for the next SelfFromApproved call. Tie or increase is refused. Baseline Self() remains memory-free. Engine not replaced. Not revenue.
        </p>

        <nav className="flex flex-wrap gap-4 text-sm">
          <Link href="/workbench/relative" className="underline">Mathematical specification</Link>
          <Link href="/workbench/operator" className="underline">Shared operator</Link>
          <Link href="/workbench/shiyan" className="underline">Shiyan plant</Link>
          <Link href="/workbench" className="underline">Workbench B</Link>
        </nav>
      </main>
    </div>
  );
}