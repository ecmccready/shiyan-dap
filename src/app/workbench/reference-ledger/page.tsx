import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import ledger from "../../../../fixtures/reference-ledger/records.json";
import type { LedgerFile } from "@/lib/reference-ledger/types";

export const metadata: Metadata = {
  title: "Reference Data Ledger | Shiyan DAP",
  description: "Versioned 4D-SCP results labeled simulated, routed, or physically measured. No PHI.",
};

const file = ledger as LedgerFile;

export default function ReferenceLedgerPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader brand="Shiyan DAP" section="Reference Data Ledger" />
      <main className="max-w-5xl mx-auto px-6 py-12 space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold">Reference Data Ledger</h1>
          <p className="text-zinc-400">{file.naming}</p>
          <p className="text-sm text-zinc-500">
            Power: {file.power}. Each domain keeps its own inputs, rules, agents, measurements, and evidence format.
            Verticals do not redefine the semiconductor core.{" "}
            <Link className="text-emerald-400 underline" href="/">Front door</Link>
          </p>
        </header>
        <div className="space-y-6">
          {file.records.map((r) => (
            <article key={r.id} className="rounded-xl border border-zinc-800 p-5 space-y-3">
              <header className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-xl font-semibold">{r.id}</h2>
                <p className="font-mono text-xs text-emerald-400">
                  {r.outcome.verdict}{r.outcome.negative ? " · negative result" : ""} · {r.evidence.labels.join(" · ")}
                </p>
              </header>
              <p className="text-sm text-zinc-300">{r.workload_identity}</p>
              <dl className="grid gap-2 text-sm text-zinc-400">
                <div><dt className="text-zinc-500">Input conditions</dt><dd>{r.input_conditions.summary}</dd></div>
                <div><dt className="text-zinc-500">Baseline</dt><dd>{r.baseline.summary}</dd></div>
                <div><dt className="text-zinc-500">Experiment</dt><dd>{r.experiment.summary}</dd></div>
                <div><dt className="text-zinc-500">Build provenance</dt><dd>{r.build_provenance.summary}</dd></div>
                <div><dt className="text-zinc-500">Implementation</dt><dd>{r.implementation.summary}</dd></div>
                <div><dt className="text-zinc-500">Hardware target</dt><dd>{r.hardware_target.summary}</dd></div>
                <div><dt className="text-zinc-500">Validation</dt><dd>{r.validation.summary}</dd></div>
                <div><dt className="text-zinc-500">Outcome</dt><dd>{r.outcome.summary}</dd></div>
              </dl>
            </article>
          ))}
        </div>
        <p className="text-sm text-zinc-500">
          Field list and boundaries: <span className="font-mono">docs/reference-data-ledger.md</span>.
        </p>
      </main>
    </div>
  );
}
