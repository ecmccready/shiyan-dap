"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { readRuns, type OutcomeRun } from "@/product/run";

export default function WorkspacePage() {
  const [runs, setRuns] = useState<OutcomeRun[] | null>(null);

  useEffect(() => {
    setRuns(readRuns());
  }, []);

  const org = runs?.[0]?.org ?? "unsigned";
  const workspace = runs?.[0]?.workspace ?? "none";
  const closed = runs?.filter((run) => run.status === "closed").length ?? 0;

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Workspace" />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <p className="text-xs uppercase tracking-[0.18em] text-emerald-400">Unsigned</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">No organization owns these Runs.</h1>
        <p className="mt-4 text-sm leading-6 text-zinc-400">
          The proof link can be opened by anyone who has it. There is no sign-in, no workspace membership, and no meter. This count is this browser only.
        </p>
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <Tile k="Organization" v={org} />
          <Tile k="Workspace" v={workspace} />
          <Tile k="Closed Runs" v={runs === null ? "…" : String(closed)} />
        </div>
        <section className="mt-8 rounded-3xl border border-dashed border-zinc-700 p-6 text-sm text-zinc-400">
          Billing is not instrumented. A closed Run is not a charge. Authentication is not built.
        </section>
        <nav className="mt-8 flex flex-wrap gap-4 text-sm text-zinc-400">
          <Link className="underline" href="/workbench/history">History</Link>
          <Link className="underline" href="/workbench">Workbench</Link>
        </nav>
      </main>
    </div>
  );
}

function Tile({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-3xl border border-zinc-800 p-5">
      <p className="text-xs uppercase tracking-wider text-zinc-500">{k}</p>
      <p className="mt-2 text-2xl font-medium">{v}</p>
    </div>
  );
}