"use client";

import { useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { NETWORK, missingHandoffs } from "@/lib/network/context";

const PRIOR = {
  n: "N-safety-evidence",
  version: "2026-10-09",
  y: "mark_boundary → complete_field → request_independent_check → seal_pack",
  cold: 0.216,
  reuse: 0.151,
  phi: 0.065,
};

export default function ReusedPage() {
  const [documented, setDocumented] = useState(false);
  const missing = missingHandoffs().filter(() => !documented);
  const sameNetwork = PRIOR.n === NETWORK.id && PRIOR.version === NETWORK.version;
  const applies = sameNetwork && missing.length === 0;

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Reuse" />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <p className="text-xs uppercase tracking-[0.18em] text-emerald-400">Context check</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          {applies ? "The prior context matches. The drop does not move." : "Prior experience does not apply yet."}
        </h1>
        <p className="mt-4 text-sm leading-6 text-zinc-400">
          The sealed provenance pack fell, cold {PRIOR.cold} to reuse {PRIOR.reuse}, Φ {PRIOR.phi}. That number stays on its plant. A documented handoff changes the context check. It does not change e.
        </p>
        <dl className="mt-8 divide-y divide-zinc-800 rounded-3xl border border-zinc-800 text-sm">
          <Row k="Prior N" v={`${PRIOR.n} · ${PRIOR.version}`} />
          <Row k="Current N" v={`${NETWORK.id} · ${NETWORK.version}`} />
          <Row k="Same network" v={sameNetwork ? "yes" : "no"} />
          <Row k="Missing handoff" v={missing.map((r) => r.to).join(", ") || "none"} />
          <Row k="Change" v={documented ? "independent-check documented on this page" : "none recorded"} />
          <Row k="Reuse" v={applies ? "context matches" : "refused"} />
        </dl>
        <button
          onClick={() => setDocumented(true)}
          disabled={documented}
          className="mt-5 h-11 rounded-full bg-white px-5 text-sm font-medium text-black disabled:opacity-40"
        >
          {documented ? "Handoff recorded" : "Document independent-check"}
        </button>
        <p className="mt-4 text-sm text-amber-200">
          {applies
            ? "Context matches. Φ 0.065 is not copied onto this page. An observed relationship is not causation. Self() does not read this page."
            : "Refused. An observed relationship is not causation. Improvement is not claimed on this context. Self() does not read this page."}
        </p>
        <nav className="mt-8 flex flex-wrap gap-4 text-sm text-zinc-400">
          <Link className="underline" href="/workbench/network">Network</Link>
          <Link className="underline" href="/workbench/diagnostics">Diagnostics</Link>
          <Link className="underline" href="/workbench/proof">Safety proof</Link>
        </nav>
      </main>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="grid gap-1 px-4 py-3 sm:grid-cols-3">
      <dt className="text-xs uppercase tracking-wider text-zinc-500">{k}</dt>
      <dd className="text-zinc-200 sm:col-span-2">{v}</dd>
    </div>
  );
}