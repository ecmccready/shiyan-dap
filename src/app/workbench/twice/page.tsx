use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { safetyFlywheel } from "@/product/proof";

const JOURNEY = [
  "CREATE RUN",
  "Define objective",
  "A proposes action",
  "B executes",
  "z",
  "e",
  "Δe",
  "PROOF",
  "REUSE",
  "NEW RUN",
];

export default function TwicePage() {
  const [ran, setRan] = useState(false);
  const runs = useMemo(() => {
    if (!ran) return [];
    return [1, 2].map((n) => {
      const wheel = safetyFlywheel("grok_bot");
      const packs = wheel.reuse.map((arm, i) => {
        const cold = wheel.cold[i];
        const phi = Number((cold.e1 - arm.e1).toFixed(3));
        return { title: arm.title, cold: cold.e1, reuse: arm.e1, phi, pass: phi > 0 };
      });
      return { n, packs, pass: packs.every((p) => p.pass) };
    });
  }, [ran]);
  const repeatable = ran && runs.length === 2 && runs.every((run) => run.pass);

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Repeat" />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <p className="text-xs uppercase tracking-[0.18em] text-emerald-400">Unfinished step</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Run the Safety proof twice independently.</h1>
        <p className="mt-4 text-sm leading-6 text-zinc-400">
          Two calls. Same A. Same Safety plant. The second call does not read the first. Self() does not read prior Runs.
          The published B1 record is 1.391 to 0.235, Φ 1.156, twice. This page recomputes instead of copying that row.
        </p>

        <ol className="mt-8 space-y-2">
          {JOURNEY.map((step, i) => (
            <li key={step} className="flex items-center gap-3 text-sm">
              <span className="w-6 text-xs text-emerald-400">0{i + 1}</span>
              <span className="rounded-full border border-zinc-700 px-3 py-1">{step}</span>
            </li>
          ))}
        </ol>

        <button
          onClick={() => setRan(true)}
          className="mt-8 h-11 rounded-full bg-emerald-500 px-5 text-sm font-medium text-black"
        >
          {ran ? "Proofs printed" : "Run Safety twice"}
        </button>

        {!ran && (
          <p className="mt-6 rounded-3xl border border-dashed border-zinc-700 p-6 text-sm text-zinc-500">
            Nothing printed. A repeat cannot be claimed yet.
          </p>
        )}

        {runs.map((run) => (
          <section key={run.n} className="mt-6 rounded-3xl border border-zinc-800 p-5">
            <p className="text-xs uppercase tracking-wider text-emerald-400">Safety Run #{run.n}</p>
            {run.packs.map((pack) => (
              <p key={pack.title} className="mt-3 text-sm">
                {pack.title}
                <span className="mt-1 block tabular-nums">cold e {pack.cold} → reuse e {pack.reuse}</span>
                <span className="block">Φ {pack.phi} · {pack.pass ? "Φ > 0" : "not a win"}</span>
              </p>
            ))}
          </section>
        ))}

        {ran && (
          <p className={`mt-6 border-l-2 pl-4 text-xl font-medium ${repeatable ? "border-emerald-400" : "border-amber-400 text-amber-200"}`}>
            {repeatable ? "The reduction is repeatable." : "The reduction did not repeat. Do not claim it."}
          </p>
        )}

        <nav className="mt-8 flex flex-wrap gap-4 text-sm text-zinc-400">
          <Link className="underline" href="/workbench">Workbench</Link>
          <Link className="underline" href="/workbench/repeat">Recorded B1 repeat</Link>
          <Link className="underline" href="/workbench/proof">Proof</Link>
        </nav>
      </main>
    </div>
  );
}