"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

type Row = {
  t?: number;
  y?: string;
  z?: string;
  operator_chose_action?: boolean;
};

export default function WorkspacePage() {
  const [note, setNote] = useState("A is ready. Open B when you need the plant.");
  const [rows, setRows] = useState<Row[]>([]);

  async function ping() {
    try {
      const res = await fetch("/api/workspace/step", { method: "GET" });
      const data = await res.json();
      setNote(data.z || data.last_z || JSON.stringify(data).slice(0, 180));
      if (Array.isArray(data.ledger)) setRows(data.ledger);
    } catch {
      setNote("Controller snapshot unavailable. Workbench B still opens.");
    }
  }

  useEffect(() => {
    ping();
  }, []);

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Workspace" />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-emerald-400 mb-3">Workspace A · controller</p>
        <h1 className="text-3xl font-bold mb-3">Workspace A</h1>
        <p className="text-zinc-400 mb-8">
          Task, policy, evaluator, memory, Self(). Workbench B is the
          environment A acts on. It is not a customer rail.
        </p>

        <div className="flex flex-wrap gap-3 mb-8">
          <Link
            href="/workbench"
            className="h-12 px-6 rounded-full bg-emerald-600 text-sm inline-flex items-center"
          >
            Open Workbench B
          </Link>
          <Link
            href="/nfts"
            className="h-12 px-6 rounded-full border border-zinc-700 text-sm inline-flex items-center"
          >
            Prove
          </Link>
          <Link
            href="/single"
            className="h-12 px-6 rounded-full border border-zinc-700 text-sm inline-flex items-center"
          >
            Songs
          </Link>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 mb-6">
          <p className="text-sm text-zinc-400 mb-4">{note}</p>
          <button
            onClick={ping}
            className="h-11 px-6 rounded-full border border-zinc-700 text-sm"
          >
            Read z
          </button>
        </div>

        {rows.length > 0 ? (
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-zinc-500">
                  <th className="text-left py-2">t</th>
                  <th className="text-left py-2">y</th>
                  <th className="text-left py-2">z</th>
                  <th className="text-left py-2">op</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t border-zinc-800">
                    <td className="py-2">{r.t}</td>
                    <td className="py-2">{r.y}</td>
                    <td className="py-2">{r.z}</td>
                    <td className="py-2">
                      {String(r.operator_chose_action ?? "")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </main>
    </div>
  );
}