/** TEST ONLY. Proves SHIYAN_STORAGE_DIAGNOSTICS logs nothing when unset,
 *  and only operation/code/class (never message text or URLs) when set to "1".
 *  Run: npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-storage-diagnostics.ts
 */
import assert from "node:assert/strict";
import type { Pool } from "pg";
import { NeonReferenceEnvelopes } from "../src/core/neon-reference-store";
import { NeonRecoveryRecorder } from "../src/core/neon-recovery-recorder";
import { NeonExperienceStore } from "../src/core/neon-experience-store";
import { ExperienceStoreUnavailableError } from "../src/core/experience-store";
import { ReferenceStorageError } from "../src/core/github-reference";
import { logStorageDiagnostic } from "../src/core/storage-diagnostics";

class DatabaseError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "DatabaseError";
  }
}

const SECRET_MESSAGE = "password=supersecret postgresql://example relation does not exist db.example";

function capture<T>(fn: () => T): { value: T; lines: string[] } {
  const lines: string[] = [];
  const original = console.error;
  console.error = (message?: unknown, ...rest: unknown[]) => {
    lines.push([message, ...rest].map((part) => String(part)).join(" "));
  };
  try {
    return { value: fn(), lines };
  } finally {
    console.error = original;
  }
}

async function captureAsync<T>(fn: () => Promise<T>): Promise<{ value?: T; error?: unknown; lines: string[] }> {
  const lines: string[] = [];
  const original = console.error;
  console.error = (message?: unknown, ...rest: unknown[]) => {
    lines.push([message, ...rest].map((part) => String(part)).join(" "));
  };
  try {
    return { value: await fn(), lines };
  } catch (error) {
    return { error, lines };
  } finally {
    console.error = original;
  }
}

function assertSafe(lines: string[]): void {
  const text = lines.join("\n");
  assert.doesNotMatch(text, /supersecret/);
  assert.doesNotMatch(text, /postgresql:\/\//i);
  assert.doesNotMatch(text, /password=/i);
  assert.doesNotMatch(text, /does not exist/);
  assert.doesNotMatch(text, /db\.example/);
  assert.doesNotMatch(text, /supersecret/);
}

const error = new DatabaseError("42P01", SECRET_MESSAGE);

// Helper: unset / other values log nothing; "1" logs only code and class.
const off = capture(() => logStorageDiagnostic("envelopes.listIds", error, {}));
assert.equal(off.lines.length, 0);

const zero = capture(() => logStorageDiagnostic("envelopes.listIds", error, { SHIYAN_STORAGE_DIAGNOSTICS: "0" }));
assert.equal(zero.lines.length, 0);

const trueish = capture(() => logStorageDiagnostic("envelopes.listIds", error, { SHIYAN_STORAGE_DIAGNOSTICS: "true" }));
assert.equal(trueish.lines.length, 0);

const on = capture(() => logStorageDiagnostic("envelopes.listIds", error, { SHIYAN_STORAGE_DIAGNOSTICS: "1" }));
assert.equal(on.lines.length, 1);
assert.equal(on.lines[0], "shiyan storage diagnostics operation=envelopes.listIds code=42P01 class=DatabaseError");
assertSafe(on.lines);

async function main(): Promise<void> {
  const prior = process.env.SHIYAN_STORAGE_DIAGNOSTICS;
  const restoreEnv = () => {
    if (prior === undefined) delete process.env.SHIYAN_STORAGE_DIAGNOSTICS;
    else process.env.SHIYAN_STORAGE_DIAGNOSTICS = prior;
  };

  const failingPool = {
    query: async () => { throw new DatabaseError("42P01", SECRET_MESSAGE); },
  } as unknown as Pool;

  try {
    delete process.env.SHIYAN_STORAGE_DIAGNOSTICS;
    const envelopes = new NeonReferenceEnvelopes(failingPool);
    const unset = await captureAsync(() => envelopes.listIds("prod-a"));
    assert.ok(unset.error instanceof ReferenceStorageError);
    assert.equal((unset.error as Error).message, "Reference storage backend unavailable");
    assert.equal(unset.lines.length, 0, "guarded() must not log when the flag is unset");

    process.env.SHIYAN_STORAGE_DIAGNOSTICS = "1";
    const set = await captureAsync(() => envelopes.listIds("prod-a"));
    assert.ok(set.error instanceof ReferenceStorageError);
    assert.equal((set.error as Error).message, "Reference storage backend unavailable");
    assert.equal(set.lines.length, 1);
    assert.equal(set.lines[0], "shiyan storage diagnostics operation=envelopes.listIds code=42P01 class=DatabaseError");
    assertSafe(set.lines);

    const recorder = new NeonRecoveryRecorder(failingPool);
    const recorded = await captureAsync(() => recorder.record({
      version: "recovery-record-v1",
      tenantId: "prod-a",
      referenceId: "ref-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      runId: "run-diag",
      status: "REJECTED",
      priorPredicted: 1,
      synthesizedPredicted: null,
      anchorDelta: null,
      phiBefore: 1,
      phiAfter: null,
      phiLift: null,
      maxAnchorShiftRatio: 0.1,
      bound: 1,
      scale: 1,
      zeroAnchor: false,
      requiredDelta: 0,
      proofVerdict: null,
      recordSha256: "a".repeat(64),
      prevRecordSha256: null,
      createdAt: "2026-11-14T00:00:00Z",
    }));
    assert.deepEqual(recorded.value, { ok: false, error: "Anchors storage backend unavailable" });
    assert.equal(recorded.lines.length, 1);
    assert.equal(recorded.lines[0], "shiyan storage diagnostics operation=recovery.record code=42P01 class=DatabaseError");
    assertSafe(recorded.lines);

    const store = new NeonExperienceStore("prod-a", failingPool);
    const read = await captureAsync(() => store.readById("exp-1"));
    assert.ok(read.error instanceof ExperienceStoreUnavailableError);
    assert.equal(read.lines.length, 1);
    assert.equal(read.lines[0], "shiyan storage diagnostics operation=experiences.readById code=42P01 class=DatabaseError");
    assertSafe(read.lines);

    delete process.env.SHIYAN_STORAGE_DIAGNOSTICS;
    const silentRead = await captureAsync(() => store.readById("exp-1"));
    assert.ok(silentRead.error instanceof ExperienceStoreUnavailableError);
    assert.equal(silentRead.lines.length, 0);
  } finally {
    restoreEnv();
  }

  console.log("check-storage-diagnostics: PASS");
}

main().catch((error) => { console.error(error); process.exit(1); });
