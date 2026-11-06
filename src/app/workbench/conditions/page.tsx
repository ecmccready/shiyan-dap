"use client";

import React from "react";
import Link from "next/link";

const CONDITIONS = [
  { id: 1, label: "Non-synthetic source observations", status: "Required" },
  { id: 2, label: "Reproducible improvement against a declared baseline", status: "Required" },
  { id: 3, label: "Independent review", status: "Required" },
  { id: 4, label: "Measured customer outcome", status: "Required" },
  { id: 5, label: "Owner authorization", status: "Required" },
];

export default function ConditionsPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <main className="max-w-3xl mx-auto px-6 py-16">
        <p className="text-xs uppercase tracking-widest text-emerald-400 mb-4">
          Aethel Node · Acquisition Gate
        </p>

        <h1 className="text-4xl font-semibold mb-6">Five evidence conditions</h1>

        <p className="text-zinc-300 mb-10">
          Acquisition remains locked until these conditions are met. The eventual acquisition agent consumes the evidence the product generates.
        </p>

        <div className="space-y-4">
          {CONDITIONS.map((c) => (
            <div key={c.id} className="border border-zinc-800 rounded-xl p-5 bg-zinc-950 flex justify-between items-center">
              <div>
                <div className="font-semibold">{c.id}. {c.label}</div>
              </div>
              <div className="text-sm text-zinc-400">{c.status}</div>
            </div>
          ))}
        </div>

        <div className="mt-10">
          <Link
            href="/workbench/journey"
            className="inline-block bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded"
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