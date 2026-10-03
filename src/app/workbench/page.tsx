"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { Namer, namerLabel } from "@/lib/closed-loop";
import { Arm, SAFETY_B, safetyFlywheel } from "@/product/proof";

export default function ProofPage() {
  const [namer, setNamer] = useState<Namer>("grok_bot");
  const [pay, setPay] = useState("No charge yet.");
  const wheel = useMemo(() => safetyFlywheel(namer), [namer]);
  const won = wheel.case2_better && wheel.case3_better;
  const record = wheel.reuse[2].artifact;

  async function charge() {
    setPay("Opening Stripe…");
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assetId: "safety_proof_001",
        title: "Safety proof · measured run",
        cluster: "B",
        offerId: "OFFER-safety-proof-001",
      }),
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    else setPay(data.error || "Checkout did not return a URL.");
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Workbench B" />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-emerald-400 text-xs uppercase tracking-widest mb-3">
          One commercial B
        </p>
        <h1 className="text-3xl font-bold mb-3">A acts on Safety</h1>
        <p className="text-zinc-400 max-w-2xl mb-8">
          The loop is frozen. This page is the proposition: measurable z, Δe,
          experience, a better next action, then a charge. Not a unicorn proof.
        </p>

        <section className="border border-zinc-800 rounded-2xl p-5 mb-8 text-sm text-zinc-400">
          <p className="text-emerald-400 text-xs mb-2">1 · Loop frozen. 2 · What a B is</p>
          <p>B = {SAFETY_B.id}. Accepts {SAFETY_B.accepts[0]}.</p>
          <p className="mt-2">Actions: {SAFETY_B.actions.join(", ")}.</p>
          <p className="mt-2">z: {SAFETY_B.z}.</p>
          <p className="mt-2">e: {SAFETY_B.e}. Δe: {SAFETY_B.delta_e}.</p>
          <p className="mt-2">{SAFETY_B.not}.</p>
        </section>

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
              {i === 0 ? "" : (i === 1 ? wheel.case2_better : wheel.case3_better) ? " · better" : " · not better"}
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <ArmCard arm={wheel.cold[i]} />
              <ArmCard arm={arm} />
            </div>
          </section>
        ))}

        <section className="border border-zinc-800 rounded-2xl p-5 mb-8 text-sm">
          <p className="text-emerald-400 text-xs mb-2">3 · Run artifact. 4 · Reuse</p>
          <ul className="text-zinc-300 space-y-1">
            <li>Run ID · {record.run_id}</li>
            <li>B · {record.B}</li>
            <li>initial state · {record.initial_state}</li>
            <li>action y · {record.action_y}</li>
            <li>result z · {record.result_z}</li>
            <li>reference · {record.reference}</li>
            <li>error e · {record.error_e}</li>
            <li>Δe · {record.delta_e}</li>
            <li>experience · {record.experience}</li>
            <li>next action · {record.next_action}</li>
          </ul>
          <p className="text-zinc-500 mt-3">
            {won
              ? "Case 2 and Case 3 beat cold on steps, ESCALATE gates, or final e."
              : "A later run did not benefit. Do not claim the flywheel."}
          </p>
        </section>

        <section className="border border-zinc-800 rounded-2xl p-5 mb-8">
          <p className="text-emerald-400 text-xs mb-2">5 · Charge for the record</p>
          <p className="text-sm text-zinc-400 mb-4">{pay}</p>
          <button onClick={charge} className="h-11 px-5 rounded-full bg-emerald-600 text-sm">
            Charge for this Safety run
          </button>
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
        e {arm.e0} → {arm.e1} · Δe {arm.delta_e} · {arm.steps.length} steps · {arm.escalates} ESCALATE
      </p>
      <ol className="text-xs font-mono text-zinc-400 space-y-1">
        {arm.steps.map((s) => (
          <li key={`${arm.label}-${arm.case_id}-${s.t}`}>
            y={s.y} · {s.e}→{s.e_next} · {s.gate}
          </li>
        ))}
      </ol>
    </article>
  );
}