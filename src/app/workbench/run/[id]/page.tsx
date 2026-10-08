"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import { safetyFlywheel, type Arm } from "@/product/proof";

const JOURNEY = ["CREATE RUN", "Objective", "A proposes", "B executes", "z", "e", "Δe", "PROOF", "REUSE", "NEW RUN"];

export default function RunDossierPage() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params.id ?? "");
  const wheel = useMemo(() => safetyFlywheel("grok_bot"), []);
  const hit = useMemo(() => {
    const i = wheel.reuse.findIndex((arm) => arm.artifact.run_id === id || arm.case_id === id);
    if (i < 0) return null;
    return { reuse: wheel.reuse[i], cold: wheel.cold[i] };
  }, [wheel, id]);
  const [note, setNote] = useState("");

  function exportProof(arm: Arm, cold: Arm) {
    const record = recordOf(arm, cold, id);
    const blob = new Blob([JSON.stringify(record, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${arm.artifact.run_id}.run.json`;
    a.click();
    URL.revokeObjectURL(url);
    setNote("Record downloaded. It is evidence, not a receipt.");
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Run" />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <Link href="/workbench" className="text-sm text-zinc-500 underline">Workbench</Link>
        <ol className="mt-6 flex gap-2 overflow-x-auto text-xs text-zinc-400">
          {JOURNEY.map((step) => (
            <li key={step} className="shrink-0 rounded-full border border-zinc-800 px-3 py-1">{step}</li>
          ))}
        </ol>
        {!hit && (
          <section className="mt-8 rounded-3xl border border-dashed border-zinc-700 p-8">
            <h1 className="text-2xl font-medium">Run not on this plant</h1>
            <p className="mt-3 text-sm text-zinc-400">{id || "Missing id"} has no record. None was invented.</p>
          </section>
        )}
        {hit && <Record arm={hit.reuse} cold={hit.cold} id={id} note={note} onExport={exportProof} />}
      </main>
    </div>
  );
}

function Record({
  arm,
  cold,
  id,
  note,
  onExport,
}: {
  arm: Arm;
  cold: Arm;
  id: string;
  note: string;
  onExport: (arm: Arm, cold: Arm) => void;
}) {
  const row = recordOf(arm, cold, id);
  const fields = [
    ["Objective", row.objective],
    ["Reference", row.reference],
    ["Controller A", row.controller],
    ["Workbench B", row.workbench],
    ["Action y", row.action_y],
    ["Output z", row.output_z],
    ["Initial e", String(row.initial_e)],
    ["Final e", String(row.final_e)],
    ["Δe", String(row.delta_e)],
    ["Gate status", row.gate],
    ["Evidence", row.evidence],
    ["Provenance", row.provenance],
    ["Replay sequence", row.replay],
    ["Cold result", String(row.cold_result)],
    ["Reuse result", String(row.reuse_result)],
    ["Φ", String(row.phi)],
    ["Outcome", row.outcome],
  ];

  return (
    <article className="mt-6">
      <p className="text-xs uppercase tracking-[0.18em] text-emerald-400">RUN #{row.run_id}</p>
      <h1 className="mt-2 text-3xl font-semibold">{row.objective}</h1>
      <p className={`mt-4 text-2xl font-medium ${row.outcome === "PASS" ? "text-emerald-300" : "text-amber-200"}`}>{row.outcome}</p>
      <dl className="mt-6 divide-y divide-zinc-800 rounded-3xl border border-zinc-800">
        {fields.map(([k, v]) => (
          <div key={k} className="grid gap-1 px-4 py-3 sm:grid-cols-3">
            <dt className="text-xs uppercase tracking-wider text-zinc-500">{k}</dt>
            <dd className="text-sm text-zinc-200 sm:col-span-2">{v}</dd>
          </div>
        ))}
      </dl>
      <button onClick={() => onExport(arm, cold)} className="mt-5 h-11 rounded-full bg-white px-5 text-sm font-medium text-black">
        Export record
      </button>
      {note && <p className="mt-3 text-sm text-emerald-300">{note}</p>}
    </article>
  );
}

function recordOf(arm: Arm, cold: Arm, id: string) {
  const phi = Number((cold.e1 - arm.e1).toFixed(3));
  const gate = arm.escalates > 0 ? "ESCALATE" : "HOLD";
  const outcome = phi > 0 ? "PASS" : phi === 0 ? "HOLD" : "FAIL";
  return {
    run_id: arm.artifact.run_id || id,
    objective: arm.title,
    reference: arm.artifact.reference,
    controller: "A names y. Self() does not read this Run.",
    workbench: arm.artifact.B,
    action_y: arm.artifact.action_y,
    output_z: arm.artifact.result_z,
    initial_e: arm.e0,
    final_e: arm.e1,
    delta_e: arm.delta_e,
    gate,
    evidence: arm.artifact.experience,
    provenance: `${arm.artifact.run_id} · sealed Safety plant`,
    replay: arm.steps.map((s) => s.y).join(" → "),
    cold_result: cold.e1,
    reuse_result: arm.e1,
    phi,
    outcome,
  };
}