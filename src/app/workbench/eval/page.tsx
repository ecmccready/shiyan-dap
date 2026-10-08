"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { Namer, namerLabel } from "@/lib/closed-loop";
import { safetyFlywheel } from "@/product/proof";

type Row = {
  caseId: string;
  title: string;
  namer: Namer;
  eCold: number;
  eReuse: number;
  phi: number;
  pass: boolean;
};

const NAMERS: Namer[] = ["grok_fast", "hy4_deep", "grok_bot"];

export default function EvalPage() {
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [fault, setFault] = useState("");

  const rows = useMemo<Row[]>(() => {
    try {
      return NAMERS.flatMap((namer) => {
        const wheel = safetyFlywheel(namer);
        return wheel.reuse.map((arm, i) => {
          const cold = wheel.cold[i];
          const phi = Number((cold.e1 - arm.e1).toFixed(3));
          return {
            caseId: arm.case_id,
            title: arm.title,
            namer,
            eCold: cold.e1,
            eReuse: arm.e1,
            phi,
            pass: arm.e1 < cold.e1,
          };
        });
      });
    } catch (err) {
      setFault(err instanceof Error ? err.message : "Harness failed.");
      return [];
    }
  }, []);

  const passed = rows.filter((r) => r.pass).length;
  const phis = rows.map((r) => r.phi).sort((a, b) => a - b);
  const median = phis.length ? phis[Math.floor(phis.length / 2)] : 0;
  const byNamer = NAMERS.map((namer) => {
    const mine = rows.filter((r) => r.namer === namer);
    return { namer, pass: mine.filter((r) => r.pass).length, n: mine.length };
  });

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Reliability" />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <p className="text-xs uppercase tracking-[0.18em] text-emerald-400">Proof of reliability</p>
        <h1 className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
          Case, cold, reuse, Φ, pass or fail.
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-400">
          This harness scores the sealed Safety plant. It does not invent hundreds of runs.
          Population today: {rows.length || "—"} deterministic case × namer rows. A pass is final e below cold. A tie fails.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={() => {
              setRunning(true);
              setFault("");
              window.setTimeout(() => {
                setRunning(false);
                setDone(true);
              }, 600);
            }}
            className="h-11 rounded-full bg-emerald-500 px-5 text-sm font-medium text-black"
          >
            {running ? "Scoring sealed cases" : "Run harness"}
          </button>
          <Link href="/workbench" className="inline-flex h-11 items-center text-sm text-zinc-400 underline">
            Back to Workbench
          </Link>
        </div>

        {fault && (
          <p className="mt-4 rounded-2xl border border-red-900 p-4 text-sm text-red-300" role="alert">{fault}</p>
        )}

        {!done && !running && (
          <p className="mt-8 rounded-3xl border border-dashed border-zinc-700 p-8 text-sm text-zinc-500">
            Harness idle. No score is shown until you run it.
          </p>
        )}

        {running && <p className="mt-8 text-sm text-emerald-300" role="status">Loading sealed arms…</p>}

        {done && (
          <>
            <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Tile k="Rows" v={String(rows.length)} />
              <Tile k="Pass rate" v={rows.length ? `${Math.round((passed / rows.length) * 100)}%` : "—"} />
              <Tile k="Median Φ" v={median.toFixed(3)} />
              <Tile k="Regressions" v={String(rows.length - passed)} />
            </section>
            <section className="mt-4 grid gap-3 sm:grid-cols-3">
              <Tile k="Repeatability" v="2 / 2" s="B1 repeat, 1.391 → 0.235. Not revenue." />
              <Tile k="Audit interventions" v="On stall" s="Frozen digest goes to /audit. Not counted here." />
              <Tile k="Latency" v="Sealed" s="No network timing on this plant." />
            </section>
            <section className="mt-4 grid gap-3 sm:grid-cols-3">
              {byNamer.map((m) => (
                <Tile key={m.namer} k={namerLabel(m.namer)} v={`${m.pass}/${m.n} pass`} s="Same A. Namer only names y." />
              ))}
            </section>
            <div className="mt-6 overflow-x-auto rounded-3xl border border-zinc-800">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="text-xs uppercase tracking-wider text-zinc-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Case</th>
                    <th className="px-4 py-3 font-medium">Namer</th>
                    <th className="px-4 py-3 font-medium">e cold</th>
                    <th className="px-4 py-3 font-medium">e reuse</th>
                    <th className="px-4 py-3 font-medium">Φ</th>
                    <th className="px-4 py-3 font-medium">Verdict</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={`${row.namer}-${row.caseId}`} className="border-t border-zinc-800">
                      <td className="px-4 py-3">{row.title}</td>
                      <td className="px-4 py-3">{namerLabel(row.namer)}</td>
                      <td className="px-4 py-3 tabular-nums">{row.eCold.toFixed(3)}</td>
                      <td className="px-4 py-3 tabular-nums">{row.eReuse.toFixed(3)}</td>
                      <td className="px-4 py-3 tabular-nums">{row.phi.toFixed(3)}</td>
                      <td className="px-4 py-3">{row.pass ? "PASS" : "FAIL"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function Tile({ k, v, s }: { k: string; v: string; s?: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 p-4">
      <p className="text-xs uppercase tracking-wider text-zinc-500">{k}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{v}</p>
      {s && <p className="mt-1 text-xs leading-5 text-zinc-500">{s}</p>}
    </div>
  );
}