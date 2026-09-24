"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Row = {
  t: number;
  y: string;
  e_norm: number;
  V: number;
  dV: number;
  dominant: string;
  z: string;
  confidence: number;
};

type Snap = {
  A?: {
    y: string;
    confidence: number;
    locked: { execute_task: boolean };
    candidates: { action: string; score: number; locked: boolean }[];
  };
  B?: Record<string, number>;
  V?: number;
  e_norm?: number | null;
  last_z?: string | null;
  ledger?: Row[];
};

export default function SelfPage() {
  const [snap, setSnap] = useState<Snap | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const r = await fetch("/api/workbench/loop", { cache: "no-store" });
      if (!r.ok) throw new Error("loop");
      setSnap(await r.json());
      setErr("");
    } catch {
      setErr("Loop API not on this deploy. Commit control-loop first.");
    }
  }

  async function stepSelf() {
    setBusy(true);
    try {
      const r = await fetch("/api/workbench/loop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const j = await r.json();
      if (!r.ok) setErr(j.reason || "step locked");
      else setErr("");
      setSnap(j);
    } catch {
      setErr("Loop API not on this deploy. Commit control-loop first.");
    }
    setBusy(false);
  }

  async function resetLoop() {
    setBusy(true);
    try {
      const r = await fetch("/api/workbench/loop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reset: true }),
      });
      setSnap(await r.json());
      setErr("");
    } catch {
      setErr("Loop API not on this deploy. Commit control-loop first.");
    }
    setBusy(false);
  }

  useEffect(() => {
    load();
  }, []);

  const ledger = snap?.ledger ?? [];
  const last = ledger[ledger.length - 1];

  return (
    <main className="min-h-screen bg-black text-zinc-100 p-8 max-w-2xl mx-auto space-y-6">
      <p className="text-xs uppercase tracking-widest text-emerald-400">
        .self(B, M) → (B′, M′, A′)
      </p>
      <h1 className="text-2xl font-semibold">.self()</h1>
      <p className="text-sm text-zinc-400">
        Compact form: .self(B,M) = .self(W(B,A(M,B)), M ⊕ z). Observable
        Lyapunov stand-in: V. We record whether V fell. We do not claim
        V → V* on this repo. .self() is a state-transition operator, not
        “call the model again.”
      </p>

      <pre className="text-xs bg-zinc-950 border border-zinc-800 rounded-lg p-4 overflow-auto">
        {`A_{t+1} = .self( M ⊕ Φ[ ΔB - P(A,M,B) ], B' )
B' = W(B, A)

want  lim ||e_t|| = 0   as observation, not theorem
want  V(M',B') < V(M,B) when e ≠ 0`}
      </pre>

      {err ? <p className="text-sm text-red-400">{err}</p> : null}

      <section className="border border-emerald-800 rounded-lg p-4 space-y-2">
        <p className="text-xs text-emerald-400">Operator</p>
        <p className="font-mono text-sm">
          y = {snap?.A?.y ?? "—"} · conf {snap?.A?.confidence?.toFixed(3) ?? "—"}
        </p>
        <p className="text-xs text-zinc-500">
          execute_task {snap?.A?.locked.execute_task ? "LOCKED" : "open"}
        </p>
        <p className="font-mono text-xs text-zinc-400">
          {snap?.last_z ?? "No tick yet."}
        </p>
        <p className="font-mono text-xs">
          e_norm {snap?.e_norm ?? "—"} · V {snap?.V ?? "—"} · dV{" "}
          {last ? last.dV : "—"} ·{" "}
          {last ? (last.dV < 0 ? "V fell" : "V did not fall") : "—"}
        </p>
        <div className="flex flex-wrap gap-4 text-sm">
          <button
            onClick={stepSelf}
            disabled={busy}
            className="underline disabled:text-zinc-600"
          >
            {busy ? "Stepping…" : "Step Self()"}
          </button>
          <button
            onClick={resetLoop}
            disabled={busy}
            className="underline disabled:text-zinc-600"
          >
            Reset B
          </button>
        </div>
      </section>

      <section className="border border-zinc-800 rounded-lg p-4 space-y-2