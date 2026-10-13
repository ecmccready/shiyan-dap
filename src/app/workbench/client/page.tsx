"use client";

import { useState } from "react";
import { loadRun, exportRunJSON, type PersistedRun } from "@/lib/run-store";

export default function ClientPage() {
  const [id, setId] = useState("");
  const [run, setRun] = useState<PersistedRun | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    setRun(null);
    if (!id.trim()) return;
    try {
      const r = await loadRun(id.trim());
      if (!r) setError("Run not found");
      else setRun(r);
    } catch {
      setError("Failed to load Run");
    }
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <h1 className="text-xl font-semibold">Client proof record</h1>
      <p className="text-sm text-neutral-600">
        Enter a Run ID to inspect the measured benefit and export evidence.
      </p>

      <div className="flex gap-2">
        <input
          value={id}
          onChange={(e) => setId(e.target.value)}
          placeholder="run_…"
          className="flex-1 rounded border px-3 py-2 text-sm"
        />
        <button
          onClick={load}
          className="rounded bg-neutral-900 px-4 py-2 text-sm text-white"
        >
          Load
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {run && (
        <div className="space-y-4">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-neutral-500">Workspace / Client</dt>
            <dd>
              {run.workspace_id} / {run.client_id}
            </dd>
            <dt className="text-neutral-500">Input reference</dt>
            <dd>{run.input_reference}</dd>
            <dt className="text-neutral-500">Workflow / model</dt>
            <dd>
              {run.workflow_version} / {run.model_version}
            </dd>
            <dt className="text-neutral-500">Action y</dt>
            <dd>{run.y}</dd>
            <dt className="text-neutral-500">Outcome z</dt>
            <dd>{run.z}</dd>
            <dt className="text-neutral-500">Error e</dt>
            <dd>{run.e.toFixed(3)}</dd>
            <dt className="text-neutral-500">Measured benefit</dt>
            <dd>
              {run.phi !== null && run.phi > 0
                ? `Φ +${run.phi.toFixed(3)}`
                : "no improvement"}
            </dd>
            <dt className="text-neutral-500">Safety</dt>
            <dd>{run.safety_passed ? "passed" : "held"}</dd>
          </dl>

          <button
            onClick={() => {
              const blob = new Blob([exportRunJSON(run)], {
                type: "application/json",
              });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `${run.id}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="rounded bg-neutral-900 px-4 py-2 text-sm text-white"
          >
            Export evidence JSON
          </button>

          <p className="text-xs text-neutral-500">
            No internal architecture required. This record is the proof.
          </p>
        </div>
      )}
    </main>
  );
}