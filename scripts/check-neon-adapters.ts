// TEST ONLY: exercises the Neon/Postgres adapters against a DISPOSABLE database pair.
// Writes test-only fixture rows under random "test-only-*" tenants. The tables are append-only,
// so these rows can never be deleted: use a throwaway Neon branch (or local PostgreSQL) only.
// Never point this at staging data you want to keep, and never at production.
//
//   SHIYAN_TEST_DB_DISPOSABLE=1 \
//   SHIYAN_TEST_STORAGE_URL='postgresql://shiyan_app:...@127.0.0.1/db?sslmode=disable' \
//   SHIYAN_TEST_ANCHOR_URL='postgresql://shiyan_anchor_app:...@127.0.0.1/db2?sslmode=disable' \
//   npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-neon-adapters.ts
//
// SHIYAN_TEST_DATABASE_URL and SHIYAN_TEST_ANCHOR_DATABASE_URL are accepted only if the
// documented test names above are unset. The app is configured with SHIYAN_STORAGE_URL
// and SHIYAN_ANCHOR_URL (the committed Preview names).
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";

const h = (s: string) => createHash("sha256").update(s).digest("hex");
const pick = (documented: string, fallback: string) => {
  const a = process.env[documented];
  const b = process.env[fallback];
  if (a && a.trim()) return a.trim();
  if (b && b.trim()) return b.trim();
  return undefined;
};

async function main() {
  assert.equal(process.env.SHIYAN_TEST_DB_DISPOSABLE, "1", "Set SHIYAN_TEST_DB_DISPOSABLE=1 to confirm both databases are throwaway");
  const storageUrl = pick("SHIYAN_TEST_STORAGE_URL", "SHIYAN_TEST_DATABASE_URL");
  const anchorUrl = pick("SHIYAN_TEST_ANCHOR_URL", "SHIYAN_TEST_ANCHOR_DATABASE_URL");
  assert.ok(storageUrl && anchorUrl, "SHIYAN_TEST_STORAGE_URL and SHIYAN_TEST_ANCHOR_URL are required (legacy SHIYAN_TEST_DATABASE_URL / SHIYAN_TEST_ANCHOR_DATABASE_URL accepted only as fallbacks)");
  assert.ok(!process.env.VERCEL, "Refusing to run on Vercel");

  const KA = randomBytes(24).toString("hex");
  const KB = randomBytes(24).toString("hex");
  const suffix = randomBytes(4).toString("hex");
  const A = `test-only-a-${suffix}`;
  const B = `test-only-b-${suffix}`;
  const REPO = "test-only-owner/test-only-repo";
  // Configure the app with the documented Preview names, before importing routes.
  Object.assign(process.env, {
    SHIYAN_STORAGE_BACKEND: "neon",
    SHIYAN_STORAGE_URL: storageUrl,
    SHIYAN_ANCHOR_URL: anchorUrl,
    AETHEL_TENANT_KEYS: JSON.stringify({ [A]: h(KA), [B]: h(KB) }),
    AETHEL_GITHUB_REPOS: JSON.stringify({ [REPO]: A }),
  });
  delete process.env.AETHEL_GITHUB_TOKEN;
  delete process.env.SHIYAN_DATABASE_URL;
  delete process.env.SHIYAN_ANCHOR_DATABASE_URL;

  const { checkDatabaseUrl, poolFor } = await import("../src/core/neon-db");
  const provider = await import("../src/core/reference-anchor-provider");
  const { configuredExperienceStore, resolveStorageBackend, resolvedStorageUrl, resolvedAnchorUrl } = await import("../src/core/storage-provider");
  const gh = await import("../src/core/github-reference");
  const runs = await import("../src/app/api/v1/runs/route");
  const one = await import("../src/app/api/v1/runs/[id]/route");
  const customer = await import("../src/app/api/v1/customer-proof/[id]/route");
  const telemetry = await import("../src/app/api/v1/telemetry/route");
  const { experienceDigest } = await import("../src/core/hf-memory");

  // Provider selection and fail-closed behaviour, using documented names.
  assert.equal(resolveStorageBackend(process.env).kind, "neon");
  assert.equal(resolvedStorageUrl(process.env), storageUrl);
  assert.equal(resolvedAnchorUrl(process.env), anchorUrl);
  assert.equal(resolveStorageBackend({ VERCEL: "1" }).kind, "unconfigured");
  assert.equal(resolveStorageBackend({ VERCEL: "1", VERCEL_ENV: "production", SHIYAN_STORAGE_BACKEND: "filesystem" }).kind, "unconfigured");
  assert.equal(resolveStorageBackend({ SHIYAN_STORAGE_URL: storageUrl }).kind, "unconfigured");
  assert.equal(resolveStorageBackend({ SHIYAN_STORAGE_BACKEND: "neon" }).kind, "unconfigured");
  assert.equal(resolveStorageBackend({ SHIYAN_STORAGE_BACKEND: "bogus" }).kind, "unconfigured");
  assert.equal(resolveStorageBackend({}).kind, "filesystem");
  assert.equal(checkDatabaseUrl("postgresql://u:p@db.example/neondb").ok, false, "sslmode is mandatory");
  assert.equal(checkDatabaseUrl("postgresql://u:p@localhost/db?sslmode=disable", { VERCEL: "1" }).ok, false);
  assert.ok(provider.configuredReferenceStorage(process.env));
  assert.equal(provider.configuredReferenceAnchors({ ...process.env, SHIYAN_ANCHOR_URL: storageUrl }), undefined, "same database is not independent");
  assert.equal(provider.configuredReferenceAnchors({ ...process.env, SHIYAN_ANCHOR_URL: undefined, SHIYAN_ANCHOR_DATABASE_URL: undefined }), undefined);
  assert.equal(provider.configuredReferenceAnchors({ ...process.env, SHIYAN_STORAGE_BACKEND: "filesystem" }), undefined);
  const unconfigured = configuredExperienceStore(A, { VERCEL: "1" });
  assert.equal(unconfigured.ok, false);
  assert.ok(!JSON.stringify(unconfigured).includes(String(storageUrl)));
  assert.ok(!JSON.stringify(unconfigured).includes(String(anchorUrl)));

  // Legacy *_DATABASE_URL names are fallbacks only; documented names win.
  const decoyStorage = "postgresql://decoy:decoy@127.0.0.1/decoy?sslmode=disable";
  const decoyAnchor = storageUrl; // would fail the independence check if it won
  assert.equal(resolvedStorageUrl({ SHIYAN_STORAGE_URL: storageUrl, SHIYAN_DATABASE_URL: decoyStorage }), storageUrl);
  assert.equal(resolvedAnchorUrl({ SHIYAN_ANCHOR_URL: anchorUrl, SHIYAN_ANCHOR_DATABASE_URL: decoyAnchor }), anchorUrl);
  const viaFallback = resolveStorageBackend({ SHIYAN_STORAGE_BACKEND: "neon", SHIYAN_DATABASE_URL: storageUrl });
  assert.equal(viaFallback.kind, "neon");
  if (viaFallback.kind === "neon") {
    const documented = resolveStorageBackend({ SHIYAN_STORAGE_BACKEND: "neon", SHIYAN_STORAGE_URL: storageUrl });
    assert.equal(documented.kind, "neon");
    if (documented.kind === "neon") assert.deepEqual(viaFallback.database.identity, documented.database.identity);
  }
  const documentedWins = resolveStorageBackend({
    SHIYAN_STORAGE_BACKEND: "neon",
    SHIYAN_STORAGE_URL: storageUrl,
    SHIYAN_DATABASE_URL: "postgresql://u:p@example.invalid/neondb", // invalid (no sslmode); must not be used
  });
  assert.equal(documentedWins.kind, "neon");
  const invalidDocumented = resolveStorageBackend({
    SHIYAN_STORAGE_BACKEND: "neon",
    SHIYAN_STORAGE_URL: "postgresql://u:p@example.invalid/neondb",
    SHIYAN_DATABASE_URL: storageUrl,
  });
  assert.equal(invalidDocumented.kind, "unconfigured", "invalid documented URL must not fall back");
  const fallbackAnchors = provider.configuredReferenceStorage({
    ...process.env,
    SHIYAN_STORAGE_URL: undefined,
    SHIYAN_ANCHOR_URL: undefined,
    SHIYAN_DATABASE_URL: storageUrl,
    SHIYAN_ANCHOR_DATABASE_URL: anchorUrl,
  });
  assert.ok(fallbackAnchors, "legacy fallback names alone must still configure reference storage");
  const documentedAnchorWins = provider.configuredReferenceStorage({
    ...process.env,
    SHIYAN_STORAGE_URL: storageUrl,
    SHIYAN_ANCHOR_URL: anchorUrl,
    SHIYAN_DATABASE_URL: decoyStorage,
    SHIYAN_ANCHOR_DATABASE_URL: decoyAnchor,
  });
  assert.ok(documentedAnchorWins, "documented SHIYAN_ANCHOR_URL must win over a conflicting fallback");

  const json = async (r: Response) => ({ status: r.status, body: await r.json() as Record<string, unknown> });
  const auth = (k: string) => ({ authorization: `Bearer ${k}` });
  const run = (o: Record<string, unknown> = {}) => ({
    contract_version: "aethel.run/1", run_id: "test-only-run", workbench: { name: "test-only-workbench", version: "test-only" },
    goal: "Test fixture only", action: "Test fixture only", predicted: 1, observed: 1, seed: 42, ...o,
  });
  const submit = (k: string, body: unknown) => runs.POST(new Request("http://test.invalid/api/v1/runs", { method: "POST", headers: auth(k), body: JSON.stringify(body) })).then(json);
  const verify = (k: string, id: string) => one.GET(new Request(`http://test.invalid/api/v1/runs/${id}`, { headers: auth(k) }), { params: Promise.resolve({ id }) }).then(json);
  const exportReport = (k: string, id: string) => customer.GET(new Request(`http://test.invalid/api/v1/customer-proof/${id}`, { headers: auth(k) }), { params: Promise.resolve({ id }) }).then(json);

  // Runs through the real routes on Postgres.
  const a = await submit(KA, run());
  assert.equal(a.status, 201, JSON.stringify(a.body));
  const aId = String(a.body.experience_id);
  const [dupes, b] = await Promise.all([Promise.all(Array.from({ length: 4 }, () => submit(KA, run()))), submit(KB, run({ observed: 3 }))]);
  assert.deepEqual(dupes.map((d) => d.status), [409, 409, 409, 409]);
  assert.equal(b.status, 201);
  const race = await Promise.all(Array.from({ length: 4 }, () => submit(KA, run({ run_id: "test-only-race" }))));
  assert.deepEqual(race.map((r) => r.status).sort(), [201, 409, 409, 409]);
  const va = await verify(KA, aId);
  assert.equal(va.status, 200);
  const v = va.body.verification as Record<string, unknown>;
  assert.equal(v.integrity, "PASS");
  assert.equal(v.consistent, true);
  assert.equal(experienceDigest(va.body.experience as never), v.content_sha256);
  const cross = await verify(KB, aId);
  const unknown = await verify(KB, "wb-" + "f".repeat(32));
  assert.equal(cross.status, 404);
  assert.deepEqual({ ...cross.body, experience_id: null }, { ...unknown.body, experience_id: null });
  assert.equal((await exportReport(KA, aId)).status, 200);
  assert.equal((await exportReport(KB, aId)).status, 404);
  assert.equal((await verify(KB, String(b.body.experience_id))).status, 200);

  // Promoted-recovery telemetry auto_proof lands in shiyan.experiences with recovery fields and matching sha256.
  const tel = await json(await telemetry.POST(new Request("http://test.invalid/api/v1/telemetry", {
    method: "POST",
    headers: { ...auth(KA), "content-type": "application/json" },
    body: JSON.stringify({ predicted: 10, observed: 8.5, phi: 1, seed: 42, auto_proof: true }),
  })));
  assert.equal(tel.status, 200, JSON.stringify(tel.body));
  assert.equal((tel.body.proof as { verdict?: string } | undefined)?.verdict, "PASS");
  assert.equal(tel.body.converged, true);
  const recovery = tel.body.recovery as Record<string, unknown>;
  assert.equal(recovery.promoted, true);
  assert.equal(recovery.priorPredicted, 10);
  assert.equal(typeof recovery.synthesizedPredicted, "number");
  assert.equal(typeof recovery.anchorDelta, "number");
  assert.equal(typeof recovery.phiLift, "number");
  assert.ok(Math.abs(recovery.anchorDelta as number) <= 2.5);
  const telId = String(tel.body.experience_id);
  assert.match(telId, /^telemetry-/);
  assert.match(String(tel.body.hash), /^[0-9a-f]{64}$/);

  // Database-enforced append-only and least privilege.
  const storage = checkDatabaseUrl(storageUrl);
  const anchorsDb = checkDatabaseUrl(anchorUrl);
  assert.ok(storage.ok && anchorsDb.ok);
  const sp = poolFor("storage", storage.value);
  const ap = poolFor("anchors", anchorsDb.value);
  const storedTel = await sp.query<{ record_json: string; content_sha256: string; tenant_id: string; experience_id: string }>(
    "SELECT tenant_id, experience_id, record_json, content_sha256 FROM shiyan.experiences WHERE tenant_id = $1 AND experience_id = $2",
    [A, telId],
  );
  assert.equal(storedTel.rowCount, 1);
  const telRow = storedTel.rows[0];
  assert.equal(telRow.tenant_id, A);
  assert.equal(telRow.experience_id, telId);
  assert.equal(h(telRow.record_json), telRow.content_sha256);
  const telRecord = JSON.parse(telRow.record_json) as Record<string, unknown>;
  const storedRecovery = telRecord.recovery as Record<string, unknown>;
  assert.equal(storedRecovery.promoted, true);
  assert.equal(storedRecovery.priorPredicted, 10);
  assert.equal(storedRecovery.synthesizedPredicted, recovery.synthesizedPredicted);
  assert.equal(storedRecovery.anchorDelta, recovery.anchorDelta);
  assert.equal(storedRecovery.phiLift, recovery.phiLift);
  assert.equal(experienceDigest(telRecord as never), telRow.content_sha256);
  assert.equal((telRecord.provenance as { run_id: string }).run_id, tel.body.hash);
  await assert.rejects(sp.query("UPDATE shiyan.experiences SET record_json = record_json WHERE tenant_id = $1 AND experience_id = $2", [A, telId]), /permission denied|not permitted/);
  await assert.rejects(sp.query("DELETE FROM shiyan.experiences WHERE tenant_id = $1 AND experience_id = $2", [A, telId]), /permission denied|not permitted/);
  await assert.rejects(sp.query("UPDATE shiyan.experiences SET record_json = record_json WHERE tenant_id = $1", [A]), /permission denied|not permitted/);
  await assert.rejects(sp.query("DELETE FROM shiyan.experiences WHERE tenant_id = $1", [A]), /permission denied|not permitted/);
  await assert.rejects(sp.query("TRUNCATE shiyan.experiences"), /permission denied|not permitted/);
  await assert.rejects(sp.query(
    "INSERT INTO shiyan.experiences (tenant_id, experience_id, record_json, content_sha256, proof_timestamp) VALUES ($1, 'test-only-bad', '{}', $2, now())",
    [A, "0".repeat(64)]), /check constraint/);
  await assert.rejects(ap.query("UPDATE shiyan_anchor.reference_anchors SET repo = repo"), /permission denied|not permitted/);
  await assert.rejects(ap.query("DELETE FROM shiyan_anchor.reference_anchors"), /permission denied|not permitted/);
  await assert.rejects(sp.query("SELECT 1 FROM shiyan_anchor.reference_anchors LIMIT 1"), /does not exist|permission denied/);
  await assert.rejects(ap.query("SELECT 1 FROM shiyan.experiences LIMIT 1"), /does not exist|permission denied/);

  // References: anchors in the anchor database, envelopes in the storage database.
  const ref = provider.configuredReferenceStorage(process.env)!;
  const commit = randomBytes(20).toString("hex");
  const snapshot = {
    version: "aethel.reference/1" as const, tenant: A, repo: REPO, ref: "main", commit_sha: commit, tree_sha: randomBytes(20).toString("hex"),
    files: [], commits: [{ sha: commit, date: "2026-01-01T00:00:00Z", message: "test-only fixture" }], contracts: [], evidence: [], excluded_paths: 0,
  };
  const saved = await Promise.all(Array.from({ length: 4 }, () => gh.saveReference(snapshot, ref.anchors, ref.envelopes)));
  assert.equal(saved.filter((s) => s.created).length, 1);
  const refId = saved[0].reference_id;
  const read = await gh.readReference(A, refId, ref.anchors, ref.envelopes);
  assert.ok(read);
  assert.equal(read.snapshot.commit_sha, commit);
  assert.equal(await gh.readReference(B, refId, ref.anchors, ref.envelopes), null);
  assert.equal((await gh.listReferences(A, ref.anchors, ref.envelopes)).length, 1);
  assert.deepEqual(await gh.listReferences(B, ref.anchors, ref.envelopes), []);

  // An anchor that disagrees with the stored envelope fails closed.
  const commit2 = randomBytes(20).toString("hex");
  const snapshot2 = { ...snapshot, commit_sha: commit2, commits: [{ ...snapshot.commits[0], sha: commit2 }] };
  const id2 = gh.referenceId(snapshot2);
  await ref.anchors.createIfAbsent({
    anchor_version: "aethel.reference-anchor/1", envelope_format: "aethel.reference-envelope/1",
    tenant: A, reference_id: id2, repo: REPO, commit_sha: commit2, snapshot_sha256: "1".repeat(64), envelope_sha256: "2".repeat(64),
  });
  await assert.rejects(gh.saveReference(snapshot2, ref.anchors, ref.envelopes));
  await assert.rejects(gh.readReference(A, id2, ref.anchors, ref.envelopes), /incomplete/);
  await assert.rejects(gh.listReferences(A, ref.anchors, ref.envelopes));

  // Route wiring: anchors configured, so the request reaches the GitHub step (no token here).
  const refs = await import("../src/app/api/v1/references/route");
  const post = await json(await refs.POST(new Request("http://test.invalid/api/v1/references", { method: "POST", headers: auth(KA), body: JSON.stringify({ repo: REPO }) })));
  assert.equal(post.status, 503);
  assert.equal(post.body.code, "GITHUB_NOT_CONFIGURED");

  await sp.end();
  await ap.end();
  console.log(`neon-adapters: PASS (test-only tenants ${A}, ${B} on a disposable database)`);
  console.log("NOT covered: Neon-specific networking/pooler, production configuration, crash durability, real customer runs, TLS to Neon");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
