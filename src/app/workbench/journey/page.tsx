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
  const [baseline, setBaseline] = useState("");
  const [success, setSuccess] = useState("");

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

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-8">
      <h1 className="text-2xl font-semibold">Endogenous commercial loop · proof journey</h1>
      <p className="text-sm text-neutral-600">
        Front door. Live engine data. Distinguishes unavailable from zero.
      </p>

      <section className="border rounded p-4">
        <h2 className="font-medium">1. Objective declaration</h2>
        <label className="block text-sm mt-2">Objective</label>
        <input className="w-full border rounded px-2 py-1" value={objective} onChange={(e) => setObjective(e.target.value)} />
        <label className="block text-sm mt-2">Declared baseline</label>
        <input className="w-full border rounded px-2 py-1" value={baseline} onChange={(e) => setBaseline(e.target.value)} />
        <label className="block text-sm mt-2">Success conditions</label>
        <input className="w-full border rounded px-2 py-1" value={success} onChange={(e) => setSuccess(e.target.value)} />
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
        <h2 className="font-medium">5. Human disposition</h2>
        <p className="text-sm text-neutral-600">Moved to durable hash-bound record in next commit.</p>
      </section>

      <section className="border rounded p-4">
        <h2 className="font-medium">6. Acquisition readiness</h2>
        <p className="text-sm">Locked until gates 1–5 pass.</p>
      </section>
    </main>
  );
}