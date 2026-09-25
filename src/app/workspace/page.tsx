"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Exp = {
  task: string;
  action: string;
  predicted: number;
  observed: number;
  error: number;
  successful: boolean;
};

type Snap = {
  next_task?: string;
  weakest?: string;
  B?: { s: number };
  latest?: Exp;
  experiences?: Exp[];
  claimed_self_improving_ai?: boolean;
};

export default function WorkspacePage() {
  const [data, setData] = useState<Snap | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setData(await (await fetch("/api/workspace/experience")).json());
  }

  useEffect(() => {
    load();
  }, []);

  async function run() {
    setBusy(true);
    setData(await (await fetch("/api/workspace/experience", { method: "POST" })).json());
    setBusy(false);
  }

  return (
    <main className="min-h-screen bg-black text-zinc-100 p-8 max-w-2xl mx-auto space-y-6">
      <p className="text-xs uppercase tracking-widest text-emerald-400">
        Workspace A · Task · Policy · Evaluator · Memory · Self()
      </p>
      <h1 className="text-2xl font-semibold">Workspace A</h1>
      <p className="text-sm text-zinc-400">
        Native loop: propose task, predict, act on P2P B, measure e,
        write E, target weakest skill. Retrieval from similar states
        drives P(), not a fixed table alone. Not SIMA 2. Not weight
        training.
      </p>
      <pre className="text-xs bg-zinc-950 border border-zinc-800 rounded-lg p-4 overflow-auto">
        {`A → Task → Action → B' → Measure → E → A'
P from similar E    W(B,y)    e = ΔB − hatΔB
next T = weakest mean|e|
claimed_self_improving_ai = false`}
      </pre>
      <button
        type="button"
        disabled={busy}
        onClick={run}
        className="text-sm underline disabled:opacity-50"
      >
        Execute task
      </button>
      {data && (
        <section className="text-xs font-mono border border-zinc-800 rounded-lg p-4 space-y-1">
          <p>B.s={data.B?.s} next_task={data.next_task} weakest={data.weakest}</p>
          {data.latest && (
            <p>
              y={data.latest.action} hat={data.latest.predicted} Δ=
              {data.latest.observed} e={data.latest.error} ok=
              {String(data.latest.successful)}
            </p>
          )}
          <p>E n={data.experiences?.length ?? 0}</p>
        </section>
      )}
      <nav className="flex flex-wrap gap-3 text-sm">
        <Link className="underline" href="/workbench">
          P2P B
        </Link>
        <Link className="underline" href="/self">
          Names
        </Link>
        <Link className="underline" href="/">
          Home
        </Link>
      </nav>
    </main>
  );
}