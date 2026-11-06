"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

type MetamorphicStatus = {
  phi: number;
  converged: boolean;
  predicted: number;
  emergent: number;
};

export default function StatusPage() {
  const [meta, setMeta] = useState<MetamorphicStatus | null>(null);
  const conditionsMet = 0;
  const conditionsTotal = 5;
  const progress = (conditionsMet / conditionsTotal) * 100;

  useEffect(() => {
    fetch("/api/metamorphic")
      .then((res) => res.json())
      .then((data) => {
        if (data.pack) {
          setMeta({
            phi: data.pack.phi,
            converged: data.pack.converged,
            predicted: data.pack.predicted,
            emergent: data.pack.emergent,
          });
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-black text-white">
      <main className="max-w-3xl mx-auto px-6 py-16">
        <p className="text-xs uppercase tracking-widest text-emerald-400 mb-4">
          Aethel Node · Engine Status
        </p>

        <h1 className="text-4xl font-semibold mb-6">Current loop state</h1>

        <p className="text-zinc-300 mb-10">
          Opportunity recorded. Contract agreed. Evidence verified. Metamorphic check complete. Awaiting human disposition. Acquisition remains gated.
        </p>

        <div className="space-y-4">
          <Link href="/workbench/opportunity" className="block border border-zinc-800 rounded-xl p-5 bg-zinc-950 hover:border-zinc-600">
            <div className="font-semibold">Opportunity</div>
            <div className="text-sm text-emerald-400 mt-1">Recorded</div>
          </Link>

          <Link href="/workbench/acquisition" className="block border border-zinc-800 rounded-xl p-5 bg-zinc-950 hover:border-zinc-600">
            <div className="font-semibold">Acquisition agent</div>
            <div className="text-sm text-zinc-400 mt-1">Qualify prospects · Human approval required</div>
          </Link>

          <Link href="/workbench/contract" className="block border border-zinc-800 rounded-xl p-5 bg-zinc-950 hover:border-zinc-600">
            <div className="font-semibold">Proof contract</div>
            <div className="text-sm text-emerald-400 mt-1">Agreed</div>
          </Link>

          <Link href="/workbench/execute" className="block border border-zinc-800 rounded-xl p-5 bg-zinc-950 hover:border-zinc-600">
            <div className="font-semibold">Execution · Metamorphic</div>
            {meta ? (
              <div className="text-sm mt-1">
                <span className={meta.converged ? "text-emerald-400" : "text-red-400"}>
                  Φ {meta.phi} · {meta.converged ? "Converged" : "Drifted"}
                </span>
                <span className="text-zinc-500 ml-2">
                  predicted {meta.predicted} → emergent {meta.emergent}
                </span>
              </div>
            ) : (
              <div className="text-sm text-zinc-400 mt-1">Loading…</div>
            )}
          </Link>

          <Link href="/workbench/proof" className="block border border-zinc-800 rounded-xl p-5 bg-zinc-950 hover:border-zinc-600">
            <div className="font-semibold">Metamorphic proof pack</div>
            <div className="text-sm text-emerald-400 mt-1">High-entropy pack ready · Exportable</div>
          </Link>

          <Link href="/workbench/conditions" className="block border border-zinc-800 rounded-xl p-5 bg-zinc-950 hover:border-zinc-600">
            <div className="font-semibold">Five evidence conditions</div>
            <div className="text-sm text-zinc-400 mt-1 mb-2">
              {conditionsMet} of {conditionsTotal} met · Acquisition gated
            </div>
            <div className="w-full bg-zinc-800 rounded-full h-1.5">
              <div
                className="bg-emerald-500 h-1.5 rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
          </Link>

          <Link href="/workbench/loop" className="block border border-zinc-800 rounded-xl p-5 bg-zinc-950 hover:border-zinc-600">
            <div className="font-semibold">Recursive improvement</div>
            <div className="text-sm text-zinc-400 mt-1">Verified experience feeds the next cycle</div>
          </Link>

          <Link href="/workbench/engine" className="block border border-zinc-800 rounded-xl p-5 bg-zinc-950 hover:border-zinc-600">
            <div className="font-semibold">Engine overview</div>
            <div className="text-sm text-zinc-400 mt-1">Complete loop · All surfaces</div>
          </Link>

          <Link href="/workbench/offer" className="block border border-zinc-800 rounded-xl p-5 bg-zinc-950 hover:border-zinc-600">
            <div className="font-semibold">Commercial offer</div>
            <div className="text-sm text-zinc-400 mt-1">Generated from demonstrated outcome</div>
          </Link>

          <Link href="/workbench/convert" className="block border border-zinc-800 rounded-xl p-5 bg-zinc-950 hover:border-zinc-600">
            <div className="font-semibold">Conversion</div>
            <div className="text-sm text-zinc-400 mt-1">Accept the result and purchase</div>
          </Link>

          <Link href="/workbench/evidence" className="block border border-zinc-800 rounded-xl p-5 bg-zinc-950 hover:border-zinc-600">
            <div className="font-semibold">Evidence</div>
            <div className="text-sm text-emerald-400 mt-1">Verified · Awaiting review</div>
          </Link>

          <Link href="/workbench/review" className="block border border-zinc-800 rounded-xl p-5 bg-zinc-950 hover:border-zinc-600">
            <div className="font-semibold">Disposition</div>
            <div className="text-sm text-zinc-400 mt-1">Ready for reviewer</div>
          </Link>

          <Link href="/workbench/journey" className="block border border-zinc-800 rounded-xl p-5 bg-zinc-950 hover:border-zinc-600">
            <div className="font-semibold">Front door</div>
            <div className="text-sm text-zinc-400 mt-1">Prove the outcome. Then decide.</div>
          </Link>

          <Link href="/workbench/flywheel" className="block border border-zinc-800 rounded-xl p-5 bg-zinc-950 hover:border-zinc-600">
            <div className="font-semibold">Founder Reference Flywheel</div>
            <div className="text-sm text-zinc-400 mt-1">Append-only verified memory · ROE improves next action</div>
          </Link>
        </div>

        <p className="text-xs text-zinc-500 mt-10">
          Prove the outcome. Then decide.
        </p>
      </main>
    </div>
  );
}
