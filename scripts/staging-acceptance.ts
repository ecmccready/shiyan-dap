// STAGING acceptance for Neon-backed storage, tenant boundary, customer-proof export and references.
// Talks only to the deployed app over HTTPS; it never connects to a database directly.
//
// Creates REAL tenant records in STAGING ONLY: the run comes from --run-file, a genuine
// aethel.run/1 submission from your workbench. The script never invents run data.
//
// Usage:
//   create mode:  npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/staging-acceptance.ts --run-file ./my-run.json
//   verify mode:  npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/staging-acceptance.ts --verify-existing wb-<32 hex> [--expect-sha256 <64 hex>]
//
// Env (never hardcode keys; never printed):
//   STAGING_BASE_URL               https://<staging deployment>       (required)
//   STAGING_TENANT_A_KEY           tenant A API key                   (required)
//   STAGING_TENANT_B_KEY           tenant B API key (different tenant) (required)
//   STAGING_EXPECT_ANCHORS         "1" if staging has SHIYAN_ANCHOR_URL configured, else "0" (required)
//   STAGING_REFERENCE_REPO         owner/repo allowlisted for tenant A  (optional; reference checks skipped if unset)
//   STAGING_REFERENCE_REF          branch/tag/sha                      (optional, default main)
//   STAGING_REFERENCE_ID           ref-<32 hex> to re-read in --verify-existing mode (optional)
//   STAGING_VERCEL_BYPASS_SECRET   Vercel Deployment Protection bypass  (optional)
//   SHIYAN_PRODUCTION_HOSTS        comma-separated production hostnames to refuse (optional, recommended)
//
// Production guard: a base URL that does not look like staging/preview/localhost, or that is listed in
// SHIYAN_PRODUCTION_HOSTS, is refused. With --i-understand-this-is-production the script runs READ-ONLY
// (--verify-existing only); it never submits a run or connects a reference in production.
// --verify-existing mode is read-only everywhere (GET requests only).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { experienceDigest } from "../src/core/hf-memory";
import type { ExperienceRecord } from "../src/core/experience-schema";

type Json = Record<string, unknown>;
type Result = { name: string; status: "PASS" | "FAIL" | "SKIPPED"; detail?: string };

const results: Result[] = [];
const ID = /^wb-[0-9a-f]{32}$/;
const SHA = /^[0-9a-f]{64}$/;

function args(argv: string[]) {
  const out: { runFile?: string; verifyExisting?: string; expectSha?: string; production: boolean } = { production: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (!v || v.startsWith("--")) throw new Error(`${a} requires a value`);
      return v;
    };
    if (a === "--run-file") out.runFile = next();
    else if (a === "--verify-existing") out.verifyExisting = next();
    else if (a === "--expect-sha256") out.expectSha = next();
    else if (a === "--i-understand-this-is-production") out.production = true;
    else throw new Error(`Unknown argument: ${a}`);
  }
  if (!!out.runFile === !!out.verifyExisting) throw new Error("Pass exactly one of --run-file <path> or --verify-existing <experience_id>");
  if (out.verifyExisting && !ID.test(out.verifyExisting)) throw new Error("--verify-existing must be wb- followed by 32 hex characters");
  if (out.expectSha && (!SHA.test(out.expectSha) || !out.verifyExisting)) throw new Error("--expect-sha256 needs 64 hex and --verify-existing");
  return out;
}

function required(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) throw new Error(`${name} is required`);
  return v.trim();
}

function looksLikeStaging(host: string): boolean {
  return host === "localhost" || host === "127.0.0.1" || /(^|[-.])(staging|preview)([.-]|$)/.test(host) || /-git-[a-z0-9-]+\.vercel\.app$/.test(host) || (/^shiyan-[a-z0-9]+-ecmccreadys-projects\.vercel\.app$/.test(host) && host !== "shiyan-dap-ecmccreadys-projects.vercel.app");
}

async function main() {
  const opts = args(process.argv.slice(2));
  const base = new URL(required("STAGING_BASE_URL"));
  if (base.protocol !== "https:" && !(base.protocol === "http:" && ["localhost", "127.0.0.1"].includes(base.hostname))) {
    throw new Error("STAGING_BASE_URL must be https (http only for localhost)");
  }
  const host = base.hostname.toLowerCase();
  const productionHosts = (process.env.SHIYAN_PRODUCTION_HOSTS ?? "").split(",").map((h) => h.trim().toLowerCase()).filter(Boolean);
  const isProduction = productionHosts.includes(host) || !looksLikeStaging(host);
  if (isProduction && !opts.production) {
    throw new Error(`Refusing ${host}: it does not look like staging/preview. Use a staging URL, or pass --i-understand-this-is-production for a read-only --verify-existing check.`);
  }
  if (isProduction && !opts.verifyExisting) {
    throw new Error("Production mode is read-only: only --verify-existing is allowed; this script never writes to production.");
  }
  const keyA = required("STAGING_TENANT_A_KEY");
  const keyB = required("STAGING_TENANT_B_KEY");
  if (keyA === keyB) throw new Error("STAGING_TENANT_A_KEY and STAGING_TENANT_B_KEY must be different tenants");
  const expectAnchors = required("STAGING_EXPECT_ANCHORS");
  if (expectAnchors !== "0" && expectAnchors !== "1") throw new Error("STAGING_EXPECT_ANCHORS must be 0 or 1");
  const bypass = process.env.STAGING_VERCEL_BYPASS_SECRET;

  const call = async (method: "GET" | "POST", path: string, key?: string, body?: unknown) => {
    const headers: Record<string, string> = { accept: "application/json" };
    if (key) headers.authorization = `Bearer ${key}`;
    if (body !== undefined) headers["content-type"] = "application/json";
    if (bypass) headers["x-vercel-protection-bypass"] = bypass;
    const response = await fetch(new URL(path, base), {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "error", cache: "no-store", signal: AbortSignal.timeout(30_000),
    });
    const text = await response.text();
    let json: Json = {};
    try { json = JSON.parse(text) as Json; } catch { json = { non_json_body_bytes: text.length }; }
    return { status: response.status, headers: response.headers, body: json };
  };
  const check = async (name: string, fn: () => Promise<string | void>) => {
    try { results.push({ name, status: "PASS", detail: (await fn()) || undefined }); }
    catch (e) { results.push({ name, status: "FAIL", detail: e instanceof Error ? e.message : String(e) }); }
  };
  const skip = (name: string, detail: string) => results.push({ name, status: "SKIPPED", detail });

  console.log(`Target: ${base.origin} (${isProduction ? "PRODUCTION, read-only" : "staging"})`);
  console.log(`Mode: ${opts.verifyExisting ? `verify-existing ${opts.verifyExisting}` : "create"}`);

  let id = opts.verifyExisting ?? "";
  let submittedSha = "";

  await check("unauthenticated read is rejected (401)", async () => {
    const r = await call("GET", `/api/v1/runs/wb-${"0".repeat(32)}`);
    assert.equal(r.status, 401, `got ${r.status} ${JSON.stringify(r.body)}`);
  });

  if (opts.runFile) {
    const run = JSON.parse(readFileSync(opts.runFile, "utf8")) as Json;
    if (run.contract_version !== "aethel.run/1") throw new Error("--run-file must be an aethel.run/1 submission");
    await check("tenant A submits a real run (201)", async () => {
      const r = await call("POST", "/api/v1/runs", keyA, run);
      if (r.status === 409) throw new Error(`409 ${String(r.body.code)}: this run_id was already submitted (experience_id ${String(r.body.experience_id)}). Use --verify-existing, or a new run_id from your workbench.`);
      if (r.status === 503) throw new Error(`503 ${String(r.body.code)}: ${String(r.body.error)}`);
      assert.equal(r.status, 201, `got ${r.status} ${JSON.stringify(r.body)}`);
      id = String(r.body.experience_id);
      assert.match(id, ID);
      const v = r.body.verification as Json;
      submittedSha = String(v?.content_sha256);
      assert.match(submittedSha, SHA);
      return `experience_id ${id}`;
    });
  }

  if (!ID.test(id)) {
    skip("all remaining checks", "no experience_id available");
  } else {
    let verifiedSha = "";
    let verifiedRecord: ExperienceRecord | undefined;
    await check("tenant A verifies the run: integrity PASS, consistent", async () => {
      const r = await call("GET", `/api/v1/runs/${id}`, keyA);
      assert.equal(r.status, 200, `got ${r.status} ${JSON.stringify(r.body)}`);
      const v = r.body.verification as Json;
      assert.equal(v.integrity, "PASS");
      assert.equal(v.consistent, true);
      assert.equal(v.stored_verdict, v.recomputed_verdict);
      verifiedSha = String(v.content_sha256);
      assert.match(verifiedSha, SHA);
      if (submittedSha) assert.equal(verifiedSha, submittedSha, "verify hash differs from submit hash");
      if (opts.expectSha) assert.equal(verifiedSha, opts.expectSha, "content_sha256 changed since the earlier invocation");
      verifiedRecord = r.body.experience as ExperienceRecord;
      assert.equal(experienceDigest(verifiedRecord), verifiedSha, "local recomputation of content_sha256 differs");
      return `verdict ${String(v.verdict)}, content_sha256 ${verifiedSha}`;
    });

    await check("tenant B gets 404 for tenant A's run, same as an unknown id", async () => {
      const cross = await call("GET", `/api/v1/runs/${id}`, keyB);
      const unknown = await call("GET", `/api/v1/runs/wb-${"f".repeat(32)}`, keyB);
      assert.equal(cross.status, 404, `got ${cross.status}`);
      assert.equal(unknown.status, 404, `unknown id got ${unknown.status}`);
      assert.deepEqual({ ...cross.body, experience_id: null }, { ...unknown.body, experience_id: null });
      const exportB = await call("GET", `/api/v1/customer-proof/${id}`, keyB);
      assert.equal(exportB.status, 404, `customer-proof as B got ${exportB.status}`);
      assert.equal("record" in exportB.body, false);
    });

    await check("customer-proof export as tenant A (200, consistent, private)", async () => {
      const r = await call("GET", `/api/v1/customer-proof/${id}`, keyA);
      assert.equal(r.status, 200, `got ${r.status} ${JSON.stringify(r.body)}`);
      assert.equal(r.body.report_version, "aethel.customer-proof/1");
      assert.match(String(r.headers.get("cache-control")), /no-store/);
      assert.match(String(r.headers.get("cache-control")), /private/);
      const record = r.body.record as ExperienceRecord;
      assert.equal(experienceDigest(record), r.body.content_sha256, "exported record does not hash to content_sha256");
      if (verifiedSha) assert.equal(r.body.content_sha256, verifiedSha);
      return `server_verdict ${String(r.body.server_verdict)}`;
    });
  }

  const repo = process.env.STAGING_REFERENCE_REPO;
  const existingRef = process.env.STAGING_REFERENCE_ID;
  if (opts.verifyExisting) {
    if (!existingRef) skip("stored reference survives", "STAGING_REFERENCE_ID not set");
    else await check("stored reference survives: tenant A reads it, tenant B gets 404", async () => {
      assert.match(existingRef, /^ref-[0-9a-f]{32}$/, "STAGING_REFERENCE_ID must be ref- followed by 32 hex");
      const read = await call("GET", `/api/v1/references/${existingRef}`, keyA);
      assert.equal(read.status, 200, `got ${read.status} ${JSON.stringify(read.body)}`);
      const cross = await call("GET", `/api/v1/references/${existingRef}`, keyB);
      assert.equal(cross.status, 404, `tenant B got ${cross.status}`);
      return `snapshot_sha256 ${String(read.body.snapshot_sha256)}`;
    });
  } else if (isProduction) skip("reference connection", "not exercised in production read-only mode");
  else if (!repo) skip("reference connection", "STAGING_REFERENCE_REPO not set");
  else {
    await check(`reference connect ${expectAnchors === "1" ? "succeeds with anchors" : "fails closed without anchors"}`, async () => {
      const r = await call("POST", "/api/v1/references", keyA, { repo, ref: process.env.STAGING_REFERENCE_REF || "main" });
      if (expectAnchors === "0") {
        assert.equal(r.status, 503, `got ${r.status}`);
        assert.equal(r.body.code, "REFERENCE_STORAGE_NOT_CONFIGURED");
        return "503 REFERENCE_STORAGE_NOT_CONFIGURED";
      }
      if (r.status === 503 && r.body.code === "GITHUB_NOT_CONFIGURED") throw new Error("anchors are configured, but AETHEL_GITHUB_TOKEN is not set on staging");
      if (r.status === 503 && r.body.code === "REFERENCE_STORAGE_NOT_CONFIGURED") throw new Error("staging reports no reference storage: check SHIYAN_STORAGE_BACKEND, SHIYAN_STORAGE_URL and SHIYAN_ANCHOR_URL (separate database and role)");
      assert.ok(r.status === 201 || r.status === 200, `got ${r.status} ${JSON.stringify(r.body)}`);
      const refId = String(r.body.reference_id);
      const read = await call("GET", `/api/v1/references/${refId}`, keyA);
      assert.equal(read.status, 200, `read got ${read.status}`);
      assert.equal(read.body.snapshot_sha256, r.body.snapshot_sha256);
      const cross = await call("GET", `/api/v1/references/${refId}`, keyB);
      assert.equal(cross.status, 404, `tenant B read got ${cross.status}`);
      const list = await call("GET", "/api/v1/references", keyA);
      assert.equal(list.status, 200, `list got ${list.status}`);
      return `${r.status} ${refId} commit ${String(r.body.commit_sha)} (set STAGING_REFERENCE_ID=${refId} for --verify-existing)`;
    });
  }

  console.log("");
  for (const r of results) console.log(`${r.status.padEnd(7)} ${r.name}${r.detail ? ` — ${r.detail}` : ""}`);
  const failed = results.filter((r) => r.status === "FAIL").length;
  console.log("");
  if (id) {
    console.log("Receipt (keep it for the post-redeploy check):");
    console.log(JSON.stringify({ base_url: base.origin, experience_id: id, content_sha256: submittedSha || opts.expectSha || null, checked_at: new Date().toISOString() }, null, 2));
    if (!opts.verifyExisting) console.log(`\nAfter a redeploy or cold start, run:\n  npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/staging-acceptance.ts --verify-existing ${id}${submittedSha ? ` --expect-sha256 ${submittedSha}` : ""}`);
  }
  console.log(`\nstaging-acceptance: ${failed ? `FAIL (${failed} failed)` : "PASS"} against ${base.origin}. This is staging evidence only, not production verification.`);
  process.exitCode = failed ? 1 : 0;
}

main().catch((e) => {
  console.error(`staging-acceptance: ERROR ${e instanceof Error ? e.message : String(e)}`);
  process.exitCode = 2;
});
