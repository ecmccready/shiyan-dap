/** Offline check: append-only experience store persistence and integrity. Run: npx tsx scripts/check-experience-store.ts */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HFMemory } from "../src/core/hf-memory";
import type { ExperienceRecord } from "../src/core/experience-schema";
import { ExperienceAppendError, ExperienceIntegrityError, ExperienceStore,
  isDurableExperienceStore, resolveExperienceStoreRoot } from "../src/core/experience-store";

const fixture = (id: string, overrides: Partial<ExperienceRecord> = {}): ExperienceRecord => ({
  experience_id: id, repo: "offline/check", commit_sha: "check-only", goal: "Persist experience",
  baseline: "error=1", action: "append", predicted_outcome: "error=0.5", observed_outcome: "error=0.4",
  delta_e: 0.6, metrics: { error: 0.4 }, verification: { replay_verdict: "PASS", verifier_version: "store-check" },
  metamorphic: { seed: 1, transformation: "none", expected_relation: "identity", result: "PASS", converged: true },
  provenance: { source: "offline-check", run_id: id, timestamp: "2026-11-08T20:00:00Z" },
  reuse_eligibility: false, z_next_action: "continue", revision: 1, ...overrides,
});

if (process.argv[2] === "--read") {
  // Child process: a fresh process and store instance reading what the parent wrote.
  const record = new ExperienceStore(new HFMemory(process.argv[3])).readById(process.argv[4]);
  process.stdout.write(JSON.stringify(record));
  process.exit(0);
}

const root = mkdtempSync(join(tmpdir(), "aethel-experience-store-"));
try {
  const base = join(root, "founder-z");
  const store = new ExperienceStore(new HFMemory(root));
  const run1 = fixture("run-1");
  assert.deepEqual(store.append(run1), run1);

  // Persisted read from a new instance and a new process.
  assert.deepEqual(new ExperienceStore(new HFMemory(root)).readById("run-1"), run1);
  const child = execFileSync(process.execPath, [...process.execArgv, process.argv[1], "--read", root, "run-1"], { encoding: "utf8" });
  assert.deepEqual(JSON.parse(child), run1);

  // Proof file holds the sha256 of the record.
  const proof = JSON.parse(readFileSync(join(base, "proofs", "run-1.json"), "utf8"));
  assert.match(proof.sha256, /^[0-9a-f]{64}$/);

  // Append-only: duplicate id (same or different content) is refused and original is untouched.
  assert.throws(() => store.append(run1), ExperienceAppendError);
  assert.throws(() => store.append(fixture("run-1", { delta_e: 9 })), /Append-only/);
  assert.equal(store.readById("run-1").delta_e, 0.6);

  // Invalid input and unknown/unsafe ids.
  assert.throws(() => store.append({ ...run1, experience_id: "../escape" }), ExperienceAppendError);
  assert.throws(() => store.readById("missing"), ExperienceIntegrityError);
  assert.throws(() => store.readById("../etc"), /Invalid experience_id/);

  // Tamper rejection: edit the record on disk without updating its hash.
  store.append(fixture("run-2"));
  const path = join(base, "experiences", "run-2.json");
  writeFileSync(path, JSON.stringify({ ...JSON.parse(readFileSync(path, "utf8")), delta_e: 0.99 }, null, 2));
  assert.throws(() => new ExperienceStore(new HFMemory(root)).readById("run-2"), ExperienceIntegrityError);
  assert.throws(() => store.list(), ExperienceIntegrityError);

  // Tampered proof hash is also rejected.
  const proofPath = join(base, "proofs", "run-1.json");
  writeFileSync(proofPath, JSON.stringify({ ...proof, sha256: "0".repeat(64) }));
  assert.throws(() => store.readById("run-1"), /proof validation failed/);

  // Backend selection is honest about durability.
  assert.equal(resolveExperienceStoreRoot({ VERCEL: "1" }), "/tmp/aethel-hf-memory");
  assert.equal(isDurableExperienceStore({ VERCEL: "1" }), false);
  assert.equal(resolveExperienceStoreRoot({ AETHEL_HF_MEMORY_ROOT: "/data/x" }), "/data/x");
  assert.equal(isDurableExperienceStore({}), true);
  console.log("experience-store: PASS");
} finally {
  rmSync(root, { recursive: true, force: true });
}
