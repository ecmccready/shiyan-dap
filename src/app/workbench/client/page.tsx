"use client";

import { useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

const CLIENT = {
  name: "Target client",
  workflow: "repeated workflow with objective evaluator",
  examples: [
    "document completeness checks",
    "software test repair",
    "compliance evidence preparation",
    "supplier audit / rework tracking",
    "internal operational workflows",
  ],
};

const TEMPLATE = {
  cold: { e0: "client initial e", eFinal: "client cold final", sequence: "Self()", note: "baseline on client reference" },
  reuse: { e0: "client initial e", eFinal: "client reuse final", sequence: "mark_boundary → complete_field → request_independent_check → seal_pack", used: true },
  phi: "Φ only if final e falls",
};

function buildRun() {
  return {
    run_id: `client_${Date.now()}`,
    plant: "Client",
    reference: "client-supplied",
    cold: TEMPLATE.cold,
    reuse: TEMPLATE.reuse,
    phi: TEMPLATE.phi,
    commercial: {
      cost: "recorded per Run",
      latency: "recorded per Run",
      success_rate: "recorded per Run",
      customer_approved_value: "recorded when client settles",
    },
    note: "Same sealed sequence as Safety and Optimus. Φ stays inside this plant. Not a diagnosis. No PHI. Not revenue until the client settles.",
  };
}

export default function ClientPage() {
  const [exported, setExported] = useState(false);

  function exportRun() {
    const blob = new Blob([JSON.stringify(buildRun(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "aethel-client-run.json";
    a.click();
    URL.revokeObjectURL(url);
    setExported(true);
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader section="Workbench B" />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-emerald-400 text-xs uppercase tracking-widest mb-3">
          Pipeline · target client
        </p>
        <h1 className="text-3xl font-bold mb-3">Add value on their reference</h1>
        <p className="text-zinc-400 max-w-2xl mb-6">
          Know which AI workflow works, prove that it works, and reuse it when the evidence supports doing so.
          The workbench does not change. The client supplies the reference.
        </p>
        <p className="text-zinc-500 text-sm mb-6">
          Public proof is already printed on the Optimus plant. This page is where the same loop scores your reference.
        </p>

        <section className="border border-zinc-800 rounded-2xl p-5 mb-8 text-sm text-zinc-300 space-y-3">
          <p><span className="text-white">Buyer:</span> {CLIENT.name} — organization responsible for quality, cost, or reliability of repeated workflows.</p>
          <p><span className="text-white">Workflow:</span> {CLIENT.workflow}</p>
          <p><span className="text-white">Examples:</span> {CLIENT.examples.join(", ")}</p>
          <p><span className="text-white">Product:</span> Workbench that executes the task, scores outcomes against their reference, and records reproducible evidence.</p>
          <p><span className="text-white">Primary metric:</span> Change in final error, Φ, alongside task success, cost, latency, and safety.</p>
          <p><span className="text-white">Potential business model:</span> Subscription for the workbench, usage-based execution, and later paid access to verified reusable workflows.</p>
        </section>

        <h2 className="text-2xl font-bold mb-3">Client pack template</h2>
        <p className="text-zinc-400 max-w-2xl mb-6">
          1. Client names the repeated workflow and the objective reference.<br />
          2. Run cold on Workbench B. Record initial e.<br />
          3. Apply the sealed sequence or the client’s verified sequence.<br />
          4. Score final e. Φ only if it falls.<br />
          5. Export the Run.
        </p>

        <section className="mb-8">
          <h3 className="text-lg font-semibold mb-2">Client reference pack</h3>
          <pre className="text-sm bg-zinc-950 border border-zinc-800 rounded-2xl p-5 leading-7">{`cold
sequence: ${TEMPLATE.cold.sequence}
note: ${TEMPLATE.cold.note}
e ${TEMPLATE.cold.e0} → ${TEMPLATE.cold.eFinal}

reuse
sequence: ${TEMPLATE.reuse.sequence}
used experience: ${TEMPLATE.reuse.used ? "yes" : "no"}
e ${TEMPLATE.reuse.e0} → ${TEMPLATE.reuse.eFinal}

Φ ${TEMPLATE.phi}

commercial
cost: recorded per Run
latency: recorded per Run
success rate: recorded per Run
customer-approved value: recorded when client settles

export
Run identifier + reference version + sequence + final e + Φ + cost + latency
= inspectable evidence for the buyer and for any later review`}</pre>
        </section>

        <button
          onClick={exportRun}
          className="h-12 rounded-full bg-emerald-500 px-6 text-sm font-medium text-black mb-4"
        >
          Export Run
        </button>
        {exported && (
          <p className="text-sm text-emerald-400 mb-2">
            Run exported. The file is the inspectable evidence.
          </p>
        )}

        <p className="text-sm text-zinc-400 mt-4 mb-6">
          Exported Runs are inspectable on{" "}
          <Link className="underline" href="/workbench/history">History</Link>.
          A closed Run is not a charge. An unsettled receipt is not revenue.
        </p>
        <p className="text-sm text-zinc-300 mb-8">
          Ready to score your reference? The workbench is the plant. Supply the repeated workflow and the objective evaluator.
        </p>

        <p className="text-sm text-zinc-300">
          Same sealed sequence as Safety and Optimus. Φ stays inside this plant.
          Not a diagnosis. No PHI. Not revenue until the client settles.
          The exported Run is the evidence the buyer inspects and the acquirer can review.
          Developmental stack is the product. Client reference is the next plant.
        </p>

        <nav className="flex flex-wrap gap-4 text-sm mt-8">
          <Link className="underline" href="/workbench">Workbench B</Link>
          <Link className="underline" href="/workbench/optimus">Optimus pipeline</Link>
          <Link className="underline" href="/workbench/offer">Offer</Link>
          <Link className="underline" href="/workbench/proof">Safety proof</Link>
          <Link className="underline" href="/workbench/network">Actor network</Link>
          <Link className="underline" href="/workbench/compare">Peer proof</Link>
        </nav>
      </main>
    </div>
  );
}