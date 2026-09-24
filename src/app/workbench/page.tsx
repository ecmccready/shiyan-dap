"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const YS = [
  "observe",
  "complete_field",
  "resolve_contradiction",
  "fill_missing",
  "reduce_uncertainty",
  "execute_task",
  "hold",
] as const;

type Snap = {
  A?: { locked: { execute_task: boolean } };
  B?: Record<string, number>;
  row?: { y: string; e_norm: number; dV: number; z: string };
  last_z?: string | null;
};

export default function WorkbenchPage() {
  const [snap, setSnap] = useState<Snap | null>(null);
  const [err, setErr] = useState("");

  async function load() {
    const r = await fetch("/api/workbench/loop", { cache: "no-store" });
    setSnap(await r.json());
  }
  async function act(action: string) {
    setErr("");
    const r = await fetch("/api/workbench/loop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const j = await r.json();
    if (!r.ok) setErr(j.reason || "locked");
    setSnap(j);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <main className="min-h-screen bg-black text-zinc-100 p-8 max-w-2xl mx-auto space-y-6">
      <p className="text-xs uppercase tracking-widest text-emerald-400">
        B · workbench · opened from Workspace A
      </p>
      <h1 className="text-2xl font-semibold">Workbench B</h1>
      <p className="text-sm text-zinc-400">
        This is the environment A acts on. Every button is y. W mutates B.
        A click is a measurement. It is not a diagnosis and not Buy as B.
      </p>

      <section className="border border-emerald-800 rounded-lg p-4 space-y-3">
        <p className="text-xs text-emerald-400">Action y</p>
        <div className="flex flex-wrap gap-3 text-sm">
          {YS.map((y) => (
            <button
              key={y}
              onClick={() => act(y)}
              disabled={y === "execute_task" && !!snap?.A?.locked.execute_task}
              className="underline disabled:text-zinc-600 disabled:no-underline"
            >
              {y}
            </button>
          ))}
        </div>
        {snap?.A?.locked.execute_task ? (
          <p className="text-xs text-amber-400">execute_task locked until defects fall</p>
        ) : null}
        {err ? <p className="text-xs text-red-400">{err}</p> : null}
        <p className="font-mono text-xs text-zinc-400">{snap?.last_z || snap?.row?.z || "No tick yet."}</p>
      </section>

      <section className="border border-zinc-800 rounded-lg p-4 space-y-2">
        <p className="text-xs text-emerald-400">Create</p>
        <p className="text-lg">Diagnostic Safety Workbench</p>
        <p className="text-xs text-zinc-500">
          Evidence · agents · validation. Conflict stays unresolved.
          Escalation, not a silent result.
        </p>
        <Link className="text-sm underline" href="/workbench/safety">
          Create / open safety workbench
        </Link>
      </section>

      <nav className="flex flex-wrap gap-3 text-sm">
        <Link className="underline" href="/workspace">Workspace A</Link>
        <Link className="underline" href="/self">Self()</Link>
        <Link className="underline" href="/marketplace">Marketplace</Link>
        <Link className="underline" href="/playlist">Playlist</Link>
      </nav>
    </main>
  );
}