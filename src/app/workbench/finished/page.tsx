"use client";

import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

export default function FinishedPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Workbench" />
      <main className="max-w-3xl mx-auto px-6 py-12 space-y-6">
        <p className="text-emerald-400 text-xs uppercase tracking-widest">Finished state</p>
        <h1 className="text-3xl font-bold">Same controller. Different environment.</h1>
        <pre className="text-xs bg-zinc-950 border border-zinc-800 rounded-2xl p-5 overflow-auto">{`AETHEL NODE
        A
      Self()
        |
   _____|_____
   |         |
   v         v
  B1        B2
Workbench Workbench
 z1, e1    z2, e2
   |_________|
        |
        v
  EXPERIENCE Φ
  per plant`}</pre>
        <p>One controller. Two independently implemented Workbenches. Same measurement contract. A is not changed.</p>
        <ul className="text-sm text-zinc-300 space-y-1">
          <li>Same controller.</li>
          <li>Different environment.</li>
          <li>Measured outcome.</li>
          <li>Reusable experience, only if that plant's final e falls.</li>
        </ul>
        <p className="text-zinc-500 text-sm">
          Φ is per plant. B2 beating B1 is not an error win. The Safety rows stay 0.014, 0.065, 0.065.
          The watched Run tied at 0.235 and was refused. This diagram is not a measurement.
        </p>
        <nav className="flex flex-wrap gap-4 text-sm">
          <Link className="underline" href="/workbench/independence">Print z and e</Link>
          <Link className="underline" href="/workbench">Provenance row</Link>
          <Link className="underline" href="/workbench/proof">Safety proof</Link>
        </nav>
      </main>
    </div>
  );
}