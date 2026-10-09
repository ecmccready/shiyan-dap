"use client";

import { useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

const STEP = {
  y: "request_independent_check",
  z: "missing handoff named, not sealed",
  e: 0.216,
};

export default function ExecutePage() {
  const [done, setDone] = useState(false);
  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Execute" />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <p className="text-xs uppercase tracking-[0.18em] text-emerald-400">One action</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">B executes the named y. It does not seal.</h1>
        <p className="mt-4 text-sm leading-6 text-zinc-400">
          The proposal was request_independent_check. This page runs that step from the sealed sequence and stops. seal_pack is the drop. This step is not.
        </p>
        <dl className="mt-8 divide-y divide-zinc-800 rounded-3xl border border-zinc-800 text-sm">
          <Row k="y" v={STEP.y} />
          <Row k="z" v={done ? STEP.z : "not measured"} />
          <Row k="e" v={done ? String(STEP.e) : "—"} />
          <Row k="Δe" v={done ? "0 on this step" : "—"} />
          <Row k="Φ" v="not claimed" />
        </dl>
        <button
          onClick={() => setDone(true)}
          disabled={done}
          className="mt-5 h-11 rounded-full bg-emerald-500 px-5 text-sm font-medium text-black disabled:opacity-40"
        >
          {done ? "Executed" : "Execute y"}
        </button>
        <p className="mt-4 text-sm text-amber-200">
          {done
            ? "z returned. e is 0.216, the cold final on this pack. The edge is not closed. Not an error win."
            : "No z yet. A named y is not a result. Self() does not read this page."}
        </p>
        <nav className="mt-8 flex flex-wrap gap-4 text-sm text-zinc-400">
          <Link className="underline" href="/workbench/propose">Proposal</Link>
          <Link className="underline" href="/workbench/dependencies">Dependencies</Link>
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