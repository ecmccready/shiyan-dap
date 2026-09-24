"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Snap = {
  A?: {
    confidence: number;
    y: string;
    candidates: { action: string; score: number; locked: boolean }[];
    locked: { execute_task: boolean };
  };
  B?: Record<string, number>;
  G?: Record<string, number>;
  V?: number;
  e_norm?: number | null;
  last_z?: string | null;
  ledger?: { dV: number }[];
};

function Meter({ label, v, invert }: { label: string; v: number; invert?: boolean }) {
  const good = invert ? 1 - v : v;
  return (
    <p className="text-xs font-mono">
      {label} {v.toFixed(3)}
      <span className="ml-2 inline-block h-1 w-24 bg-zinc-800 align-middle">
        <span
          className="block h-1 bg-emerald-500"
          style={{ width: `${Math.max(0, Math.min(100, good * 100))}%` }}
        />
      </span>
    </p>
  );
}

function WorkspaceInner() {
  const router = useRouter();
  const q = useSearchParams();
  const domain = q.get("domain") === "safety" ? "safety" : "music";
  const [snap, setSnap] = useState<Snap | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const r = await fetch("/api/workbench/loop", { cache: "no-store" });
    setSnap(await r.json());
  }
  async function stepSelf() {
    setBusy(true);
    await fetch("/api/workbench/loop", { method: "POST", body: "{}" });
    await load();
    setBusy(false);
  }

  useEffect(() => {
    load();
  }, []);

  const last = snap?.ledger?.slice(-1)[0];

  return (
    <main className="min-h-screen bg-black text-zinc-100 p-8 max-w-2xl mx-auto space-y-6">
      <p className="text-xs uppercase tracking-widest text-emerald-400">
        Workspace A · governs / observes / validates
      </p>
      <h1 className="text-2xl font-semibold">Workspace A</h1>
      <p className="text-sm text-zinc-400">
        A owns Self() and z. B is the workbench A opens — not a customer.
        A page load is not a step. Step Self() writes e, z, V to the ledger.
      </p>

      <label className="block text-sm">
        <span className="text-xs text-emerald-400">Domain</span>
        <select
          className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2"
          value={domain}
          onChange={(e) => router.push("/workspace?domain=" + e.target.value)}
        >
          <option value="music">Music</option>
          <option value="safety">Diagnostic safety</option>
        </select>
      </label>

      <section className="border border-emerald-800 rounded-lg p-4 space-y-2">
        <p className="text-xs text-emerald-400">Controller A</p>
        <p className="font-mono text-sm">
          y = {snap?.A?.y ?? "—"} · conf {snap?.A?.confidence?.toFixed(3) ?? "—"}
        </p>
        <p className="text-xs text-zinc-500">
          execute_task {snap?.A?.locked.execute_task ? "LOCKED" : "open"}
        </p>
        <button
          onClick={stepSelf}
          disabled={busy}
          className="text-sm underline disabled:text-zinc-600"
        >
          {busy ? "Stepping…" : "Step Self()"}
        </button>
        <Link className="ml-4 text-sm underline" href="/workbench">
          Open workbench
        </Link>
      </section>

      <section className="border border-zinc-800 rounded-lg p-4 space-y-1">
        <p className="text-xs text-emerald-400">Workbench B</p>
        {snap?.B ? (
          <>
            <Meter label="completeness" v={snap.B.completeness} />
            <Meter label="contradiction" v={snap.B.contradiction} invert />
            <Meter label="missing" v={snap.B.missing} invert />
            <Meter label="uncertainty" v={snap.B.uncertainty} invert />
            <Meter label="useful" v={snap.B.useful} />
          </>
        ) : (
          <p className="text-xs text-zinc-500">Loop API not loaded.</p>
        )}
      </section>

      <section className="border border-zinc-800 rounded-lg p-4 space-y-1 font-mono text-xs">
        <p className="text-emerald-400">z · e · V</p>
        <p>{snap?.last_z ?? "No tick yet."}</p>
        <p>e_norm {snap?.e_norm ?? "—"}</p>
        <p>
          V {snap?.V ?? "—"} · dV {last ? last.dV : "—"} ·{" "}
          {last ? (last.dV < 0 ? "V fell" : "V did not fall") : "—"}
        </p>
        <p className="text-zinc-500">Observable, not theorem. No global convergence claim.</p>
      </section>

      {domain === "music" ? (
        <nav className="flex flex-wrap gap-3 text-sm">
          <Link className="underline" href="/nfts">Music rail</Link>
          <Link className="underline" href="/playlist">Playlist</Link>
          <Link className="underline" href="/upload">Create</Link>
          <Link className="underline" href="/loop">Loop</Link>
          <Link className="underline" href="/self">Self()</Link>
        </nav>
      ) : (
        <nav className="flex flex-wrap gap-3 text-sm">
          <Link className="underline" href="/workbench">Workbench</Link>
          <Link className="underline" href="/workbench/safety">Diagnostic Safety Workbench</Link>
          <Link className="underline" href="/self">Self()</Link>
        </nav>
      )}
    </main>
  );
}

export default function WorkspacePage() {
  return (
    <Suspense fallback={<main className="bg-black min-h-screen" />}>
      <WorkspaceInner />
    </Suspense>
  );
}