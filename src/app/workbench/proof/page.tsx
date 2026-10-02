"use client";

import { useMemo } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { coldRoll, phi, reuseRoll, type Roll } from "@/lib/reuse-policy";

const CASES = [
  ["case-incomplete-pack", "Incomplete evidence pack"],
  ["case-missing-measurements", "Missing measurements"],
  ["case-provenance-gap", "Provenance gap"],
] as const;

function line(r: Roll) {
  return r.steps
    .map((s, i) => `${i + 1}) y=${s.y} · e ${s.e} → ${s.e_next} · ${s.gate}`)
    .join("\n");
}

export default function ProofPage() {
  const demo = useMemo(() => {
    return CASES.map(([id, title]) => {
      const cold = coldRoll(id);
      const reuse = reuseRoll(id, cold);
      const gain = phi(cold, reuse);
      return {
        id,
        title,
        cold,
        reuse,
        gain,
        used: reuse.hint !== null && gain > 0,
      };
    });
  }, []);
  const won = demo.every((d) => d.gain > 0);

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Workbench B" />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-emerald-400 text-xs uppercase tracking-widest mb-3">Safety proof</p>
        <h1 className="text-3xl font-bold mb-3">Cold plant, then reuse plant</h1>
        <p className="text-zinc-400 max-w-2xl mb-8">
          Evidence gate. Not a diagnosis. No PHI. Self() is not edited.
          Φ = e_cold(final) − e_reuse(final). List only if Φ &gt; 0.
        </p>
        {demo.map((d) => (
          <section key={d.id} className="mb-8">
            <h2 className="text-lg font-semibold mb-2">{d.title}</h2>
            <pre className="text-sm bg-zinc-950 border border-zinc-800 rounded-2xl p-5 leading-7">{`cold
hint: none
e ${d.cold.e0} → ${d.cold.eFinal}
${line(d.cold)}

reuse
hint: ${d.reuse.hint ?? "none"}
used experience: ${d.used ? "yes" : "no"}
e ${d.reuse.e0} → ${d.reuse.eFinal}
${line(d.reuse)}

Φ ${d.gain} · ${d.gain > 0 ? "error win" : "not listable"}`}</pre>
          </section>
        ))}
        <p className="text-sm text-zinc-300">
          {won
            ? "Later plants beat cold final e."
            : "Later plants did not beat cold final e. Do not claim the flywheel."}
        </p>
        <nav className="flex gap-4 text-sm mt-8">
          <Link className="underline" href="/workbench">Workbench B</Link>
          <Link className="underline" href="/workbench/safety">Diagnostic</Link>
        </nav>
      </main>
    </div>
  );
}