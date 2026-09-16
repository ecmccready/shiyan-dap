"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { computeB, Self } from "@/lib/outcomes";
import { TOOL_SCHEMAS } from "@/lib/protocol";

type Head = { z?: string; action?: string; agent?: string; at?: string; ok?: boolean };

export default function ProtocolPage() {
  const [head, setHead] = useState<Head>({});
  const [tools, setTools] = useState<{ langchain?: boolean; runtime?: string }>({});
  const self = Self();
  const b = computeB();

  useEffect(() => {
    fetch("/api/memory")
      .then((r) => r.json())
      .then((d) => setHead(d))
      .catch(() => {});
    fetch("/api/tools")
      .then((r) => r.json())
      .then((d) => setTools(d))
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Protocol" />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-emerald-400 mb-3">slice_v6 · protocol first · langchain second</p>
        <h1 className="text-3xl font-bold mb-3">Shiyan protocol</h1>
        <p className="text-zinc-400 mb-8">
          Substrate first. LangChain later. computeB() names B. Self() names z. This page is an operator view, not demand.
        </p>

        <section className="bg-zinc-900/60 border border-emerald-800 rounded-2xl p-6 mb-6">
          <p className="text-xs text-emerald-400 mb-2">Head z · founder-z</p>
          <p className="text-xl">{head.z || self.z}</p>
          <p className="text-zinc-500 mt-2">
            {head.action} · {head.agent} · {head.at}
          </p>
          <p className="text-zinc-400 mt-4">
            Client Self() {self.z} · Computed B {b.action} · e {self.eA} · step {b.step}
          </p>
          <p className="text-zinc-500 mt-2 text-sm">
            runtime {tools.runtime || "shiyan-native"} · langchain {String(tools.langchain ?? false)}
          </p>
        </section>

        <section className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 mb-6">
          <p className="text-xs text-emerald-400 mb-4">Tools · native, not langchain</p>
          {Object.entries(TOOL_SCHEMAS).map(([name, spec]) => (
            <div key={name} className="mb-4">
              <p className="font-mono text-sm">{name}</p>
              <p className="text-zinc-500 text-sm">{spec.description}</p>
            </div>
          ))}
        </section>

        <div className="flex flex-wrap gap-3 mb-8">
          <Link href="/measurements" className="h-11 px-6 rounded-full bg-emerald-600 text-sm inline-flex items-center">
            Learn
          </Link>
          <Link href="/bot" className="h-11 px-6 rounded-full border border-zinc-700 text-sm inline-flex items-center">
            Act
          </Link>
          <Link href="/nfts" className="h-11 px-6 rounded-full border border-zinc-700 text-sm inline-flex items-center">
            Prove
          </Link>
        </div>

        <p className="text-zinc-500 text-sm">
          GET /api/tools · POST /api/tools · GET /api/self · GET /api/assets · GET /api/assets/:id/history
        </p>
      </main>
    </div>
  );
}