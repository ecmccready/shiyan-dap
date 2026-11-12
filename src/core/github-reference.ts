// Read-only GitHub reference adapter and independently anchored envelopes
// (local POSIX files by default; a durable ReferenceEnvelopeStore such as Neon when supplied).
import { createHash, randomUUID } from "node:crypto";
import {
  constants, closeSync, fsyncSync, fstatSync, linkSync, lstatSync,
  mkdirSync, openSync, readFileSync, readdirSync, unlinkSync, writeSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tenantRoot, TENANT_ID_PATTERN } from "./tenant-auth";

type Env = Record<string, string | undefined>;
export type GitHubFetch = (path: string) => Promise<unknown>;
export const REFERENCE_VERSION = "aethel.reference/1";
const REPO = /^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9._-]{1,100}$/;
const REF = /^[A-Za-z0-9][A-Za-z0-9._\/-]{0,99}$/;
const SECRETISH = /(^|\/)(\.env[^/]*|.*\.(pem|key|p12|pfx)|id_rsa[^/]*|.*secret[^/]*|.*credential[^/]*)$/i;
const CONTRACTS = ["src/core/interfaces.ts", "src/core/platform-contract.ts", "src/core/run-contract.ts", "src/core/experience-schema.ts"];
const EVIDENCE = /^(docs\/[^/]+\.md|fixtures\/[^/]+\.json|README\.md)$/;
const REFERENCE_LIMITS = {
  treeEntries: 100_000, pathBytes: 4_096, historyCommits: 20,
  historyMessageBytes: 65_536, evidenceFiles: 50,
  blobBytes: 2 * 1024 * 1024, totalBlobBytes: 16 * 1024 * 1024,
} as const;
const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const enc = (path: string) => path.split("/").map(encodeURIComponent).join("/");

/** AETHEL_GITHUB_REPOS maps owner/repo to its owning tenant. Invalid policy denies all. */
export function loadRepoAllowlist(env: Env = process.env): Map<string, string> {
  try {
    const parsed: unknown = JSON.parse(env.AETHEL_GITHUB_REPOS || "{}");
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return new Map();
    const policy = new Map<string, string>();
    for (const [repo, tenant] of Object.entries(parsed)) {
      if (!REPO.test(repo) || typeof tenant !== "string" || !TENANT_ID_PATTERN.test(tenant)) return new Map();
      policy.set(repo, tenant);
    }
    return policy;
  } catch { return new Map(); }
}
export function githubConnectionStatus(env: Env = process.env) {
  const repos = loadRepoAllowlist(env);
  return { configured: Boolean(env.AETHEL_GITHUB_TOKEN) && repos.size > 0, allowlisted_repos: repos.size };
}
export type RefAuthz =
  | { ok: true; repo: string; ref: string }
  | { ok: false; status: 400 | 404; code: string; error: string };
/** Unknown and another tenant's repository have the same response. */
export function authorizeRepo(tenant: string, repo: unknown, ref: unknown, env: Env = process.env): RefAuthz {
  if (typeof repo !== "string" || !REPO.test(repo)) return { ok: false, status: 400, code: "INVALID_REPO", error: "repo must be owner/name" };
  if (typeof ref !== "string" || !REF.test(ref) || ref.includes("..")) return { ok: false, status: 400, code: "INVALID_REF", error: "ref must be a branch, tag or commit sha" };
  if (loadRepoAllowlist(env).get(repo) !== tenant) return { ok: false, status: 404, code: "REPO_NOT_AUTHORIZED", error: "Repository is not authorized for this tenant" };
  return { ok: true, repo, ref };
}
export function githubTokenFetch(token: string): GitHubFetch {
  return async (path) => {
    if (!path.startsWith("/repos/")) throw new Error("Refusing non-repo GitHub path");
    const res = await fetch(`https://api.github.com${path}`, {
      cache: "no-store", redirect: "error",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
    });
    if (!res.ok) throw new Error(`GitHub read failed (${res.status})`);
    return res.json();
  };
}

export interface ReferenceSnapshot {
  version: typeof REFERENCE_VERSION;
  tenant: string; repo: string; ref: string; commit_sha: string; tree_sha: string;
  files: { path: string; git_sha: string; size: number }[];
  commits: { sha: string; date: string; message: string }[];
  contracts: { path: string; git_sha: string; sha256: string }[];
  evidence: { path: string; git_sha: string; sha256: string }[];
  excluded_paths: number;
  // Optional for additive v1 compatibility only. Absence proves no coverage guarantee.
  collection?: {
    tree: { complete: true; entries: number; scope: "repository-tree-only; submodule contents not traversed" };
    history: {
      limit: number; returned: number;
      completeness: "unknown; pagination not inspected";
      messages: "first line, at most 200 UTF-16 code units";
    };
    contracts: { expected_paths: string[]; missing_paths: string[] };
    evidence: {
      limit: number; candidates: number; hashed: number; omitted_due_to_limit: number;
      scope: "non-secret blobs matching EVIDENCE only";
    };
    limits: { tree_entries: number; path_bytes: number; history_message_bytes: number; blob_bytes: number; total_blob_bytes: number };
  };
}
function referenceObject(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`Invalid GitHub ${label}`);
  return value as Record<string, unknown>;
}
function referenceSha(value: unknown, label: string): string {
  if (typeof value !== "string" || !/^[0-9a-f]{40}$/.test(value)) throw new Error(`Invalid GitHub ${label}`);
  return value;
}
function referenceSize(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new Error(`Invalid GitHub ${label}`);
  return value;
}
function referencePath(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 ||
      Buffer.byteLength(value, "utf8") > REFERENCE_LIMITS.pathBytes ||
      /[\u0000-\u001f\u007f\\]/.test(value) ||
      value.split("/").some((part) => part === "" || part === "." || part === "..")) {
    throw new Error("Invalid or unsupported GitHub tree path");
  }
  return value;
}
function referenceDate(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value)) throw new Error("Invalid GitHub commit date");
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString().replace(".000Z", "Z") !== value) throw new Error("Invalid GitHub commit date");
  return value;
}

/** Caller must authorize ownership first. Parsed-response caps are not HTTP transport limits. */
export async function buildReferenceSnapshot(tenant: string, repo: string, ref: string, gh: GitHubFetch): Promise<ReferenceSnapshot> {
  if (!TENANT_ID_PATTERN.test(tenant) || !REPO.test(repo) || !REF.test(ref) || ref.includes("..")) throw new Error("Invalid reference parameters");
  const commitResponse = referenceObject(await gh(`/repos/${repo}/commits/${enc(ref)}`), "commit response");
  const commitSha = referenceSha(commitResponse.sha, "commit SHA");
  const commitData = referenceObject(commitResponse.commit, "commit data");
  const commitTree = referenceObject(commitData.tree, "commit tree");
  const treeSha = referenceSha(commitTree.sha, "commit tree SHA");
  const treeResponse = referenceObject(await gh(`/repos/${repo}/git/trees/${treeSha}?recursive=1`), "tree response");
  if (treeResponse.truncated !== false) throw new Error("GitHub tree completeness is not confirmed");
  if (referenceSha(treeResponse.sha, "tree SHA") !== treeSha) throw new Error("GitHub tree SHA mismatch");
  if (!Array.isArray(treeResponse.tree) || treeResponse.tree.length > REFERENCE_LIMITS.treeEntries) throw new Error("Invalid or oversized GitHub tree");
  const treeEntries: unknown[] = treeResponse.tree;
  const paths = new Set<string>();
  const blobs: { path: string; git_sha: string; size: number }[] = [];
  for (const value of treeEntries) {
    const entry = referenceObject(value, "tree entry");
    const path = referencePath(entry.path);
    const gitSha = referenceSha(entry.sha, "tree-entry SHA");
    if (paths.has(path)) throw new Error("Duplicate GitHub tree path");
    paths.add(path);
    const validMode =
      (entry.type === "blob" && (entry.mode === "100644" || entry.mode === "100755" || entry.mode === "120000")) ||
      (entry.type === "tree" && entry.mode === "040000") ||
      (entry.type === "commit" && entry.mode === "160000");
    if (!validMode) throw new Error("Invalid GitHub tree type/mode");
    if (entry.type === "blob") blobs.push({ path, git_sha: gitSha, size: referenceSize(entry.size, "blob size") });
    else if (entry.size !== undefined) referenceSize(entry.size, "tree-entry size");
  }
  const files = blobs.filter((entry) => !SECRETISH.test(entry.path))
    .sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  const historyResponse = await gh(`/repos/${repo}/commits?sha=${commitSha}&per_page=${REFERENCE_LIMITS.historyCommits}`);
  if (!Array.isArray(historyResponse) || historyResponse.length === 0 || historyResponse.length > REFERENCE_LIMITS.historyCommits) throw new Error("Invalid GitHub commit history");
  const historyShas = new Set<string>();
  const commits: ReferenceSnapshot["commits"] = [];
  for (const value of historyResponse) {
    const item = referenceObject(value, "history entry");
    const sha = referenceSha(item.sha, "history commit SHA");
    if (historyShas.has(sha)) throw new Error("Duplicate GitHub history commit");
    historyShas.add(sha);
    const data = referenceObject(item.commit, "history commit data");
    if (typeof data.message !== "string" || Buffer.byteLength(data.message, "utf8") > REFERENCE_LIMITS.historyMessageBytes) throw new Error("Invalid or oversized GitHub commit message");
    const committer = referenceObject(data.committer, "history committer");
    commits.push({ sha, date: referenceDate(committer.date), message: data.message.split("\n")[0].slice(0, 200) });
  }
  if (commits[0].sha !== commitSha) throw new Error("GitHub history is not rooted at the resolved commit");
  let totalBlobBytes = 0;
  const hashFile = async (file: { path: string; git_sha: string; size: number }): Promise<{ path: string; git_sha: string; sha256: string }> => {
    if (file.size > REFERENCE_LIMITS.blobBytes || totalBlobBytes + file.size > REFERENCE_LIMITS.totalBlobBytes) throw new Error("GitHub reference blob budget exceeded");
    const blob = referenceObject(await gh(`/repos/${repo}/git/blobs/${file.git_sha}`), "blob response");
    if (referenceSha(blob.sha, "blob SHA") !== file.git_sha || referenceSize(blob.size, "blob response size") !== file.size || blob.encoding !== "base64" || typeof blob.content !== "string") throw new Error("Invalid GitHub blob response");
    const maxEncodedLength = 4 * Math.ceil(REFERENCE_LIMITS.blobBytes / 3);
    if (blob.content.length > 2 * maxEncodedLength + 1024) throw new Error("Oversized GitHub blob encoding");
    const encoded = blob.content.replace(/[\r\n]/g, "");
    if (encoded.length > maxEncodedLength || encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) throw new Error("Invalid GitHub base64 content");
    const bytes = Buffer.from(encoded, "base64");
    if (bytes.length !== file.size || bytes.toString("base64") !== encoded) throw new Error("GitHub blob content/size mismatch");
    const gitSha = createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
    if (gitSha !== file.git_sha) throw new Error("GitHub blob identity mismatch");
    totalBlobBytes += bytes.length;
    return { path: file.path, git_sha: file.git_sha, sha256: sha256(bytes) };
  };
  const contractFiles = files.filter((file) => CONTRACTS.includes(file.path));
  const evidenceCandidates = files.filter((file) => EVIDENCE.test(file.path));
  const selectedEvidence = evidenceCandidates.slice(0, REFERENCE_LIMITS.evidenceFiles);
  const contracts: ReferenceSnapshot["contracts"] = [];
  const evidence: ReferenceSnapshot["evidence"] = [];
  for (const file of contractFiles) contracts.push(await hashFile(file));
  for (const file of selectedEvidence) evidence.push(await hashFile(file));
  const foundContracts = new Set(contractFiles.map((file) => file.path));
  return {
    version: REFERENCE_VERSION, tenant, repo, ref, commit_sha: commitSha, tree_sha: treeSha,
    files, commits, contracts, evidence, excluded_paths: blobs.length - files.length,
    collection: {
      tree: { complete: true, entries: treeEntries.length, scope: "repository-tree-only; submodule contents not traversed" },
      history: { limit: REFERENCE_LIMITS.historyCommits, returned: commits.length, completeness: "unknown; pagination not inspected", messages: "first line, at most 200 UTF-16 code units" },
      contracts: { expected_paths: [...CONTRACTS], missing_paths: CONTRACTS.filter((path) => !foundContracts.has(path)) },
      evidence: { limit: REFERENCE_LIMITS.evidenceFiles, candidates: evidenceCandidates.length, hashed: evidence.length, omitted_due_to_limit: evidenceCandidates.length - evidence.length, scope: "non-secret blobs matching EVIDENCE only" },
      limits: { tree_entries: REFERENCE_LIMITS.treeEntries, path_bytes: REFERENCE_LIMITS.pathBytes, history_message_bytes: REFERENCE_LIMITS.historyMessageBytes, blob_bytes: REFERENCE_LIMITS.blobBytes, total_blob_bytes: REFERENCE_LIMITS.totalBlobBytes },
    },
  };
}

const ENVELOPE_FORMAT = "aethel.reference-envelope/1" as const;
const ANCHOR_VERSION = "aethel.reference-anchor/1" as const;
const REFERENCE_ID = /^ref-[0-9a-f]{32}$/;
const SHA256_HEX = /^[0-9a-f]{64}$/;
const GIT_SHA = /^[0-9a-f]{40}$/;
const MAX_RECORD_BYTES = 32 * 1024 * 1024;
const MAX_LIST_RECORDS = 10_000;
export interface ReferenceAnchor {
  anchor_version: typeof ANCHOR_VERSION;
  envelope_format: typeof ENVELOPE_FORMAT;
  tenant: string; reference_id: string; repo: string; commit_sha: string;
  snapshot_sha256: string; envelope_sha256: string;
}
/**
 * REQUIRED independently administered immutable backend; no local fallback.
 * Application credentials cannot overwrite/delete or weaken retention.
 * createIfAbsent atomically commits (tenant,id), acknowledges durability, and
 * returns the existing durable winner on conflict. get is strongly consistent:
 * null means authoritative absence; outages THROW. listTenant is complete and
 * strongly consistent, handles pagination, and includes pending publications.
 * Backend policy and a real adapter must enforce these properties.
 */
export interface IndependentReferenceAnchors {
  createIfAbsent(anchor: ReferenceAnchor): Promise<ReferenceAnchor>;
  get(tenant: string, id: string): Promise<ReferenceAnchor | null>;
  listTenant(tenant: string): Promise<readonly ReferenceAnchor[]>;
}
/**
 * Optional durable envelope store (e.g. Neon). When omitted, envelopes use the local POSIX files below.
 * putIfAbsent never overwrites: it inserts only if (tenant,id) is absent and returns the durable stored
 * bytes, with created=true only for the insert that won. get is strongly consistent: null means
 * authoritative absence; outages THROW. listIds is complete for the tenant.
 * Envelope bytes are always verified against the independent anchor; this store is not trusted.
 */
export interface ReferenceEnvelopeStore {
  putIfAbsent(tenant: string, id: string, bytes: Buffer): Promise<{ bytes: Buffer; created: boolean }>;
  get(tenant: string, id: string): Promise<Buffer | null>;
  listIds(tenant: string): Promise<readonly string[]>;
}
export class ReferenceStorageError extends Error {}
type StoredReference = { snapshot: ReferenceSnapshot; snapshot_sha256: string };
const refsDir = (tenant: string) => resolve(tenantRoot(tenant), "references");
const storageId = (repo: string, commit: string) => `ref-${sha256(JSON.stringify([repo, commit]))}`.slice(0, 36);
export const referenceId = (snapshot: ReferenceSnapshot) => storageId(snapshot.repo, snapshot.commit_sha);
function anchorStore(store?: IndependentReferenceAnchors): IndependentReferenceAnchors {
  if (!store) throw new ReferenceStorageError("Independent reference integrity storage is not configured");
  return store;
}
function errno(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}
function storageObject(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new ReferenceStorageError("Invalid reference record object");
  return value as Record<string, unknown>;
}
function validStoragePath(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && Buffer.byteLength(value, "utf8") <= REFERENCE_LIMITS.pathBytes &&
    !/[\u0000-\u001f\u007f\\]/.test(value) && !value.split("/").some((part) => part === "" || part === "." || part === "..");
}
function nonnegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
/** Core v1 schema only; optional additive collection metadata is not a validation certificate. */
function storageSnapshot(value: unknown, tenant: string, id?: string): ReferenceSnapshot {
  const snapshot = storageObject(value);
  if (!TENANT_ID_PATTERN.test(tenant) || snapshot.version !== REFERENCE_VERSION || snapshot.tenant !== tenant ||
      typeof snapshot.repo !== "string" || !REPO.test(snapshot.repo) ||
      typeof snapshot.ref !== "string" || !REF.test(snapshot.ref) || snapshot.ref.includes("..") ||
      typeof snapshot.commit_sha !== "string" || !GIT_SHA.test(snapshot.commit_sha) ||
      typeof snapshot.tree_sha !== "string" || !GIT_SHA.test(snapshot.tree_sha) || !nonnegativeInteger(snapshot.excluded_paths)) {
    throw new ReferenceStorageError("Invalid reference snapshot identity");
  }
  if (id !== undefined && storageId(snapshot.repo, snapshot.commit_sha) !== id) throw new ReferenceStorageError("Reference ID mismatch");
  if (!Array.isArray(snapshot.files) || snapshot.files.length > REFERENCE_LIMITS.treeEntries) throw new ReferenceStorageError("Invalid reference file inventory");
  const files = new Map<string, string>();
  for (const value of snapshot.files) {
    const file = storageObject(value);
    if (!validStoragePath(file.path) || SECRETISH.test(file.path) || typeof file.git_sha !== "string" || !GIT_SHA.test(file.git_sha) || !nonnegativeInteger(file.size) || files.has(file.path)) throw new ReferenceStorageError("Invalid reference file");
    files.set(file.path, file.git_sha);
  }
  if (!Array.isArray(snapshot.commits) || snapshot.commits.length === 0 || snapshot.commits.length > REFERENCE_LIMITS.historyCommits) throw new ReferenceStorageError("Invalid reference history");
  const commits = new Set<string>();
  for (const value of snapshot.commits) {
    const commit = storageObject(value);
    if (typeof commit.sha !== "string" || !GIT_SHA.test(commit.sha) || commits.has(commit.sha) ||
        typeof commit.date !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(commit.date) || !Number.isFinite(Date.parse(commit.date)) ||
        typeof commit.message !== "string" || commit.message.length > 200 || commit.message.includes("\n")) throw new ReferenceStorageError("Invalid reference history entry");
    if (new Date(commit.date).toISOString().replace(".000Z", "Z") !== commit.date) throw new ReferenceStorageError("Invalid reference history date");
    commits.add(commit.sha);
  }
  if (storageObject(snapshot.commits[0]).sha !== snapshot.commit_sha) throw new ReferenceStorageError("Reference history root mismatch");
  for (const field of ["contracts", "evidence"] as const) {
    const entries = snapshot[field];
    const limit = field === "contracts" ? CONTRACTS.length : REFERENCE_LIMITS.evidenceFiles;
    if (!Array.isArray(entries) || entries.length > limit) throw new ReferenceStorageError("Invalid reference hash inventory");
    const seen = new Set<string>();
    for (const value of entries) {
      const item = storageObject(value);
      if (!validStoragePath(item.path) || seen.has(item.path) || typeof item.git_sha !== "string" || files.get(item.path) !== item.git_sha ||
          typeof item.sha256 !== "string" || !SHA256_HEX.test(item.sha256) ||
          (field === "contracts" ? !CONTRACTS.includes(item.path) : !EVIDENCE.test(item.path))) throw new ReferenceStorageError("Invalid reference hash entry");
      seen.add(item.path);
    }
  }
  if (snapshot.collection !== undefined) storageObject(snapshot.collection);
  return snapshot as unknown as ReferenceSnapshot;
}
function checkedAnchor(value: unknown, tenant: string, id: string): ReferenceAnchor {
  const anchor = storageObject(value);
  if (anchor.anchor_version !== ANCHOR_VERSION || anchor.envelope_format !== ENVELOPE_FORMAT ||
      anchor.tenant !== tenant || !TENANT_ID_PATTERN.test(tenant) || anchor.reference_id !== id || !REFERENCE_ID.test(id) ||
      typeof anchor.repo !== "string" || !REPO.test(anchor.repo) || typeof anchor.commit_sha !== "string" || !GIT_SHA.test(anchor.commit_sha) ||
      storageId(anchor.repo, anchor.commit_sha) !== id || typeof anchor.snapshot_sha256 !== "string" || !SHA256_HEX.test(anchor.snapshot_sha256) ||
      typeof anchor.envelope_sha256 !== "string" || !SHA256_HEX.test(anchor.envelope_sha256)) throw new ReferenceStorageError("Invalid independent reference anchor");
  return anchor as unknown as ReferenceAnchor;
}
function sameAnchor(first: ReferenceAnchor, second: ReferenceAnchor): boolean {
  return (["anchor_version", "envelope_format", "tenant", "reference_id", "repo", "commit_sha", "snapshot_sha256", "envelope_sha256"] as const)
    .every((key) => first[key] === second[key]);
}
function syncDirectory(path: string): void {
  const fd = openSync(path, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  try {
    if (!fstatSync(fd).isDirectory()) throw new ReferenceStorageError("Reference directory is not a directory");
    fsyncSync(fd);
  } finally { closeSync(fd); }
}
/**
 * Persistent POSIX storage, working hard links/fsync, trusted ownership/ACLs
 * and non-adversarial ancestors are required. Existing permissions are not
 * repaired. Path checks do not defeat a hostile local administrator.
 * Creation fsyncs each directory and its parent, including new ancestors.
 */
function checkedDirectory(path: string, create: boolean): boolean {
  const parent = dirname(path);
  if (parent !== path && !checkedDirectory(parent, create)) return false;
  try {
    const stat = lstatSync(path);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new ReferenceStorageError("Unsafe reference directory");
  } catch (error) {
    if (!errno(error, "ENOENT")) throw error;
    if (!create) return false;
    try { mkdirSync(path, { mode: 0o700 }); }
    catch (mkdirError) { if (!errno(mkdirError, "EEXIST")) throw mkdirError; }
    const stat = lstatSync(path);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new ReferenceStorageError("Unsafe reference directory");
  }
  if (create) {
    syncDirectory(path);
    if (parent !== path) syncDirectory(parent);
  }
  return true;
}
function localBytes(tenant: string, id: string): Buffer | null {
  const dir = refsDir(tenant);
  if (!checkedDirectory(dir, false)) return null;
  try {
    lstatSync(join(dir, `${id}.sha256`));
    throw new ReferenceStorageError("Legacy reference requires migration");
  } catch (error) { if (!errno(error, "ENOENT")) throw error; }
  let fd: number;
  try { fd = openSync(join(dir, `${id}.json`), constants.O_RDONLY | constants.O_NOFOLLOW); }
  catch (error) { if (errno(error, "ENOENT")) return null; throw error; }
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.size > MAX_RECORD_BYTES) throw new ReferenceStorageError("Invalid reference record file");
    const bytes = readFileSync(fd);
    if (bytes.length > MAX_RECORD_BYTES) throw new ReferenceStorageError("Oversized reference record");
    return bytes;
  } finally { closeSync(fd); }
}
function verifiedEnvelope(bytes: Buffer, tenant: string, id: string, anchor: ReferenceAnchor): StoredReference {
  if (sha256(bytes) !== anchor.envelope_sha256) throw new ReferenceStorageError("Independent envelope hash mismatch");
  const envelope = storageObject(JSON.parse(bytes.toString("utf8")));
  if (envelope.format !== ENVELOPE_FORMAT || envelope.tenant !== tenant || envelope.reference_id !== id ||
      typeof envelope.snapshot_json !== "string" || typeof envelope.snapshot_sha256 !== "string" ||
      sha256(envelope.snapshot_json) !== envelope.snapshot_sha256 || envelope.snapshot_sha256 !== anchor.snapshot_sha256) throw new ReferenceStorageError("Invalid reference envelope");
  const snapshot = storageSnapshot(JSON.parse(envelope.snapshot_json), tenant, id);
  if (snapshot.repo !== anchor.repo || snapshot.commit_sha !== anchor.commit_sha) throw new ReferenceStorageError("Independent reference identity mismatch");
  return { snapshot, snapshot_sha256: envelope.snapshot_sha256 };
}
function stabilizePublishedFile(dir: string, id: string): void {
  const fd = openSync(join(dir, `${id}.json`), constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    if (!fstatSync(fd).isFile()) throw new ReferenceStorageError("Invalid published reference");
    fsyncSync(fd);
  } finally { closeSync(fd); }
  syncDirectory(dir);
}
async function remoteBytes(envelopes: ReferenceEnvelopeStore, tenant: string, id: string): Promise<Buffer | null> {
  const bytes = await envelopes.get(tenant, id);
  if (bytes === null) return null;
  if (!Buffer.isBuffer(bytes) || bytes.length > MAX_RECORD_BYTES) throw new ReferenceStorageError("Invalid or oversized reference envelope");
  return bytes;
}
export async function readReference(tenant: string, id: string, anchors?: IndependentReferenceAnchors, envelopes?: ReferenceEnvelopeStore): Promise<StoredReference | null> {
  const store = anchorStore(anchors);
  if (!TENANT_ID_PATTERN.test(tenant)) throw new ReferenceStorageError("Invalid tenant");
  if (!REFERENCE_ID.test(id)) return null;
  const result = await store.get(tenant, id);
  const anchor = result === null ? null : checkedAnchor(result, tenant, id);
  const bytes = envelopes ? await remoteBytes(envelopes, tenant, id) : localBytes(tenant, id);
  if (!anchor && !bytes) return null;
  if (!anchor || !bytes) throw new ReferenceStorageError("Reference integrity/publication incomplete");
  const stored = verifiedEnvelope(bytes, tenant, id, anchor);
  // A reader can race the writer immediately after link(): do not acknowledge
  // publication until the final file and directory have been fsynced.
  if (!envelopes) stabilizePublishedFile(refsDir(tenant), id);
  return stored;
}
/** Anchor first, then envelope; a crash between them leaves an anchored-but-unpublished id that a retry completes. */
async function saveRemoteReference(checked: ReferenceSnapshot, snapshotJson: string, id: string, store: IndependentReferenceAnchors, envelopes: ReferenceEnvelopeStore): Promise<{ reference_id: string; snapshot_sha256: string; created: boolean }> {
  const tenant = checked.tenant;
  if (await remoteBytes(envelopes, tenant, id) !== null) {
    const existing = await readReference(tenant, id, store, envelopes);
    if (!existing || existing.snapshot.repo !== checked.repo || existing.snapshot.commit_sha !== checked.commit_sha) throw new ReferenceStorageError("Conflicting stored reference");
    return { reference_id: id, snapshot_sha256: existing.snapshot_sha256, created: false };
  }
  const snapshotHash = sha256(snapshotJson);
  const bytes = Buffer.from(JSON.stringify({ format: ENVELOPE_FORMAT, tenant, reference_id: id, snapshot_json: snapshotJson, snapshot_sha256: snapshotHash }) + "\n", "utf8");
  if (bytes.length > MAX_RECORD_BYTES) throw new ReferenceStorageError("Oversized reference envelope");
  const proposed: ReferenceAnchor = {
    anchor_version: ANCHOR_VERSION, envelope_format: ENVELOPE_FORMAT,
    tenant, reference_id: id, repo: checked.repo, commit_sha: checked.commit_sha,
    snapshot_sha256: snapshotHash, envelope_sha256: sha256(bytes),
  };
  const winner = checkedAnchor(await store.createIfAbsent(proposed), tenant, id);
  if (!sameAnchor(winner, proposed)) {
    const existing = await readReference(tenant, id, store, envelopes);
    if (!existing || existing.snapshot.repo !== checked.repo || existing.snapshot.commit_sha !== checked.commit_sha) throw new ReferenceStorageError("Conflicting independent anchor");
    return { reference_id: id, snapshot_sha256: existing.snapshot_sha256, created: false };
  }
  const put = await envelopes.putIfAbsent(tenant, id, bytes);
  const stored = await readReference(tenant, id, store, envelopes);
  if (!stored) throw new ReferenceStorageError("Published reference disappeared");
  return { reference_id: id, snapshot_sha256: stored.snapshot_sha256, created: put.created === true };
}
export async function saveReference(snapshot: ReferenceSnapshot, anchors?: IndependentReferenceAnchors, envelopes?: ReferenceEnvelopeStore): Promise<{ reference_id: string; snapshot_sha256: string; created: boolean }> {
  const store = anchorStore(anchors);
  const snapshotJson = JSON.stringify(snapshot);
  const checked = storageSnapshot(JSON.parse(snapshotJson), snapshot.tenant);
  const id = referenceId(checked);
  if (envelopes) return saveRemoteReference(checked, snapshotJson, id, store, envelopes);
  const dir = refsDir(checked.tenant);
  checkedDirectory(dir, true);
  if (localBytes(checked.tenant, id) !== null) {
    const existing = await readReference(checked.tenant, id, store);
    if (!existing || existing.snapshot.repo !== checked.repo || existing.snapshot.commit_sha !== checked.commit_sha) throw new ReferenceStorageError("Conflicting stored reference");
    return { reference_id: id, snapshot_sha256: existing.snapshot_sha256, created: false };
  }
  const snapshotHash = sha256(snapshotJson);
  const bytes = Buffer.from(JSON.stringify({ format: ENVELOPE_FORMAT, tenant: checked.tenant, reference_id: id, snapshot_json: snapshotJson, snapshot_sha256: snapshotHash }) + "\n", "utf8");
  if (bytes.length > MAX_RECORD_BYTES) throw new ReferenceStorageError("Oversized reference envelope");
  const proposed: ReferenceAnchor = {
    anchor_version: ANCHOR_VERSION, envelope_format: ENVELOPE_FORMAT,
    tenant: checked.tenant, reference_id: id, repo: checked.repo, commit_sha: checked.commit_sha,
    snapshot_sha256: snapshotHash, envelope_sha256: sha256(bytes),
  };
  const temp = join(dir, `.reference-${randomUUID()}.tmp`);
  const fd = openSync(temp, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  try {
    let offset = 0;
    while (offset < bytes.length) {
      const written = writeSync(fd, bytes, offset, bytes.length - offset, null);
      if (written <= 0) throw new ReferenceStorageError("Reference write made no progress");
      offset += written;
    }
    fsyncSync(fd);
  } finally { closeSync(fd); }
  syncDirectory(dir);
  let completed = false;
  try {
    const winner = checkedAnchor(await store.createIfAbsent(proposed), checked.tenant, id);
    if (!sameAnchor(winner, proposed)) {
      const existing = await readReference(checked.tenant, id, store);
      if (!existing || existing.snapshot.repo !== checked.repo || existing.snapshot.commit_sha !== checked.commit_sha) throw new ReferenceStorageError("Conflicting independent anchor");
      completed = true;
      return { reference_id: id, snapshot_sha256: existing.snapshot_sha256, created: false };
    }
    let created = true;
    try { linkSync(temp, join(dir, `${id}.json`)); }
    catch (error) { if (!errno(error, "EEXIST")) throw error; created = false; }
    const stored = await readReference(checked.tenant, id, store);
    if (!stored) throw new ReferenceStorageError("Published reference disappeared");
    completed = true;
    return { reference_id: id, snapshot_sha256: stored.snapshot_sha256, created };
  } finally {
    if (completed) { unlinkSync(temp); syncDirectory(dir); }
    // On failure preserve staged bytes for controlled recovery against the
    // real anchor. Never list/publish temp files or overwrite a final record.
  }
}
export async function listReferences(tenant: string, anchors?: IndependentReferenceAnchors, envelopes?: ReferenceEnvelopeStore) {
  const store = anchorStore(anchors);
  if (!TENANT_ID_PATTERN.test(tenant)) throw new ReferenceStorageError("Invalid tenant");
  const anchored = await store.listTenant(tenant);
  if (!Array.isArray(anchored) || anchored.length > MAX_LIST_RECORDS) throw new ReferenceStorageError("Invalid or oversized anchor listing");
  const ids = new Set<string>();
  for (const value of anchored) {
    const item = storageObject(value);
    if (typeof item.reference_id !== "string") throw new ReferenceStorageError("Invalid anchor listing entry");
    const anchor = checkedAnchor(value, tenant, item.reference_id);
    if (ids.has(anchor.reference_id)) throw new ReferenceStorageError("Duplicate anchor listing entry");
    ids.add(anchor.reference_id);
  }
  if (envelopes) {
    const published = await envelopes.listIds(tenant);
    if (!Array.isArray(published) || published.length > MAX_LIST_RECORDS) throw new ReferenceStorageError("Invalid or oversized envelope listing");
    for (const value of published) {
      if (typeof value !== "string" || !REFERENCE_ID.test(value)) throw new ReferenceStorageError("Invalid envelope listing entry");
      ids.add(value);
    }
  } else {
    const dir = refsDir(tenant);
    if (checkedDirectory(dir, false)) {
      for (const name of readdirSync(dir)) {
        const match = /^(ref-[0-9a-f]{32})\.(json|sha256)$/.exec(name);
        if (match) ids.add(match[1]);
      }
    }
  }
  if (ids.size > MAX_LIST_RECORDS) throw new ReferenceStorageError("Reference listing limit exceeded");
  const result: { reference_id: string; repo: string; commit_sha: string; snapshot_sha256: string }[] = [];
  for (const id of [...ids].sort()) {
    const stored = await readReference(tenant, id, store, envelopes);
    if (!stored) throw new ReferenceStorageError("Listed reference is missing");
    result.push({ reference_id: id, repo: stored.snapshot.repo, commit_sha: stored.snapshot.commit_sha, snapshot_sha256: stored.snapshot_sha256 });
  }
  return result;
}

export type ConnectOutcome = { status: 200 | 201 | 400 | 404 | 502 | 503; body: Record<string, unknown> };
/** Authorization precedes all upstream access. Missing independent anchors fails closed. */
export async function connectReference(tenant: string, body: unknown, env: Env = process.env, gh?: GitHubFetch, anchors?: IndependentReferenceAnchors, envelopes?: ReferenceEnvelopeStore): Promise<ConnectOutcome> {
  const b = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  const extra = Object.keys(b).filter((key) => key !== "repo" && key !== "ref");
  if (extra.length) return { status: 400, body: { code: "INVALID_REQUEST", error: `unknown field: ${extra.join(", ")}` } };
  const authz = authorizeRepo(tenant, b.repo, b.ref ?? "main", env);
  if (!authz.ok) return { status: authz.status, body: { code: authz.code, error: authz.error } };
  if (!anchors) return { status: 503, body: { code: "REFERENCE_STORAGE_NOT_CONFIGURED", error: "Independent reference integrity storage is not configured" } };
  const fetcher = gh ?? (env.AETHEL_GITHUB_TOKEN ? githubTokenFetch(env.AETHEL_GITHUB_TOKEN) : null);
  if (!fetcher) return { status: 503, body: { code: "GITHUB_NOT_CONFIGURED", error: "GitHub reference access is not configured" } };
  let snapshot: ReferenceSnapshot;
  try { snapshot = await buildReferenceSnapshot(tenant, authz.repo, authz.ref, fetcher); }
  catch { return { status: 502, body: { code: "GITHUB_READ_FAILED", error: "Could not read the authorized repository" } }; }
  try {
    const saved = await saveReference(snapshot, anchors, envelopes);
    const stored = await readReference(tenant, saved.reference_id, anchors, envelopes);
    if (!stored) throw new ReferenceStorageError("Saved reference missing");
    const s = stored.snapshot;
    return { status: saved.created ? 201 : 200, body: {
      ...saved, repo: s.repo, ref: s.ref, commit_sha: s.commit_sha,
      files: s.files.length, commits: s.commits.length, contracts: s.contracts.length, evidence: s.evidence.length,
    } };
  } catch {
    return { status: 503, body: { code: "REFERENCE_STORAGE_UNAVAILABLE", error: "Reference storage or independent integrity verification failed" } };
  }
}