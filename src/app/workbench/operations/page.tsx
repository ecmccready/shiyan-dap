"use client";

import { useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { RECORDED_PACKS } from "@/lib/mcp/schema";
import { OPERATIONS_B, coldOnOperationsB, sealedOnOperationsB } from "@/lib/mcp/operations-b";

const PLANTS = [
  {
    id: "B1",
    name: "Evidence / Safety",
    href: "/workbench",
    built: true,
    z: "completeness, contradiction, missing, uncertainty",
    e: RECORDED_PACKS[2].reuse_final_e,
  },
  {
    id: "B2",
    name: "Operations",
    href: "/workbench/operations",
    built: true,
    z: OPERATIONS_B.z,
    e: 0.19,
  },
  {
    id: "B3",
    name: "Customer-defined",
    href: "/workbench/operations#b3",
    built: false,
    z: "supplied with the reference. Not invented here.",
    e: null as number | null,
  },
];

export default function OperationsPage() {
  const cold = coldOnOperationsB();
  const [coldFinal, setColdFinal] = useState(String(cold.e_next));
  const parsed = Number(coldFinal);
  const ready = Number.isFinite(parsed);
  const sealed = ready ? sealedOnOperationsB(parsed) : null;

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Operations B" />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <p className="text-xs uppercase tracking-[0.18em] text-emerald-400">Same A. Different B.</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">One controller. Three plants.</h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-400">
          Controller A names y. It does not import the Workbench. B1, B2, and B3 speak aethel.loop.v1.
          The contract is y, z, e, Δe, Φ. A different environment is not a win over Safety.
        </p>

        <div className="mt-8 grid gap-3 md:grid-cols-3">
          {PLANTS.map((plant) => (
            <article key={plant.id} className="rounded-3xl border border-zinc-800 p-5">
              <p className="text-xs text-emerald-400">{plant.id}</p>
              <h2 className="mt-1 text-lg font-medium">{plant.name}</h2>
              <p className="mt-2 text-sm text-zinc-400">{plant.z}</p>
              <p className="mt-3 text-sm">{plant.built ? `Final e printed: ${plant.e}` : "No z. No e. No Φ."}</p>
              <Link href={plant.href} className="mt-4 inline-block text-sm underline">
                {plant.built ? "Open plant" : "Contract only"}
              </Link>
            </article>
          ))}
        </div>

        <section className="mt-8 rounded-3xl border border-zinc-800 p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-emerald-400">B2 measurement</p>
          <h2 className="mt-1 text-xl font-medium">{OPERATIONS_B.id} · {OPERATIONS_B.domain}</h2>
          <p className="mt-2 text-sm text-zinc-400">{OPERATIONS_B.not}</p>
          <p className="mt-4 text-sm">Cold z · {cold.z}</p>
          <p className="mt-1 text-sm">Cold e · {cold.e} → {cold.e_next}. Gate {cold.gate}.</p>
          <label className="mt-4 block text-sm text-zinc-300">
            Caller-supplied cold final e
            <input
              value={coldFinal}
              onChange={(e) => setColdFinal(e.target.value)}
              className="mt-2 h-11 w-40 rounded-full border border-zinc-700 bg-black px-4"
            />
          </label>
          {!ready && <p className="mt-3 text-sm text-red-300">No number. Φ is not named.</p>}
          {sealed && (
            <div className="mt-4">
              <p className="text-sm">Reuse z · {sealed.z}</p>
              <p className="mt-1 text-sm">Reuse e · {sealed.final_e}. Δe · {sealed.delta_e}.</p>
              <ol className="mt-3 space-y-2">
                {sealed.steps.map((step) => (
                  <li key={step.y} className="rounded-2xl border border-zinc-800 px-4 py-3 text-sm">
                    y = {step.y}
                    <span className="float-right tabular-nums">e {step.e_next}</span>
                    <span className="mt-1 block text-xs text-zinc-500">{step.z}</span>
                  </li>
                ))}
              </ol>
              <p className={`mt-4 text-sm ${sealed.better ? "text-emerald-300" : "text-amber-300"}`}>
                {sealed.better
                  ? `Φ ${sealed.phi} on B2 only. ${sealed.peer_note}`
                  : `Refused. Final e did not fall. Φ ${sealed.phi}.`}
              </p>
            </div>
          )}
        </section>

        <section id="b3" className="mt-8 rounded-3xl border border-dashed border-zinc-700 p-6">
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">B3</p>
          <h2 className="mt-1 text-xl font-medium">Customer-defined Workbench</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            A customer plant supplies reference truth and implements the same tools. This page does not invent its z or e.
            Until that plant prints both, it is not a measurement and not a vertical.
          </p>
        </section>

        <nav className="mt-8 flex flex-wrap gap-4 text-sm text-zinc-400">
          <Link className="underline" href="/workbench">B1 Safety</Link>
          <Link className="underline" href="/workbench/mcp">MCP</Link>
          <Link className="underline" href="/workbench/verify">IT verification</Link>
        </nav>
      </main>
    </div>
  );
}