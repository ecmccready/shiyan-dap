"use client";

import { useState, useEffect } from "react";
import type { GoalContract } from "@/lib/level4/goal";
import type { ControllerRecord } from "@/lib/level4/controller";
import { autonomousStep } from "@/lib/level4/loop";
import { saveCheckpoint, loadCheckpoint, clearCheckpoint } from "@/lib/level4/checkpoint";

const DEMO_GOAL: GoalContract = {
  id: "goal_demo",
  desired_outcome: "reduce final e below 0.16 under safety constraints",
  permitted_actions: ["request_independent_check", "seal_pack", "hold"],
  max_iterations: 5,
  max_cost: 10,
  success_condition: "e < 0.16 && safety_passed",
  require_approval_for: ["payment", "production_change"],
  created_at: new Date().toISOString(),
};

const INITIAL: ControllerRecord = {
  goal_id: DEMO_GOAL.id,
  state: "READY",
  iteration: 0,
  last_e: null,
  history: [],
};

export default function AutonomousPage() {
  const [rec, setRec] = useState<ControllerRecord>(INITIAL);
  const [recovered, setRecovered] = useState(false);

  useEffect(() => {
    const saved = loadCheckpoint();
    if (saved?.rec) {
      setRec(saved.rec);
      setRecovered(true);
    }
  }, []);

  async function step() {
    const next = await autonomousStep(
      DEMO_GOAL,
      rec,
      "client_demo",
      "safety_v1",
      "model_3",
      "hold",
      0
    );
    setRec(next);
    saveCheckpoint(next);
  }

  function reset() {
    clearCheckpoint();
    setRec(INITIAL);
    setRecovered(false);
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <h1 className="text-xl font-semibold">Level 4 — Autonomous Run</h1>
      <p className="text-sm text-neutral-600">
        Persistent, bounded control loop. Plans, acts, verifies, and stops under explicit constraints.
      </p>
      <p className="text-sm">
        <a href="/roadmap" className="underline text-blue-600 hover:text-blue-800">
          Level 4 durability roadmap
        </a>
        {" — recovery, idempotency, safety gates, end-to-end proof."}
      </p>
      {recovered && (
        <p className="text-sm text-amber-700">Recovered from last checkpoint.</p>
      )}

      <dl className="grid grid-cols-2 gap-2 text-sm">
        <dt>State</dt>
        <dd className="font-medium">{rec.state}</dd>
        <dt>Iterations</dt>
        <dd>
          {rec.iteration} / {DEMO_GOAL.max_iterations}
        </dd>
        <dt>Goal</dt>
        <dd>{DEMO_GOAL.desired_outcome}</dd>
      </dl>

      <div className="flex gap-2">
        <button
          onClick={step}
          disabled={rec.state === "COMPLETE" || rec.state === "BLOCKED"}
          className="rounded bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          Advance loop
        </button>
        <button
          onClick={reset}
          className="rounded border px-4 py-2 text-sm"
        >
          Reset
        </button>
      </div>

      <section className="space-y-1 text-xs font-mono">
        {rec.history.map((h, i) => (
          <div key={i}>
            {h.at.slice(11, 19)} · {h.state} — {h.note}
          </div>
        ))}
      </section>
    </main>
  );
}