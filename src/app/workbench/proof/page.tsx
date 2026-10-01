"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { Namer, namerLabel } from "@/lib/closed-loop";
import {
  Arm,
  Receipt,
  proofLines,
  readReceipts,
  recordOutcomeIntent,
  safetyFlywheel,
} from "@/product/proof";

export default function ProofPage() {
  const [namer, setNamer] = useState<Namer>("grok_bot");
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const wheel = useMemo(() => safetyFlywheel(namer), [namer]);
  const won = wheel.case2_better && wheel.case3_better;

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Workbench B" />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-emerald-400 text-xs uppercase tracking-widest mb-3">
          Workspace B · Safety proof
        </p>
        <h1 className="text-3xl font-bold mb-3">Run, z, e, delta-e, experience</h1>
        <p className="text-zinc-400 max-w-2xl mb-4">
          One commercial B. A acts, B changes, error is measured, and the next
          case either uses that experience or it does not.
        </p>
        <p className="text-zinc-500 text-sm max-w-2xl mb-8">
          Evidence gate only. No diagnosis. No PHI. Self() is not edited.
        </p>

        <div className="flex flex-wrap gap-2 mb-8">
          {(["grok_fast", "hy4_deep", "grok_bot"] as Namer[]).map((id) => (
            <button
              key={id}
              onClick={() => setNamer(id)}
              className={`h-10 px-4 rounded-full text-sm border ${
                namer === id ? "bg-emerald-600 border-emerald-600" : "border-zinc-700"
              }`}
            >
              {namerLabel(id)}
            </button>
          ))}
        </div>

        {wheel.reuse.map((arm, i) => (
          <section key={arm.case_id} className="mb-8">
            <p className="text-emerald-400 text-xs mb-3">
              Case {i + 1} · {arm.title}
            </p>
            <div className="border border-zinc-800 rounded-2xl p-5 mb-3">
              {proofLines(arm).map((line) => (
                <p key={line.k} className="text-sm mb-2">
                  <span className="text-zinc-500">{line.k}. </span>
                  <span className="text-zinc-200">{line.v}</span>
                </p>
              ))}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <ArmCard arm={wheel.cold[i]} />
              <ArmCard arm={arm} />
            </div>
          </section>
        ))}

        <section className="border border-zinc-800 rounded-2xl p-5 mb-8 text-sm">
          <p className="text-emerald-400 text-xs mb-2">Flywheel</p>
          <p className="text-zinc-300">
            Case 2 reuse delta-e {wheel.reuse[1].delta_e} vs cold {wheel.cold[1].delta_e}.
            Case 3 reuse delta-e {wheel.reuse[2].delta_e} vs cold {wheel.cold[2].delta_e}.
          </p>
          <p className="text-zinc-500 mt-2">
            {won
              ? "Later cases beat cold Self() on this pack."
              : "Later cases did not beat cold Self(). Do not claim the flywheel."}
          </p>
        </section>

        <section className="border border-zinc-800 rounded-2xl p-5 mb-8">
          <p className="text-emerald-400 text-xs mb-2">Charge for the outcome</p>
          <p className="text-sm text-zinc-400 mb-4">
            $49 for one closed Safety proof. This writes an unsettled receipt.
            It is not a payment.
          </p>
          <button
            className="h-11 px-5 rounded-full bg-emerald-600 text-sm"
            onClick={() => {
              recordOutcomeIntent(wheel.reuse[2]);
              setReceipts(readReceipts());
            }}
          >
            Record outcome intent
          </button>
          <ul className="mt-4 text-xs font-mono text-zinc-500 space-y-1">
            {receipts.map((r) => (
              <li key={r.id}>
                {r.id} · delta-e {r.delta_e} · ${r.amount_usd} · {r.status}
              </li>
            ))}
          </ul>
        </section>

        <nav className="flex flex-wrap gap-4 text-sm">
          <Link className="underline" href="/workbench">Workbench B</Link>
          <Link className="underline" href="/workbench/safety">Diagnostic</Link>
          <Link className="underline" href="/audit">Audit</Link>
        </nav>
      </main>
    </div>
  );
}

function ArmCard({ arm }: { arm: Arm }) {
  return (
    <article className="border border-zinc-800 rounded-2xl p-4">
      <p className="text-xs text-zinc-500 mb-1">{arm.label}</p>
      <p className="text-sm text-zinc-300 mb-2">
        e {arm.e0} → {arm.e1} · delta-e {arm.delta_e}
        {arm.used_prior ? " · used prior" : ""}
      </p>
      <ol className="text-xs font-mono text-zinc-400 space-y-1">
        {arm.steps.map((s) => (
          <li key={`${arm.label}-${arm.case_id}-${s.t}`}>
            y={s.y} · e {s.e}→{s.e_next} · delta-e {s.reduced} · {s.gate}
          </li>
        ))}
      </ol>
    </article>
  );
}