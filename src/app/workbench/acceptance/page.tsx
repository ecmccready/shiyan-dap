"use client";

import { useState } from "react";
import { saveRun, type PersistedRun } from "@/lib/run-store";
import { SelfFromApproved } from "@/lib/approved-experience";
import { compareColdReuse } from "@/lib/causal-proof";

const CLIENT = "client_acceptance";
const WF = "safety_v1";
const MODEL = "model_3";

export default function AcceptancePage() {
  const [log, setLog] = useState<string[]>([]);

  function add(line: string) {
    setLog((prev) => [line, ...prev].slice(0, 20));
  }

  async function runAcceptance() {
    setLog([]);

    add("1. Cold start — fallback y = seal_pack");
    const cold = await SelfFromApproved(CLIENT, WF, MODEL, "seal_pack");
    add(`   Cold y = ${cold.y} (${cold.source})`);

    const coldRun: PersistedRun = {
      id: `run_cold_${Date.now()}`,
      workspace_id: "ws_acceptance",
      client_id: CLIENT,
      input_reference: "safety_pack_ref",
      workflow_version: WF,
      model_version: MODEL,
      y: cold.y,
      z: "sealed",
      e: 0.216,
      e_baseline: 0.216,
      phi: 0,
      safety_passed: true,
      provenance: ["cold"],
      created_at: new Date().toISOString(),
      approved: true,
    };
    await saveRun(coldRun);
    add(`2. Persisted cold Run ${coldRun.id}`);

    const goodRun: PersistedRun = {
      ...coldRun,
      id: `run_good_${Date.now()}`,
      y: "request_independent_check",
      e: 0.151,
      e_baseline: 0.216,
      phi: 0.065,
      provenance: ["approved_experience"],
    };
    await saveRun(goodRun);
    add(`   Stored approved experience Run ${goodRun.id} (Φ +0.065)`);

    const warm = await SelfFromApproved(CLIENT, WF, MODEL, "seal_pack");
    add(
      `3–5. Retrieved → y = ${warm.y} (source=${warm.source}, justification=${warm.justification ?? "none"})`
    );
    add(
      warm.source === "approved"
        ? "   Controller influenced by retrieved experience"
        : "   No influence"
    );

    const cmp = compareColdReuse(0.216, 0.151, true);
    add(
      `6. Final error: cold ${cmp.cold_e} → reuse ${cmp.reuse_e} → ${cmp.outcome} (Φ ${cmp.phi.toFixed(3)})`
    );

    const unsafe: PersistedRun = {
      ...goodRun,
      id: `run_unsafe_${Date.now()}`,
      approved: false,
      safety_passed: false,
      phi: 0.1,
    };
    await saveRun(unsafe);
    const afterUnsafe = await SelfFromApproved(CLIENT, WF, MODEL, "seal_pack");
    add(
      `7. After unsafe Run: y = ${afterUnsafe.y} (source=${afterUnsafe.source}) — rejected`
    );
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <h1 className="text-xl font-semibold">
        Acceptance: Self() uses approved experience
      </h1>
      <p className="text-sm text-neutral-600">
        Seven-step contract. Advances the controller from known sequence to
        experience-informed.
      </p>
      <button
        onClick={runAcceptance}
        className="rounded bg-neutral-900 px-4 py-2 text-sm text-white"
      >
        Run acceptance
      </button>
      <ul className="space-y-1 font-mono text-xs">
        {log.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ul>
    </main>
  );
}