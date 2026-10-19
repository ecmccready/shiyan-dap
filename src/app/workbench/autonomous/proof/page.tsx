"use client";

import { useEffect, useState } from "react";
import type { GoalContract } from "@/lib/level4/goal";
import type { ControllerRecord } from "@/lib/level4/controller";
import { autonomousStep } from "@/lib/level4/loop";
import { saveCheckpoint, loadCheckpoint, clearCheckpoint } from "@/lib/level4/checkpoint";
import { precheckAction } from "@/lib/level4/precheck";
import { measureActions } from "@/lib/level4/measured";

// Browser-safe proposer: SelfFromApproved reads @vercel/kv, which cannot run client-side.
const holdProposer = async () => ({ y: "hold" });
import Level4Shell from "@/components/Level4Shell";
import RunEndpoints from "@/components/RunEndpoints";
import VerifyVerdict from "@/components/VerifyVerdict";
import CopyVerifySummary from "@/components/CopyVerifySummary";
import ShareSection from "@/components/ShareSection";
import { loadExperienceServer, latestVerified } from "@/lib/level4/experience-client";

const DEMO_GOAL: GoalContract = {
  id: "goal_proof",
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

export default function ProofPage() {
  const [log, setLog] = useState<string[]>([]);
  const [passed, setPassed] = useState<boolean | null>(null);
  const [shareRunId, setShareRunId] = useState<string | null>(null);
  useEffect(() => {
    loadExperienceServer()
      .then((list) => { const l = latestVerified(list); setShareRunId(l?.eligible ? l.run_id : null); })
      .catch(() => setShareRunId(null));
  }, []);

  function add(msg: string) {
    setLog((l) => [...l, `${new Date().toISOString().slice(11, 19)} · ${msg}`]);
  }

  async function runProof() {
    setLog([]);
    setPassed(null);
    clearCheckpoint();
    add("cleared prior checkpoint");

    let rec = INITIAL;
    add("started fresh run");

    // step once and checkpoint
    rec = await autonomousStep(DEMO_GOAL, rec, "client_demo", "safety_v1", "model_3", "hold", 0, holdProposer);
    saveCheckpoint(rec);
    add(`stepped to iteration ${rec.iteration}, state ${rec.state}, checkpoint saved`);

    // simulate restart
    const loaded = loadCheckpoint();
    if (!loaded?.rec) {
      add("FAIL: no checkpoint recovered");
      setPassed(false);
      return;
    }
    add("recovered checkpoint after simulated restart");

    // continue from recovered state
    rec = await autonomousStep(DEMO_GOAL, loaded.rec, "client_demo", "safety_v1", "model_3", "hold", 0, holdProposer);
    add(`continued to iteration ${rec.iteration}, state ${rec.state}`);

    const gate = precheckAction(DEMO_GOAL, rec, "hold", 0);
    add(gate.ok ? "precheck passed on recovered state" : `precheck blocked: ${gate.reason}`);

    const ok =
      rec.iteration > loaded.rec.iteration &&
      rec.state !== "BLOCKED" &&
      rec.history.length > loaded.rec.history.length &&
      gate.ok;

    const m = measureActions(["mark_boundary", "complete_field", "request_independent_check", "seal_pack"]);
    add(`core plant (reuse sequence): e ${m.e0} → ${m.e}, Δe ${m.delta_e}`);

    add(ok ? "PASS: recovery preserved progress and allowed continuation" : "FAIL: recovery did not advance cleanly");
    setPassed(ok);
  }

  return (
    <Level4Shell>
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <h1 className="text-xl font-semibold">Level 4 — End-to-end recovery proof</h1>
      <p className="text-sm text-zinc-400">
        Steps once, checkpoints, simulates restart, recovers, continues, and re-checks the pre-action gate.
      </p>
      <button
        onClick={runProof}
        className="rounded-full bg-emerald-600 px-4 py-2 text-sm text-white"
      >
        Run recovery proof
      </button>
      {passed !== null && (
        <p className={`text-sm font-medium ${passed ? "text-emerald-400" : "text-red-400"}`}>
          {passed ? "PASS" : "FAIL"}
        </p>
      )}
      <section className="space-y-1 text-xs font-mono">
        {log.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </section>
      <VerifyVerdict />
      <CopyVerifySummary />
      <ShareSection runId={shareRunId} />
      <RunEndpoints variant="inline" />
      <RunEndpoints />
    </main>
    </Level4Shell>
  );
}