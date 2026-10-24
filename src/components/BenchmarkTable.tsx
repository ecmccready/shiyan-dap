"use client";

import { useEffect, useState } from "react";

type Row = { iter: number; y: string; e_reuse: number; e_cold: number; delta_e: number; phi: number; I: number; G: boolean };
type Summary = { steps: number; e_start: number; e_final: number; e_cold_final: number; delta_e_total: number; phi_final: number };

/** Read-only cold-vs-reuse table from GET /api/level4/benchmark. Renders a small note if unavailable. */
export default function BenchmarkTable() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch("/api/level4/benchmark", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        if (!Array.isArray(d?.rows) || d.rows.length === 0) throw new Error();
        setRows(d.rows);
        setSummary(d.summary ?? null);
      })
      .catch(() => setFailed(true));
  }, []);

  if (failed) return <p className="text-xs text-zinc-500">Benchmark unavailable.</p>;
  if (!rows) return null;
  return (
    <section className="rounded-xl border border-zinc-800 p-4 text-sm" aria-label="Cross-run benchmark">
      <p className="font-medium">
        Cross-run benchmark: cold start vs reuse{" "}
        <a href="/api/level4/benchmark" target="_blank" rel="noopener" className="ml-1 text-xs font-normal underline text-zinc-400">
          raw data
        </a>
      </p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-xs font-mono text-zinc-300">
          <thead className="text-zinc-500">
            <tr><th className="text-left">step</th><th className="text-left">action</th><th className="text-right">e reuse</th><th className="text-right">e cold</th><th className="text-right">Δe</th><th className="text-right">Φ</th><th className="text-right">I_t</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.iter}><td>{r.iter}</td><td>{r.y}</td><td className="text-right">{r.e_reuse}</td><td className="text-right">{r.e_cold}</td><td className="text-right">{r.delta_e}</td><td className="text-right">{r.phi}</td><td className="text-right">{r.I}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      {summary && (
        <p className="mt-2 text-xs text-zinc-400">
          {summary.steps} steps · e {summary.e_start} → {summary.e_final} (cold {summary.e_cold_final}) · Δe total {summary.delta_e_total} · Φ {summary.phi_final}
        </p>
      )}
    </section>
  );
}
