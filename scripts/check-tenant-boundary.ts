Full corrected scripts/check-tenant-boundary.ts

Replace the entire file with this. The GITHUB_NOT_CONFIGURED assertion now passes anchors as the fifth argument.

ts
/**
 * Offline tenant-boundary and customer-export tests.
 * Run from repository root in a fresh Linux/WSL process:
 * npx --no-install tsx --tsconfig ./tsconfig.json scripts/check-tenant-boundary.ts
 * Test fixtures and anchors are never production evidence.
 * Requires the customer-proof VERIFICATION_INCONSISTENT guard.
 */
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import type {
  GitHubFetch,
  IndependentReferenceAnchors,
  ReferenceAnchor,
} from "../src/core/github-reference";

const REPO = "ecmccready/shiyan-dap";
const PREFIX = `/repos/${REPO}`;
const h = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const clone = <T>(value: T): T => structuredClone(value);

const object = (value: unknown): Record<string, unknown> => {
  assert.ok(
    typeof value === "object" && value !== null && !Array.isArray(value),
  );
  return value as Record<string, unknown>;
};

const field = (value: Record<string, unknown>, key: string): string => {
  assert.equal(typeof value[key], "string");
  return value[key] as string;
};

async function json(response: Response) {
  return {
    response,
    status: response.status,
    body: object(await response.json()),
  };
}

/** TEST ONLY. Not durable or independent production storage. */
class TestOnlyAnchors implements IndependentReferenceAnchors {
  private readonly rows = new Map<string, ReferenceAnchor>();

  private key(tenant: string, id: string) {
    return JSON.stringify([tenant, id]);
  }

  async createIfAbsent(anchor: ReferenceAnchor): Promise<ReferenceAnchor> {
    const key = this.key(anchor.tenant, anchor.reference_id);
    // Atomic in this JS process: no await between lookup and insert.
    if (!this.rows.has(key)) this.rows.set(key, clone(anchor));
    return clone(this.rows.get(key)!);
  }

  async get(tenant: string, id: string): Promise<ReferenceAnchor | null> {
    const row = this.rows.get(this.key(tenant, id));
    return row ? clone(row) : null;
  }

  async listTenant(tenant: string): Promise<ReferenceAnchor[]> {
    return [...this.rows.values()]
      .filter((row) => row.tenant === tenant)
      .map(clone);
  }
}

function gitObject(kind: "blob" | "tree" | "commit", bytes: Buffer): string {
  return createHash("sha1")
    .update(`${kind} ${bytes.length}\0`)
    .update(bytes)
    .digest("hex");
}

function gitTree(
  entries: { mode: "100644" | "40000"; name: string; sha: string }[],
): string {
  const ordered = [...entries].sort((a, b) =>
    Buffer.compare(
      Buffer.from(a.name + (a.mode === "40000" ? "/" : "")),
      Buffer.from(b.name + (b.mode === "40000" ? "/" : "")),
    ),
  );
  return gitObject(
    "tree",
    Buffer.concat(
      ordered.map((entry) =>
        Buffer.concat([
          Buffer.from(`${entry.mode} ${entry.name}\0`),
          Buffer.from(entry.sha, "hex"),
        ]),
      ),
    ),
  );
}

function fixture(label: string) {
  const contract = Buffer.from("export interface TestOnlyContract {}\n");
  const readme = Buffer.from("# Isolated test fixture only\n");
  const excluded = Buffer.from("test-only-not-a-secret\n");
  const contractSha = gitObject("blob", contract);
  const readmeSha = gitObject("blob", readme);
  const excludedSha = gitObject("blob", excluded);
  const coreSha = gitTree([
    { mode: "100644", name: "interfaces.ts", sha: contractSha },
  ]);
  const srcSha = gitTree([
    { mode: "40000", name: "core", sha: coreSha },
  ]);
  const keysSha = gitTree([
    { mode: "100644", name: "server.pem", sha: excludedSha },
  ]);
  const treeSha = gitTree([
    { mode: "100644", name: ".env.local", sha: excludedSha },
    { mode: "100644", name: "README.md", sha: readmeSha },
    { mode: "40000", name: "keys", sha: keysSha },
    { mode: "40000", name: "src", sha: srcSha },
  ]);
  const commitSha = gitObject(
    "commit",
    Buffer.from(
      `tree ${treeSha}\nauthor Test Fixture <fixture@example.invalid> 0 +0000\n` +
        `committer Test Fixture <fixture@example.invalid> 0 +0000\n\n${label}\n`,
    ),
  );
  const calls: string[] = [];

  const fetch: GitHubFetch = async (path) => {
    calls.push(path);
    if (
      path === `${PREFIX}/commits/main` ||
      path === `${PREFIX}/commits/${commitSha}`
    ) {
      return { sha: commitSha, commit: { tree: { sha: treeSha } } };
    }
    if (path === `${PREFIX}/git/trees/${treeSha}?recursive=1`) {
      return {
        sha: treeSha,
        truncated: false,
        tree: [
          {
            path: ".env.local",
            type: "blob",
            mode: "100644",
            sha: excludedSha,
            size: excluded.length,
          },
          {
            path: "README.md",
            type: "blob",
            mode: "100644",
            sha: readmeSha,
            size: readme.length,
          },
          { path: "keys", type: "tree", mode: "040000", sha: keysSha },
          {
            path: "keys/server.pem",
            type: "blob",
            mode: "100644",
            sha: excludedSha,
            size: excluded.length,
          },
          { path: "src", type: "tree", mode: "040000", sha: srcSha },
          {
            path: "src/core",
            type: "tree",
            mode: "040000",
            sha: coreSha,
          },
          {
            path: "src/core/interfaces.ts",
            type: "blob",
            mode: "100644",
            sha: contractSha,
            size: contract.length,
          },
        ],
      };
    }
    if (path === `${PREFIX}/commits?sha=${commitSha}&per_page=20`) {
      return [
        {
          sha: commitSha,
          commit: {
            message: `${label}\n\nTest only`,
            committer: { date: "1970-01-01T00:00:00Z" },
          },
        },
      ];
    }
    const bytes =
      path === `${PREFIX}/git/blobs/${contractSha}`
        ? contract
        : path === `${PREFIX}/git/blobs/${readmeSha}`
          ? readme
          : null;
    if (bytes) {
      return {
        sha: gitObject("blob", bytes),
        size: bytes.length,
        encoding: "base64",
        content: bytes.toString("base64"),
      };
    }
    throw new Error(`Unexpected offline fixture request: ${path}`);
  };

  return {
    fetch,
    calls,
    commitSha,
    treeSha,
    contractSha,
    readmeSha,
    excludedSha,
  };
}

function privateResponse(response: Response) {
  assert.match(response.headers.get("cache-control") ?? "", /private/i);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/i);
  assert.equal(response.headers.get("pragma"), "no-cache");
  assert.match(response.headers.get("vary") ?? "", /authorization/i);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
}

async function main() {
  assert.equal(
    process.argv.slice(2).length,
    0,
    "Offline suite accepts no arguments; --live is deliberately removed",
  );

  const root = mkdtempSync(join(tmpdir(), "aethel-tenant-tests-only-"));
  const envKeys = [
    "AETHEL_HF_MEMORY_ROOT",
    "AETHEL_TENANT_KEYS",
    "AETHEL_GITHUB_REPOS",
    "AETHEL_GITHUB_TOKEN",
    "VERCEL_GIT_COMMIT_SHA",
  ] as const;
  const saved = Object.fromEntries(
    envKeys.map((key) => [key, process.env[key]]),
  );
  const savedFetch = globalThis.fetch;
  let networkAttempts = 0;

  const KA = randomBytes(24).toString("hex");
  const KB = randomBytes(24).toString("hex");
  const KEYS = JSON.stringify({ "tenant-a": h(KA), "tenant-b": h(KB) });
  const hdr = (key?: string): Record<string, string> =>
    key ? { authorization: `Bearer ${key}` } : {};
  const run = (overrides: Record<string, unknown> = {}) => ({
    contract_version: "aethel.run/1",
    run_id: "test-run-001",
    workbench: { name: "test-only-workbench", version: "test-only-v1" },
    goal: "Test fixture only",
    action: "Test fixture only",
    predicted: 1,
    observed: 1,
    seed: 42,
    ...overrides,
  });
  const inside = (path: string) => {
    assert.ok(
      resolve(path).startsWith(resolve(root) + sep),
      "Test path escaped isolated root",
    );
    return path;
  };

  try {
    // Isolate persistence before runtime application imports.
    process.env.AETHEL_HF_MEMORY_ROOT = root;
    process.env.AETHEL_TENANT_KEYS = KEYS;
    process.env.AETHEL_GITHUB_REPOS = JSON.stringify({ [REPO]: "tenant-a" });
    process.env.VERCEL_GIT_COMMIT_SHA = "test-only";
    delete process.env.AETHEL_GITHUB_TOKEN;
    globalThis.fetch = async () => {
      networkAttempts++;
      throw new Error("Network forbidden in offline test suite");
    };

    const runs = await import("../src/app/api/v1/runs/route");
    const one = await import("../src/app/api/v1/runs/[id]/route");
    const refs = await import("../src/app/api/v1/references/route");
    const refOne = await import("../src/app/api/v1/references/[id]/route");
    const proofRoute = await import("../src/app/api/v1/proof/route");
    const status = await import("../src/app/api/v1/github/route");
    const customer = await import("../src/app/api/v1/customer-proof/[id]/route");
    const gh = await import("../src/core/github-reference");
    const provider = await import("../src/core/reference-anchor-provider");
    const { resolveExperienceStoreRoot } = await import(
      "../src/core/experience-store"
    );
    const { experienceDigest } = await import("../src/core/hf-memory");
    const { validateExperienceRecord } = await import(
      "../src/core/experience-schema"
    );
    assert.equal(resolveExperienceStoreRoot(), root);

    const submit = async (
      key: string | undefined,
      body: unknown,
      extra: Record<string, string> = {},
    ) =>
      json(
        await runs.POST(
          new Request("http://test.invalid/api/v1/runs", {
            method: "POST",
            headers: { ...hdr(key), ...extra },
            body: JSON.stringify(body),
          }),
        ),
      );

    const verify = async (key: string | undefined, id: string) =>
      json(
        await one.GET(
          new Request(`http://test.invalid/api/v1/runs/${id}`, {
            headers: hdr(key),
          }),
          { params: Promise.resolve({ id }) },
        ),
      );

    const postRef = async (key: string | undefined, body: unknown) =>
      json(
        await refs.POST(
          new Request("http://test.invalid/api/v1/references", {
            method: "POST",
            headers: hdr(key),
            body: JSON.stringify(body),
          }),
        ),
      );

    const exportReport = async (
      key: string | undefined,
      id: string,
      extra: Record<string, string> = {},
    ) => {
      const result = await json(
        await customer.GET(
          new Request(`http://test.invalid/api/v1/customer-proof/${id}`, {
            headers: { ...hdr(key), ...extra },
          }),
          { params: Promise.resolve({ id }) },
        ),
      );
      privateResponse(result.response);
      if (result.status !== 200) {
        assert.equal("record" in result.body, false);
        const text = JSON.stringify(result.body);
        assert.ok(
          !text.includes(root) && !text.includes(KA) && !text.includes(KB),
        );
      }
      return result;
    };

    // Authentication, spoofing and append-only run checks.
    assert.equal((await submit(undefined, run())).status, 401);
    assert.equal(
      (await submit("test-only-wrong-key-000000", run())).status,
      401,
    );
    assert.equal(
      (await submit(undefined, run(), { authorization: "Basic abc" })).status,
      401,
    );
    assert.equal(
      (await submit(undefined, run(), { "x-tenant-id": "tenant-a" })).status,
      401,
    );
    assert.equal(
      (
        await proofRoute.POST(
          new Request("http://test.invalid/api/v1/proof", {
            method: "POST",
            body: JSON.stringify({ converged: true }),
          }),
        )
      ).status,
      401,
    );
    for (const spoof of [
      run({ tenant_id: "tenant-b" }),
      run({ tenant: "tenant-b" }),
    ]) {
      assert.equal((await submit(KA, spoof)).status, 400);
    }

    const a = await submit(KA, run());
    const b = await submit(KB, run({ observed: 3 }));
    assert.equal(a.status, 201);
    assert.equal(b.status, 201);
    const aId = field(a.body, "experience_id");
    const bId = field(b.body, "experience_id");
    assert.notEqual(aId, bId);
    assert.equal(object(a.body.experience).tenant_id, "tenant-a");
    assert.equal((await submit(KA, run())).status, 409);
    assert.equal(
      object((await verify(KA, aId)).body.verification).verdict,
      "PASS",
    );
    assert.equal(
      object((await verify(KB, bId)).body.verification).verdict,
      "FAIL",
    );

    const unknownId = "wb-" + "f".repeat(32);
    const cross = await verify(KA, bId);
    const unknown = await verify(KA, unknownId);
    assert.equal(cross.status, 404);
    assert.deepEqual(
      { ...cross.body, experience_id: null },
      { ...unknown.body, experience_id: null },
    );
    assert.equal((await verify(KB, aId)).status, 404);
    assert.equal((await verify(undefined, aId)).status, 401);
    assert.equal(
      readdirSync(
        inside(join(root, "tenants", "tenant-a", "founder-z", "experiences")),
      ).length,
      1,
    );
    assert.equal(existsSync(inside(join(root, "founder-z"))), false);

    const published = await json(
      await proofRoute.POST(
        new Request("http://test.invalid/api/v1/proof", {
          method: "POST",
          headers: hdr(KB),
          body: JSON.stringify({ converged: true }),
        }),
      ),
    );
    assert.equal(published.status, 200);
    assert.ok(
      existsSync(
        inside(
          join(
            root,
            "tenants",
            "tenant-b",
            "founder-z",
            "experiences",
            `${field(published.body, "experience_id")}.json`,
          ),
        ),
      ),
    );
    assert.equal(
      (await exportReport(KB, field(published.body, "experience_id"))).status,
      400,
    );

    // Missing, malformed or ambiguous tenant-key configuration fails closed.
    for (const config of [
      undefined,
      "not-json",
      JSON.stringify({ "tenant-a": h(KA), "tenant-b": h(KA) }),
    ]) {
      if (config === undefined) delete process.env.AETHEL_TENANT_KEYS;
      else process.env.AETHEL_TENANT_KEYS = config;
      assert.equal(
        (await submit(KA, run({ run_id: "not-written" }))).status,
        503,
      );
      assert.equal((await verify(KA, aId)).status, 503);
      assert.equal((await exportReport(KA, aId)).status, 503);
    }
    process.env.AETHEL_TENANT_KEYS = KEYS;
    assert.equal(
      gh.loadRepoAllowlist({
        AETHEL_GITHUB_REPOS: JSON.stringify({
          [REPO]: "tenant-a",
          "invalid/repo": "../escape",
        }),
      }).size,
      0,
    );

    // HTTP routes retain the disabled production provider.
    assert.equal(provider.configuredReferenceAnchors(), undefined);
    assert.equal((await postRef(undefined, { repo: REPO })).status, 401);
    assert.equal((await postRef(KB, { repo: REPO })).status, 404);
    assert.deepEqual(
      (await postRef(KB, { repo: REPO })).body,
      (await postRef(KA, { repo: "someone/else" })).body,
    );
    for (const bad of [
      { repo: "https://evil.invalid/repo" },
      { repo: "../../etc" },
      { repo: REPO, ref: "../x" },
      { repo: REPO, ref: "a..b" },
      { repo: REPO, url: "http://test.invalid/forbidden" },
    ]) {
      assert.equal((await postRef(KA, bad)).status, 400);
    }
    const disabled = await postRef(KA, { repo: REPO });
    assert.equal(disabled.status, 503);
    assert.equal(disabled.body.code, "REFERENCE_STORAGE_NOT_CONFIGURED");
    const st = await json(await status.GET());
    assert.equal(st.body.github_configured, false);
    assert.equal(st.body.tenant_auth_configured, true);
    assert.ok(!JSON.stringify(st.body).includes(REPO));

    // Explicit TEST ONLY anchor injection for core success cases.
    const anchors = new TestOnlyAnchors();
    const f = fixture("First test-only reference");
    let unauthorizedFetches = 0;
    const neverFetch: GitHubFetch = async () => {
      unauthorizedFetches++;
      throw new Error("Unauthorized upstream call");
    };
    assert.equal(
      (
        await gh.connectReference(
          "tenant-b",
          { repo: REPO },
          process.env,
          neverFetch,
          anchors,
        )
      ).status,
      404,
    );
    assert.equal(
      (
        await gh.connectReference(
          "tenant-a",
          { repo: "someone/else" },
          process.env,
          neverFetch,
          anchors,
        )
      ).status,
      404,
    );
    assert.equal(unauthorizedFetches, 0);

    // Missing anchors: storage configuration fails before GitHub access.
    const noAnchors = await gh.connectReference(
      "tenant-a",
      { repo: REPO },
      process.env,
      f.fetch,
    );
    assert.equal(noAnchors.status, 503);
    assert.equal(noAnchors.body.code, "REFERENCE_STORAGE_NOT_CONFIGURED");
    assert.equal(f.calls.length, 0);

    // Anchors supplied as argument FIVE; no fetcher/token is configured.
    assert.equal(
      (
        await gh.connectReference(
          "tenant-a",
          { repo: REPO },
          process.env,
          undefined,
          anchors,
        )
      ).body.code,
      "GITHUB_NOT_CONFIGURED",
    );

    const first = await gh.connectReference(
      "tenant-a",
      { repo: REPO },
      process.env,
      f.fetch,
      anchors,
    );
    assert.equal(first.status, 201);
    const id = field(first.body, "reference_id");
    const snap = await gh.readReference("tenant-a", id, anchors);
    assert.ok(snap);
    assert.deepEqual(
      snap.snapshot.files.map((file) => file.path),
      ["README.md", "src/core/interfaces.ts"],
    );
    assert.equal(snap.snapshot.excluded_paths, 2);
    assert.equal(
      snap.snapshot.contracts[0].sha256,
      h("export interface TestOnlyContract {}\n"),
    );
    assert.equal(snap.snapshot.collection?.tree.complete, true);
    assert.equal(
      snap.snapshot.collection?.history.completeness,
      "unknown; pagination not inspected",
    );
    assert.equal(snap.snapshot.collection?.evidence.hashed, 1);
    assert.ok(f.calls.every((path) => path.startsWith(PREFIX + "/")));
    assert.ok(!f.calls.includes(`${PREFIX}/git/blobs/${f.excludedSha}`));

    const repeated = await gh.connectReference(
      "tenant-a",
      { repo: REPO },
      process.env,
      f.fetch,
      anchors,
    );
    assert.equal(repeated.status, 200);
    assert.equal(repeated.body.snapshot_sha256, first.body.snapshot_sha256);
    assert.equal(await gh.readReference("tenant-b", id, anchors), null);
    assert.equal(await gh.readReference("tenant-a", "../../x", anchors), null);
    assert.equal((await gh.listReferences("tenant-a", anchors)).length, 1);
    assert.deepEqual(await gh.listReferences("tenant-b", anchors), []);

    const anchorCopy = await anchors.get("tenant-a", id);
    assert.ok(anchorCopy);
    anchorCopy.envelope_sha256 = "0".repeat(64);
    assert.notEqual(
      (await anchors.get("tenant-a", id))?.envelope_sha256,
      anchorCopy.envelope_sha256,
    );
    await assert.rejects(gh.readReference("tenant-a", id), /not configured/);
    await assert.rejects(
      gh.githubTokenFetch("test-only-unused-token")("/user"),
      /non-repo/,
    );
    assert.equal(
      (
        await json(
          await refs.GET(
            new Request("http://test.invalid/api/v1/references", {
              headers: hdr(KA),
            }),
          ),
        )
      ).status,
      503,
    );
    assert.equal(
      (
        await json(
          await refOne.GET(
            new Request("http://test.invalid/api/v1/references/id", {
              headers: hdr(KA),
            }),
            { params: Promise.resolve({ id }) },
          ),
        )
      ).status,
      503,
    );

    const truncated: GitHubFetch = async (path) => {
      const response = await f.fetch(path);
      return path === `${PREFIX}/git/trees/${f.treeSha}?recursive=1`
        ? { ...object(response), truncated: true }
        : response;
    };
    await assert.rejects(
      gh.buildReferenceSnapshot("tenant-a", REPO, "main", truncated),
      /completeness/,
    );
    const wrongBlob: GitHubFetch = async (path) => {
      const response = await f.fetch(path);
      return path === `${PREFIX}/git/blobs/${f.contractSha}`
        ? {
            ...object(response),
            content: Buffer.from("bad").toString("base64"),
          }
        : response;
    };
    await assert.rejects(
      gh.buildReferenceSnapshot("tenant-a", REPO, "main", wrongBlob),
    );

    // Concurrent publication: one creator and one immutable winner.
    const race = fixture("Concurrent test-only reference");
    const raceSnapshot = await gh.buildReferenceSnapshot(
      "tenant-a",
      REPO,
      "main",
      race.fetch,
    );
    const winners = await Promise.all(
      Array.from({ length: 4 }, () => gh.saveReference(raceSnapshot, anchors)),
    );
    assert.equal(winners.filter((result) => result.created).length, 1);
    assert.equal(
      new Set(winners.map((result) => result.snapshot_sha256)).size,
      1,
    );
    assert.equal((await gh.listReferences("tenant-a", anchors)).length, 2);

    // Reference tampering and deletion must not silently disappear.
    const refPath = inside(
      join(root, "tenants", "tenant-a", "references", `${id}.json`),
    );
    const originalEnvelope = readFileSync(refPath);
    try {
      writeFileSync(
        refPath,
        Buffer.concat([originalEnvelope, Buffer.from(" ")]),
      );
      await assert.rejects(
        gh.readReference("tenant-a", id, anchors),
        /hash mismatch/,
      );
      await assert.rejects(gh.listReferences("tenant-a", anchors));
    } finally {
      writeFileSync(refPath, originalEnvelope);
    }
    try {
      unlinkSync(refPath);
      await assert.rejects(
        gh.readReference("tenant-a", id, anchors),
        /incomplete/,
      );
      await assert.rejects(gh.listReferences("tenant-a", anchors));
    } finally {
      writeFileSync(refPath, originalEnvelope);
    }

    const missingAnchor: IndependentReferenceAnchors = {
      createIfAbsent: (anchor) => anchors.createIfAbsent(anchor),
      get: async () => null,
      listTenant: (tenant) => anchors.listTenant(tenant),
    };
    await assert.rejects(
      gh.readReference("tenant-a", id, missingAnchor),
      /incomplete/,
    );
    const corruptAnchor: IndependentReferenceAnchors = {
      createIfAbsent: (anchor) => anchors.createIfAbsent(anchor),
      listTenant: (tenant) => anchors.listTenant(tenant),
      get: async (tenant, rid) => {
        const anchor = await anchors.get(tenant, rid);
        return anchor
          ? { ...anchor, envelope_sha256: "0".repeat(64) }
          : null;
      },
    };
    await assert.rejects(
      gh.readReference("tenant-a", id, corruptAnchor),
      /hash mismatch/,
    );

    // Actual customer GET handler: authentication, owner, isolation and headers.
    assert.equal((await exportReport(undefined, aId)).status, 401);
    assert.equal(
      (await exportReport("test-only-wrong-key-000000", aId)).status,
      401,
    );
    assert.equal(
      (await exportReport(undefined, aId, { "x-tenant-id": "tenant-a" })).status,
      401,
    );
    assert.equal((await exportReport(KA, "../../etc")).status, 400);
    const denied = await exportReport(KB, aId);
    const absent = await exportReport(KB, unknownId);
    assert.equal(denied.status, 404);
    assert.deepEqual(denied.body, absent.body);

    const owner = await exportReport(KA, aId);
    assert.equal(owner.status, 200);
    assert.equal(owner.body.report_version, "aethel.customer-proof/1");
    assert.equal(owner.body.server_verdict, "PASS");
    assert.match(
      owner.response.headers.get("content-disposition") ?? "",
      new RegExp(aId + "-proof[.]json"),
    );
    const originalRecord = object(owner.body.record);
    assert.ok(validateExperienceRecord(originalRecord));
    assert.equal(originalRecord.tenant_id, "tenant-a");
    assert.equal(owner.body.content_sha256, experienceDigest(originalRecord));

    // A consistent failing check remains exportable as FAIL.
    const failing = await exportReport(KB, bId);
    assert.equal(failing.status, 200);
    assert.equal(failing.body.server_verdict, "FAIL");

    const base = inside(join(root, "tenants", "tenant-a", "founder-z"));
    const recordPath = inside(join(base, "experiences", `${aId}.json`));
    const proofPath = inside(join(base, "proofs", `${aId}.json`));
    const recordBytes = readFileSync(recordPath);
    const proofBytes = readFileSync(proofPath);

    // Record-only tamper: leave stored checksum unchanged.
    try {
      const edited = clone(originalRecord);
      edited.goal = "Tampered test-only goal";
      writeFileSync(recordPath, JSON.stringify(edited));
      const rejected = await exportReport(KA, aId);
      assert.equal(rejected.status, 422);
      assert.equal(rejected.body.code, "INTEGRITY_FAILED");
    } finally {
      writeFileSync(recordPath, recordBytes);
    }

    // Proof-only tamper.
    try {
      const editedProof = object(JSON.parse(proofBytes.toString("utf8")));
      editedProof.sha256 = "0".repeat(64);
      writeFileSync(proofPath, JSON.stringify(editedProof));
      const rejected = await exportReport(KA, aId);
      assert.equal(rejected.status, 422);
      assert.equal(rejected.body.code, "INTEGRITY_FAILED");
    } finally {
      writeFileSync(proofPath, proofBytes);
    }

    // Matching local checksum does not excuse contradictory proof results.
    // Controlled edits affect only temporary test data.
    try {
      const edited = clone(originalRecord);
      edited.metamorphic.result = "FAIL";
      const editedProof = object(JSON.parse(proofBytes.toString("utf8")));
      editedProof.sha256 = experienceDigest(edited);
      writeFileSync(recordPath, JSON.stringify(edited));
      writeFileSync(proofPath, JSON.stringify(editedProof));

      const verified = await verify(KA, aId);
      assert.equal(verified.status, 200);
      assert.equal(object(verified.body.verification).consistent, false);
      assert.equal(object(verified.body.verification).verdict, "FAIL");

      const rejected = await exportReport(KA, aId);
      assert.equal(
        rejected.status,
        422,
        "Customer export must reject inconsistent evidence; apply the route guard, not a weaker assertion",
      );
      assert.equal(rejected.body.code, "VERIFICATION_INCONSISTENT");
    } finally {
      writeFileSync(recordPath, recordBytes);
      writeFileSync(proofPath, proofBytes);
    }

    assert.equal(networkAttempts, 0);
    console.log(
      "tenant-boundary + customer-export: PASS (offline test-only fixtures)",
    );
    console.log(
      "NOT covered: browser UI, real immutable anchor backend, crash/power-loss durability, production configuration or real customer outcomes",
    );
  } finally {
    globalThis.fetch = savedFetch;
    for (const key of envKeys) {
      const value = saved[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    rmSync(root, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});


