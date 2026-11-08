// Read-only GitHub reference adapter. Only repos in the server allowlist, only for the tenant that owns them.
// Reads metadata (tree paths + git shas, commits) and the text of contract/evidence files to hash them.
// Fetched content is never executed. Upstream host is fixed to api.github.com; no caller-supplied URLs.
import { createHash } from "node:crypto";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, writeSync } from "node:fs";
import { join } from "node:path";
import { tenantRoot } from "./tenant-auth";

type Env = Record<string, string | undefined>;
export type GitHubFetch = (path: string) => Promise<unknown>; // path is an api.github.com path, e.g. /repos/o/r/commits
export const REFERENCE_VERSION = "aethel.reference/1";
const REPO = /^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9._-]{1,100}$/;
const REF = /^[A-Za-z0-9][A-Za-z0-9._\/-]{0,99}$/;
const SECRETISH = /(^|\/)(\.env[^/]*|.*\.(pem|key|p12|pfx)|id_rsa[^/]*|.*secret[^/]*|.*credential[^/]*)$/i;
const CONTRACTS = ["src/core/interfaces.ts", "src/core/platform-contract.ts", "src/core/run-contract.ts", "src/core/experience-schema.ts"];
const EVIDENCE = /^(docs\/[^/]+\.md|fixtures\/[^/]+\.json|README\.md)$/;

/** AETHEL_GITHUB_REPOS = {"owner/repo": "<owning tenant id>"}; AETHEL_GITHUB_TOKEN = read-only token (server only). */
export function loadRepoAllowlist(env: Env = process.env): Map<string, string> {
  try {
    const parsed = JSON.parse(env.AETHEL_GITHUB_REPOS || "{}");
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return new Map();
    return new Map(Object.entries(parsed).filter((e): e is [string, string] => REPO.test(e[0]) && typeof e[1] === "string"));
  } catch { return new Map(); }
}
export function githubConnectionStatus(env: Env = process.env) {
  const repos = loadRepoAllowlist(env);
  return { configured: Boolean(env.AETHEL_GITHUB_TOKEN) && repos.size > 0, allowlisted_repos: repos.size };
}

export type RefAuthz = { ok: true; repo: string; ref: string } | { ok: false; status: 400 | 404; code: string; error: string };
/** Unknown repo and other-tenant repo return the same 404 so a tenant cannot infer another tenant's allowlist. */
export function authorizeRepo(tenant: string, repo: unknown, ref: unknown, env: Env = process.env): RefAuthz {
  if (typeof repo !== "string" || !REPO.test(repo)) return { ok: false, status: 400, code: "INVALID_REPO", error: "repo must be owner/name" };
  if (typeof ref !== "string" || !REF.test(ref) || ref.includes("..")) return { ok: false, status: 400, code: "INVALID_REF", error: "ref must be a branch, tag or commit sha" };
  if (loadRepoAllowlist(env).get(repo) !== tenant) return { ok: false, status: 404, code: "REPO_NOT_AUTHORIZED", error: "Repository is not authorized for this tenant" };
  return { ok: true, repo, ref };
}

export function githubTokenFetch(token: string): GitHubFetch {
  return async (path) => {
    if (!path.startsWith("/repos/")) throw new Error("Refusing non-repo GitHub path");
    const res = await fetch(`https://api.github.com${path}`, { cache: "no-store", redirect: "error",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" } });
    if (!res.ok) throw new Error(`GitHub read failed (${res.status})`);
    return res.json();
  };
}

const sha256 = (s: string | Buffer) => createHash("sha256").update(s).digest("hex");
const enc = (p: string) => p.split("/").map(encodeURIComponent).join("/");

export interface ReferenceSnapshot {
  version: typeof REFERENCE_VERSION; tenant: string; repo: string; ref: string; commit_sha: string; tree_sha: string;
  files: { path: string; git_sha: string; size: number }[];
  commits: { sha: string; date: string; message: string }[];
  contracts: { path: string; git_sha: string; sha256: string }[];
  evidence: { path: string; git_sha: string; sha256: string }[];
  excluded_paths: number;
}

export async function buildReferenceSnapshot(tenant: string, repo: string, ref: string, gh: GitHubFetch): Promise<ReferenceSnapshot> {
  const commit = await gh(`/repos/${repo}/commits/${enc(ref)}`) as { sha: string; commit: { tree: { sha: string } } };
  if (!/^[0-9a-f]{40}$/.test(commit?.sha ?? "")) throw new Error("Unexpected commit response");
  const tree = await gh(`/repos/${repo}/git/trees/${commit.commit.tree.sha}?recursive=1`) as { truncated?: boolean; tree: { path: string; type: string; sha: string; size?: number }[] };
  const blobs = tree.tree.filter((e) => e.type === "blob");
  const files = blobs.filter((e) => !SECRETISH.test(e.path)).map((e) => ({ path: e.path, git_sha: e.sha, size: e.size ?? 0 }))
    .sort((a, b) => a.path.localeCompare(b.path));
  const history = await gh(`/repos/${repo}/commits?sha=${commit.sha}&per_page=20`) as { sha: string; commit: { message: string; committer: { date: string } } }[];
  const hashFile = async (f: { path: string; git_sha: string }) => {
    const blob = await gh(`/repos/${repo}/git/blobs/${f.git_sha}`) as { content: string; encoding: string };
    const bytes = blob.encoding === "base64" ? Buffer.from(blob.content, "base64") : Buffer.from(blob.content);
    return { path: f.path, git_sha: f.git_sha, sha256: sha256(bytes) }; // content hashed, not stored or executed
  };
  const contracts = [], evidence = [];
  for (const f of files.filter((f) => CONTRACTS.includes(f.path))) contracts.push(await hashFile(f));
  for (const f of files.filter((f) => EVIDENCE.test(f.path)).slice(0, 50)) evidence.push(await hashFile(f));
  return { version: REFERENCE_VERSION, tenant, repo, ref, commit_sha: commit.sha, tree_sha: commit.commit.tree.sha, files,
    commits: history.map((c) => ({ sha: c.sha, date: c.commit.committer.date, message: c.commit.message.split("\n")[0].slice(0, 200) })),
    contracts, evidence, excluded_paths: blobs.length - files.length };
}

const refsDir = (tenant: string) => join(tenantRoot(tenant), "references");
export const referenceId = (s: ReferenceSnapshot) => `ref-${sha256(JSON.stringify([s.repo, s.commit_sha]))}`.slice(0, 36);

/** Immutable per tenant: one file per (repo, commit). Re-connecting the same commit returns the existing snapshot. */
export function saveReference(snapshot: ReferenceSnapshot): { reference_id: string; snapshot_sha256: string; created: boolean } {
  const dir = refsDir(snapshot.tenant);
  mkdirSync(dir, { recursive: true });
  const id = referenceId(snapshot), path = join(dir, `${id}.json`);
  const text = JSON.stringify(snapshot, null, 2) + "\n";
  if (existsSync(path)) {
    const stored = readReference(snapshot.tenant, id);
    if (!stored) throw new Error("Stored reference failed integrity check");
    return { reference_id: id, snapshot_sha256: stored.snapshot_sha256, created: false };
  }
  const fd = openSync(path, "wx");
  try { writeSync(fd, text); } finally { closeSync(fd); }
  const hashPath = join(dir, `${id}.sha256`);
  const fd2 = openSync(hashPath, "wx");
  try { writeSync(fd2, sha256(text)); } finally { closeSync(fd2); }
  return { reference_id: id, snapshot_sha256: sha256(text), created: true };
}

export function readReference(tenant: string, id: string): { snapshot: ReferenceSnapshot; snapshot_sha256: string } | null {
  if (!/^ref-[0-9a-f]{32}$/.test(id)) return null;
  try {
    const text = readFileSync(join(refsDir(tenant), `${id}.json`), "utf8");
    const expected = readFileSync(join(refsDir(tenant), `${id}.sha256`), "utf8").trim();
    const snapshot = JSON.parse(text) as ReferenceSnapshot;
    if (sha256(text) !== expected || snapshot.tenant !== tenant) return null;
    return { snapshot, snapshot_sha256: expected };
  } catch { return null; }
}

export function listReferences(tenant: string) {
  const dir = refsDir(tenant);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((n) => n.endsWith(".json")).sort().map((n) => n.slice(0, -5))
    .map((id) => ({ id, ref: readReference(tenant, id) }))
    .filter((x) => x.ref).map(({ id, ref }) => ({ reference_id: id, repo: ref!.snapshot.repo, commit_sha: ref!.snapshot.commit_sha, snapshot_sha256: ref!.snapshot_sha256 }));
}

export type ConnectOutcome = { status: 200 | 201 | 400 | 404 | 502 | 503; body: Record<string, unknown> };
/** Authorize (allowlist + owning tenant) before any upstream call; then snapshot and store immutably. */
export async function connectReference(tenant: string, body: unknown, env: Env = process.env, gh?: GitHubFetch): Promise<ConnectOutcome> {
  const b = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  const extra = Object.keys(b).filter((k) => k !== "repo" && k !== "ref");
  if (extra.length) return { status: 400, body: { code: "INVALID_REQUEST", error: `unknown field: ${extra.join(", ")}` } };
  const authz = authorizeRepo(tenant, b.repo, b.ref ?? "main", env);
  if (!authz.ok) return { status: authz.status, body: { code: authz.code, error: authz.error } };
  const fetcher = gh ?? (env.AETHEL_GITHUB_TOKEN ? githubTokenFetch(env.AETHEL_GITHUB_TOKEN) : null);
  if (!fetcher) return { status: 503, body: { code: "GITHUB_NOT_CONFIGURED", error: "AETHEL_GITHUB_TOKEN is not configured on this server" } };
  let snapshot: ReferenceSnapshot;
  try { snapshot = await buildReferenceSnapshot(tenant, authz.repo, authz.ref, fetcher); }
  catch { return { status: 502, body: { code: "GITHUB_READ_FAILED", error: "Could not read the authorized repository" } }; }
  const saved = saveReference(snapshot);
  return { status: saved.created ? 201 : 200, body: { ...saved, repo: snapshot.repo, ref: snapshot.ref, commit_sha: snapshot.commit_sha,
    files: snapshot.files.length, commits: snapshot.commits.length, contracts: snapshot.contracts.length, evidence: snapshot.evidence.length } };
}
