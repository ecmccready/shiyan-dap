"use client";

import { useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

export default function SealPage() {
  const [checked, setChecked] = useState(false);
  const [sealed, setSealed] = useState(false);
  const e = sealed ? 0.151 : 0.216;

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Seal" />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <p className="text-xs uppercase tracking-[0.18em] text-emerald-400">The drop</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">seal_pack is the drop. The check was not.</h1>
        <p className="mt-4 text-sm leading-6 text-zinc-400">
          request_independent_check returned e 0.216 and Δe 0. This page seals only after that return, and the 0.151 is the sealed provenance replay.
        </p>
        <dl className="mt-8 divide-y divide-zinc-800 rounded-3xl border border-zinc-800 text-sm">
          <Row k="Prior y" v="request_independent_check" />
          <Row k="Check returned" v={checked ? "e 0.216, Δe 0" : "not yet"} />
          <Row k="y" v={sealed ? "seal_pack" : "held"} />
          <Row k="z" v={sealed ? "gate HOLD" : "not sealed"} />
          <Row k="e" v={checked ? String(e) : "—"} />
          <Row k="Φ" v={sealed ? "0.065 sealed pack" : "not claimed"} />
        </dl>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            onClick={() => setChecked(true)}
            disabled={checked}
            className="h-11 rounded-full bg-white px-5 text-sm font-medium text-black disabled:opacity-40"
          >
            {checked ? "Check returned" : "Record the check"}
          </button>
          <button
            onClick={() => setSealed(true)}
            disabled={!checked || sealed}
            className="h-11 rounded-full bg-emerald-500 px-5 text-sm font-medium text-black disabled:opacity-40"
          >
            {sealed ? "Sealed" : "seal_pack"}
          </button>
        </div>
        <p className="mt-4 text-sm text-amber-200">
          {sealed
            ? "Sealed replay. Cold 0.216 to 0.151, Φ 0.065. Not a new plant. Not causation. Not revenue."
            : "Held. The check does not lower e. Self() does not read this page."}
        </p>
        <nav className="mt-8 flex flex-wrap gap-4 text-sm text-zinc-400">
          <Link className="underline" href="/workbench/execute">Execute</Link>
          <Link className="underline" href="/workbench/record">Record</Link>
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