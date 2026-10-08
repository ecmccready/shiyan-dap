"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import { safetyFlywheel, type Arm } from "@/product/proof";
import { readRuns, type OutcomeRun } from "@/product/run";

const JOURNEY = ["CREATE RUN", "Objective", "A proposes", "B executes", "z", "e", "Δe", "PROOF", "REUSE", "NEW RUN"];

export default function RunDossierPage() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params.id ?? "");
  const [stored, setStored] = useState<OutcomeRun | null | undefined>(undefined);
  const wheel = useMemo(() => safetyFlywheel("grok_bot"), []);
  const hit = useMemo(() => {
    const i = wheel.reuse.findIndex((arm) => arm.artifact.run_id === id || arm.case_id === id);
    if (i < 0) return null;
    return { reuse: wheel.reuse[i], cold: wheel.cold[i] };
  }, [wheel, id]);

  useEffect(() => {
    setStored(readRuns().find((run) => run.id === id) ?? null);
  }, [id]);

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Run" />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <Link href="/workbench/history" className="text-sm text-zinc-500 underline">History</Link>
        <ol className="mt-6 flex gap-2 overflow-x-auto text-xs text-zinc-400">
          {JOURNEY.map((step) => (
            <li key={step} className="shrink-0 rounded-full border border-zinc-800 px-3 py-1">{step}</li>
          ))}
        </ol>
        {stored === undefined && <p className="mt-8 text-sm text-zinc-500">Reading this browser.</p>}
        {stored && <StoredRecord run={stored} />}
        {!stored && hit && <PlantRecord arm={hit.reuse} cold={hit.cold} id={id} />}
        {stored === null && !hit && (
          <section className="mt-8 rounded-3xl border border-dashed border-zinc-700 p-8">
            <h1 className="text-2xl font-medium">Run not in this browser</h1>
            <p className="mt-3 text-sm text-zinc-400">
              {id || "Missing id"} is not stored here and is not a sealed Safety Run. A private window cannot see a browser record. None was invented.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}

function StoredRecord({ run }: { run: OutcomeRun }) {
  const fields = [
    ["Objective", run.objective],
    ["Reference", run.reference],
    ["Controller A", `${run.org} / ${run.workspace}`],
    ["Workbench B", run.workbench],
    ["Action y", run.case_id],
    ["Output z", run.status],
    ["Initial e", String(run.e0)],
    ["Final e", String(run.e_now)],
    ["Δe", String(run.delta_e)],
    ["Gate status", run.status],
    ["Evidence", "Stored in this browser. Not a receipt."],
    ["Provenance", run.id],
    ["Replay sequence", "sealed Safety replay"],
    ["Cold result", String(run.e0)],
    ["Reuse result", String(run.e_now)],
    ["Φ", String(run.delta_e)],
    ["Outcome", run.delta_e > 0 ? "PASS" : run.delta_e === 0 ? "HOLD" : "FAIL"],
  ];
  return (
    <article className="mt-6">
      <p className="text-xs uppercase tracking-[0.18em] text-emerald-400">RUN #{run.id}</p>
      <h1 className="mt-2 text-3xl font-semibold">{run.objective}</h1>
      <p className="mt-3 text-sm text-zinc-500">This browser only. Another window will not have it.</p>
      <Fields fields={fields} />
    </article>
  );
}

function PlantRecord({ arm, cold, id }: { arm: Arm; cold: Arm; id: string }) {
  const phi = Number((cold.e1 - arm.e1).toFixed(3));
  const fields = [
    ["Objective", arm.title],
    ["Reference", arm.artifact.reference],
    ["Controller A", "A names y. Self() does not read this Run."],
    ["Workbench B", arm.artifact.B],
    ["Action y", arm.artifact.action_y],
    ["Output z", arm.artifact.result_z],
    ["Initial e", String(arm.e0)],
    ["Final e", String(arm.e1)],
    ["Δe", String(arm.delta_e)],
    ["Gate status", arm.escalates > 0 ? "ESCALATE" : "HOLD"],
    ["Evidence", arm.artifact.experience],
    ["Provenance", `${arm.artifact.run_id || id} · sealed Safety plant`],
    ["Replay sequence", arm.steps.map((s) => s.y).join(" → ")],
    ["Cold result", String(cold.e1)],
    ["Reuse result", String(arm.e1)],
    ["Φ", String(phi)],
    ["Outcome", phi > 0 ? "PASS" : phi === 0 ? "HOLD" : "FAIL"],
  ];
  return (
    <article className="mt-6">
      <p className="text-xs uppercase tracking-[0.18em] text-emerald-400">Sealed plant</p>
      <h1 className="mt-2 text-3xl font-semibold">{arm.title}</h1>
      <Fields fields={fields} />
    </article>
  );
}

function Fields({ fields }: { fields: string[][] }) {
  return (
    <dl className="mt-6 divide-y divide-zinc-800 rounded-3xl border border-zinc-800">
      {fields.map(([k, v]) => (
        <div key={k} className="grid gap-1 px-4 py-3 sm:grid-cols-3">
          <dt className="text-xs uppercase tracking-wider text-zinc-500">{k}</dt>
          <dd className="text-sm text-zinc-200 sm:col-span-2">{v}</dd>
        </div>
      ))}
    </dl>
  );
}