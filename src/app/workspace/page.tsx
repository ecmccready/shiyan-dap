"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Row = {
  weight: number;
  error: number | null;
  z: string;
  next_action: string;
  channelId: string;
  at: string;
};

export default function WorkspacePage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch("/api/workspace/state");
    const data = await res.json();
    setRows(data.rows || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function run(external: boolean) {
    setBusy(true);
    await fetch("/api/workspace/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        external,
        scale: 0.72,
        time: 0.81,
        speed: 0.64,
        confidence: 0.9,
      }),
    });
    await load();
    setBusy(false);
  }

  return (
    <main className="min-h-screen bg-black text-zinc-100 p-8 max-w-2xl mx-auto space-y-6">
      <p className="text-xs uppercase tracking-widest text-emerald-400">
        Workspace A · Self() · music first
      </p>
      <h1 className="text-2xl font-semibold">Workspace A</h1>
      <p className="text-sm text-zinc-400">
        The workspace is a measurable autonomous economic system:
        actions generate state, state determines the next action,
        external time can calibrate the system. Founder sustains A.
        A is the agent of agents. B is the workbench, not a buyer.
      </p>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="border border-emerald-800 rounded-lg p-4 space-y-2">
          <p className="text-xs text-emerald-400">A</p>
          <p className="text-lg">Compute provisional z</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => run(false)}
            className="text-sm underline disabled:opacity-50"
          >
            Run endogenous
          </button>
        </div>
        <div className="border border-zinc-800 rounded-lg p-4 space-y-2">
          <p className="text-xs text-emerald-400">B workbench</p>
          <p className="text-lg">Observe intent</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => run(true)}
            className="text-sm underline disabled:opacity-50"
          >
            Record workbench intent
          </button>
          <Link className="text-sm underline block" href="/workbench">
            Workbench
          </Link>
        </div>
      </section>

      <pre className="text-xs bg-zinc-950 border border-zinc-800 rounded-lg p-4 overflow-auto">
        {`Workspace A → Self() → predict B → act y
           → observe B → E_B → z → next

B_pred = f(S, T, V, C)
T = time of external measurement
E_B = B_observed - B_pred`}
      </pre>

      <section>
        <h2 className="text-sm text-emerald-400 mb-2">Ledger</h2>
        {rows.length === 0 ? (
          <p className="text-xs text-zinc-500">No rows.</p>
        ) : (
          <ul className="space-y-2 text-xs font-mono">
            {rows.map((r) => (
              <li key={r.at} className="border border-zinc-800 rounded-lg p-3">
                {r.at} · {r.channelId} · w={r.weight} · E_B=
                {r.error ?? "n/a"} · {r.next_action}
                <br />
                {r.z}
              </li>
            ))}
          </ul>
        )}
      </section>

      <nav className="flex flex-wrap gap-3 text-sm">
        <Link className="underline" href="/workbench">
          Workbench
        </Link>
        <Link className="underline" href="/self">
          Self()
        </Link>
        <Link className="underline" href="/nfts">
          Music rail
        </Link>
        <Link className="underline" href="/ledger">
          Ledger
        </Link>
      </nav>
    </main>
  );
}