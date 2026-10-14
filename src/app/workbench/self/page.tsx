"use client";

import { useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { SelfFromApproved } from "@/lib/approved-experience";
import { Self, freshPlant, type YAction } from "@/lib/closed-loop";

export default function SelfPage() {
  const [baseline, setBaseline] = useState<YAction | null>(null);
  const [fromExperience, setFromExperience] = useState<{
    y: string;
    source: string;
    justification?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  async function runBaseline() {
    const plant = freshPlant();
    const y = Self(plant);
    setBaseline(y);
    setLog((prev) => [`Baseline Self() → ${y} (does not read memory)`, ...prev.slice(0, 7)]);
  }

  async function runFromExperience() {
    setLoading(true);
    try {
      // Demo client / versions — replace with real workspace values in production
      const result = await SelfFromApproved(
        "demo-client",
        "1.0",
        "grok-bot",
        "observe"
      );
      setFromExperience(result);
      setLog((prev) => [
        `SelfFromApproved → ${result.y} (${result.source}${result.justification ? ` · ${result.justification}` : ""})`,
        ...prev.slice(0, 7),
      ]);
    } catch (err) {
      setLog((prev) => [`Error: ${String(err)}`, ...prev.slice(0, 7)]);
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Workbench B · Self()" />
      <main className="max-w-4xl mx-auto px-6 py-12 space-y-8">
        <header>
          <p className="text-emerald-400 text-xs uppercase tracking-widest mb-3">
            Level 3 · Self() from persistent experience
          </p>
          <h1 className="text-3xl font-bold mb-3">
            Baseline Self() vs experience-using Self()
          </h1>
          <p className="text-zinc-400 max-w-2xl">
            Baseline Self() names y without reading memory. SelfFromApproved retrieves only approved, safety-passed Runs with Φ &gt; 0 and selects the highest-Φ y. Reuse refused on tie or increase. Engine not replaced.
          </p>
        </header>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={runBaseline}
            className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-xl text-sm"
          >
            Run baseline Self()
          </button>
          <button
            onClick={runFromExperience}
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-sm disabled:opacity-50"
          >
            {loading ? "…" : "Run Self() from approved experience"}
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <section className="border border-zinc-800 rounded-2xl p-5">
            <p className="text-xs text-zinc-500 uppercase tracking-widest mb-2">Baseline</p>
            <p className="text-lg font-mono">{baseline ?? "—"}</p>
            <p className="text-xs text-zinc-500 mt-2">Does not read prior Runs</p>
          </section>
          <section className="border border-zinc-800 rounded-2xl p-5">
            <p className="text-xs text-zinc-500 uppercase tracking-widest mb-2">From approved experience</p>
            <p className="text-lg font-mono">{fromExperience?.y ?? "—"}</p>
            <p className="text-xs text-zinc-500 mt-2">
              source: {fromExperience?.source ?? "—"}
              {fromExperience?.justification ? ` · ${fromExperience.justification}` : ""}
            </p>
          </section>
        </div>

        {log.length > 0 && (
          <section className="border border-zinc-800 rounded-2xl p-5 text-xs font-mono space-y-1">
            {log.map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </section>
        )}

        <p className="text-xs text-zinc-500">
          Only Runs with approved === true, safety_passed === true, and phi &gt; 0 are eligible. A tie on final e is not a win. Developmental stack is the product. Not revenue.
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