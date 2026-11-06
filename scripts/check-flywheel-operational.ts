/** Offline temporary evidence ONLY. No remote calls, deployed writes or plant execution. */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import type { ExperienceRecord } from "../src/core/interfaces";
import { HFMemory, retrieveEligible } from "../src/core/hf-memory";
import { emitTrainingRecord } from "../src/lib/huggingface";
import { readOperationalState, SelfFromHF, computeBFromHF } from "../src/lib/hf-outcome-adapter";
import { Self, computeB, yFromAsset, delta, type OutcomeTransition } from "../src/lib/outcomes";
import { GET as getSelf, POST as postSelf } from "../src/app/api/self/route";
import { POST as postAB } from "../src/app/api/ab/route";
import { POST as postMemory } from "../src/app/api/memory/route";

async function main() {
  const root = mkdtempSync(join(tmpdir(), "aethel-hf-operational-"));
  const prior = process.env.AETHEL_HF_MEMORY_ROOT;
  const priorWriteToken = process.env.LEVEL4_WRITE_TOKEN;
  process.env.AETHEL_HF_MEMORY_ROOT = root;
  // Use the existing write gate's explicit test credential, never a real account credential.
  process.env.LEVEL4_WRITE_TOKEN = "offline-check-only";
  const originalLog = console.log;
  const logs: string[] = [];
  console.log = (...args) => { logs.push(args.join(" ")); originalLog(...args); };
  const fixture: ExperienceRecord = {
    experience_id: "operational-run-1", repo: "offline/check", commit_sha: "fixture-only",
    goal: "Use previously verified evidence for next-action advice", baseline: "error=1",
    action: "Inspect an observed boundary", predicted_outcome: "error=0.5", observed_outcome: "error=0.4",
    delta_e: 0.6, metrics: { error: 0.4 }, verification: { replay_verdict: "PASS", verifier_version: "offline-check-only" },
    metamorphic: { seed: 42, transformation: "bounded perturbation", expected_relation: "anchor preserved", result: "PASS", converged: true },
    provenance: { source: "external-observation-fixture", run_id: "operational-run-1", timestamp: "2026-11-06T20:00:00Z" },
    reuse_eligibility: true, z_next_action: "Review the observed boundary before the next measurement", revision: 1,
  };
  const request = (path: string, body: unknown, auth = false) => new NextRequest(`http://localhost${path}`, {
    method: "POST", headers: { "Content-Type": "application/json", ...(auth ? { Authorization: "Bearer offline-check-only" } : {}) },
    body: JSON.stringify(body),
  });
  try {
    const memory = new HFMemory();
    const fallback = readOperationalState([]);
    assert.equal(fallback.memory_source, "local-outcome-fallback");
    assert.deepEqual(fallback.self, Self([]));
    assert.deepEqual(fallback.computed_b, computeB([]));
    const before = yFromAsset("new");
    const after = yFromAsset("settled");
    const localRows: OutcomeTransition[] = [{ measurement_id: "local-1", asset_id: "asset-1", action: "OBSERVE",
      vertical: "check", agent: "Agent A · offline fixture", simulated: false, y_before: before, y_after: after,
      delta_y: delta(before, after), transition_class: "positive", confidence: 1, causal_confidence: 0.2,
      measurement_window: "offline", baseline: "fixture", timestamp: fixture.provenance.timestamp }];
    const localFallback = readOperationalState(localRows);
    assert.deepEqual(localFallback.self, Self(localRows));
    assert.deepEqual(localFallback.computed_b, computeB(localRows));
    const legacy = await emitTrainingRecord({ clusterId: "text-1", domain: "check", input: "unverified input" });
    assert.equal(legacy.backend, "local-hf-memory");
    assert.equal(legacy.record.verification.replay_verdict, "SKIP");
    assert.equal(legacy.record.reuse_eligibility, false);
    assert.deepEqual(retrieveEligible(), []);
    assert.equal((await postMemory(request("/api/memory", { kind: "training", record: {} }))).status, 401);
    const textReply = await postMemory(request("/api/memory", {
      kind: "training", record: { ...fixture, clusterId: "text-2", domain: "check", input: "do not self-certify PASS" },
    }, true));
    assert.equal(textReply.status, 200);
    const textPayload = await textReply.json();
    assert.equal(textPayload.record.reuse_eligibility, false);
    assert.equal(textPayload.record.verification.replay_verdict, "SKIP");
    console.log("PASS real text emitter and active /api/memory training entrypoint persist SKIP, never fabricate eligibility; write gate retained");

    const saved = await emitTrainingRecord(fixture);
    assert.equal(saved.record.provenance.source, "training-emitter/external-observation-fixture");
    assert.equal(saved.retrieved_for_next_action, true);
    assert.equal(saved.proposal.experience_id, fixture.experience_id);
    assert.deepEqual(memory.readExperience(fixture.experience_id), { ok: true, value: saved.record });
    assert.equal(retrieveEligible()[0].experience_id, fixture.experience_id);
    assert.equal(SelfFromHF([]).z, fixture.z_next_action);
    const computed = computeBFromHF([]);
    assert.equal(computed.z, fixture.z_next_action);
    assert.equal(computed.e, computeB([]).e);
    assert.equal(computed.action, computeB([]).action); // Advice must not fabricate settlement or bypass local gates.
    assert.match(computed.source, /HF next-action advice operational-run-1/);
    assert.equal(SelfFromHF(localRows).yA, 1);
    assert.equal(SelfFromHF(localRows).z, fixture.z_next_action);
    assert.equal(computeBFromHF(localRows).action, computeB(localRows).action);
    for (const [id, overrides] of [
      ["failed", { verification: { replay_verdict: "FAIL", verifier_version: "check" } }],
      ["synthetic", { provenance: { ...fixture.provenance, source: "synthetic-simulator" } }],
      ["unconverged", { metamorphic: { ...fixture.metamorphic, converged: false } }],
    ] as const) {
      const rejected = await emitTrainingRecord({ ...fixture, experience_id: id, delta_e: 100, ...overrides });
      assert.equal(rejected.record.reuse_eligibility, false);
    }
    await assert.rejects(() => emitTrainingRecord(fixture), /Append-only/);
    const faulty = new HFMemory(mkdtempSync(join(root, "fault-")), () => "{}");
    await assert.rejects(() => emitTrainingRecord({ ...fixture, experience_id: "readback-failure" }, faulty), /read-back/);
    assert.ok(logs.some((line) => line.includes("read-back=operational-run-1") && line.includes("retrieved_for_next_action=true")));
    console.log("PASS emitter → append-only write → hash-verified read-back → retrieveEligible → Self/computeB server adapters; failed/synthetic/unconverged rejected");

    for (const response of [await getSelf(), await postSelf(request("/api/self", { outcomes: [] })),
      await postAB(request("/api/ab", { actor: "A", action: "PROPOSE", outcomes: [] }))]) {
      assert.equal(response.status, 200);
      const payload = await response.json();
      assert.equal(payload.memory_source, "hf-memory");
      assert.equal(payload.self.z, fixture.z_next_action);
      assert.equal(payload.computed_b.z, fixture.z_next_action);
      assert.equal(payload.proposal.experience_id, fixture.experience_id);
    }
    console.log("PASS active /api/self GET+POST and /api/ab POST use emitted HF record, not only local outcomes");
    const path = join(root, "founder-z/experiences/operational-run-1.json");
    writeFileSync(path, readFileSync(path, "utf8").replace("error=0.4", "tampered"));
    const originalError = console.error;
    let corruptFallback;
    try { console.error = () => {}; corruptFallback = readOperationalState([]); } finally { console.error = originalError; }
    assert.equal(corruptFallback.memory_source, "local-outcome-fallback");
    assert.equal(corruptFallback.memory_error, "HF memory unavailable");
    assert.deepEqual(corruptFallback.self, Self([]));
    assert.deepEqual(corruptFallback.computed_b, computeB([]));
    console.log("PASS empty/corrupt HF memory preserves local outcome fallback and does not claim a successful retrieval");
  } finally {
    console.log = originalLog;
    if (prior === undefined) delete process.env.AETHEL_HF_MEMORY_ROOT; else process.env.AETHEL_HF_MEMORY_ROOT = prior;
    if (priorWriteToken === undefined) delete process.env.LEVEL4_WRITE_TOKEN; else process.env.LEVEL4_WRITE_TOKEN = priorWriteToken;
    rmSync(root, { recursive: true, force: true });
  }
}
void main().catch((error) => { console.error(error); process.exitCode = 1; });
