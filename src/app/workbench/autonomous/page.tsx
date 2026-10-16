"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import type { GoalContract } from "@/lib/level4/goal";
import type { ControllerRecord } from "@/lib/level4/controller";
import { autonomousStep } from "@/lib/level4/loop";
import { saveCheckpoint, loadCheckpoint, clearCheckpoint } from "@/lib/level4/checkpoint";
import { alreadyApplied, markApplied, clearSeen } from "@/lib/level4/idempotency";
import { precheckAction } from "@/lib/level4/precheck";
import { recordVerified, clearVerified } from "@/lib/level4/verified";
import { saveServerRecord, loadServerRecord, clearServerRecord } from "@/lib/level4/server-record";

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
  const searchParams = useSearchParams();
  const RUN_ID =
    searchParams.get("run") ||
    (typeof window !== "undefined" ? window.sessionStorage.getItem("aethel-active-run-id") : null) ||
    "demo-run";

  const [rec, setRec] = useState<ControllerRecord>(INITIAL);
  const [recovered, setRecovered] = useState(false);

  useEffect(() => {
    async function load() {
      const serverRec = await loadServerRecord(RUN_ID);
      if (serverRec) {
        setRec(serverRec);
        setRecovered(true);
        return;
      }
      const saved = loadCheckpoint();
      if (saved?.rec) {
        setRec(saved.rec);
        setRecovered(true);
      }
    }
    load();
  }, [RUN_ID]);

  async function step() {
    const actionKey = `${rec.goal_id}:${rec.iteration}:hold`;

    if (alreadyApplied(actionKey)) {
      setRec({
        ...rec,
        history: [
          ...rec.history,
          {
            state: rec.state,
            at: new Date().toISOString(),
            note: "idempotent skip (already applied)",
          },
        ],
      });
      return;
    }

    const check = precheckAction(DEMO_GOAL, rec, "hold", 0);
    if (!check.ok) {
      setRec({
        ...rec,
        state: "BLOCKED",
        blocked_reason: check.reason,
        history: [
          ...rec.history,
          {
            state: "BLOCKED",
            at: new Date().toISOString(),
            note: `precheck blocked: ${check.reason}`,
          },
        ],
      });
      return;
    }

    const next = await autonomousStep(
      DEMO_GOAL,
      rec,
      "client_demo",
      "safety_v1",
      "model_3",
      "hold",
      0
    );

    const verified = recordVerified(next, next.last_e, true);
    next.history.push({
      state: next.state,
      at: verified.verified_at,
      note: `verified result recorded (eligible=${verified.eligible})`,
    });

    markApplied(actionKey);
    setRec(next);
    saveCheckpoint(next);
    await saveServerRecord(RUN_ID, next);
  }

  async function reset() {
    clearCheckpoint();
    clearSeen();
    clearVerified();
    await clearServerRecord(RUN_ID);
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
      <p className="text-sm">
        <a href="/workbench/start" className="underline text-blue-600 hover:text-blue-800">
          Guided start
        </a>
        {" — one path from goal to verified result."}
      </p>
      <p className="text-sm">
        <a href={`/api/level4/run?id=${RUN_ID}`} className="underline text-blue-600" target="_blank">
          Inspect server record
        </a>
      </p>
      <p className="text-sm">
        <a href="/workbench/status" className="underline text-blue-600 hover:text-blue-800">
          Level 4 status
        </a>
        {" — measured outcome and acquisition readiness."}
      </p>
      {recovered && (
        <p className="text-sm text-amber-700">
          Recovered from server record ({RUN_ID}).
        </p>
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
        <dt>Run</dt>
        <dd className="font-mono text-xs">{RUN_ID}</dd>
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