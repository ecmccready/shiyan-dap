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

export default function WorkbenchPage() {
  const [state, setState] = useState<State | null>(null);

  useEffect(() => {
    fetch("/api/workbench/diagnostic")
      .then((r) => r.json())
      .then((d) => setState(d.state));
  }, []);

  return (
    <main className="min-h-screen bg-black text-zinc-100 p-8 max-w-2xl mx-auto space-y-6">
      <p className="text-xs uppercase tracking-widest text-emerald-400">
        B · Diagnostic Safety Workbench · evidence state
      </p>
      <h1 className="text-2xl font-semibold">Diagnostic Safety Workbench</h1>
      <p className="text-sm text-zinc-400">
        B does not emit y = diagnosis. B holds patient evidence,
        measurements, history, candidates, contradictions, missing
        information, provenance, agent analyses, independent checks,
        and uncertainty — then runs safety validation. WHO flags
        diagnostic error, automation risk, bias, opacity, and
        displacement of judgment. FDA CDS language: expose inputs and
        basis so a human can review. Noise nav (marketplace / trade /
        ping) lives here, not on Workspace A.
      </p>

      <pre className="text-xs bg-zinc-950 border border-zinc-800 rounded-lg p-4 overflow-auto">
        {`A  Autonomous Workspace
   governance / state
B  Diagnostic Assurance Workbench
   Evidence · Agents · Validation
   Diagnostic state
     validated → clinician
     unresolved → escalation

Second order: what could make this wrong?
Commission = wrong result
Omission   = missed finding`}
      </pre>

      {state && (
        <section className="border border-zinc-800 rounded-lg p-4 space-y-2 text-xs font-mono">
          <p>status: {state.status}</p>
          <p>y: {state.y}</p>
          <p>e: {state.e}</p>
          <p>candidate: {state.candidate ?? "none (not a diagnosis)"}</p>
          <p>required: {state.required.join(", ")}</p>
          <p>available: {state.available.join(", ")}</p>
          <p>
            contradictions:{" "}
            {state.contradictions
              .map((c) => c.source + " " + c.note)
              .join(" · ") || "none"}
          </p>
          <p>
            checks: consistent={String(state.checks.consistent)}{" "}
            sufficient={String(state.checks.sufficient)}{" "}
            escalate={String(state.checks.escalationRequired)}
          </p>
          <p className="text-zinc-400 whitespace-pre-wrap">
            {state.secondOrder.join("\n")}
          </p>
          <p className="text-zinc-500">{state.limitation}</p>
        </section>
      )}

      <nav className="flex flex-wrap gap-3 text-sm">
        <Link className="underline" href="/workspace?domain=safety">
          Workspace A
        </Link>
        <Link className="underline" href="/workspace?domain=music">
          Music domain
        </Link>
        <Link className="underline" href="/marketplace">
          Marketplace
        </Link>
        <Link className="underline" href="/trade">
          Trade
        </Link>
        <Link className="underline" href="/ping">
          Ping
        </Link>
        <Link className="underline" href="/nfts">
          Music rail
        </Link>
      </nav>
    </main>
  );
}