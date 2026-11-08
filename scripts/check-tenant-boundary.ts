/** Tenant boundary + authorized GitHub reference checks. Run: npx tsx scripts/check-tenant-boundary.ts [--live] */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = mkdtempSync(join(tmpdir(), "aethel-tenant-"));
const saved = { ...process.env };
const KA = "tenant-a-key-000000001", KB = "tenant-b-key-000000002";
const h = (k: string) => createHash("sha256").update(k).digest("hex");
const KEYS = JSON.stringify({ "tenant-a": h(KA), "tenant-b": h(KB) });
Object.assign(process.env, { AETHEL_HF_MEMORY_ROOT: root, AETHEL_TENANT_KEYS: KEYS,
  AETHEL_GITHUB_REPOS: JSON.stringify({ "ecmccready/shiyan-dap": "tenant-a" }) });
delete process.env.AETHEL_GITHUB_TOKEN;
const V = "aethel.run/1";
const run = (o: Record<string, unknown> = {}) => ({ contract_version: V, run_id: "run-001", workbench: { name: "shared-wb", version: "1" },
  goal: "g", action: "a", predicted: 1, observed: 1, seed: 42, ...o });
const hdr = (k?: string) => (k ? { authorization: `Bearer ${k}` } : {}) as Record<string, string>;

async function main() {
  const runs = await import("../src/app/api/v1/runs/route");
  const one = await import("../src/app/api/v1/runs/[id]/route");
  const refs = await import("../src/app/api/v1/references/route");
  const refOne = await import("../src/app/api/v1/references/[id]/route");
  const proofRoute = await import("../src/app/api/v1/proof/route");
  const status = await import("../src/app/api/v1/github/route");
  const gh = await import("../src/core/github-reference");
  const j = async (r: Response) => ({ status: r.status, body: await r.json() });
  const submit = (k: string | undefined, body: unknown, extra: Record<string, string> = {}) =>
    runs.POST(new Request("http://x/api/v1/runs", { method: "POST", headers: { ...hdr(k), ...extra }, body: JSON.stringify(body) })).then(j);
  const verify = (k: string | undefined, id: string) =>
    one.GET(new Request(`http://x/api/v1/runs/${id}`, { headers: hdr(k) }), { params: Promise.resolve({ id }) }).then(j);

  // Unauthenticated / invalid credentials.
  assert.equal((await submit(undefined, run())).status, 401);
  assert.equal((await submit("wrong-key-0000000000", run())).status, 401);
  assert.equal((await submit(undefined, run(), { authorization: "Basic abc" })).status, 401);
  assert.equal((await submit(undefined, run(), { "x-tenant-id": "tenant-a" })).status, 401);
  assert.equal((await proofRoute.POST(new Request("http://x/api/v1/proof", { method: "POST", body: JSON.stringify({ converged: true }) }))).status, 401);

  // Spoofed identity fields are rejected as unknown fields.
  for (const spoof of [run({ tenant_id: "tenant-b" }), run({ tenant: "tenant-b" })]) assert.equal((await submit(KA, spoof)).status, 400);

  // Same run_id + workbench in two tenants: isolated, distinct ids.
  const a = await submit(KA, run()), b = await submit(KB, run({ observed: 3 }));
  assert.equal(a.status, 201); assert.equal(b.status, 201);
  assert.notEqual(a.body.experience_id, b.body.experience_id);
  assert.equal(a.body.experience.tenant_id, "tenant-a");
  assert.equal((await submit(KA, run())).status, 409);       // duplicate scoped to tenant
  assert.equal((await verify(KA, a.body.experience_id)).body.verification.verdict, "PASS");
  assert.equal((await verify(KB, b.body.experience_id)).body.verification.verdict, "FAIL");

  // Cross-tenant read returns the same 404 as an unknown id.
  const cross = await verify(KA, b.body.experience_id), unknown = await verify(KA, "wb-" + "f".repeat(32));
  assert.equal(cross.status, 404); assert.deepEqual({ ...cross.body, experience_id: 0 }, { ...unknown.body, experience_id: 0 });
  assert.equal((await verify(KB, a.body.experience_id)).status, 404);
  assert.equal((await verify(undefined, a.body.experience_id)).status, 401);

  // Storage is physically separated by tenant; the legacy root store is untouched.
  assert.equal(readdirSync(join(root, "tenants", "tenant-a", "founder-z", "experiences")).length, 1);
  assert.equal(existsSync(join(root, "founder-z")), false);

  // Proof publish is tenant-scoped.
  const p = await j(await proofRoute.POST(new Request("http://x/api/v1/proof", { method: "POST", headers: hdr(KB), body: JSON.stringify({ converged: true }) })));
  assert.equal(p.status, 200);
  assert.ok(existsSync(join(root, "tenants", "tenant-b", "founder-z", "experiences", `${p.body.experience_id}.json`)));

  // Missing config fails closed.
  delete process.env.AETHEL_TENANT_KEYS;
  assert.equal((await submit(KA, run({ run_id: "x" }))).status, 503);
  assert.equal((await verify(KA, a.body.experience_id)).status, 503);
  process.env.AETHEL_TENANT_KEYS = "not json";
  assert.equal((await submit(KA, run({ run_id: "x" }))).status, 503);
  process.env.AETHEL_TENANT_KEYS = KEYS;

  // GitHub references: authorization before any upstream call.
  const post = (k: string | undefined, body: unknown) => refs.POST(new Request("http://x/api/v1/references", { method: "POST", headers: hdr(k), body: JSON.stringify(body) })).then(j);
  assert.equal((await post(undefined, { repo: "ecmccready/shiyan-dap" })).status, 401);
  assert.equal((await post(KB, { repo: "ecmccready/shiyan-dap" })).status, 404);           // not B's repo
  assert.equal((await post(KA, { repo: "someone/else" })).status, 404);                   // not allowlisted
  assert.deepEqual((await post(KB, { repo: "ecmccready/shiyan-dap" })).body, (await post(KA, { repo: "someone/else" })).body);
  for (const bad of [{ repo: "https://evil.example/x" }, { repo: "../../etc" }, { repo: "ecmccready/shiyan-dap", ref: "../x" },
    { repo: "ecmccready/shiyan-dap", ref: "a..b" }, { repo: "ecmccready/shiyan-dap", url: "http://169.254.169.254" }]) {
    assert.equal((await post(KA, bad)).status, 400, JSON.stringify(bad));
  }
  assert.equal((await post(KA, { repo: "ecmccready/shiyan-dap" })).body.code, "GITHUB_NOT_CONFIGURED"); // no token => 503
  const st = await j(await status.GET());
  assert.equal(st.body.github_configured, false); assert.equal(st.body.tenant_auth_configured, true);

  // Mocked adapter: snapshot, secret-path exclusion, immutability, tenant-scoped reads.
  const calls: string[] = [];
  const blob = (s: string) => ({ encoding: "base64", content: Buffer.from(s).toString("base64") });
  const mock: import("../src/core/github-reference").GitHubFetch = async (path) => {
    calls.push(path);
    if (path === "/repos/ecmccready/shiyan-dap/commits/main") return { sha: "a".repeat(40), commit: { tree: { sha: "t1" } } };
    if (path.startsWith("/repos/ecmccready/shiyan-dap/git/trees/t1")) return { tree: [
      { path: "src/core/interfaces.ts", type: "blob", sha: "b1", size: 10 }, { path: "README.md", type: "blob", sha: "b2", size: 5 },
      { path: ".env.local", type: "blob", sha: "b3", size: 9 }, { path: "keys/server.pem", type: "blob", sha: "b4", size: 9 }, { path: "src", type: "tree", sha: "x" }] };
    if (path.startsWith("/repos/ecmccready/shiyan-dap/commits?")) return [{ sha: "a".repeat(40), commit: { message: "feat: x\n\nbody", committer: { date: "2026-11-08T00:00:00Z" } } }];
    if (path.endsWith("/git/blobs/b1")) return blob("export interface X {}");
    if (path.endsWith("/git/blobs/b2")) return blob("# readme");
    throw new Error("unexpected " + path);
  };
  const c1 = await gh.connectReference("tenant-a", { repo: "ecmccready/shiyan-dap" }, process.env, mock);
  assert.equal(c1.status, 201);
  assert.ok(calls.every((c) => c.startsWith("/repos/ecmccready/shiyan-dap/")));
  assert.ok(!calls.some((c) => c.includes("b3") || c.includes("b4")));
  const id = c1.body.reference_id as string;
  const snap = gh.readReference("tenant-a", id)!;
  assert.deepEqual(snap.snapshot.files.map((f) => f.path), ["README.md", "src/core/interfaces.ts"]);
  assert.equal(snap.snapshot.excluded_paths, 2);
  assert.equal(snap.snapshot.contracts[0].sha256, createHash("sha256").update("export interface X {}").digest("hex"));
  assert.equal((await gh.connectReference("tenant-a", { repo: "ecmccready/shiyan-dap" }, process.env, mock)).status, 200); // immutable, idempotent
  assert.equal((await gh.connectReference("tenant-b", { repo: "ecmccready/shiyan-dap" }, process.env, mock)).status, 404);
  const getRef = (k: string, rid: string) => refOne.GET(new Request("http://x", { headers: hdr(k) }), { params: Promise.resolve({ id: rid }) }).then(j);
  assert.equal((await getRef(KA, id)).status, 200);
  assert.equal((await getRef(KB, id)).status, 404);
  assert.equal((await getRef(KA, "../../x")).status, 404);
  const listA = await j(await refs.GET(new Request("http://x", { headers: hdr(KA) })));
  const listB = await j(await refs.GET(new Request("http://x", { headers: hdr(KB) })));
  assert.equal(listA.body.references.length, 1); assert.equal(listB.body.references.length, 0);
  // Fetcher with a token refuses non-repo paths before any network use.
  await assert.rejects(gh.githubTokenFetch("placeholder")("/user"), /non-repo/);

  // Live: authorized founder repo read via the operator's gh CLI (scoped reads only).
  if (process.argv.includes("--live")) {
    const { ghCliFetch } = await import("./snapshot-founder-reference");
    const live = await gh.connectReference("tenant-a", { repo: "ecmccready/shiyan-dap", ref: "main" }, process.env, ghCliFetch);
    assert.ok(live.status === 201, JSON.stringify(live.body));
    const s = gh.readReference("tenant-a", live.body.reference_id as string)!.snapshot;
    assert.match(s.commit_sha, /^[0-9a-f]{40}$/);
    assert.ok(s.contracts.some((c) => c.path === "src/core/interfaces.ts"));
    assert.equal((await getRef(KB, live.body.reference_id as string)).status, 404);
    console.log("live:", JSON.stringify({ commit: s.commit_sha, files: s.files.length, commits: s.commits.length, contracts: s.contracts.length, evidence: s.evidence.length }));
  }
  console.log("tenant-boundary: PASS");
}
main().finally(() => { process.env = saved; rmSync(root, { recursive: true, force: true }); })
  .catch((e) => { console.error(e); process.exit(1); });
