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

export default function SafetyWorkbenchPage() {
  const [state, setState] = useState<State | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/workbench/diagnostic")
      .then((r) => r.json())
      .then((d) => setState(d.state))
      .catch(() =>
        setErr("Evidence API not on this deploy. Commit diagnostic-state first.")
      );
  }, []);

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
y ≠ diagnosis`}
      </pre>

      {err ? <p className="text-sm text-red-400">{err}</p> : null}

      {state && (
        <section className="border border-zinc-800 rounded-lg p-4 space-y-2 text-xs font-mono">
          <p>status: {state.status}</p>
          <p>y: {state.y}</p>
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
      </nav>
    </main>
  );
}