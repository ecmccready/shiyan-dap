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
            <div className="text-sm text-zinc-400 mt-1">0 of 5 met · Acquisition gated</div>
          </Link>

          <Link href="/workbench/evidence" className="block border border-zinc-800 rounded-xl p-5 bg-zinc-950 hover:border-zinc-600">
            <div className="font-semibold">Evidence</div>
            <div className="text-sm text-emerald-400 mt-1">Verified · Awaiting review</div>
          </Link>

          <Link href="/workbench/review" className="block border border-zinc-800 rounded-xl p-5 bg-zinc-950 hover:border-zinc-600">
            <div className="font-semibold">Disposition</div>
            <div className="text-sm text-zinc-400 mt-1">Ready for reviewer</div>
          </Link>
        </div>

        <p className="text-xs text-zinc-500 mt-10">
          Prove the outcome. Then decide.
        </p>
      </main>
    </div>
  );
}