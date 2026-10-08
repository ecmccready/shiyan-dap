"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import { SAFETY_PACK } from "@/lib/closed-loop";
import { safetyFlywheel, type Arm } from "@/product/proof";
import { readRuns, type OutcomeRun } from "@/product/run";

const JOURNEY = ["CREATE RUN", "Objective", "A proposes", "B executes", "z", "e", "Δe", "PROOF", "REUSE", "NEW RUN"];

type Share = {
  objective: string;
  reference: string;
  y: string;
  z: string;
  e0: string;
  e1: string;
  delta: string;
  gate: string;
  phi: string;
  outcome: string;
};

export default function RunDossierPage() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params.id ?? "");
  const [stored, setStored] = useState<OutcomeRun | null | undefined>(undefined);
  const [shared, setShared] = useState<Share | null>(null);
  const [note, setNote] = useState("");
  const wheel = useMemo(() => safetyFlywheel("grok_bot"), []);
  const hit = useMemo(() => {
    const i = wheel.reuse.findIndex((arm) => arm.artifact.run_id === id || arm.case_id === id);
    if (i < 0) return null;
    return { reuse: wheel.reuse[i], cold: wheel.cold[i] };
  }, [wheel, id]);

  useEffect(() => {
    setStored(readRuns().find((run) => run.id === id) ?? null);
    const raw = new URLSearchParams(window.location.search).get("proof");
    if (!raw) return;
    try {
      setShared(JSON.parse(decodeURIComponent(raw)) as Share);
    } catch {
      setShared(null);
    }
  }, [id]);

  const arm = stored
    ? wheel.reuse.find((item) => item.case_id === stored.plant.case_id) ?? null
    : hit?.reuse ?? null;
  const cold = stored
    ? wheel.cold.find((item) => item.case_id === stored.plant.case_id) ?? null
    : hit?.cold ?? null;

  async function share(row: Share) {
    const url = `${window.location.origin}/workbench/run/${id}?proof=${encodeURIComponent(JSON.stringify(row))}`;
    await navigator.clipboard.writeText(url);
    setNote("Link copied. It carries this printed record. It is not a receipt.");
  }

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
        {shared && <SharedRecord id={id} row={shared} />}
        {!shared && stored && <StoredRecord run={stored} arm={arm} cold={cold} onShare={share} note={note} />}
        {!shared && !stored && hit && <PlantRecord arm={hit.reuse} cold={hit.cold} id={id} />}
        {!shared && stored === null && !hit && (
          <section className="mt-8 rounded-3xl border border-dashed border-zinc-700 p-8">
            <h1 className="text-2xl font-medium">Run not in this browser</h1>
            <p className="mt-3 text-sm text-zinc-400">{id || "Missing id"} has no stored record and no proof link. None was invented.</p>
          </section>
        )}
      </main>
    </div>
  );
}

function StoredRecord({
  run,
  arm,
  cold,
  onShare,
  note,
}: {
  run: OutcomeRun;
  arm: Arm | null;
  cold: Arm | null;
  onShare: (row: Share) => void;
  note: string;
}) {
  const pack = SAFETY_PACK.find((item) => item.id === run.plant.case_id);
  const y = run.plant.M.last_y ?? arm?.artifact.action_y ?? "not stepped on this stored Run";
  const z = run.plant.M.last_z ?? arm?.artifact.result_z ?? "not measured on this stored Run";
  const phi = cold && arm ? Number((cold.e1 - arm.e1).toFixed(3)) : run.delta_e;
  const row: Share = {
    objective: run.objective,
    reference: pack?.reference_note ?? "not stored",
    y,
    z,
    e0: String(run.e0),
    e1: String(run.e_now),
    delta: String(run.delta_e),
    gate: pack?.reference_gate ?? run.status,
    phi: String(phi),
    outcome: run.delta_e > 0 ? "PASS" : run.delta_e === 0 ? "HOLD" : "FAIL",
  };
  return (
    <article className="mt-6">
      <p className="text-xs uppercase tracking-[0.18em] text-emerald-400">RUN #{run.id}</p>
      <h1 className="mt-2 text-3xl font-semibold">{run.objective}</h1>
      <p className="mt-3 text-sm text-zinc-500">This browser only until the proof link is copied. Status is {run.status}. Status is not z.</p>
      <Fields fields={fieldsOf(row, `${run.id} · ${run.plant.case_id}`, arm)} />
      <button onClick={() => onShare(row)} className="mt-5 h-11 rounded-full bg-white px-5 text-sm font-medium text-black">
        Copy proof link
      </button>
      {note && <p className="mt-3 text-sm text-emerald-300">{note}</p>}
    </article>
  );
}

function SharedRecord({ id, row }: { id: string; row: Share }) {
  return (
    <article className="mt-6">
      <p className="text-xs uppercase tracking-[0.18em] text-emerald-400">Shared copy · {id}</p>
      <h1 className="mt-2 text-3xl font-semibold">{row.objective}</h1>
      <p className="mt-3 text-sm text-zinc-500">Opened from the proof link. Not a server record and not a receipt.</p>
      <Fields fields={fieldsOf(row, id, null)} />
    </article>
  );
}

function PlantRecord({ arm, cold, id }: { arm: Arm; cold: Arm; id: string }) {
  const phi = Number((cold.e1 - arm.e1).toFixed(3));
  const row: Share = {
    objective: arm.title,
    reference: arm.artifact.reference,
    y: arm.artifact.action_y,
    z: arm.artifact.result_z,
    e0: String(arm.e0),
    e1: String(arm.e1),
    delta: String(arm.delta_e),
    gate: arm.escalates > 0 ? "ESCALATE" : "HOLD",
    phi: String(phi),
    outcome: phi > 0 ? "PASS" : phi === 0 ? "HOLD" : "FAIL",
  };
  return (
    <article className="mt-6">
      <p className="text-xs uppercase tracking-[0.18em] text-emerald-400">Sealed plant</p>
      <h1 className="mt-2 text-3xl font-semibold">{arm.title}</h1>
      <Fields fields={fieldsOf(row, arm.artifact.run_id || id, arm)} />
    </article>
  );
}

function fieldsOf(row: Share, provenance: string, arm: Arm | null) {
  return [
    ["Objective", row.objective],
    ["Reference", row.reference],
    ["Action y", row.y],
    ["Output z", row.z],
    ["Initial e", row.e0],
    ["Final e", row.e1],
    ["Δe", row.delta],
    ["Gate status", row.gate],
    ["Provenance", provenance],
    ["Replay sequence", arm ? arm.steps.map((s) => s.y).join(" → ") : "copied record"],
    ["Φ", row.phi],
    ["Outcome", row.outcome],
  ];
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