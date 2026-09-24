"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type State = {
  status: string;
  candidate: string | null;
  required: string[];
  available: string[];
  contradictions: { source: string; note: string }[];
  secondOrder: string[];
  checks: Record<string, boolean>;
  y: string;
  e: string;
  limitation: string;
};

type LoopSnap = {
  B?: {
    completeness: number;
    contradiction: number;
    missing: number;
    uncertainty: number;
    useful: number;
  };
  V?: number;
  e_norm?: number | null;
  last_z?: string | null;
  A?: { y: string; locked: { execute_task: boolean } };
  ledger?: { t: number; y: string; dV: number; dominant: string }[];
};

export default function SafetyWorkbenchPage() {
  const [state, setState] = useState<State | null>(null);
  const [loop, setLoop] = useState<LoopSnap | null>(null);
  const [err, setErr] = useState("");
  const [loopErr, setLoopErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadEvidence() {
    try {
      const r = await fetch("/api/workbench/diagnostic", { cache: "no-store" });
      const d = await r.json();
      setState(d.state);
      setErr("");
    } catch {
      setErr("Evidence API not on this deploy. Commit diagnostic-state first.");
    }
  }

  async function loadLoop() {
    try {
      const r = await fetch("/api/workbench/loop", { cache: "no-store" });
      if (!r.ok) throw new Error("loop");
      setLoop(await r.json());
      setLoopErr("");
    } catch {
      setLoopErr("Loop API not on this deploy. Commit control-loop first.");
    }
  }

  async function recordEvidenceTick() {
    setBusy(true);
    try {
      const r = await fetch("/api/workbench/loop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "observe" }),
      });
      if (!r.ok) throw new Error("loop");
      setLoop(await r.json());
      setLoopErr("");
    } catch {
      setLoopErr("Loop API not on this deploy. Commit control-loop first.");
    }
    setBusy(false);
  }

  useEffect(() => {
    loadEvidence();
    loadLoop();
  }, []);

  const last = loop?.ledger?.slice(-1)[0];
  const route =
    state?.status === "validated"
      ? "validated → clinician"
      : "unresolved → escalation";

  return (
    <main className="min-h-screen bg-black text-zinc-100 p-8 max-w-2xl mx-auto space-y-6">
      <p className="text-xs uppercase tracking-widest text-emerald-400">
        Created from Workbench B · not a diagnosis
      </p>
      <h1 className="text-2xl font-semibold">Diagnostic Safety Workbench</h1>
      <p className="text-sm text-zinc-400">
        Second-order check: what could make this wrong? Commission =
        wrong result. Omission = missed finding. A enforces evidence
        completeness and contradiction detection. Validated →
        clinician. Unresolved → escalation. Does not eliminate
        misdiagnosis. Not a device claim.
      </p>

      <pre className="text-xs bg-zinc-950 border border-zinc-800 rounded-lg p-4 overflow-auto">
        {`A  Workspace
B  this workbench
   Evidence · Agents · Validation
   Diagnostic state
     validated → clinician
     unresolved → escalation

z = evidence state
y != diagnosis`}
      </pre>

      {err ? <p className="text-sm text-red-400">{err}</p> : null}

      {state && (
        <section className="border border-zinc-800 rounded-lg p-4 space-y-2 text-xs font-mono">
          <p className="text-emerald-400">evidence B</p>
          <p>status: {state.status}</p>
          <p>y: {state.y} · y != diagnosis</p>
          <p>e: {state.e}</p>
          <p>candidate: {state.candidate ?? "none"}</p>
          <p>required: {state.required.join(", ")}</p>
          <p>available: {state.available.join(", ")}</p>
          <p>
            contradictions:{" "}
            {state.contradictions
              .map((c) => c.source + " " + c.note)
              .join(" · ") || "none"}
          </p>
          <p className="text-zinc-400">{state.secondOrder.join(" · ")}</p>
          <p className="text-zinc-500">{state.limitation}</p>
        </section>
      )}

      {loopErr ? <p className="text-sm text-red-400">{loopErr}</p> : null}

      <section className="border border-zinc-800 rounded-lg p-4 space-y-2 text-xs font-mono">
        <p className="text-emerald-400">loop tick · not diagnosis</p>
        {loop?.B ? (
          <>
            <p>
              completeness {loop.B.completeness.toFixed(3)} · contradiction{" "}
              {loop.B.contradiction.toFixed(3)}
            </p>
            <p>
              missing {loop.B.missing.toFixed(3)} · uncertainty{" "}
              {loop.B.uncertainty.toFixed(3)} · useful {loop.B.useful.toFixed(3)}
            </p>
          </>
        ) : (
          <p className="text-zinc-500">No B snapshot.</p>
        )}
        <p>
          last y {loop?.A?.y ?? "-"} · e_norm {loop?.e_norm ?? "-"} · V{" "}
          {loop?.V ?? "-"}
        </p>
        <p>
          dV {last ? last.dV : "-"} ·{" "}
          {last ? (last.dV < 0 ? "V fell" : "V did not fall") : "-"} · dominate{" "}
          {last?.dominant ?? "-"}
        </p>
        <p className="text-zinc-400">{loop?.last_z ?? "No loop tick."}</p>
        <p>execute_task {loop?.A?.locked.execute_task ? "LOCKED" : "open"}</p>
        <button
          onClick={recordEvidenceTick}
          disabled={busy}
          className="underline text-sm font-sans disabled:text-zinc-600"
        >
          {busy ? "Recording..." : "Record evidence tick"}
        </button>
      </section>

      <section className="border border-zinc-800 rounded-lg p-4 space-y-2 text-xs">
        <p className="text-emerald-400 font-mono">routing · not diagnosis</p>
        <p className="font-mono">{route}</p>
        <p className="text-zinc-500">
          Threshold routing only. No Diagnose button. Not a device claim.
        </p>
      </section>

      <nav className="flex flex-wrap gap-3 text-sm">
        <Link className="underline" href="/workbench">
          Workbench B
        </Link>
        <Link className="underline" href="/workspace?domain=safety">
          Workspace A
        </Link>
        <Link className="underline" href="/workspace?domain=music">
          Music
        </Link>
        <Link className="underline" href="/self">
          Self()
        </Link>
      </nav>
    </main>
  );
}