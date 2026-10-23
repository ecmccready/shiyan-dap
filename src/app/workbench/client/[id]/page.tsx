"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { loadRun, exportRunJSON, type PersistedRun } from "@/lib/run-store";

export default function ClientRunPage() {
  const { id } = useParams<{ id: string }>();
  const [run, setRun] = useState<PersistedRun | null>(null);

  useEffect(() => {
    loadRun(id).then(setRun);
  }, [id]);

  if (!run) return <main className="p-6">Loading Run…</main>;

  const benefit = run.phi !== null && run.phi > 0 ? `Φ +${run.phi.toFixed(3)}` : "no improvement";

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <h1 className="text-xl font-semibold">Client proof record</h1>
      <p className="text-sm text-neutral-600">
        Workspace {run.workspace_id} · Client {run.client_id}
      </p>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <dt>Input reference</dt><dd>{run.input_reference}</dd>
        <dt>Workflow / model</dt><dd>{run.workflow_version} / {run.model_version}</dd>
        <dt>Action y</dt><dd>{run.y}</dd>
        <dt>Outcome z</dt><dd>{run.z}</dd>
        <dt>Error e</dt><dd>{run.e.toFixed(3)}</dd>
        <dt>Measured benefit</dt><dd>{benefit}</dd>
        <dt>Safety</dt><dd>{run.safety_passed ? "passed" : "held"}</dd>
      </dl>
      <button
        onClick={() => {
          const blob = new Blob([exportRunJSON(run)], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${run.id}.json`;
          a.click();
        }}
        className="rounded bg-neutral-900 px-4 py-2 text-sm text-white"
      >
        Export evidence JSON
      </button>
      <p className="text-xs text-neutral-500">
        No internal architecture required. This record is the proof.
      </p>
    </main>
  );
}