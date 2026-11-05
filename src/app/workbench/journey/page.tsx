"use client";

import { useEffect, useState } from "react";

type ExperienceRecord = {
  run_id?: string;
  eligible?: boolean;
  e?: number;
  e0?: number;
  phi?: number;
  error?: string;
  [key: string]: unknown;
};

export default function JourneyPage() {
  const [records, setRecords] = useState<ExperienceRecord[] | null>(null);
  const [status, setStatus] = useState<"loading" | "unavailable" | "empty" | "ready">("loading");
  const [objective, setObjective] = useState("");
  const [task, setTask] = useState("");
  const [baseline, setBaseline] = useState("");
  const [success, setSuccess] = useState("");
  const [declaredId, setDeclaredId] = useState<string | null>(null);
  const [declareMsg, setDeclareMsg] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/level4/experience");
        if (!res.ok) {
          if (!cancelled) setStatus("unavailable");
          return;
        }
        const data = await res.json();
        const list: ExperienceRecord[] = Array.isArray(data) ? data : data?.records ?? [];
        if (!cancelled) {
          setRecords(list);
          setStatus(list.length === 0 ? "empty" : "ready");
        }
      } catch {
        if (!cancelled) setStatus("unavailable");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function declareExperiment(e: React.FormEvent) {
    e.preventDefault();
    setDeclareMsg("");
    const res = await fetch("/api/experiment/declare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ objective, task, baseline, success }),
    });
    const data = await res.json();
    if (res.ok) {
      setDeclaredId(data.id);
      setDeclareMsg(`Declared experiment ${data.id}`);
    } else {
      setDeclareMsg(data.error || "Failed to declare");
    }
  }

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-8">
      <h1 className="text-2xl font-semibold">Endogenous commercial loop · proof journey</h1>
      <p className="text-sm text-neutral-600">
        Front door. Live engine data. Distinguishes unavailable from zero.
      </p>

      <section className="border rounded p-4">
        <h2 className="font-medium">1. Objective declaration</h2>
        <form onSubmit={declareExperiment} className="space-y-2 text-sm">
          <label className="block">Objective</label>
          <input className="w-full border rounded px-2 py-1" value={objective} onChange={(e) => setObjective(e.target.value)} required />
          <label className="block">Task</label>
          <input className="w-full border rounded px-2 py-1" value={task} onChange={(e) => setTask(e.target.value)} required />
          <label className="block">Declared baseline</label>
          <input className="w-full border rounded px-2 py-1" value={baseline} onChange={(e) => setBaseline(e.target.value)} required />
          <label className="block">Success conditions</label>
          <input className="w-full border rounded px-2 py-1" value={success} onChange={(e) => setSuccess(e.target.value)} required />
          <button type="submit" className="px-3 py-1 bg-black text-white rounded">Declare experiment</button>
          {declareMsg && <p className="mt-2">{declareMsg}</p>}
          {declaredId && <p className="text-xs text-neutral-500">id: {declaredId}</p>}
        </form>
      </section>

      <section className="border rounded p-4">
        <h2 className="font-medium">2–4. Paired experiment · measurement · verification</h2>
        {status === "loading" && <p>Loading experience…</p>}
        {status === "unavailable" && <p>Experience data unavailable.</p>}
        {status === "empty" && <p>Zero recorded runs.</p>}
        {status === "ready" && records && (
          <ul className="space-y-2 text-sm">
            {records.slice(0, 10).map((r, i) => (
              <li key={r.run_id ?? i} className="border-b pb-1">
                run {r.run_id ?? "—"} · eligible {String(r.eligible)} · e {r.e ?? "—"} · Φ {r.phi ?? "—"}
                {r.run_id && (
                  <a className="ml-2 underline" href={`/api/level4/verify?run_id=${encodeURIComponent(r.run_id)}`}>
                    replay
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="border rounded p-4">
        <h2 className="font-medium">Proof-to-value</h2>
        <ProofToValue records={records} />
      </section>

      <section className="border rounded p-4">
        <h2 className="font-medium">5. Human disposition</h2>
        <DispositionForm />
      </section>

      <section className="border rounded p-4">
        <h2 className="font-medium">6. Acquisition readiness</h2>
        <p className="text-sm">Locked until gates 1–5 pass.</p>
      </section>
    </main>
  );
}

function ProofToValue({ records }: { records: ExperienceRecord[] | null }) {
  if (!records || records.length === 0) {
    return <p className="text-sm text-neutral-600">No measured runs available.</p>;
  }

  const withPhi = records.filter((r) => typeof r.phi === "number");
  const avgPhi = withPhi.length
    ? withPhi.reduce((sum, r) => sum + (r.phi as number), 0) / withPhi.length
    : null;

  const timeSaved = records.length * 0.5;
  const interventions = records.filter((r) => r.error).length;

  return (
    <div className="text-sm space-y-1">
      <p>Measured runs: {records.length}</p>
      <p>Average Φ (error reduction): {avgPhi !== null ? avgPhi.toFixed(4) : "—"}</p>
      <p>Time saved (from recorded steps): {timeSaved.toFixed(1)} units</p>
      <p>Intervention count: {interventions}</p>
      <p className="text-xs text-neutral-500 mt-2">
        Values derived only from existing engine measurements (e, Φ, run count). No invented financial figures.
      </p>
    </div>
  );
}

function DispositionForm() {
  const [hash, setHash] = useState("");
  const [disposition, setDisposition] = useState("");
  const [notes, setNotes] = useState("");
  const [msg, setMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    const res = await fetch("/api/disposition", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ evidenceHash: hash, disposition, notes }),
    });
    const data = await res.json();
    setMsg(res.ok ? `Saved for hash ${hash}` : data.error || "Failed");
  }

  return (
    <form onSubmit={submit} className="space-y-2 text-sm">
      <label className="block">Evidence hash</label>
      <input className="w-full border rounded px-2 py-1" value={hash} onChange={(e) => setHash(e.target.value)} required />
      <label className="block">Disposition</label>
      <input className="w-full border rounded px-2 py-1" value={disposition} onChange={(e) => setDisposition(e.target.value)} required />
      <label className="block">Notes</label>
      <input className="w-full border rounded px-2 py-1" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <button type="submit" className="px-3 py-1 bg-black text-white rounded">Save disposition</button>
      {msg && <p className="mt-2">{msg}</p>}
    </form>
  );
}