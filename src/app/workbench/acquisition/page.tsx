"use client";

import { useState } from "react";

const GATES = [
  { id: 1, label: "Non-synthetic source observations" },
  { id: 2, label: "Reproducible improvement against a declared baseline" },
  { id: 3, label: "Independent review" },
  { id: 4, label: "Measured customer outcome" },
  { id: 5, label: "Owner authorization" },
];

export default function AcquisitionPage() {
  const [gates, setGates] = useState<Record<number, boolean>>({
    1: false, 2: false, 3: false, 4: false, 5: false,
  });
  const [opportunity, setOpportunity] = useState("");
  const [msg, setMsg] = useState("");

  const allPassed = GATES.every((g) => gates[g.id]);

  function toggle(id: number) {
    setGates((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  async function prepare(e: React.FormEvent) {
    e.preventDefault();
    if (!allPassed) {
      setMsg("Locked — all five gates must pass before any opportunity can be prepared.");
      return;
    }
    setMsg(`Opportunity prepared (approval required before outreach): ${opportunity || "(empty)"}`);
  }

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Acquisition agent</h1>
      <p className="text-sm text-neutral-600">
        Evidence-backed prospect research and opportunity qualification. Locked until gates pass. No outreach without owner approval.
      </p>

      <section className="border rounded p-4">
        <h2 className="font-medium">Gates</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {GATES.map((g) => (
            <li key={g.id}>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={gates[g.id]} onChange={() => toggle(g.id)} />
                {g.id}. {g.label}
              </label>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-sm">{allPassed ? "All gates passed." : "Locked."}</p>
      </section>

      <section className="border rounded p-4">
        <h2 className="font-medium">Prepare opportunity</h2>
        <form onSubmit={prepare} className="space-y-2 text-sm">
          <label className="block">Customer problem / opportunity note</label>
          <textarea className="w-full border rounded px-2 py-1" rows={3} value={opportunity} onChange={(e) => setOpportunity(e.target.value)} disabled={!allPassed} />
          <button type="submit" className="px-3 py-1 bg-black text-white rounded" disabled={!allPassed}>
            Prepare (approval required)
          </button>
          {msg && <p className="mt-2">{msg}</p>}
        </form>
      </section>

      <p className="text-xs text-neutral-500">
        Agent capabilities (when unlocked): understand Aethel Node from verified experience, identify the customer problem, select relevant verified evidence, construct a customer-specific demonstration, prepare an acquisition opportunity, and request approval before contacting anyone.
      </p>
    </main>
  );
}