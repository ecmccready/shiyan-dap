/** TEST ONLY. Offline check for bounded reconcile() and the 002 recovery_records migration.
 * Fixtures and in-memory recorders only; never connects to a database.
 * Run: npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-reconcile.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ANCHORS_NOT_CONFIGURED,
  MAX_ANCHOR_SHIFT_RATIO,
  anchorBound,
  canonical,
  createMemoryRecoveryRecorder,
  disabledRecoveryRecorder,
  reconcile,
  sha256Canonical,
  type EvaluateDeterministicProof,
  type ReconcileInput,
  type ReconcileProof,
} from "../src/core/reconcile";
import { configuredRecoveryRecorder } from "../src/core/neon-recovery-recorder";
import { evaluateDeterministicProof } from "../src/core/deterministic-proof";

const root = join(import.meta.dirname, "..");
const clock = () => new Date("2026-01-01T00:00:00.000Z");

function scripted(steps: ReconcileProof[]): EvaluateDeterministicProof {
  let i = 0;
  return () => {
    const next = steps[i] ?? steps[steps.length - 1];
    i += 1;
    if (!next) throw new Error("scripted proof exhausted");
    return next;
  };
}

const pass: ReconcileProof = { verdict: "PASS", phiAfter: 1.25 };
const fail: ReconcileProof = { verdict: "FAIL", phiAfter: 1 };

const within: ReconcileInput = {
  tenantId: "tenant-a",
  runId: "run-anchors-test",
  referenceId: "ref-0123456789abcdef0123456789abcdef",
  priorPredicted: 10,
  observed: 8.5,
  currentAnchor: 10,
  phiBefore: 1,
  seed: 42,
};

async function main() {
  // --- within-bound clean PASS => PROMOTED, one record, all four fields ---
  const promotedStore = createMemoryRecoveryRecorder();
  const promoted = await reconcile(within, {
    evaluateDeterministicProof: scripted([fail, pass]),
    recorder: promotedStore,
    clock,
  });
  assert.equal(promoted.ok, true);
  assert.equal(promoted.promoted, true);
  assert.equal(promoted.status, "PROMOTED");
  assert.equal(promoted.priorPredicted, 10);
  assert.equal(promoted.synthesizedPredicted, 8.5);
  assert.equal(promoted.anchorDelta, -1.5);
  assert.equal(promoted.phiLift, 0.25);
  assert.equal(promoted.proofVerdict, "PASS");
  assert.equal(promotedStore.rows.length, 1);
  const written = promotedStore.rows[0];
  assert.equal(written.status, "PROMOTED");
  assert.equal(written.priorPredicted, 10);
  assert.equal(written.synthesizedPredicted, 8.5);
  assert.equal(written.anchorDelta, -1.5);
  assert.equal(written.phiLift, 0.25);
  assert.equal(written.maxAnchorShiftRatio, MAX_ANCHOR_SHIFT_RATIO);
  assert.equal(written.recordSha256, promoted.recordSha256);
  assert.equal(written.recordSha256.length, 64);
  assert.ok(Math.abs(written.anchorDelta as number) <= 0.25 * Math.abs(written.priorPredicted));

  // --- exceeds 0.25 => DRIFT_EXCEEDED, record written, no promotion ---
  const driftStore = createMemoryRecoveryRecorder();
  const drift = await reconcile({ ...within, observed: 0 }, {
    evaluateDeterministicProof: scripted([fail]),
    recorder: driftStore,
    clock,
  });
  assert.equal(drift.ok, true);
  assert.equal(drift.promoted, false);
  assert.equal(drift.status, "DRIFT_EXCEEDED");
  assert.equal(drift.anchorDelta, -10);
  assert.ok(Math.abs(drift.anchorDelta as number) > 0.25 * Math.abs(drift.priorPredicted));
  assert.equal(driftStore.rows.length, 1);
  assert.equal(driftStore.rows[0].status, "DRIFT_EXCEEDED");
  assert.equal(drift.phiLift, 0);

  // --- replay not PASS => REJECTED ---
  const rejectedStore = createMemoryRecoveryRecorder();
  const rejected = await reconcile(within, {
    evaluateDeterministicProof: scripted([fail, { verdict: "FAIL", phiAfter: 0.5 }]),
    recorder: rejectedStore,
    clock,
  });
  assert.equal(rejected.ok, true);
  assert.equal(rejected.promoted, false);
  assert.equal(rejected.status, "REJECTED");
  assert.equal(rejected.proofVerdict, "FAIL");
  assert.equal(rejected.synthesizedPredicted, 8.5);
  assert.equal(rejected.phiLift, -0.5);
  assert.equal(rejectedStore.rows.length, 1);
  assert.equal(rejectedStore.rows[0].status, "REJECTED");

  const inconclusive = await reconcile(within, {
    evaluateDeterministicProof: scripted([fail, { verdict: "INCONCLUSIVE", phiAfter: 1 }]),
    recorder: createMemoryRecoveryRecorder(),
    clock,
  });
  assert.equal(inconclusive.status, "REJECTED");
  assert.equal(inconclusive.promoted, false);

  const alreadyPass = await reconcile(within, {
    evaluateDeterministicProof: scripted([pass, pass]),
    recorder: createMemoryRecoveryRecorder(),
    clock,
  });
  assert.equal(alreadyPass.status, "REJECTED");
  assert.equal(alreadyPass.promoted, false);

  // --- bound math: exact 0.25 edge is legal; just over is not ---
  const edgeEnv = anchorBound(10, 7.5, 0.25);
  assert.equal(edgeEnv.scale, 10);
  assert.equal(edgeEnv.bound, 2.5);
  assert.equal(Math.abs(7.5 - 10), edgeEnv.bound);
  const edgeStore = createMemoryRecoveryRecorder();
  const edge = await reconcile({ ...within, observed: 7.5 }, {
    evaluateDeterministicProof: scripted([fail, { verdict: "PASS", phiAfter: 1.1 }]),
    recorder: edgeStore,
    clock,
  });
  assert.equal(edge.status, "PROMOTED");
  assert.equal(edge.promoted, true);
  assert.equal(edge.anchorDelta, -2.5);
  assert.equal(edge.synthesizedPredicted, 7.5);
  assert.equal(Math.abs(edge.anchorDelta as number), 0.25 * Math.abs(edge.priorPredicted as number));

  const over = await reconcile({ ...within, observed: 7 }, {
    evaluateDeterministicProof: scripted([fail]),
    recorder: createMemoryRecoveryRecorder(),
    clock,
  });
  assert.equal(over.status, "DRIFT_EXCEEDED");
  assert.equal(over.promoted, false);
  assert.equal(over.anchorDelta, -3);
  assert.ok(Math.abs(over.anchorDelta as number) > 2.5);

  const zeroEnv = anchorBound(0, 1, 0.25);
  assert.equal(zeroEnv.zeroAnchor, true);
  assert.equal(zeroEnv.scale, 0);
  assert.equal(zeroEnv.bound, 0);
  const zeroOver = await reconcile({ ...within, priorPredicted: 0, currentAnchor: 0, observed: 1, phiBefore: 1 }, {
    evaluateDeterministicProof: scripted([fail]),
    recorder: createMemoryRecoveryRecorder(),
    clock,
  });
  assert.equal(zeroOver.status, "DRIFT_EXCEEDED");
  assert.equal(zeroOver.promoted, false);
  // A zero anchor has bound 0, so even a 0.25 target exceeds the cap.
  const zeroEdge = await reconcile({ ...within, priorPredicted: 0, currentAnchor: 0, observed: 0.25, phiBefore: 1 }, {
    evaluateDeterministicProof: scripted([fail]),
    recorder: createMemoryRecoveryRecorder(),
    clock,
  });
  assert.equal(zeroEdge.status, "DRIFT_EXCEEDED");
  assert.equal(zeroEdge.promoted, false);
  const bothZero = anchorBound(0, 0, 0.25);
  assert.equal(bothZero.bound, 0);
  assert.equal(bothZero.scale, 0);
  const zeroStay = await reconcile({ ...within, priorPredicted: 0, currentAnchor: 0, observed: 0, phiBefore: 1 }, {
    evaluateDeterministicProof: scripted([fail, { verdict: "PASS", phiAfter: 1.05 }]),
    recorder: createMemoryRecoveryRecorder(),
    clock,
  });
  assert.equal(zeroStay.status, "PROMOTED");
  assert.equal(zeroStay.anchorDelta, 0);

  // --- record hash is deterministic ---
  const hashStore = createMemoryRecoveryRecorder();
  const first = await reconcile({ ...within, prevRecordSha256: null }, {
    evaluateDeterministicProof: scripted([fail, pass]),
    recorder: hashStore,
    clock,
  });
  const second = await reconcile({ ...within, prevRecordSha256: null }, {
    evaluateDeterministicProof: scripted([fail, pass]),
    recorder: hashStore,
    clock,
  });
  assert.equal(first.recordSha256, second.recordSha256);
  assert.equal(first.recordSha256, sha256Canonical((() => {
    const { recordSha256: _ignored, ...rest } = first.record!;
    return rest;
  })()));
  assert.equal(canonical(first.record), canonical(second.record));
  assert.equal(hashStore.rows.length, 2);

  // Existing evaluateDeterministicProof fits the injected signature.
  const real = await reconcile({ ...within, observed: 10, priorPredicted: 10, currentAnchor: 10 }, {
    evaluateDeterministicProof,
    recorder: createMemoryRecoveryRecorder(),
    clock,
  });
  assert.equal(real.ok, true);
  assert.equal(real.promoted, false);
  assert.equal(real.status, "REJECTED");
  assert.equal(real.proofVerdict, "PASS");

  // --- recorder unavailable: explicit error, no secrets in the result ---
  const secret = "postgresql://shiyan_anchor:super-secret-password@ep-holy-violet.example/neondb?sslmode=require";
  const disabled = await reconcile(within, {
    evaluateDeterministicProof: scripted([fail, pass]),
    recorder: disabledRecoveryRecorder(),
    clock,
  });
  assert.equal(disabled.ok, false);
  assert.equal(disabled.promoted, false);
  assert.equal(disabled.status, "PROMOTED");
  assert.equal(disabled.error, ANCHORS_NOT_CONFIGURED);
  assert.doesNotMatch(JSON.stringify(disabled), /super-secret-password|postgresql:\/\//i);

  const throwing = await reconcile(within, {
    evaluateDeterministicProof: scripted([fail, pass]),
    recorder: { async record() { throw new Error(`connect failed: ${secret}`); } },
    clock,
  });
  assert.equal(throwing.ok, false);
  assert.equal(throwing.error, "Recovery recorder failed");
  assert.doesNotMatch(JSON.stringify(throwing), /super-secret-password/);
  assert.doesNotMatch(throwing.error ?? "", /postgresql:\/\//i);

  const unconfigured = configuredRecoveryRecorder({ SHIYAN_ANCHOR_URL: undefined, SHIYAN_ANCHOR_DATABASE_URL: undefined });
  const missing = await reconcile(within, {
    evaluateDeterministicProof: scripted([fail, pass]),
    recorder: unconfigured,
    clock,
  });
  assert.equal(missing.ok, false);
  assert.equal(missing.error, ANCHORS_NOT_CONFIGURED);

  const badUrl = configuredRecoveryRecorder({ SHIYAN_ANCHOR_URL: secret.replace("?sslmode=require", "") });
  const fromBadUrl = await reconcile(within, {
    evaluateDeterministicProof: scripted([fail, pass]),
    recorder: badUrl,
    clock,
  });
  assert.equal(fromBadUrl.ok, false);
  assert.equal(fromBadUrl.error, ANCHORS_NOT_CONFIGURED);
  assert.doesNotMatch(JSON.stringify(fromBadUrl), /super-secret-password/);

  const storageOnly = configuredRecoveryRecorder({
    SHIYAN_STORAGE_URL: "postgresql://shiyan_app:storage-secret@ep-storage.example/neondb?sslmode=require",
  });
  const fromStorageOnly = await reconcile(within, {
    evaluateDeterministicProof: scripted([fail, pass]),
    recorder: storageOnly,
    clock,
  });
  assert.equal(fromStorageOnly.ok, false);
  assert.equal(fromStorageOnly.error, ANCHORS_NOT_CONFIGURED);
  assert.doesNotMatch(JSON.stringify(fromStorageOnly), /storage-secret/);

  const sameDb = configuredRecoveryRecorder({
    SHIYAN_ANCHOR_URL: secret,
    SHIYAN_STORAGE_URL: secret,
  });
  const fromSame = await reconcile(within, {
    evaluateDeterministicProof: scripted([fail, pass]),
    recorder: sameDb,
    clock,
  });
  assert.equal(fromSame.ok, false);
  assert.equal(fromSame.error, "Anchors storage must be an independent database");
  assert.doesNotMatch(JSON.stringify(fromSame), /super-secret-password/);

  // --- migration is additive plain SQL and does not alter/drop existing objects ---
  const sql = readFileSync(join(root, "db/migrations/002_shiyan_recovery_records.sql"), "utf8");
  assert.match(sql, /CREATE TABLE IF NOT EXISTS shiyan_anchor\.recovery_records/);
  assert.match(sql, /shiyan_anchor\.reject_mutation/);
  assert.match(sql, /GRANT SELECT, INSERT ON shiyan_anchor\.recovery_records TO shiyan_anchor/);
  assert.match(sql, /GRANT USAGE, SELECT ON SEQUENCE shiyan_anchor\.recovery_records_id_seq TO shiyan_anchor/);
  assert.doesNotMatch(sql, /\\gset|\\if |\\endif|\\set /);
  assert.doesNotMatch(sql, /\bALTER\b/);
  assert.doesNotMatch(sql, /\bDROP\b/);
  // Trigger text on the new table may say UPDATE OR DELETE; that does not mutate existing objects.

  console.log("reconcile: PASS");
}

main().catch((error) => { console.error(error); process.exit(1); });
