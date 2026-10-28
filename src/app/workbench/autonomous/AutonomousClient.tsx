"use client";

import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Level4Shell from "@/components/Level4Shell";
import type { GoalContract } from "@/lib/level4/goal";
import type { ControllerRecord } from "@/lib/level4/controller";
import { transition } from "@/lib/level4/controller";
import { autonomousStep } from "@/lib/level4/loop";
import { saveCheckpoint, loadCheckpoint, clearCheckpoint } from "@/lib/level4/checkpoint";
import { alreadyApplied, markApplied, clearSeen } from "@/lib/level4/idempotency";
import { precheckAction } from "@/lib/level4/precheck";
import { recordVerified, recordExperienceServer } from "@/lib/level4/verified";
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
import { nextFromPlan, type DurablePlan } from "@/lib/level4/durable-self";
import { resolveDurableSource, type ReuseOutcome } from "@/lib/level4/reuse-handoff";
import { type DurableVet } from "@/lib/level4/durable-vet";
import { loadExperienceServer, type ExperienceEntry } from "@/lib/level4/experience-client";
import { roeNextAction } from "@/lib/level4/roe-next-action";
import { roeForEntry } from "@/lib/level4/roe";
import { selectorRows, selectorLabel, type SelectorRow, type SelectorTagged } from "@/lib/level4/selector-label";
import { newRunId } from "@/lib/level4/acquisition";

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
  const router = useRouter();
  // Same lookup order as before: ?run= → session → demo-run.
  const [runId, setRunId] = useState<string>(
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
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [tensor, setTensor] = useState<TensorCheck | null>(null);
  // Self() durable feed, on by default; ?durable=0 disables (?durable=1 still accepted).
  // A durable plan is used only after a client-side replay vets it (see durable-vet.ts).
  const [durableOn] = useState(() => searchParams.get("durable") !== "0");
  const [reuseId] = useState(() => searchParams.get("reuse"));
  const [reuse, setReuse] = useState<ReuseOutcome | null>(null);
  const [plan, setPlan] = useState<DurablePlan | null>(null);
  const [vet, setVet] = useState<DurableVet | null>(null);
  // ROE drive (opt-in, ?roe_drive=1): the step-aware objective picks the action. Off by default.
  const [roeDrive] = useState(() => searchParams.get("roe_drive") === "1");
  const [roeLambda] = useState(() => { const v = Number(searchParams.get("lambda")); return Number.isFinite(v) ? v : 0; });
  const [roeMu] = useState(() => { const v = Number(searchParams.get("mu")); return Number.isFinite(v) ? v : 0; });
  const [roeEntries, setRoeEntries] = useState<ExperienceEntry[] | null>(null);
  // Display only: which selector chose each step, when entries carry selector data.
  const [selRows, setSelRows] = useState<SelectorRow[]>([]);
  // Display only: this run's stored entries, for the gated improvement credit I_t row.
  const [runEntries, setRunEntries] = useState<ExperienceEntry[]>([]);

  useEffect(() => {
    let active = true;
    loadExperienceServer().then((list) => {
      if (!active) return;
      setSelRows(selectorRows(list as SelectorTagged[], runId));
      setRunEntries(list.filter((x) => x.run_id === runId));
    });
    return () => {
      active = false;
    };
  }, [runId]);

  useEffect(() => {
    if (!roeDrive) return;
    let active = true;
    // Same experience source and same current-run exclusion as loadDurablePlan.
    loadExperienceServer().then((list) => {
      if (active) setRoeEntries(list.filter((x) => x.run_id !== runId));
    });
    return () => {
      active = false;
    };
  }, [roeDrive, runId]);

  useEffect(() => {
    if (!durableOn) return;
    let active = true;
    // ?reuse=<run id> (from the Domains dropdown) tries that verified run's sequence first, behind the same
    // replay vet; any failure falls back to the best durable plan, then the built-in sequence.
    resolveDurableSource(goal.permitted_actions, runId, successThreshold(goal.success_condition), reuseId).then((r) => {
      if (!active) return;
      setVet(r.vet);
      setPlan(r.plan);
      setReuse(r.reuse);
    });
    return () => {
      active = false;
    };
  }, [durableOn, goal.permitted_actions, goal.success_condition, runId, reuseId]);

  useEffect(() => {
    let active = true;
    async function load() {
      const serverRec = await loadServerRecord(runId).catch(() => null);
      if (!active) return;
      if (serverRec) {
        setRec({ actions: [], e0: E0, ...serverRec });
        setRecovered(true);
        return;
      }
      const saved = loadCheckpoint(runId);
      if (!active) return;
      if (saved?.rec && saved.rec.goal_id === DEMO_GOAL.id) {
        setRec({ actions: [], e0: E0, ...saved.rec });
        setRecovered(true);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [runId]);

  const applied = (rec.actions ?? []) as YAction[];
  const nextY = (plan ? nextFromPlan(plan, applied.length) : nextFromExperience(applied)) as YAction;
  const roePick = roeDrive && roeEntries
    ? roeNextAction(roeEntries, { lambda: roeLambda, mu: roeMu, applied: applied.length, safe_order: true, applied_actions: applied }).step_aware.selected
    : null;
  const roeY = (roePick ?? nextY) as YAction;
  const threshold = successThreshold(goal.success_condition);
  const cold = applied.length > 0 ? coldBaseline(applied.length) : null;
  const deltaE = rec.e0 != null && rec.last_e != null ? rec.e0 - rec.last_e : null;
  const phi = cold != null && rec.last_e != null ? cold - rec.last_e : null;

  async function step() {
    if (busy) return;
    setBusy(true);
    try {
      const y = roeDrive ? roeY : nextY;
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
        saveCheckpoint(blocked, runId);
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
        roeDrive
          ? async () => ({ y: roeY as string, source: roePick ? "roe_step_aware" : "roe_fallback" })
          : plan
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
        ...(roeDrive
          ? { selector: "roe_step_aware" as const, roe_lambda: roeLambda, roe_mu: roeMu, roe_fallback: roePick == null }
          : {}),
      });
      setTensor(tcheck);
      if (roeDrive) {
        const label = selectorLabel({ selector: "roe_step_aware", roe_lambda: roeLambda, roe_mu: roeMu, roe_fallback: roePick == null });
        if (label) {
          const row = { iteration: next.iteration, y, label };
          setSelRows((rows) => [...rows.filter((r) => r.iteration !== row.iteration), row].sort((a, b) => a.iteration - b.iteration));
        }
      }

      markApplied(actionKey);
      setRec(next);
      saveCheckpoint(next, runId);
      await saveServerRecord(runId, next).catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    if (busy || resetting) return;
    if (!window.confirm("Start a fresh run? This deletes the current controller record and checkpoint. Verified experience remains linked to the old run.")) return;

    setResetting(true);
    setResetError(null);
    try {
      clearCheckpoint(runId);
      clearSeen(runId);
      await clearServerRecord(runId);
      const nextRunId = newRunId();
      try {
        window.sessionStorage.setItem("aethel-active-run-id", nextRunId);
      } catch {
        setResetError("A fresh run started, but this browser could not remember it for future visits.");
      }
      const params = new URLSearchParams(searchParams.toString());
      params.set("run", nextRunId);
      setRunId(nextRunId);
      router.replace(`/workbench/autonomous?${params.toString()}`);
      setRec(INITIAL);
      setTensor(null);
      setSelRows([]);
      setRunEntries([]);
      setRoeEntries(null);
      setPlan(null);
      setVet(null);
      setRecovered(false);
    } catch {
      setResetError("Could not finish resetting this run. Its server record may still be recoverable; please try again.");
    } finally {
      setResetting(false);
    }
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

      {(roeDrive || selRows.length > 0) && (
        <p data-roe-badge className="inline-block rounded-full border border-emerald-800 px-3 py-1 font-mono text-xs text-emerald-400">
          <a
            data-roe-badge-link
            href="/api/level4/benchmark"
            title="λ: cost weight, μ: risk weight in the step-aware objective; safe_order: taken actions drop off and seal_pack waits for request_independent_check. Opens the read-only cold-vs-reuse benchmark."
            className="hover:underline"
          >
            {roeDrive
              ? `ROE selector active · step-aware · λ ${roeLambda} · μ ${roeMu} · safe_order on`
              : "ROE selector used on this run"}
          </a>
        </p>
      )}

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

      {reuseId && (
        <p data-reuse-status className="text-xs text-zinc-500">
          {!durableOn
            ? `Reuse of ${reuseId} ignored: the durable feed is disabled with ?durable=0.`
            : reuse
              ? reuse.status === "applied"
                ? `Reuse: sequence from verified run ${reuse.requested} injected (${reuse.reason}).`
                : `Reuse of ${reuse.requested} not applied: ${reuse.reason}. Fell back to the default source below.`
              : `Reuse: checking run ${reuseId}…`}
        </p>
      )}

      <p className="text-xs text-zinc-500">
        {!durableOn
          ? "Source: built-in approved sequence (durable feed disabled with ?durable=0)."
          : plan
            ? `Source: durable run ${plan.run_id} (Φ ${plan.phi}, e ${plan.e}; ${plan.candidates} eligible COMPLETE candidate(s); replay e ${vet?.replay_e?.toFixed(3)} ≤ built-in ${vet?.builtin_e.toFixed(3)}).`
            : vet
              ? `Source: built-in approved sequence (durable feed fell back: ${vet.reason}).`
              : "Source: checking durable experience…"}
      </p>

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
          disabled={busy || resetting || rec.state === "COMPLETE" || rec.state === "BLOCKED"}
          className="h-10 rounded-full bg-emerald-600 px-5 text-sm text-white disabled:opacity-40"
        >
          {busy ? "Working…" : "Advance loop"}
        </button>
        <button
          onClick={reset}
          disabled={busy || resetting}
          className="h-10 rounded-full border border-zinc-700 px-5 text-sm disabled:opacity-40"
        >
          {resetting ? "Starting fresh run…" : "Start fresh run"}
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
      {resetError && <p role="alert" className="text-sm text-red-400">{resetError}</p>}

      <section className="space-y-1 rounded-xl border border-zinc-800 p-4 text-xs font-mono text-zinc-300">
        {rec.history.length === 0 ? (
          <p className="text-zinc-500">No steps yet.</p>
        ) : (
          (() => {
            let stepN = 0;
            return rec.history.map((h, i) => {
              const sid = h.note.startsWith("verified result recorded") ? `step-${++stepN}` : undefined;
              return (
                <div key={i} id={sid}>
                  {h.at.slice(11, 19)} · {h.state} — {h.note}
                </div>
              );
            });
          })()
        )}
      </section>

      {selRows.length > 0 && (
        <section className="space-y-1 rounded-xl border border-zinc-800 p-4 text-xs text-zinc-400">
          <p className="text-zinc-500">Selector per step (steps not listed: existing planner)</p>
          {selRows.map((r) => (
            <div key={r.iteration} className="font-mono">
              step {r.iteration} · {r.y} — {r.label}
            </div>
          ))}
        </section>
      )}

      {(roeDrive || selRows.length > 0) && (() => {
        const last = [...runEntries].sort((a, b) => Number(a.iteration) - Number(b.iteration)).pop();
        if (!last) return <p data-roe-it className="font-mono text-xs text-zinc-500">I_t: no steps yet</p>;
        const r = roeForEntry(last);
        const failed = r.G ? "" : ` (${r.gates.tensor === false ? "tensor" : "gate"} failed)`;
        return (
          <>
          <p data-roe-it className="font-mono text-xs text-zinc-400">
            <a
              href={`#step-${String(last.iteration)}`}
              className="hover:underline"
              title="Scroll to this step in the log"
              onClick={(ev) => {
                const el = document.getElementById(`step-${String(last.iteration)}`);
                if (!el) return;
                ev.preventDefault();
                el.scrollIntoView({ behavior: "smooth", block: "center" });
                el.classList.add("bg-emerald-900/40");
                window.setTimeout(() => el.classList.remove("bg-emerald-900/40"), 1500);
              }}
            >
              I_t (step {String(last.iteration)} · {String(last.y)}): {r.I === null ? "n/a" : Number(r.I.toFixed(3))} · G {r.G ? "pass" : "fail"}{failed}
            </a>
          </p>
          {typeof last.phi === "number" && typeof last.delta_e === "number" && (
            <p data-roe-phi className="font-mono text-xs text-zinc-400">
              Φ {Number(last.phi.toFixed(3))} · Δe {Number(last.delta_e.toFixed(3))}
              {typeof last.e === "number" && typeof last.cold_e === "number"
                ? ` · e ${Number(last.e.toFixed(3))} vs cold ${Number(last.cold_e.toFixed(3))}`
                : ""}
            </p>
          )}
          </>
        );
      })()}

      <p className="text-xs text-zinc-500">
        <a href={`/api/level4/run?id=${encodeURIComponent(runId)}`} className="underline" target="_blank" rel="noreferrer">
          Inspect server record
        </a>
      </p>
    </main>
  );
}

export default function AutonomousClient() {
  return (
    <Level4Shell>
      <Suspense fallback={<div className="p-6 text-zinc-400">Loading run…</div>}>
        <AutonomousInner />
      </Suspense>
    </Level4Shell>
  );
}
