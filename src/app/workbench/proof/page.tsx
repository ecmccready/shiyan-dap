"use client";

import { useMemo } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import CopyVerificationSummary from "@/components/CopyVerificationSummary";
import {
  coldRoll,
  phi,
  reuseRoll,
  usedExperience,
  type Roll,
} from "@/lib/reuse-policy";

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
  const demo = useMemo(
    () =>
      CASES.map(([id, title]) => {
        const cold = coldRoll(id);
        const reuse = reuseRoll(id, cold);
        const gain = phi(cold, reuse);
        return { id, title, cold, reuse, gain, used: usedExperience(cold, reuse) };
      }),
    []
  );
  const won = demo.every((d) => d.used);

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Workbench B" />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-emerald-400 text-xs uppercase tracking-widest mb-3">Safety proof</p>
        <h1 className="text-3xl font-bold mb-3">Cold plant, then reuse plant</h1>
        <p className="text-zinc-400 max-w-2xl mb-8">
          Evidence gate. Not a diagnosis. No PHI. Self() is not edited.
          A pack lists only when its own final e is below cold.
        </p>
        {demo.map((d) => (
          <section key={d.id} className="mb-8">
            <h2 className="text-lg font-semibold mb-2">{d.title}</h2>
            <pre className="text-sm bg-zinc-950 border border-zinc-800 rounded-2xl p-5 leading-7">{`cold
sequence: Self()
e ${d.cold.e0} → ${d.cold.eFinal}
${line(d.cold)}

reuse
sequence: ${d.used ? d.reuse.sequence.join(" → ") : "none"}
used experience: ${d.used ? "yes" : "no"}
e ${d.reuse.e0} → ${d.reuse.eFinal}
${d.used ? line(d.reuse) : "same plant as cold"}

Φ ${d.gain} · ${d.used ? "error win" : "not listable"}`}</pre>
          </section>
        ))}
        <p className="text-sm text-zinc-300">
          {demo.map((d) => `${d.title}: Φ ${d.gain} ${d.used ? "yes" : "no"}`).join(" · ")}
        </p>
        <p className="text-sm text-zinc-300 mt-3">
          {won
            ? "All three later plants beat cold final e."
            : "Not every plant beat cold final e. Do not claim the flywheel."}
        </p>
        <section className="mt-8 border border-zinc-800 rounded-2xl p-5 text-sm text-zinc-300 space-y-2">
          <p className="text-emerald-400 text-xs uppercase tracking-widest">Why other pages show a different Φ</p>
          <p>
            Here Φ is measured against a real cold Self() run on the Safety plants: an error win means the reuse final e is strictly below the cold final e.
          </p>
          <p>
            <Link className="underline" href="/workbench/peer">Peer</Link>, <Link className="underline" href="/workbench/compare">compare</Link>,{" "}
            <Link className="underline" href="/workbench/independent">independent</Link> and <Link className="underline" href="/workbench/independence">independence</Link>{" "}
            run the sealed sequence on MCP plants B1 and B2 and compare it with the plant&apos;s starting error (the observe or mark_boundary reading, which does not change e).
            That is an improvement against a baseline, not a cold-run win, and their numbers are not comparable with the Φ values on this page. B2 is a fixed fixture with no Self() run, so it has no cold final e.
          </p>
        </section>
        <section data-proof-external-confirmation className="mt-8 rounded-2xl border border-zinc-800 p-5 text-sm text-zinc-300">
          <p className="text-xs text-emerald-400">External confirmation</p>
          <p className="mt-2">
            The claims an outside party can check today, and what is not yet confirmed, are in the{" "}
            <Link className="underline" href="/#outside-verification">&quot;What an outside party can verify today&quot; block on the homepage</Link>
            {" "}and in <Link className="underline" href="/workbench/offer">/workbench/offer</Link>. The three Φ values above come from our own constructed Safety plants, and no outside party has reviewed or replicated them.
          </p>
          <CopyVerificationSummary />
        </section>
        <nav className="flex gap-4 text-sm mt-8">
          <Link className="underline" href="/workbench">Workbench B</Link>
          <Link className="underline" href="/workbench/safety">Diagnostic</Link>
        </nav>
      </main>
    </div>
  );
}