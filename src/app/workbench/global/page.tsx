"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import CopyVerificationSummary from "@/components/CopyVerificationSummary";
import { useCopy, copiedRing } from "@/lib/use-copy";
import { buildGlobalSnapshot, classifyRun, latestPerRun, GLOBAL_SNAPSHOT_SCHEMA } from "@/lib/diagnostics/global-snapshot";

type Row = {
  run_id: string;
  iteration: number;
  e: number | null;
  e0: number | null;
  delta_e: number | null;
  cold_e: number | null;
  phi: number | null;
  eligible: boolean;
  state: string;
  verified_at: string;
};

type RunSummary = Row & { status: "ELIGIBLE_EXPERIENCE" | "MISDIAGNOSIS_REJECTED" | "IN_PROGRESS" };

const fmt = (n: number | null | undefined) => (typeof n === "number" ? n.toFixed(3) : "n/a");

// Classification and latest-per-run are shared with the copyable snapshot (src/lib/diagnostics/global-snapshot.ts).
function summarize(rows: Row[]): RunSummary[] {
  return latestPerRun(rows).map((r) => ({ ...r, status: classifyRun(r) }));
}

/** Builds aethel.global.snapshot.v1 from the rows already loaded and copies it. Local clipboard only; nothing is sent. */
function CopySnapshot({ rows }: { rows: Row[] }) {
  const copy = useCopy(4000, undefined, "global snapshot");
  return (
    <button
      type="button"
      data-copy-global-snapshot
      onClick={() => void copy.copy(JSON.stringify(buildGlobalSnapshot(rows, new Date().toISOString()), null, 2))}
      className={`inline-flex h-9 items-center rounded-full border border-zinc-600 px-4 text-xs text-zinc-200 hover:border-zinc-400${copiedRing(copy.status)}`}
    >
      {copy.status === "copied" ? "Copied ✓" : copy.status === "failed" ? "Copy failed" : "Copy snapshot JSON"}
    </button>
  );
}

export default function GlobalMisdiagnosisPage() {
  const [runs, setRuns] = useState<RunSummary[] | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/level4/experience")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`experience ${r.status}`))))
      .then((data) => {
        const list: Row[] = Array.isArray(data) ? data : data.experience || [];
        setRows(list);
        setRuns(summarize(list));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "could not load"));
  }, []);

  const eligible = runs?.filter((r) => r.status === "ELIGIBLE_EXPERIENCE").length ?? 0;
  const rejected = runs?.filter((r) => r.status === "MISDIAGNOSIS_REJECTED").length ?? 0;
  const inProgress = runs?.filter((r) => r.status === "IN_PROGRESS").length ?? 0;

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Global · misdiagnosis" />
      <main className="max-w-4xl mx-auto px-6 py-12 space-y-6">
        <p className="text-emerald-400 text-xs uppercase tracking-widest">Global diagnostic view</p>
        <h1 className="text-3xl font-bold">Misdiagnosis as a global systemic error</h1>
        <p className="text-zinc-300 max-w-2xl" data-global-si-lede>
          The Global diagnostic view of misdiagnosis as the wrong next action in SI (Super Intelligence)-operated workflows:
          every recorded run, one status per run, measured against its goal threshold.
        </p>
        <p className="text-zinc-400 max-w-2xl">
          One domain-neutral view of every recorded Level 4 run. Misdiagnosis here means a wrong next action: observed
          variance e stays above the goal threshold, or the tensor check fails. It is not a clinical finding, makes no
          device claim, and handles no PHI. This page only reads recorded runs; it does not change the Level 4 loop.
        </p>

        <section className="border border-zinc-800 rounded-2xl p-5 text-sm space-y-2">
          <p className="text-emerald-400 text-xs">How to read a row</p>
          <p className="text-zinc-300">
            e is the final observed error. Δe = e0 − e. Φ compares that run&apos;s final e with the cold baseline recorded
            for the same run, so it is an improvement against that recorded baseline, not an independent cold run.
          </p>
          <ul className="text-zinc-400 list-disc pl-5">
            <li><code>ELIGIBLE_EXPERIENCE</code>: the run reached the goal threshold and may be reused.</li>
            <li><code>MISDIAGNOSIS_REJECTED</code>: the run completed without reaching the threshold; it is not reused.</li>
            <li><code>IN_PROGRESS</code>: the latest recorded step has not completed the run.</li>
          </ul>
        </section>

        <section className="border border-zinc-800 rounded-2xl p-5">
          <p className="text-emerald-400 text-xs mb-3">Recorded runs (GET /api/level4/experience)</p>
          <p className="text-xs text-zinc-500 mb-3" data-global-snapshot-api>
            Same snapshot as JSON (<code>aethel.global.snapshot.v1</code>):{" "}
            <a className="underline" href="/api/diagnostics/global-snapshot">/api/diagnostics/global-snapshot</a>. GET only, read from the
            experience store (503 when it is not configured); a shape and status record, not attestation or a clinical diagnosis.
          </p>
          {error ? (
            <p className="text-sm text-amber-400">Could not load recorded runs: {error}.</p>
          ) : runs === null ? (
            <p className="text-sm text-zinc-500">Loading…</p>
          ) : runs.length === 0 ? (
            <p className="text-sm text-zinc-500">No recorded runs yet.</p>
          ) : (
            <>
              <p className="text-base text-white mb-1" data-global-counts>
                {runs.length} runs · {eligible} eligible · {rejected} misdiagnosis rejected · {inProgress} in progress
              </p>
              <p className="text-sm text-zinc-400 mb-3">Status is derived from the latest recorded step.</p>
              <div className="flex flex-wrap items-center gap-3 mb-4" data-global-snapshot>
                <CopySnapshot rows={rows} />
                <span className="text-xs text-zinc-500">
                  Operator hand-off: <code>{GLOBAL_SNAPSHOT_SCHEMA}</code> built in your browser from the runs above and copied to your clipboard.
                  Status only, not attestation or a clinical diagnosis; nothing is sent or stored.
                </span>
              </div>
              <div className="overflow-auto">
                <table className="w-full text-xs text-left">
                  <thead className="text-zinc-500">
                    <tr><th className="py-2 pr-3">Run</th><th className="pr-3">e</th><th className="pr-3">Δe</th><th className="pr-3">Φ</th><th className="pr-3">Status</th><th>Verify</th></tr>
                  </thead>
                  <tbody>
                    {runs.map((r) => (
                      <tr key={r.run_id} className="border-t border-zinc-800 font-mono">
                        <td className="py-2 pr-3">{r.run_id}</td>
                        <td className="pr-3">{fmt(r.e)}</td>
                        <td className="pr-3">{fmt(r.delta_e)}</td>
                        <td className="pr-3">{fmt(r.phi)}</td>
                        <td className="pr-3">{r.status}</td>
                        <td>
                          <a className="underline" href={`/api/level4/verify?run_id=${encodeURIComponent(r.run_id)}`}>verify</a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>

        <section data-global-related className="border border-zinc-800 rounded-2xl p-5 text-sm space-y-2">
          <p className="text-emerald-400 text-xs">Related surfaces (read-only links)</p>
          <ul className="text-zinc-300 list-disc pl-5 space-y-1">
            <li><Link className="underline" href="/workbench/diagnostic">Diagnostics</Link>: the diagnostic plant behind this view.</li>
            <li><Link className="underline" href="/workbench/safety">Safety</Link>: the buyer-facing Safety proof plant.</li>
            <li><Link className="underline" href="/workbench/marketplace">Marketplace</Link>: the peer index of verified sequences (Φ &gt; 0) from the same records.</li>
          </ul>
        </section>

        <section data-global-external-confirmation className="border border-zinc-800 rounded-2xl p-5 text-sm space-y-2">
          <p className="text-emerald-400 text-xs">External confirmation</p>
          <p className="text-zinc-300">
            The claims an outside party can check today, and what is not yet confirmed, are in the{" "}
            <Link className="underline" href="/#outside-verification">&quot;What an outside party can verify today&quot; block on the homepage</Link>
            {" "}and in <Link className="underline" href="/workbench/offer">/workbench/offer</Link>. The recorded runs above are our own, and Φ here is against a recorded baseline, not an independent cold run.
          </p>
          <CopyVerificationSummary />
        </section>

        <nav className="flex flex-wrap gap-4 text-sm">
          <Link className="underline" href="/workbench/status">Level 4 status</Link>
          <Link className="underline" href="/workbench/proof">Proof</Link>
          <Link className="underline" href="/workbench/safety">Safety</Link>
          <Link className="underline" href="/workbench/diagnostic">Diagnostics</Link>
        </nav>
      </main>
    </div>
  );
}
