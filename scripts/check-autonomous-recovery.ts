/** TEST ONLY. Offline check for bounded SelfEngine.reconcile. Fixtures never enter production stores.
 * Run: npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-autonomous-recovery.ts
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  MAX_ANCHOR_SHIFT_RATIO,
  SelfEngine,
  canonical,
  envelopeFor,
  self,
  sha256Canonical,
  synthesizeAnchorDeltas,
} from "../src/core/self-engine";
import { evaluateDeterministicProof } from "../src/core/deterministic-proof";
import { runTelemetry } from "../src/core/metamorphic-runtime";
import { ExperienceStore } from "../src/core/experience-store";
import { HFMemory } from "../src/core/hf-memory";
import { tenantRoot } from "../src/core/tenant-auth";

const noDrift = { predicted: 1, observed: 1, phi: 1, seed: 42 };
const moderate = { predicted: 10, observed: 8.5, phi: 1, seed: 42 };
const boundary = { predicted: 10, observed: 7.1, phi: 1, seed: 42 };
const severe = { predicted: 10, observed: 0, phi: 1, seed: 42 };
const historicFail = { predicted: 1, observed: 3, phi: 1, seed: 42 };

const root = mkdtempSync(join(tmpdir(), "aethel-autonomous-recovery-"));
const priorRoot = process.env.AETHEL_HF_MEMORY_ROOT;
process.env.AETHEL_HF_MEMORY_ROOT = root;
const KEY_A = "autonomous-recovery-key-aaa1";
const KEY_B = "autonomous-recovery-key-bbb2";
const priorKeys = process.env.AETHEL_TENANT_KEYS;
process.env.AETHEL_TENANT_KEYS = JSON.stringify({
  "tenant-a": createHash("sha256").update(KEY_A).digest("hex"),
  "tenant-b": createHash("sha256").update(KEY_B).digest("hex"),
});

function hashBody(body: Record<string, unknown>): string {
  const copy = { ...body };
  delete copy.experience_id;
  delete copy.hash;
  delete copy.proof_error;
  return sha256Canonical(copy);
}

async function main() {
  const { POST } = await import("../src/app/api/v1/telemetry/route");
  const post = async (body: unknown, key = KEY_A) =>
    (await POST(new Request("http://x/api/v1/telemetry", {
      method: "POST",
      headers: { authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
    }))).json() as Promise<Record<string, unknown>>;

  // --- no-drift: payload and hash are byte-identical to pre-change behavior ---
  const priorPass = runTelemetry(noDrift);
  assert.equal(priorPass.proof.verdict, "PASS");
  assert.equal(SelfEngine.reconcile(noDrift).ran, false);
  assert.equal(self.reconcile(noDrift).ran, false);
  const pass1 = await post({ ...noDrift, auto_proof: true });
  const pass2 = await post({ ...noDrift, auto_proof: true });
  assert.equal("recovery" in pass1, false);
  assert.equal("recovery" in pass2, false);
  const expectedPass: Record<string, unknown> = {
    emergentState: priorPass.emergentState,
    converged: priorPass.converged,
    frame: priorPass.frame,
    seed: priorPass.seed,
    proof: priorPass.proof,
    review_flag: null,
    note: null,
    experience_id: pass1.experience_id,
    hash: pass1.hash,
  };
  assert.equal(JSON.stringify(pass1), JSON.stringify(expectedPass));
  assert.equal(pass1.hash, sha256Canonical({
    emergentState: priorPass.emergentState,
    converged: priorPass.converged,
    frame: priorPass.frame,
    seed: priorPass.seed,
    proof: priorPass.proof,
    review_flag: null,
    note: null,
  }));
  assert.equal(pass1.hash, pass2.hash);
  assert.deepEqual(pass1.proof, pass2.proof);

  // --- moderate drift recovers to PASS with |Δ| ≤ 25% ---
  const priorModerate = runTelemetry(moderate);
  assert.equal(priorModerate.proof.verdict, "FAIL");
  const mid = self.reconcile(moderate);
  assert.equal(mid.ran, true);
  assert.equal(mid.promoted, true);
  assert.ok(mid.record && mid.telemetry);
  assert.equal(mid.record.promoted, true);
  assert.equal(mid.record.review_flag, null);
  assert.equal(mid.record.priorPredicted, 10);
  assert.equal(mid.telemetry.proof.verdict, "PASS");
  assert.equal(evaluateDeterministicProof({
    predicted: mid.record.synthesizedPredicted as number,
    observed: moderate.observed,
    phi: moderate.phi,
  }, moderate.seed).verdict, "PASS");
  assert.ok(mid.record.anchorDelta !== null);
  assert.ok(Math.abs(mid.record.anchorDelta as number) <= 0.25 * Math.abs(mid.record.priorPredicted));
  assert.ok(Math.abs(mid.record.anchorDelta as number) <= mid.record.envelope.maxShift);
  assert.equal(mid.record.envelope.maxAnchorShiftRatio, MAX_ANCHOR_SHIFT_RATIO);
  assert.ok((mid.record.phiLift as number) > 0);
  const midRes1 = await post({ ...moderate, auto_proof: true });
  const midRes2 = await post({ ...moderate, auto_proof: true });
  assert.equal((midRes1.proof as { verdict: string }).verdict, "PASS");
  assert.equal(midRes1.converged, true);
  assert.equal(midRes1.review_flag, null);
  const rec1 = midRes1.recovery as Record<string, unknown>;
  assert.equal(rec1.promoted, true);
  assert.equal(rec1.priorPredicted, 10);
  assert.equal(typeof rec1.synthesizedPredicted, "number");
  assert.equal(typeof rec1.anchorDelta, "number");
  assert.equal(typeof rec1.phiLift, "number");
  assert.ok(Math.abs(rec1.anchorDelta as number) <= 2.5);
  assert.deepEqual(midRes1.recovery, midRes2.recovery);
  assert.deepEqual(midRes1.proof, midRes2.proof);
  assert.equal(midRes1.hash, midRes2.hash);
  assert.equal(JSON.stringify(midRes1.recovery), JSON.stringify(mid.record));

  // --- exactly-at-boundary: only the full 0.25·|anchor| shift flips to PASS ---
  const edge = self.reconcile(boundary);
  assert.equal(edge.promoted, true);
  assert.ok(edge.record);
  assert.equal(edge.record.priorPredicted, 10);
  assert.equal(edge.record.synthesizedPredicted, 7.5);
  assert.equal(edge.record.anchorDelta, -2.5);
  assert.equal(Math.abs(edge.record.anchorDelta as number), 0.25 * Math.abs(edge.record.priorPredicted));
  assert.equal(edge.telemetry?.proof.verdict, "PASS");
  const edgeRes = await post({ ...boundary, auto_proof: true });
  assert.equal((edgeRes.proof as { verdict: string }).verdict, "PASS");
  assert.equal((edgeRes.recovery as { anchorDelta: number }).anchorDelta, -2.5);
  assert.equal((edgeRes.frame as { predictedValue: number }).predictedValue, 7.5);

  // --- severe drift: DRIFT_EXCEEDED, no patch promoted ---
  const bad = self.reconcile(severe);
  assert.equal(bad.ran, true);
  assert.equal(bad.promoted, false);
  assert.equal(bad.telemetry, undefined);
  assert.ok(bad.record);
  assert.equal(bad.record.promoted, false);
  assert.equal(bad.record.synthesizedPredicted, null);
  assert.equal(bad.record.anchorDelta, null);
  assert.equal(bad.record.review_flag, "DRIFT_EXCEEDED");
  assert.ok(bad.record.attempts > 0);
  for (const delta of synthesizeAnchorDeltas(10, 0, envelopeFor(10, 0).maxShift)) {
    assert.ok(Math.abs(delta) <= 2.5);
    assert.equal(evaluateDeterministicProof({ predicted: 10 + delta, observed: 0, phi: 1 }, 42).verdict, "FAIL");
  }
  const badRes = await post({ ...severe, auto_proof: true });
  assert.equal((badRes.proof as { verdict: string }).verdict, "FAIL");
  assert.equal(badRes.converged, false);
  assert.equal(badRes.review_flag, "DRIFT_EXCEEDED");
  assert.equal((badRes.recovery as { promoted: boolean }).promoted, false);
  assert.equal((badRes.recovery as { synthesizedPredicted: null }).synthesizedPredicted, null);
  const historic = await post({ ...historicFail, auto_proof: true });
  assert.equal((historic.proof as { verdict: string }).verdict, "FAIL");
  assert.equal((historic.recovery as { promoted: boolean }).promoted, false);

  // --- determinism: same input => same output and hash twice ---
  assert.deepEqual(self.reconcile(moderate), self.reconcile(moderate));
  assert.deepEqual(self.reconcile(severe), self.reconcile(severe));
  assert.deepEqual(self.reconcile(boundary), self.reconcile(boundary));
  assert.equal(mid.record!.replay_hash, self.reconcile(moderate).record!.replay_hash);
  assert.equal(typeof mid.record!.replay_hash, "string");
  assert.equal((mid.record!.replay_hash as string).length, 64);

  // --- recovery fields are in the published proof hash input ---
  assert.equal(midRes1.hash, hashBody(midRes1));
  const canonicalMid = canonical((() => {
    const copy = { ...midRes1 };
    delete copy.experience_id;
    delete copy.hash;
    return copy;
  })());
  assert.match(canonicalMid, /"priorPredicted":/);
  assert.match(canonicalMid, /"synthesizedPredicted":/);
  assert.match(canonicalMid, /"anchorDelta":/);
  assert.match(canonicalMid, /"phiLift":/);
  const stripped = { ...midRes1 };
  delete stripped.experience_id;
  delete stripped.hash;
  delete stripped.recovery;
  assert.notEqual(midRes1.hash, sha256Canonical(stripped));
  const storedMid = new ExperienceStore(new HFMemory(tenantRoot("tenant-a"))).readById(String(midRes1.experience_id));
  assert.equal(storedMid.metamorphic.result, "PASS");
  assert.equal(storedMid.tenant_id, "tenant-a");

  // --- tenant isolation still holds ---
  const aRec = await post({ ...moderate, auto_proof: true }, KEY_A);
  const bRec = await post({ ...moderate, auto_proof: true }, KEY_B);
  assert.equal(aRec.hash, bRec.hash);
  assert.notEqual(aRec.experience_id, bRec.experience_id);
  const storeA = new ExperienceStore(new HFMemory(tenantRoot("tenant-a")));
  const storeB = new ExperienceStore(new HFMemory(tenantRoot("tenant-b")));
  assert.equal(storeA.readById(String(aRec.experience_id)).tenant_id, "tenant-a");
  assert.equal(storeB.readById(String(bRec.experience_id)).tenant_id, "tenant-b");
  assert.throws(() => storeA.readById(String(bRec.experience_id)));
  assert.throws(() => storeB.readById(String(aRec.experience_id)));

  // High-phi, zero-gap drift cannot be absorbed by a toward-observed shift.
  const highPhi = self.reconcile({ predicted: 1, observed: 1, phi: 2, seed: 42 });
  assert.equal(highPhi.ran, true);
  assert.equal(highPhi.promoted, false);
  assert.equal(highPhi.record?.review_flag, "DRIFT_EXCEEDED");
  assert.equal(highPhi.record?.attempts, 0);

  // Zero-anchor envelope uses |observed| as the scale.
  const zeroEnv = envelopeFor(0, 1);
  assert.equal(zeroEnv.zeroAnchor, true);
  assert.equal(zeroEnv.scale, 1);
  assert.equal(zeroEnv.maxShift, 0.25);

  // --- core engine, runtime, and Level 4 files are unchanged ---
  execFileSync("git", [
    "diff", "--exit-code", "origin/main", "--",
    "src/core/metamorphic.ts",
    "src/core/metamorphic-runtime.ts",
    "src/lib/level4",
    "src/app/api/level4",
  ], { cwd: join(import.meta.dirname, ".."), stdio: "inherit" });

  console.log("autonomous-recovery: PASS");
}

main().finally(() => {
  if (priorKeys === undefined) delete process.env.AETHEL_TENANT_KEYS; else process.env.AETHEL_TENANT_KEYS = priorKeys;
  if (priorRoot === undefined) delete process.env.AETHEL_HF_MEMORY_ROOT; else process.env.AETHEL_HF_MEMORY_ROOT = priorRoot;
  rmSync(root, { recursive: true, force: true });
}).catch((e) => { console.error(e); process.exit(1); });
