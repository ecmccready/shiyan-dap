"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Payload = {
  next_task?: string;
  weakest?: string;
  rec?: {
    y: string;
    e: number;
    V: number;
    z: string;
    hatDelta: number;
    delta: number;
  };
  latest?: { task: string; successful: boolean; error: number };
  skills?: { tasks: Record<string, { n: number; meanAbsE: number }> };
};

export default function WorkspacePage() {
  const [data, setData] = useState<Payload | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch("/api/workspace/experience");
    setData(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  async function tick() {
    setBusy(true);
    const res = await fetch("/api/workspace/experience", { method: "POST" });
    setData(await res.json());
    setBusy(false);
  }

  return (
    <main className="min-h-screen bg-black text-zinc-100 p-8 max-w-2xl mx-auto space-y-6">
      <p className="text-xs uppercase tracking-widest text-emerald-400">
        Workspace A · learning controller · not weight training
      </p>
      <h1 className="text-2xl font-semibold">Workspace A</h1>
      <p className="text-sm text-zinc-400">
        A is the autonomous controller. B is the P2P state machine A
        acts in. Ledger is experience memory. Self() revises policy
        from E, not from a claim that the foundation model retrains.
        Next task aims at the weakest skill.
      </p>

      <pre className="text-xs bg-zinc-950 border border-zinc-800 rounded-lg p-4 overflow-auto">
        {`A  Workspace = controller
B  P2P State Machine = environment / workbench
M  Ledger = persistent experience
z  compressed state / next-action
Self()  policy revision
P()  prediction
W()  world transition
e  prediction error
V  progress / value
Task generator  what A learns next

A → Task → Action → B' → Measure → E → A'
claimed_self_improving_ai = false`}
      </pre>

      <button
        type="button"
        disabled={busy}
        onClick={tick}
        className="text-sm underline disabled:opacity-50"
      >
        Write experience + next task
      </button>

      {data && (
        <section className="text-xs font-mono border border-zinc-800 rounded-lg p-4 space-y-1">
          <p>next_task: {data.next_task || data.weakest}</p>
          <p>weakest: {data.weakest}</p>
          {data.rec && (
            <p>
              y={data.rec.y} hatΔ={data.rec.hatDelta} Δ={data.rec.delta} e=
              {data.rec.e} V={data.rec.V}
            </p>
          )}
          {data.latest && (
            <p>
              last E: {data.latest.task} e={data.latest.error} ok=
              {String(data.latest.successful)}
            </p>
          )}
        </section>
      )}

      <nav className="flex flex-wrap gap-3 text-sm">
        <Link className="underline" href="/workbench">
          Workbench B
        </Link>
        <Link className="underline" href="/ledger">
          Ledger
        </Link>
        <Link className="underline" href="/">
          Home
        </Link>
      </nav>
    </main>
  );
}