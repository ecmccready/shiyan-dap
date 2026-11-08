/** Offline check: fixed seed + fixed inputs => same deterministic metamorphic verdict. Run: npx tsx scripts/check-deterministic-proof.ts */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { evaluateDeterministicProof, seededDrifts } from "../src/core/deterministic-proof";
import { runTelemetry } from "../src/core/metamorphic-runtime";
import { ExperienceStore } from "../src/core/experience-store";
import { HFMemory } from "../src/core/hf-memory";

const pass = { predicted: 1, observed: 1, phi: 1 };      // gap 0: |Δphi| = phi*|drift| < 0.05
const fail = { predicted: 1, observed: 3, phi: 1 };      // gap 2: |Δphi| ≈ 0.2 > 0.05

if (process.argv[2] === "--child") {
  process.stdout.write(JSON.stringify(evaluateDeterministicProof(JSON.parse(process.argv[3]), Number(process.argv[4]))));
  process.exit(0);
}

const root = mkdtempSync(join(tmpdir(), "aethel-det-proof-"));
const priorRoot = process.env.AETHEL_HF_MEMORY_ROOT;
process.env.AETHEL_HF_MEMORY_ROOT = root;
async function main() {
  // Stable transformations: same seed => same drifts; different seed => different drifts; bounded.
  assert.deepEqual(seededDrifts(42), seededDrifts(42));
  assert.notDeepEqual(seededDrifts(42), seededDrifts(43));
  assert.ok(seededDrifts(7, 1000).every((d) => Math.abs(d) <= 0.05));
  const golden = seededDrifts(42, 3);

  // Repeated runs and a separate process give identical results.
  const a = evaluateDeterministicProof(pass, 42);
  for (let i = 0; i < 20; i++) assert.deepEqual(evaluateDeterministicProof(pass, 42), a);
  const child = execFileSync(process.execPath, [...process.execArgv, process.argv[1], "--child", JSON.stringify(pass), "42"], { encoding: "utf8" });
  assert.deepEqual(JSON.parse(child), a);
  assert.deepEqual(seededDrifts(42, 3), golden);

  // Deterministic PASS / FAIL / INCONCLUSIVE.
  assert.equal(a.verdict, "PASS");
  assert.equal(a.transformations.length, 8);
  assert.equal(evaluateDeterministicProof(fail, 42).verdict, "FAIL");
  assert.deepEqual(evaluateDeterministicProof(fail, 42), evaluateDeterministicProof(fail, 42));
  for (const seed of [undefined, -1, 1.5, 2 ** 32, "42", NaN]) assert.equal(evaluateDeterministicProof(pass, seed).verdict, "INCONCLUSIVE");
  assert.equal(evaluateDeterministicProof({ predicted: NaN, observed: 1 }, 42).verdict, "INCONCLUSIVE");

  // Input immutability.
  const frozen = Object.freeze({ ...pass });
  evaluateDeterministicProof(frozen, 42);
  assert.deepEqual(frozen, pass);

  // Real flow: runTelemetry and the telemetry route.
  const r1 = runTelemetry({ ...pass, seed: 42 }), r2 = runTelemetry({ ...pass, seed: 42 });
  assert.deepEqual(r1, r2);
  assert.equal(r1.converged, true);
  assert.equal(runTelemetry({ ...fail, seed: 42 }).converged, false);
  assert.equal(runTelemetry(pass).proof.verdict, "INCONCLUSIVE");

  const { POST } = await import("../src/app/api/v1/telemetry/route");
  const post = async (body: unknown) => (await POST(new Request("http://x/api/v1/telemetry", { method: "POST", body: JSON.stringify(body) }))).json();
  const res1 = await post({ ...pass, seed: 42, auto_proof: true });
  const res2 = await post({ ...pass, seed: 42, auto_proof: true });
  assert.equal(res1.proof.verdict, "PASS");
  assert.deepEqual(res1.proof, res2.proof);
  assert.equal(res1.proof_error, undefined);

  // Recorded metadata persists and integrity-verifies from a fresh store instance.
  const rec = new ExperienceStore(new HFMemory(root)).readById(res1.experience_id);
  assert.equal(rec.metamorphic.seed, 42);
  assert.equal(rec.metamorphic.result, "PASS");
  assert.equal(rec.metamorphic.converged, true);
  assert.match(rec.metamorphic.expected_relation, /anchor.*phi-stability/);
  assert.deepEqual(JSON.parse(rec.metamorphic.transformation).transformations, a.transformations);
  assert.equal(rec.verification.verifier_version, "deterministic-proof-v1");
  const failRes = await post({ ...fail, seed: 42, auto_proof: true });
  assert.equal(new ExperienceStore(new HFMemory(root)).readById(failRes.experience_id).metamorphic.result, "FAIL");

  // A forged verdict submitted to the proof path is recomputed, not trusted.
  const { publishProof } = await import("../src/core/proof-publisher");
  const forged = publishProof({ converged: true, proof: { ...evaluateDeterministicProof(fail, 42), verdict: "PASS" } });
  assert.equal(new ExperienceStore(new HFMemory(root)).readById(forged.experience_id).metamorphic.result, "FAIL");
  console.log("deterministic-proof: PASS");
}
main().finally(() => {
  if (priorRoot === undefined) delete process.env.AETHEL_HF_MEMORY_ROOT; else process.env.AETHEL_HF_MEMORY_ROOT = priorRoot;
  rmSync(root, { recursive: true, force: true });
}).catch((e) => { console.error(e); process.exit(1); });
