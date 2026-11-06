"use client";

import React from "react";
import Link from "next/link";

const CONDITIONS = [
  { id: 1, label: "Non-synthetic source observations", status: "Required", met: false },
  { id: 2, label: "Reproducible improvement against a declared baseline", status: "Required", met: false },
  { id: 3, label: "Independent review", status: "Required", met: false },
  { id: 4, label: "Measured customer outcome", status: "Required", met: false },
  { id: 5, label: "Owner authorization", status: "Required", met: false },
];

export default function ConditionsPage() {
  const metCount = CONDITIONS.filter((c) => c.met).length;
  const progress = (metCount / CONDITIONS.length) * 100;

  return (
    <div className="min-h-screen bg-black text-white">
      <main className="max-w-3xl mx-auto px-6 py-16">
        <p className="text-xs uppercase tracking-widest text-emerald-400 mb-4">
          Aethel Node · Acquisition Gate
        </p>

        <h1 className="text-4xl font-semibold mb-6">Five evidence conditions</h1>

        <p className="text-zinc-300 mb-10">
          Acquisition remains locked until these conditions are met. The eventual acquisition agent consumes the evidence the product generates. The metamorphic proof pack is available as candidate evidence. Verified experience feeds the next cycle.
        </p>

        <div className="mb-6">
          <div className="text-sm text-zinc-400 mb-2">
            {metCount} of {CONDITIONS.length} conditions met
          </div>
          <div className="w-full bg-zinc-800 rounded-full h-2">
            <div
              className="bg-emerald-500 h-2 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="space-y-4">
          {CONDITIONS.map((c) => (
            <div key={c.id} className="border border-zinc-800 rounded-xl p-5 bg-zinc-950 flex justify-between items-center">
              <div>
                <div className="font-semibold">{c.id}. {c.label}</div>
              </div>
              <div className={`text-sm ${c.met ? "text-emerald-400" : "text-zinc-400"}`}>
                {c.met ? "Met" : c.status}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 flex gap-4 flex-wrap">
          <Link
            href="/workbench/proof"
            className="inline-block bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded"
          >
            Inspect metamorphic proof pack
          </Link>
          <Link
            href="/workbench/loop"
            className="inline-block border border-zinc-700 hover:border-zinc-500 text-white px-6 py-2 rounded"
          >
            Recursive improvement
          </Link>
          <Link
            href="/workbench/engine"
            className="inline-block border border-zinc-700 hover:border-zinc-500 text-white px-6 py-2 rounded"
          >
            Engine overview
          </Link>
          <Link
            href="/workbench/journey"
            className="inline-block border border-zinc-700 hover:border-zinc-500 text-white px-6 py-2 rounded"
          >
            Back to front door
          </Link>
        </div>

        <p className="text-xs text-zinc-500 mt-10">
          Prove the outcome. Then decide. Acquisition stays gated until the evidence is authoritative.
        </p>
      </main>
    </div>
  );
}