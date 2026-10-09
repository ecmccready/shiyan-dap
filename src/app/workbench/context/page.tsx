"use client";

import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

const LINKS = [
  ["/workbench/control", "Control A", "Policy. A names y."],
  ["/workbench/network", "Network", "Documented actors. One missing handoff."],
  ["/workbench/graph", "Graph", "The missing edge is not e."],
  ["/workbench/reused", "Context check", "Reuse refused until the handoff is recorded."],
  ["/workbench/dependencies", "Dependencies", "seal_pack blocked while the edge is open."],
  ["/workbench/propose", "Propose", "Self() names y. No z."],
  ["/workbench/execute", "Execute", "The check returns e 0.216, Δe 0."],
  ["/workbench/seal", "Seal", "The drop. Sealed replay 0.151, Φ 0.065."],
  ["/workbench/record", "Record", "R stays on N-safety-evidence · 2026-10-09."],
  ["/workbench/chain", "Chain", "The claim boundary."],
  ["/workbench/diagnostics", "Diagnostics", "Evidence gate. Not a diagnosis."],
  ["/workbench/proof", "Safety proof", "Buyer-facing rows. Unchanged."],
];

export default function ContextPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Context" />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <p className="text-xs uppercase tracking-[0.18em] text-emerald-400">Actor network</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Context inside B. Not a new controller.</h1>
        <p className="mt-4 text-sm leading-6 text-zinc-400">
          N describes the operating context. A still names y. B still returns z. Measurement still decides improvement. A page-local handoff does not rewrite the sealed pack.
        </p>
        <ul className="mt-8 space-y-2">
          {LINKS.map(([href, name, note]) => (
            <li key={href}>
              <Link href={href} className="block rounded-2xl border border-zinc-800 px-4 py-3 text-sm hover:border-zinc-600">
                <span className="text-emerald-400">{name}</span>
                <span className="mt-1 block text-zinc-400">{note}</span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-amber-200">Not a diagnosis. No PHI. No clinical decision. Not revenue.</p>
      </main>
    </div>
  );
}