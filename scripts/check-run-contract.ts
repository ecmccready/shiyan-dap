/**
 * Third-party view of the executable platform contract: only the public route handlers are used
 * (POST /api/v1/runs, GET /api/v1/runs/{id}); disk edits simulate tampering. Run: npx tsx scripts/check-run-contract.ts
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = mkdtempSync(join(tmpdir(), "aethel-run-contract-"));
const prior = process.env.AETHEL_HF_MEMORY_ROOT;
process.env.AETHEL_HF_MEMORY_ROOT = root;
const V = "aethel.run/1";
const run = (overrides: Record<string, unknown> = {}) => ({ contract_version: V, run_id: "run-001",
  workbench: { name: "acme-workbench", version: "0.3.1" }, goal: "Keep prediction within tolerance",
  action: "calibrate sensor", predicted: 1, observed: 1, seed: 42, phi: 1, ...overrides });

async function main() {
  const runs = await import("../src/app/api/v1/runs/route");
  const one = await import("../src/app/api/v1/runs/[id]/route");
  const submit = async (body: unknown, raw = false) => {
    const r = await runs.POST(new Request("http://x/api/v1/runs", { method: "POST", body: raw ? String(body) : JSON.stringify(body) }));
    return { status: r.status, body: await r.json() };
  };
  const verify = async (id: string) => {
    const r = await one.GET(new Request(`http://x/api/v1/runs/${id}`), { params: Promise.resolve({ id }) });
    return { status: r.status, body: await r.json() };
  };

  // Contract description.
  const doc = await (await runs.GET()).json();
  assert.equal(doc.contract_version, V);
  assert.equal((await submit(doc.request_example)).status, 201);

  // Standard PASS run: submit then verify.
  const a = await submit(run({ run_id: "pass-1" }));
  assert.equal(a.status, 201);
  assert.match(a.body.experience_id, /^wb-[0-9a-f]{32}$/);
  assert.equal(a.body.verification.verdict, "PASS");
  assert.equal(a.body.metamorphic.seed, 42);
  assert.equal(a.body.metamorphic.transformations.length, 8);
  assert.equal(a.body.next_action.executable, false);
  assert.equal(a.body.experience.reuse_eligibility, false);
  const v = await verify(a.body.experience_id);
  assert.equal(v.status, 200);
  assert.equal(v.body.verification.integrity, "PASS");
  assert.equal(v.body.verification.consistent, true);
  assert.equal(v.body.verification.recomputed_verdict, "PASS");
  assert.deepEqual(v.body.metamorphic.transformations, a.body.metamorphic.transformations);
  assert.match(v.body.verification.content_sha256, /^[0-9a-f]{64}$/);

  // Deterministic: same seed + inputs under another run_id give the same verdict and transformations.
  const a2 = await submit(run({ run_id: "pass-2" }));
  assert.deepEqual(a2.body.metamorphic.transformations, a.body.metamorphic.transformations);
  const f = await submit(run({ run_id: "fail-1", observed: 3 }));
  assert.equal(f.body.verification.verdict, "FAIL");
  assert.equal(f.body.experience.verification.replay_verdict, "FAIL");
  assert.equal((await verify(f.body.experience_id)).body.verification.verdict, "FAIL");

  // Duplicates are append-only.
  const dup = await submit(run({ run_id: "pass-1", observed: 3 }));
  assert.equal(dup.status, 409);
  assert.equal(dup.body.code, "DUPLICATE_RUN");
  assert.equal(dup.body.experience_id, a.body.experience_id);
  assert.equal((await verify(a.body.experience_id)).body.verification.verdict, "PASS");

  // Schema rejection, including forged verdicts and hashes.
  for (const bad of [
    run({ verdict: "PASS" }), run({ verification: { replay_verdict: "PASS" } }), run({ hash: "0".repeat(64) }),
    run({ metamorphic: { result: "PASS" } }), run({ contract_version: "aethel.run/0" }), run({ seed: 1.5 }),
    run({ seed: undefined }), run({ predicted: "1" }), run({ run_id: "../x" }), run({ workbench: { name: "a" } }),
    run({ goal: "" }), [], null,
  ]) {
    const r = await submit(bad);
    assert.equal(r.status, 400, JSON.stringify(bad));
    assert.equal(r.body.code, "INVALID_SUBMISSION");
  }
  assert.equal((await submit("{not json", true)).body.code, "INVALID_JSON");

  // ID errors.
  assert.equal((await verify("../etc")).body.code, "INVALID_ID");
  assert.equal((await verify("wb-" + "0".repeat(32))).status, 404);

  // Tamper: edit the stored record without updating its hash -> 422.
  const base = join(root, "founder-z");
  const recPath = (id: string) => join(base, "experiences", `${id}.json`);
  const t = JSON.parse(readFileSync(recPath(f.body.experience_id), "utf8"));
  writeFileSync(recPath(f.body.experience_id), JSON.stringify({ ...t, metamorphic: { ...t.metamorphic, result: "PASS" } }));
  const tv = await verify(f.body.experience_id);
  assert.equal(tv.status, 422);
  assert.equal(tv.body.code, "INTEGRITY_FAILED");

  // Forged verdict with a re-computed hash passes integrity but fails recomputation.
  const id2 = a2.body.experience_id;
  const r2 = JSON.parse(readFileSync(recPath(id2), "utf8"));
  const forged = { ...r2, observed_outcome: "3", metamorphic: { ...r2.metamorphic,
    transformation: JSON.stringify({ ...JSON.parse(r2.metamorphic.transformation), inputs: { predicted: 1, observed: 3, phi: 1, step: 0 } }) } };
  writeFileSync(recPath(id2), JSON.stringify(forged));
  const canon = (x: unknown): string => Array.isArray(x) ? `[${x.map(canon).join(",")}]` : x !== null && typeof x === "object"
    ? `{${Object.keys(x).filter((k) => (x as Record<string, unknown>)[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canon((x as Record<string, unknown>)[k])}`).join(",")}}` : JSON.stringify(x);
  const proofPath = join(base, "proofs", `${id2}.json`);
  writeFileSync(proofPath, JSON.stringify({ ...JSON.parse(readFileSync(proofPath, "utf8")), sha256: createHash("sha256").update(canon(forged)).digest("hex") }));
  const fv = await verify(id2);
  assert.equal(fv.status, 200);
  assert.equal(fv.body.verification.stored_verdict, "PASS");
  assert.equal(fv.body.verification.recomputed_verdict, "FAIL");
  assert.equal(fv.body.verification.consistent, false);
  assert.equal(fv.body.verification.verdict, "FAIL");
  console.log("run-contract: PASS");
}
main().finally(() => {
  if (prior === undefined) delete process.env.AETHEL_HF_MEMORY_ROOT; else process.env.AETHEL_HF_MEMORY_ROOT = prior;
  rmSync(root, { recursive: true, force: true });
}).catch((e) => { console.error(e); process.exit(1); });
