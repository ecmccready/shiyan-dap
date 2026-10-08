"use client";

import { useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

const STEPS = [
  { y: "observe", z: "alert open, owner missing, rollback missing", e: 1.24, gate: "ESCALATE" },
  { y: "complete_field", z: "owner assigned, runbook step still missing", e: 0.82, gate: "HOLD" },
  { y: "request_independent_check", z: "rollback artifact attached", e: 0.41, gate: "HOLD" },
  { y: "seal_pack", z: "owner, runbook, rollback sealed", e: 0.18, gate: "HOLD" },
];

export default function VerifyPage() {
  const [shown, setShown] = useState(0);
  const [closed, setClosed] = useState(false);
  const current = STEPS[Math.max(0, shown - 1)] ?? STEPS[0];
  const e0 = STEPS[0].e;
  const e1 = closed ? STEPS[STEPS.length - 1].e : current.e;
  const delta = Number((e0 - e1).toFixed(3));
  const coldFinal = 0.41;
  const phi = Number((coldFinal - 0.18).toFixed(3));

  function step() {
    if (shown >= STEPS.length) {
      setClosed(true);
      return;
    }
    setShown((n) => n + 1);
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="IT verification" />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <p className="text-xs uppercase tracking-[0.18em] text-emerald-400">One vertical</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Verify the operational action.</h1>
        <p className="mt-4 text-sm leading-6 text-zinc-400">
          Problem, reference, action, execution, z, e, next action, lower e, verified experience.
          This is an IT incident plant. It is not Safety, not healthcare, and not a settled sale.
        </p>

        <ol className="mt-8 space-y-3 text-sm">
          <Item n="Problem" v="Production alert has no owner and no rollback proof." />
          <Item n="Reference truth" v="Owner assigned. Runbook step present. Rollback artifact attached. Gate HOLD." />
          <Item n="A proposes" v="A names y. A does not import this plant and does not read prior Runs." />
          <Item n="B executes" v="Operations B applies y and returns z." />
        </ol>

        <section className="mt-8 rounded-3xl border border-zinc-800 p-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs text-zinc-500">e now</p>
              <p className="text-4xl font-semibold tabular-nums">{e1.toFixed(2)}</p>
            </div>
            <p className="text-right text-sm text-zinc-400">Δe {delta.toFixed(2)}</p>
          </div>
          <ol className="mt-4 space-y-2">
            {STEPS.map((step, i) => (
              <li key={step.y} className={`rounded-2xl border px-4 py-3 text-sm ${i < shown ? "border-zinc-700" : "border-zinc-900 text-zinc-600"}`}>
                <span>y = {step.y}</span>
                <span className="float-right tabular-nums">e {i < shown ? step.e.toFixed(2) : "—"}</span>
                {i < shown && <span className="mt-1 block text-xs text-zinc-500">z · {step.z} · {step.gate}</span>}
              </li>
            ))}
          </ol>
          <button
            onClick={step}
            disabled={closed}
            className="mt-4 h-11 rounded-full bg-emerald-500 px-5 text-sm font-medium text-black disabled:opacity-40"
          >
            {closed ? "Run closed" : shown === 0 ? "Let B execute" : "Next action"}
          </button>
          {closed && (
            <div className="mt-4 rounded-2xl border border-zinc-800 p-4 text-sm">
              <p>Measured z · {STEPS[3].z}</p>
              <p className="mt-1">Final e · 0.18. Cold final on this plant · 0.41. Φ · {phi}.</p>
              <p className="mt-2 text-emerald-300">Accepted on this plant only. Experience is the sealed sequence, replayable, not revenue.</p>
            </div>
          )}
        </section>

        <nav className="mt-8 flex flex-wrap gap-4 text-sm text-zinc-400">
          <Link className="underline" href="/workbench">Safety proof</Link>
          <Link className="underline" href="/workbench/operations">Operations B2</Link>
          <Link className="underline" href="/workbench/eval">Harness</Link>
        </nav>
      </main>
    </div>
  );
}

function Item({ n, v }: { n: string; v: string }) {
  return (
    <li className="rounded-2xl border border-zinc-800 px-4 py-3">
      <span className="text-xs uppercase tracking-wider text-zinc-500">{n}</span>
      <span className="mt-1 block">{v}</span>
    </li>
  );
}