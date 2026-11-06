"use client";

import React from "react";
import Link from "next/link";

export default function StatusPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <main className="max-w-3xl mx-auto px-6 py-16">
        <p className="text-xs uppercase tracking-widest text-emerald-400 mb-4">
          Aethel Node · Engine Status
        </p>

        <h1 className="text-4xl font-semibold mb-6">Current loop state</h1>

        <p className="text-zinc-300 mb-10">
          Opportunity recorded. Contract agreed. Evidence verified. Awaiting human disposition.
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