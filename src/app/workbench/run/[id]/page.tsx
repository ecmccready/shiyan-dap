use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import { safetyFlywheel, type Arm } from "@/product/proof";

export default function RunDossierPage() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params.id ?? "");
  const wheel = useMemo(() => safetyFlywheel("grok_bot"), []);
  const hit = useMemo(() => {
    const i = wheel.reuse.findIndex((arm) => arm.artifact.run_id === id || arm.case_id === id);
    if (i < 0) return null;
    return { reuse: wheel.reuse[i], cold: wheel.cold[i], i };
  }, [wheel, id]);
  const [copied, setCopied] = useState("");

  async function exportProof(arm: Arm, cold: Arm) {
    const phi = Number((cold.e1 - arm.e1).toFixed(3));
    const dossier = dossierOf(arm, cold, phi, id);
    const blob = new Blob([JSON.stringify(dossier, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${arm.artifact.run_id}.proof.json`;
    a.click();
    URL.revokeObjectURL(url);
    setCopied("Proof file downloaded. It is a record, not a receipt.");
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Run" />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <Link href="/workbench" className="text-sm text-zinc-500 underline">Workbench</Link>
        {!hit && (
          <section className="mt-8 rounded-3xl border border-dashed border-zinc-700 p-8" role="status">
            <h1 className="text-2xl font-medium">Run not on this plant</h1>
            <p className="mt-3 text-sm leading-6 text-zinc-400">
              {id || "Missing id"} is not in the sealed Safety flywheel. No evidence was invented for it.
            </p>
          </section>
        )}
        {hit && <Dossier arm={hit.reuse} cold={hit.cold} onExport={exportProof} note={copied} />}
      </main>
    </div>
  );
}

function Dossier({
  arm,
  cold,
  onExport,
  note,
}: {
  arm: Arm;
  cold: Arm;
  onExport: (arm: Arm, cold: Arm) => void;
  note: string;
}) {
  const phi = Number((cold.e1 - arm.e1).toFixed(3));
  const accepted = arm.e1 < cold.e1;
  const a = arm.artifact;
  const rows = [
    ["What was the objective?", arm.title],
    ["What action did A choose?", a.action_y],
    ["What did B do?", arm.steps.map((s) => s.y).join(" → ") || "No steps printed."],
    ["What happened?", a.result_z],
    ["What was the measured result?", `z recorded. Final e ${arm.e1}.`],
    ["What was the error?", `e0 ${arm.e0} → e1 ${arm.e1}. Δe ${arm.delta_e}.`],
    ["Did the next attempt improve?", accepted ? `Yes. Cold final ${cold.e1}, reuse final ${arm.e1}, Φ ${phi}.` : `No. Final e did not fall. Φ ${phi}.`],
    ["Why accepted or rejected?", accepted ? "Reuse final e is below cold final e. That is the listing test." : "A tie or a rise is not an error win. Claim refused."],
    ["What evidence supports it?", `${a.run_id} · ${a.experience}`],
    ["Can I reproduce it?", "Yes. Replay the sealed sequence on this plant. Self() does not read this Run."],
  ];

  return (
    <article className="mt-6">
      <p className="text-xs uppercase tracking-[0.18em] text-emerald-400">Atomic commercial unit</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{arm.title}</h1>
      <p className="mt-2 font-mono text-xs text-zinc-500">{a.run_id}</p>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat k="Baseline e" v={String(arm.e0)} />
        <Stat k="Final e" v={String(arm.e1)} />
        <Stat k="Δe" v={String(arm.delta_e)} />
        <Stat k="Φ" v={phi.toFixed(3)} />
      </div>
      <dl className="mt-6 divide-y divide-zinc-800 rounded-3xl border border-zinc-800">
        {rows.map(([q, answer]) => (
          <div key={q} className="px-4 py-4 sm:px-5">
            <dt className="text-xs uppercase tracking-wider text-zinc-500">{q}</dt>
            <dd className="mt-1 text-sm leading-6 text-zinc-200">{answer}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 rounded-3xl border border-zinc-800 p-5 text-sm text-zinc-400">
        <p>Reference · {a.reference}</p>
        <p className="mt-2">Initial state · {a.initial_state}</p>
        <p className="mt-2">Next action · {a.next_action}</p>
        <p className="mt-2">Escalates · {arm.escalates}. Used prior inside Self() · {arm.used_prior ? "yes" : "no"}.</p>
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <button onClick={() => onExport(arm, cold)} className="h-11 rounded-full bg-white px-5 text-sm font-medium text-black">
          Export proof
        </button>
        <Link href="/workbench/proof" className="inline-flex h-11 items-center rounded-full border border-zinc-700 px-5 text-sm">
          Open proof plant
        </Link>
        <Link href="/audit" className="inline-flex h-11 items-center rounded-full border border-zinc-700 px-5 text-sm">
          Audit trail
        </Link>
      </div>
      {note && <p className="mt-3 text-sm text-emerald-300">{note}</p>}
    </article>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-2xl bg-zinc-950 p-3">
      <p className="text-xs text-zinc-500">{k}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{v}</p>
    </div>
  );
}

function dossierOf(arm: Arm, cold: Arm, phi: number, id: string) {
  return {
    run_id: arm.artifact.run_id || id,
    objective: arm.title,
    action_y: arm.artifact.action_y,
    steps: arm.steps,
    result_z: arm.artifact.result_z,
    e_cold: cold.e1,
    e_reuse: arm.e1,
    delta_e: arm.delta_e,
    phi,
    accepted: arm.e1 < cold.e1,
    evidence: arm.artifact.experience,
    reproducible: true,
    self_reads_prior_runs: false,
    revenue: false,
  };
}