"use client";

import { useEffect, useState } from "react";
import { loadStarts } from "@/lib/level4/acquisition";

export default function StatusPage() {
  const [starts, setStarts] = useState(0);
  const [activeRun, setActiveRun] = useState<string | null>(null);

  useEffect(() => {
    setStarts(loadStarts());
    if (typeof window !== "undefined") {
      setActiveRun(window.sessionStorage.getItem("aethel-active-run-id"));
    }
  }, []);

  const items = [
    { surface: "/roadmap", status: "live", note: "durability + acquisition priorities" },
    { surface: "/workbench/start", status: "live", note: "guided first run" },
    { surface: "/workbench/spine", status: "live", note: "product spine view" },
    { surface: "/workbench/autonomous", status: "live", note: "checkpoint, idempotency, precheck, verified, server record" },
    { surface: "/workbench/autonomous/proof", status: "live", note: "recovery + gate proof" },
  ];

  return (
    <main className="mx-auto max-w-2xl space-y-8 p-6">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-neutral-500">Level 4</p>
        <h1 className="text-2xl font-semibold">Durability status</h1>
        <p className="text-neutral-700">
          Current surfaces from this exploratory slice. Server record is in-memory for the plant; durable store is the next step.
        </p>
      </header>

      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.surface} className="rounded border p-4">
            <a href={item.surface} className="font-medium underline">
              {item.surface}
            </a>
            <p className="text-sm text-neutral-600">{item.note}</p>
          </li>
        ))}
      </ul>

      <section className="rounded border p-4 text-sm">
        <p className="font-medium">Measured outcome</p>
        <p className="text-neutral-600">
          Demo goal: reduce final e below 0.16 under safety constraints. Φ is recorded when verified results are eligible. Server record survives page reload within the same instance.
        </p>
      </section>

      <section className="rounded border p-4 text-sm space-y-2">
        <p className="font-medium">Acquisition readiness</p>
        <ul className="list-disc list-inside text-neutral-600">
          <li>Clear starting point: /workbench/start</li>
          <li>Guided first run that ends in a verified result</li>
          <li>Understandable outcome without algorithm knowledge</li>
          <li>Reason to return: progress survives reload via server record</li>
        </ul>
        <p className="text-neutral-700">Guided starts recorded: {starts}</p>
        {activeRun && (
          <p className="text-neutral-700">
            Active run:{" "}
            <a href={`/workbench/autonomous?run=${activeRun}`} className="underline">
              {activeRun}
            </a>
          </p>
        )}
        <p className="text-neutral-500">
          Ready for measured traffic once durable store is connected.
        </p>
      </section>

      <p className="text-sm text-neutral-500">
        Next: durable store (Vercel KV or existing run persistence), measured acquisition, external client with predeclared outcome.
      </p>
    </main>
  );
}