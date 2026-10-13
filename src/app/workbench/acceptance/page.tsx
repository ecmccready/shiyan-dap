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
  function add(line: string) { setLog((prev) => [line, ...prev].slice(0, 20)); }

  async function runAcceptance() {
    setLog([]);
    add("1. Cold start");
    const cold = await SelfFromApproved(CLIENT, WF, MODEL, "seal_pack");
    add(`Cold y = ${cold.y} (${cold.source})`);
    // remaining steps omitted for brevity — paste full page from earlier message after this succeeds
    add("Acceptance skeleton ready");
  }

  return (
    <main className="p-6">
      <h1>Acceptance</h1>
      <button onClick={runAcceptance} className="rounded bg-black px-4 py-2 text-white">Run</button>
      <ul>{log.map((l, i) => <li key={i}>{l}</li>)}</ul>
    </main>
  );
}
