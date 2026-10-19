"use client";

import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Level4Shell from "@/components/Level4Shell";
import type { GoalContract } from "@/lib/level4/goal";
import type { ControllerRecord } from "@/lib/level4/controller";
import { transition } from "@/lib/level4/controller";
import { autonomousStep } from "@/lib/level4/loop";
import { saveCheckpoint, loadCheckpoint, clearCheckpoint } from "@/lib/level4/checkpoint";
import { alreadyApplied, markApplied, clearSeen } from "@/lib/level4/idempotency";
import { precheckAction } from "@/lib/level4/precheck";
import { recordVerified, clearVerified, recordExperienceServer } from "@/lib/level4/verified";
import { saveServerRecord, loadServerRecord, clearServerRecord } from "@/lib/level4/server-record";
import {
  REUSE_SEQUENCE,
  coldBaseline,
  experienceProposer,
  measureActions,
  nextFromExperience,
  successThreshold,
} from "@/lib/level4/measured";
import type { YAction } from "@/lib/closed-loop";
import { demoTensorCheck, DEMO_TENSOR_EPSILON } from "@/lib/level4/demo-tensor";
import { combineEligibility, type TensorCheck } from "@/lib/level4/tensor";
import { experienceTensorFields } from "@/lib/level4/seal";
import { loadDurablePlan, nextFromPlan, type DurablePlan } from "@/lib/level4/durable-self";

const DEMO_GOAL: GoalContract = {
  id: "goal_demo",
  desired_outcome: "reduce final e below 0.16 under safety constraints",
  // The approved reuse sequence plus a safe no-op.
  permitted_actions: [...REUSE_SEQUENCE, "hold"],
  max_iterations: 5,
  max_cost: 10,
  success_condition: "e < 0.16 && safety_passed",
  require_approval_for: ["payment", "production_change"],
  created_at: "2026-10-15T00:00:00.000Z",
};

const E0 = measureActions([]).e0;

const INITIAL: ControllerRecord = {
  goal_id: DEMO_GOAL.id,
  state: "READY",
  iteration: 0,
  last_e: E0,
  e0: E0,
  actions: [],
  history: [],
};

function fmt(n: number | null | undefined) {
  return typeof n === "number" ? n.toFixed(3) : "—";
}

function AutonomousInner() {
  const searchParams = useSearchParams();
  // Same lookup order as before: ?run= → session → demo-run.
  const [runId] = useState<string>(
    () =>
      searchParams.get("run") ||
      (typeof window !== "undefined" ? window.sessionStorage.getItem("aethel-active-run-id") : null) ||
      "demo-run"
  );
  const [goal] = useState<GoalContract>(() => {
    const declared =
      typeof window !== "undefined" ? window.sessionStorage.getItem("aethel-declared-goal") : null;
    return declared ? { ...DEMO_GOAL, desired_outcome: declared } : DEMO_GOAL;
  });
  const [rec, setRec] = useState<ControllerRecord>(INITIAL);
  const [recovered, setRecovered] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tensor, setTensor] = useState<TensorCheck | null>(null);
  // Self() durable feed, opt-in with ?durable=1. Default runs use the built-in sequence.
  const [durableOn] = useState(() => searchParams.get("durable") === "1");
  const [plan, setPlan] = useState<DurablePlan | null>(null);

  useEffect(() => {
    if (!durableOn) return;
    loadDurablePlan(goal.permitted_actions, runId).then(setPlan);
  }, [durableOn, goal.permitted_actions, runId]);

  useEffect(() => {
    async function load() {
      const serverRec = await loadServerRecord(runId).catch(() => null);
      if (serverRec) {
        setRec({ actions: [], e0: E0, ...serverRec });
        setRecovered(true);
        return;
      }
      const saved = loadCheckpoint();
      if (saved?.rec && saved.rec.goal_id === DEMO_GOAL.id) {
        setRec({ actions: [], e0: E0, ...saved.rec });
        setRecovered(true);
      }
    }
    load();
  }, [runId]);

  const applied = (rec.actions ?? []) as YAction[];
  const nextY = (plan ? nextFromPlan(plan, applied.length) : nextFromExperience(applied)) as YAction;
  const threshold = successThreshold(goal.success_condition);
  const cold = applied.length > 0 ? coldBaseline(applied.length) : null;
  const deltaE = rec.e0 != null && rec.last_e != null ? rec.e0 - rec.last_e : null;
  const phi = cold != null && rec.last_e != null ? cold - rec.last_e : null;

  async function step() {
    if (busy) return;
    setBusy(true);
    try {
      const y = nextY;
      const actionKey = `${runId}:${rec.goal_id}:${rec.iteration}:${y}`;

      if (alreadyApplied(actionKey)) {
        setRec({
          ...rec,
          history: [
            ...rec.history,
            { state: rec.state, at: new Date().toISOString(), note: `idempotent skip (${y} already applied)` },
          ],
        });
        return;
      }

      const check = precheckAction(goal, rec, y, 0);
      if (!check.ok) {
        const blocked = {
          ...transition(rec, "BLOCKED", `precheck blocked: ${check.reason}`),
          blocked_reason: check.reason,
        };
        setRec(blocked);
        saveCheckpoint(blocked);
        await saveServerRecord(runId, blocked).catch(() => undefined);
        return;
      }

      let next = await autonomousStep(
        goal,
        rec,
        "client_demo",
        "safety_v1",
        "model_3",
        "hold",
        0,
        plan
          ? async () => ({ y: nextY as string, source: "durable" })
          : experienceProposer(applied)
      );
      if (next.state === "BLOCKED") {
        setRec(next);
        return;
      }

      // Measure on the core plant (closed-loop.ts) — the engine is not modified.
      const actions = [...applied, y];
      const m = measureActions(actions);
      const coldE = coldBaseline(actions.length);
      next = { ...next, actions, e0: m.e0, last_e: m.e };

      const success = threshold != null && m.e < threshold;
      // Demo tensor: a pure observation of plant state at request_independent_check /
      // seal_pack. It does not change e or the proposer; it is an additional gate on
      // the stored eligible flag only (combineEligibility).
      const tcheck = demoTensorCheck(actions);
      const eligible = combineEligibility(success, tcheck);
      next = transition(
        next,
        success ? "COMPLETE" : "CONTINUE",
        `${y}: e ${fmt(rec.last_e)} → ${fmt(m.e)} (Δe ${fmt(m.delta_e)} from start)${
          success ? ` — goal met (e < ${threshold})` : ""
        }`
      );

      const verified = recordVerified(next, m.e, eligible);
      next = {
        ...next,
        history: [
          ...next.history,
          ...(tcheck
            ? [
                {
                  state: next.state,
                  at: verified.verified_at,
                  note: `demo tensor ${tcheck.status} · ${tcheck.outCommitment.slice(0, 19)}… · d ${tcheck.distance.toFixed(3)} (ε ${DEMO_TENSOR_EPSILON})`,
                },
              ]
            : []),
          { state: next.state, at: verified.verified_at, note: `verified result recorded (eligible=${eligible})` },
        ],
      };

      await recordExperienceServer({
        run_id: runId,
        iteration: next.iteration,
        e: m.e,
        verified_at: verified.verified_at,
        eligible,
        y,
        e0: m.e0,
        delta_e: m.delta_e,
        cold_e: coldE,
        phi: Number((coldE - m.e).toFixed(3)),
        state: next.state,
        ...(tcheck ? experienceTensorFields(tcheck) : {}),
      });
      setTensor(tcheck);

      markApplied(actionKey);
      setRec(next);
      saveCheckpoint(next);
      await saveServerRecord(runId, next).catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    clearCheckpoint();
    clearSeen();
    clearVerified();
    await clearServerRecord(runId).catch(() => undefined);
    setRec(INITIAL);
    setTensor(null);
    setRecovered(false);
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <header className="space-y-2">
        <p className="text-emerald-400 text-xs uppercase tracking-widest">Level 4</p>
        <h1 className="text-2xl font-semibold">Autonomous run</h1>
        <p className="text-sm text-zinc-400">
          Bounded control loop. Each step is pre-checked, applied once, measured on the plant, and recorded.
          It stops when the goal is met or a limit is hit.
        </p>
      </header>

      {recovered && (
        <p className="text-sm text-amber-400">Recovered from saved record ({runId}).</p>
      )}

      <section className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-xl border border-zinc-800 p-4">
          <p className="text-xs text-zinc-500">Start e</p>
          <p className="text-xl font-mono">{fmt(rec.e0)}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 p-4">
          <p className="text-xs text-zinc-500">Current e</p>
          <p className="text-xl font-mono">{fmt(rec.last_e)}</p>
        </div>
        <div className="rounded-xl border border-emerald-800 p-4">
          <p className="text-xs text-zinc-500">Δe (reduction)</p>
          <p className="text-xl font-mono text-emerald-400">{fmt(deltaE)}</p>
        </div>
      </section>
      {phi != null && (
        <p className="text-xs text-zinc-500">
          Cold Self() after {applied.length} step(s): e = {fmt(cold)}. Φ vs cold = {fmt(phi)}
          {phi > 0 ? " · reuse wins" : phi === 0 ? " · tie (not a win)" : " · cold is ahead so far"}.
        </p>
      )}

      {durableOn && (
        <p className="text-xs text-zinc-500">
          {plan
            ? `Durable experience: reusing the action sequence of verified run ${plan.run_id} (Φ ${plan.phi}, e ${plan.e}; ${plan.candidates} eligible COMPLETE candidate(s) in the store).`
            : "Durable experience: none usable in the store, using the built-in approved sequence."}
        </p>
      )}

      {tensor && (
        <p className="text-xs text-zinc-500">
          Demo tensor (deterministic plant sensor vector, shape [4]):{" "}
          <span className="font-mono">{tensor.outCommitment.slice(0, 19)}…</span> · distance{" "}
          {tensor.distance.toFixed(3)} vs ε {DEMO_TENSOR_EPSILON} · {tensor.status}
        </p>
      )}

      <dl className="grid grid-cols-2 gap-2 text-sm">
        <dt className="text-zinc-500">State</dt>
        <dd className="font-medium">{rec.state}</dd>
        <dt className="text-zinc-500">Iterations</dt>
        <dd>
          {rec.iteration} / {goal.max_iterations}
        </dd>
        <dt className="text-zinc-500">Goal</dt>
        <dd>{goal.desired_outcome}</dd>
        <dt className="text-zinc-500">Next action</dt>
        <dd className="font-mono text-xs">{nextY}</dd>
        <dt className="text-zinc-500">Run</dt>
        <dd className="font-mono text-xs">{runId}</dd>
      </dl>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={step}
          disabled={busy || rec.state === "COMPLETE" || rec.state === "BLOCKED"}
          className="h-10 rounded-full bg-emerald-600 px-5 text-sm text-white disabled:opacity-40"
        >
          {busy ? "Working…" : "Advance loop"}
        </button>
        <button onClick={reset} className="h-10 rounded-full border border-zinc-700 px-5 text-sm">
          Reset
        </button>
        {rec.state === "COMPLETE" && (
          <Link
            href="/workbench/result"
            className="h-10 rounded-full border border-emerald-600 px-5 text-sm inline-flex items-center"
          >
            View verified result
          </Link>
        )}
      </div>

      <section className="space-y-1 rounded-xl border border-zinc-800 p-4 text-xs font-mono text-zinc-300">
        {rec.history.length === 0 ? (
          <p className="text-zinc-500">No steps yet.</p>
        ) : (
          rec.history.map((h, i) => (
            <div key={i}>
              {h.at.slice(11, 19)} · {h.state} — {h.note}
            </div>
          ))
        )}
      </section>

      <p className="text-xs text-zinc-500">
        <a href={`/api/level4/run?id=${encodeURIComponent(runId)}`} className="underline" target="_blank" rel="noreferrer">
          Inspect server record
        </a>
      </p>
    </main>
  );
}

export default function AutonomousPage() {
  return (
    <Level4Shell>
      <Suspense fallback={<div className="p-6 text-zinc-400">Loading run…</div>}>
        <AutonomousInner />
      </Suspense>
    </Level4Shell>
  );
}
