"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { OutcomeTransition, persistOutcome, readOutcomes, readZ } from "@/lib/outcomes";

export default function OutcomesPage() {
  const [rows, setRows] = useState<OutcomeTransition[]>([]);
  const [z, setZ] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    const all = readOutcomes();
    setRows(all);
    const returned = all.some((r) => !r.simulated && r.action === "RETURN");
    setZ(returned ? "B returned. Hold." : readZ());
  }, []);

  const persist = async () => {
    const row =
      rows.find((r) => !r.simulated && r.action === "RETURN") ||
      rows.find((r) => !r.simulated) ||
      rows[0];
    if (!row) {
      setNote("No row to persist.");
      return;
    }
    const persistZ = rows.some((r) => !r.simulated && r.action === "RETURN")
      ? "B returned. Hold."
      : z;
    persistOutcome(row, persistZ);
    try {
      const res = await fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "outcome", z: persistZ, ...row }),
      });
      const data = await res.json();
      setNote(data.ok ? "Wrote " + data.url : "HF error: " + (data.error || res.status));
      setZ(persistZ);
    } catch {
      setNote("HF request failed");
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Outcomes" />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-3">Outcomes</h1>
        <p className="text-zinc-400 mb-6">
          Browser ledger first. Hugging Face is the durable copy.
        </p>
        <p className="text-xl font-semibold mb-8">{z || "Measure on Learn."}</p>
        <div className="flex flex-wrap gap-3 mb-8">
          <Link
            href="/measurements"
            className="h-11 px-5 rounded-full bg-emerald-600 text-sm inline-flex items-center"
          >
            Learn
          </Link>
          <button onClick={persist} className="h-11 px-5 rounded-full border border-zinc-700 text-sm">
            Persist to Hugging Face
          </button>
          <a
            href="https://huggingface.co/datasets/shiyan-dap/founder-z/tree/main"
            target="_blank"
            rel="noreferrer"
            className="h-11 px-5 rounded-full border border-zinc-700 text-sm inline-flex items-center"
          >
            Hugging Face files
          </a>
        </div>
        {note ? <p className="text-sm text-emerald-400 mb-6">{note}</p> : null}
        <div className="space-y-3">
          {rows.slice().reverse().map((row) => (
            <p key={row.measurement_id} className="text-sm text-zinc-400">
              {row.agent} · {row.action} · Y {row.y_before.settlement}→{row.y_after.settlement}
              {row.simulated ? " · sim" : " · live"}
            </p>
          ))}
        </div>
      </main>
    </div>
  );
}