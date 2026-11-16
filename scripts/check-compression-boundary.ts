/** TEST ONLY. Import-boundary check for src/core/compression/**. Reads source files; no network, no writes.
 * Fails (exit 1) if a compression module imports anything outside its allowlist, reaches a forbidden
 * module transitively (MetamorphicEngine, metamorphic-runtime, deterministic-proof, self-engine, src/lib/level4),
 * or uses a non-deterministic / I/O primitive directly.
 * Sync: scripts/sync-state-chains.ts is an edge CLI like the others; it may import both writers (reusing their
 *     allowlists and locks), never the export reader, a route, Level 4 or the engine.
 * M5: anchor-store.ts may only INSERT INTO shiyan_anchor.state_chain_anchors and is imported only by
 *     scripts/anchor-state-chain.ts. export-reader.ts is the ONE read-only module the app may import, and only from
 *     src/app/api/v1/customer-proof/[id]/route.ts; it never reaches a writer (store.ts, anchor-store.ts) or source.ts.
 * M4: store.ts is the only module allowed any write SQL, and only INSERT INTO shiyan.state_segments; only
 *     scripts/persist-tenant-segments.ts may import it. Every other compression file and the read-only CLI contain no write SQL.
 * M3: the pure core may not import source.ts (the only I/O module); new core files are covered automatically.
 * M2: also checks the read-only edge (src/core/compression/source.ts and scripts/compress-tenant.ts): no write
 * SQL, no file-write APIs, and the CLI may import only an allowlist (never routes, Level 4 or write modules).
 * Run: npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-compression-boundary.ts
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

const root = resolve(join(import.meta.dirname, ".."));
const src = join(root, "src");
const compressionDir = join(src, "core", "compression");
const posix = (p: string) => relative(root, p).split(sep).join("/");

const FORBIDDEN = [
  "src/core/metamorphic.ts",
  "src/core/metamorphic-runtime.ts",
  "src/core/deterministic-proof.ts",
  "src/core/self-engine.ts",
];
const FORBIDDEN_DIR = "src/lib/level4/";
const ALLOWED_CORE = ["src/core/experience-schema.ts", "src/core/reconcile.ts", "src/core/tenant-auth.ts"];
const ALLOWED_BUILTINS = ["node:crypto"];
const SOURCE_ONLY = "src/core/neon-db.ts"; // M2: allowed only from src/core/compression/source.ts
/** M5: the export reader resolves the app's pools exactly as the app does (and nothing else). */
const EXPORT_READER_ALLOWED = ["src/core/neon-db.ts", "src/core/storage-provider.ts"];
const BANNED_TOKENS: [RegExp, string][] = [
  [/\bDate\.now\s*\(/, "Date.now"], [/\bMath\.random\s*\(/, "Math.random"],
  [/\bprocess\.env\b/, "process.env"], [/\bfetch\s*\(/, "fetch"], [/\bperformance\.now\s*\(/, "performance.now"],
];

export function specifiers(text: string): string[] {
  const out: string[] = [];
  const res = [
    /(?:^|[\s;])(?:import|export)\s+(?:type\s+)?[^'";]*?\sfrom\s*["']([^"']+)["']/g,
    /(?:^|[\s;])import\s*["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const re of res) for (const m of text.matchAll(re)) out.push(m[1]);
  return out;
}

function resolveSpec(fromFile: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = join(src, spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(dirname(fromFile), spec);
  else return null; // bare or builtin
  for (const c of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts")]) if (existsSync(c) && statSync(c).isFile()) return c;
  return base.endsWith(".ts") ? base : `${base}.ts`;
}

const isForbidden = (p: string) => FORBIDDEN.includes(p) || p.startsWith(FORBIDDEN_DIR);

/** Direct-rule violations for one compression file's text. */
const WRITE_SQL_RE = /\b(INSERT|UPDATE|DELETE|TRUNCATE|CREATE|ALTER|DROP|GRANT|REVOKE|MERGE|COPY|VACUUM)\b/g;
const STORE_FILE = "src/core/compression/store.ts";
const ANCHOR_STORE_FILE = "src/core/compression/anchor-store.ts";
const EXPORT_READER_FILE = "src/core/compression/export-reader.ts";
const EXPORT_CONSUMER = "src/app/api/v1/customer-proof/[id]/route.ts";
const PERSIST_CLI = "scripts/persist-tenant-segments.ts";
const ANCHOR_CLI = "scripts/anchor-state-chain.ts";
const SYNC_CLI = "scripts/sync-state-chains.ts"; // scheduled sync: reuses both writers with their own allowlists/locks
/** The one write target each writer may name. */
const WRITE_TARGETS: Record<string, string> = {
  [STORE_FILE]: "INSERT INTO shiyan.state_segments",
  [ANCHOR_STORE_FILE]: "INSERT INTO shiyan_anchor.state_chain_anchors",
};
/** Which non-check files may import each writer. */
const WRITER_IMPORTERS: Record<string, readonly string[]> = {
  [STORE_FILE]: [PERSIST_CLI, ANCHOR_CLI, SYNC_CLI],
  [ANCHOR_STORE_FILE]: [ANCHOR_CLI, SYNC_CLI],
};
/** Write SQL anywhere in the compression tree: none at all, except each writer may name its one INSERT target. */
export function writeSqlViolations(rel: string, text: string): string[] {
  const v: string[] = [];
  const target = WRITE_TARGETS[rel];
  for (const m of text.matchAll(WRITE_SQL_RE)) {
    const ok = target !== undefined && m[1] === "INSERT" && text.startsWith(target, m.index) && !/\w/.test(text.charAt(m.index! + target.length));
    if (!ok) v.push(`${rel}: write SQL keyword ${m[1]}${target ? ` (${rel.replace("src/core/compression/", "")} may only ${target})` : ""}`);
  }
  return v;
}

export function checkCompressionFile(file: string, text: string): string[] {
  const rel = posix(file);
  const v: string[] = [...writeSqlViolations(rel, text)];
  for (const [re, name] of BANNED_TOKENS) if (re.test(text)) v.push(`${rel}: uses ${name}`);
  for (const spec of specifiers(text)) {
    const target = resolveSpec(file, spec);
    if (target === null) {
      if (!ALLOWED_BUILTINS.includes(spec)) v.push(`${rel}: imports non-allowlisted module "${spec}"`);
      continue;
    }
    const t = posix(target);
    if (isForbidden(t)) v.push(`${rel}: imports forbidden module ${t}`);
    else if (WRITER_IMPORTERS[t] && rel !== t) v.push(`${rel}: imports the writer ${t} (only ${WRITER_IMPORTERS[t].join(", ")} may)`);
    else if (t === EXPORT_READER_FILE && rel !== t) v.push(`${rel}: imports the export reader ${t} (only ${EXPORT_CONSUMER} may)`);
    else if (t === "src/core/compression/source.ts" && rel !== "src/core/compression/source.ts" && rel !== STORE_FILE && rel !== ANCHOR_STORE_FILE) v.push(`${rel}: pure core imports the I/O module ${t}`);
    else if (t.startsWith("src/core/compression/")) continue;
    else if (ALLOWED_CORE.includes(t)) continue;
    else if (t === SOURCE_ONLY && rel === "src/core/compression/source.ts") continue;
    else if (rel === EXPORT_READER_FILE && EXPORT_READER_ALLOWED.includes(t)) continue;
    else v.push(`${rel}: imports non-allowlisted module ${t}`);
  }
  return v;
}

/** Follows relative/alias imports from every compression file and reports any path to a forbidden module. */
function transitiveViolations(entries: string[]): string[] {
  const v: string[] = [];
  const seen = new Set<string>();
  const stack = entries.map((f) => ({ file: f, via: [posix(f)] }));
  while (stack.length) {
    const { file, via } = stack.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    if (!existsSync(file)) continue;
    for (const spec of specifiers(readFileSync(file, "utf8"))) {
      const target = resolveSpec(file, spec);
      if (target === null) continue;
      const t = posix(target);
      if (isForbidden(t)) v.push(`forbidden module reached transitively: ${[...via, t].join(" -> ")}`);
      else stack.push({ file: target, via: [...via, t] });
    }
  }
  return v;
}

function listTs(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? listTs(p) : /\.tsx?$/.test(n) ? [p] : [];
  });
}

// ---------- Self-test: the checker must reject each forbidden pattern ----------
const fake = join(compressionDir, "fake.ts");
const bad: [string, RegExp][] = [
  ['import { MetamorphicEngine } from "../metamorphic";', /forbidden module src\/core\/metamorphic\.ts/],
  ['import { runTelemetry } from "../metamorphic-runtime";', /forbidden module src\/core\/metamorphic-runtime\.ts/],
  ['import { evaluateDeterministicProof } from "../deterministic-proof";', /forbidden module src\/core\/deterministic-proof\.ts/],
  ['import type { X } from "../self-engine";', /forbidden module src\/core\/self-engine\.ts/],
  ['import { tensor } from "@/lib/level4/tensor";', /forbidden module src\/lib\/level4\/tensor\.ts/],
  ['const m = await import("../../lib/level4/loop");', /forbidden module src\/lib\/level4\/loop\.ts/],
  ['const e = require("../metamorphic");', /forbidden module/],
  ['import { readFileSync } from "node:fs";', /non-allowlisted module "node:fs"/],
  ['import { poolFor } from "../neon-db";', /non-allowlisted module src\/core\/neon-db\.ts/],
  ['import { submitStandardRun } from "../run-contract";', /non-allowlisted module src\/core\/run-contract\.ts/],
  ["const t = Date.now();", /uses Date\.now/],
  ["const r = Math.random();", /uses Math\.random/],
  ['import { readTenantRows } from "./source";', /pure core imports the I\/O module src\/core\/compression\/source\.ts/],
  ['import { persistTenantSegments } from "./store";', /imports the writer src\/core\/compression\/store\.ts/],
  ['const q = "INSERT INTO shiyan.state_segments VALUES ($1)";', /write SQL keyword INSERT/],
  ['const flag = process.env.SHIYAN_STATE_COMPRESSION;', /uses process\.env/],
];
for (const [text, expected] of bad) {
  const v = checkCompressionFile(fake, text);
  assert.ok(v.some((x) => expected.test(x)), `self-test: expected violation ${expected} for: ${text}\n got: ${v.join("; ")}`);
}
assert.deepEqual(checkCompressionFile(fake, 'import { canonical } from "../reconcile";\nimport { createHash } from "node:crypto";\nimport type { StatePoint } from "./types";'), []);
assert.deepEqual(checkCompressionFile(join(compressionDir, "source.ts"), 'import { poolFor } from "../neon-db";'), [], "neon-db allowed only in source.ts");
const storeFake = join(compressionDir, "store.ts");
assert.deepEqual(checkCompressionFile(storeFake, 'import { toSourceRow } from "./source";\nconst q = "INSERT INTO shiyan.state_segments (a) VALUES ($1)";'), [], "store.ts may read via source.ts and INSERT into state_segments");
for (const [text, re] of [
  ['const q = "INSERT INTO shiyan.experiences (a) VALUES ($1)";', /store\.ts may only INSERT INTO shiyan\.state_segments/],
  ['const q = "UPDATE shiyan.state_segments SET a = 1";', /write SQL keyword UPDATE/],
  ['const q = "DELETE FROM shiyan.state_segments";', /write SQL keyword DELETE/],
  ['import { poolFor } from "../neon-db";', /non-allowlisted module src\/core\/neon-db\.ts/],
] as [string, RegExp][]) {
  const v = checkCompressionFile(storeFake, text);
  assert.ok(v.some((x) => re.test(x)), `store self-test: expected ${re} for: ${text}\n got: ${v.join("; ")}`);
}
const anchorStoreFake = join(compressionDir, "anchor-store.ts");
assert.deepEqual(checkCompressionFile(anchorStoreFake, 'import { READ_ONLY_BEGIN } from "./source";\nconst q = "INSERT INTO shiyan_anchor.state_chain_anchors (a) VALUES ($1)";'), [], "anchor-store.ts may INSERT into state_chain_anchors");
const readerFake = join(compressionDir, "export-reader.ts");
assert.deepEqual(checkCompressionFile(readerFake, 'import { poolFor } from "../neon-db";\nimport { resolveStorageBackend } from "../storage-provider";\nimport { parseChainHeads } from "./chain-head";'), [], "export-reader may resolve pools");
for (const [file, text, re] of [
  [anchorStoreFake, 'const q = "INSERT INTO shiyan.state_segments (a) VALUES ($1)";', /anchor-store\.ts may only INSERT INTO shiyan_anchor\.state_chain_anchors/],
  [anchorStoreFake, 'const q = "DELETE FROM shiyan_anchor.state_chain_anchors";', /write SQL keyword DELETE/],
  [storeFake, 'const q = "INSERT INTO shiyan_anchor.state_chain_anchors (a) VALUES ($1)";', /store\.ts may only INSERT INTO shiyan\.state_segments/],
  [readerFake, 'const q = "INSERT INTO shiyan.state_segments (a) VALUES ($1)";', /write SQL keyword INSERT/],
  [readerFake, 'import { persistTenantSegments } from "./store";', /imports the writer src\/core\/compression\/store\.ts/],
  [readerFake, 'import { anchorStateChainHead } from "./anchor-store";', /imports the writer src\/core\/compression\/anchor-store\.ts/],
  [readerFake, 'import { readTenantRows } from "./source";', /pure core imports the I\/O module/],
  [readerFake, 'const e = process.env.SHIYAN_STATE_COMPRESSION;', /uses process\.env/],
  [readerFake, 'import { verifyStandardRunAsync } from "../run-contract";', /non-allowlisted module src\/core\/run-contract\.ts/],
  [fake, 'import { stateCompressionForExport } from "./export-reader";', /imports the export reader/],
  [fake, 'import { anchorStateChainHead } from "./anchor-store";', /imports the writer/],
  [fake, 'import { poolFor } from "../storage-provider";', /non-allowlisted module src\/core\/storage-provider\.ts/],
] as [string, string, RegExp][]) {
  const v = checkCompressionFile(file, text);
  assert.ok(v.some((x) => re.test(x)), `M5 self-test: expected ${re} for: ${text}\n got: ${v.join("; ")}`);
}
console.log(`PASS self-test (${bad.length} forbidden patterns rejected, plus M5 writer/reader rules)`);

// ---------- Real tree ----------
const files = listTs(compressionDir);
assert.ok(files.length > 0, "src/core/compression has no files");
const violations = [...files.flatMap((f) => checkCompressionFile(f, readFileSync(f, "utf8"))), ...transitiveViolations(files)];
if (violations.length) {
  for (const x of violations) console.error(`FAIL ${x}`);
  process.exit(1);
}
console.log(`PASS compression boundary (${files.length} files: ${files.map((f) => posix(f).replace("src/core/compression/", "")).join(", ")})`);

// ---------- M2 read-only edge: source.ts and the local CLI ----------
const cliFile = join(root, "scripts", "compress-tenant.ts");
const persistFile = join(root, "scripts", "persist-tenant-segments.ts");
const sourceFile = join(compressionDir, "source.ts");
const CLI_ALLOWED_BUILTINS = ["node:fs", "node:os", "node:path", "node:url"];
const anchorCliFile = join(root, "scripts", "anchor-state-chain.ts");
const syncCliFile = join(root, "scripts", "sync-state-chains.ts");
const CLI_FILES = ["scripts/compress-tenant.ts", PERSIST_CLI, ANCHOR_CLI, SYNC_CLI];
const CLI_ALLOWED = ["src/core/neon-db.ts", "src/core/storage-diagnostics.ts", "src/core/tenant-auth.ts"];
/** Routes, Level 4, the engine, and every module that appends, publishes or persists. */
const EDGE_FORBIDDEN_PREFIX = ["src/app/", "src/lib/level4/", "src/components/"];
const EDGE_FORBIDDEN = [
  ...FORBIDDEN,
  "src/core/neon-experience-store.ts", "src/core/neon-recovery-recorder.ts", "src/core/neon-reference-store.ts",
  "src/core/experience-store.ts", "src/core/hf-memory.ts", "src/core/run-contract.ts", "src/core/proof-publisher.ts",
  "src/core/github-reference.ts", "src/core/storage-provider.ts", "src/core/reference-anchor-provider.ts",
];
const WRITE_TOKENS: [RegExp, string][] = [
  [/\b(INSERT|UPDATE|DELETE|TRUNCATE|CREATE|ALTER|DROP|GRANT|REVOKE|MERGE|COPY|VACUUM)\b/, "write/DDL SQL keyword"],
  [/\b(writeFile|writeFileSync|appendFile|appendFileSync|createWriteStream|mkdir|mkdirSync|rmSync|rmdir|unlink|unlinkSync|rename|renameSync|copyFile|copyFileSync|truncateSync|openSync)\b/, "file-write API"],
];
const isEdgeForbidden = (p: string) => EDGE_FORBIDDEN.includes(p) || EDGE_FORBIDDEN_PREFIX.some((d) => p.startsWith(d));

/** Direct-rule violations for the read-only edge files (source.ts and the CLI). */
export function checkEdgeFile(file: string, text: string): string[] {
  const rel = posix(file);
  const v: string[] = [];
  for (const [re, name] of WRITE_TOKENS) {
    if (WRITE_TARGETS[rel] && name === "write/DDL SQL keyword") continue; // writers are checked by writeSqlViolations
    if (re.test(text)) v.push(`${rel}: uses ${name}`);
  }
  for (const spec of specifiers(text)) {
    const target = resolveSpec(file, spec);
    if (target === null) {
      // source.ts builtins are already limited by checkCompressionFile (node:crypto only).
      if (CLI_FILES.includes(rel) && !CLI_ALLOWED_BUILTINS.includes(spec)) v.push(`${rel}: imports non-allowlisted module "${spec}"`);
      continue;
    }
    const t = posix(target);
    if (rel === EXPORT_READER_FILE && EXPORT_READER_ALLOWED.includes(t)) continue;
    if (isEdgeForbidden(t)) v.push(`${rel}: imports forbidden module ${t}`);
    else if (WRITER_IMPORTERS[t] && rel !== t && !WRITER_IMPORTERS[t].includes(rel)) v.push(`${rel}: imports the writer ${t} (only ${WRITER_IMPORTERS[t].join(", ")} may)`);
    else if (t === EXPORT_READER_FILE && CLI_FILES.includes(rel)) v.push(`${rel}: imports the export reader ${t} (only ${EXPORT_CONSUMER} may)`);
    else if (CLI_FILES.includes(rel) && !t.startsWith("src/core/compression/") && !CLI_ALLOWED.includes(t)
      && !((rel === PERSIST_CLI || rel === ANCHOR_CLI || rel === SYNC_CLI) && t === "scripts/compress-tenant.ts")) {
      v.push(`${rel}: imports non-allowlisted module ${t}`);
    }
  }
  return v;
}

/** Any import path from the edge files to a route, Level 4 or the engine (write modules are checked directly). */
function edgeTransitive(entries: string[]): string[] {
  const v: string[] = [];
  const seen = new Set<string>();
  const stack = entries.map((f) => ({ file: f, via: [posix(f)] }));
  while (stack.length) {
    const { file, via } = stack.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    if (!existsSync(file)) continue;
    for (const spec of specifiers(readFileSync(file, "utf8"))) {
      const target = resolveSpec(file, spec);
      if (target === null) continue;
      const t = posix(target);
      if (FORBIDDEN.includes(t) || EDGE_FORBIDDEN_PREFIX.some((d) => t.startsWith(d))) v.push(`edge reaches forbidden module: ${[...via, t].join(" -> ")}`);
      else stack.push({ file: target, via: [...via, t] });
    }
  }
  return v;
}

const edgeBad: [string, string, RegExp][] = [
  [cliFile, 'import { GET } from "../src/app/api/state/route";', /forbidden module src\/app\/api\/state\/route\.ts/],
  [cliFile, 'import { tensor } from "../src/lib/level4/tensor";', /forbidden module src\/lib\/level4\/tensor\.ts/],
  [cliFile, 'import { MetamorphicEngine } from "../src/core/metamorphic";', /forbidden module src\/core\/metamorphic\.ts/],
  [cliFile, 'import { runTelemetry } from "../src/core/metamorphic-runtime";', /forbidden module src\/core\/metamorphic-runtime\.ts/],
  [cliFile, 'import { NeonExperienceStore } from "../src/core/neon-experience-store";', /forbidden module src\/core\/neon-experience-store\.ts/],
  [cliFile, 'import { HFMemory } from "../src/core/hf-memory";', /forbidden module src\/core\/hf-memory\.ts/],
  [cliFile, 'import { submitStandardRun } from "../src/core/run-contract";', /forbidden module src\/core\/run-contract\.ts/],
  [cliFile, 'import { x } from "../src/core/roe-next-action";', /non-allowlisted module src\/core\/roe-next-action\.ts/],
  [cliFile, 'import { request } from "node:https";', /non-allowlisted module "node:https"/],
  [cliFile, 'writeFileSync("/tmp/x", "y");', /file-write API/],
  [sourceFile, 'import { NeonRecoveryRecorder } from "../neon-recovery-recorder";', /forbidden module src\/core\/neon-recovery-recorder\.ts/],
  [sourceFile, 'const q = "INSERT INTO shiyan.experiences VALUES ($1)";', /write\/DDL SQL keyword/],
  [sourceFile, 'const q = "UPDATE shiyan.experiences SET x = 1";', /write\/DDL SQL keyword/],
  [sourceFile, 'const q = "CREATE TABLE t (x int)";', /write\/DDL SQL keyword/],
  [sourceFile, 'const q = "SELECT 1; DELETE FROM shiyan_anchor.recovery_records";', /write\/DDL SQL keyword/],
  [cliFile, 'import { NeonRecoveryRecorder } from "../src/core/neon-recovery-recorder";', /forbidden module src\/core\/neon-recovery-recorder\.ts/],
  [cliFile, 'import { reconcile } from "../src/core/reconcile";', /non-allowlisted module src\/core\/reconcile\.ts/],
  [cliFile, 'import { persistTenantSegments } from "../src/core/compression/store";', /imports the writer src\/core\/compression\/store\.ts/],
  [persistFile, 'import { NeonExperienceStore } from "../src/core/neon-experience-store";', /forbidden module src\/core\/neon-experience-store\.ts/],
  [persistFile, 'import { GET } from "../src/app/api/proof/route";', /forbidden module src\/app\/api\/proof\/route\.ts/],
  [persistFile, 'writeFileSync("/tmp/x", "y");', /file-write API/],
  [persistFile, 'const q = "INSERT INTO shiyan.state_segments VALUES ($1)";', /write\/DDL SQL keyword/],
  [persistFile, 'import { anchorStateChainHead } from "../src/core/compression/anchor-store";', /imports the writer src\/core\/compression\/anchor-store\.ts/],
  [cliFile, 'import { anchorStateChainHead } from "../src/core/compression/anchor-store";', /imports the writer src\/core\/compression\/anchor-store\.ts/],
  [anchorCliFile, 'const q = "INSERT INTO shiyan_anchor.state_chain_anchors VALUES ($1)";', /write\/DDL SQL keyword/],
  [anchorCliFile, 'import { GET } from "../src/app/api/v1/customer-proof/[id]/route";', /forbidden module src\/app\//],
  [anchorCliFile, 'import { stateCompressionForExport } from "../src/core/compression/export-reader";', /imports the export reader/],
  [anchorCliFile, 'import { configuredReferenceAnchors } from "../src/core/reference-anchor-provider";', /forbidden module src\/core\/reference-anchor-provider\.ts/],
  [anchorCliFile, 'writeFileSync("/tmp/x", "y");', /file-write API/],
  [syncCliFile, 'const q = "INSERT INTO shiyan.state_segments VALUES ($1)";', /write\/DDL SQL keyword/],
  [syncCliFile, 'import { stateCompressionForExport } from "../src/core/compression/export-reader";', /imports the export reader/],
  [syncCliFile, 'import { GET } from "../src/app/api/v1/customer-proof/[id]/route";', /forbidden module src\/app\//],
  [syncCliFile, 'import { NeonExperienceStore } from "../src/core/neon-experience-store";', /forbidden module/],
  [syncCliFile, 'import { execSync } from "node:child_process";', /non-allowlisted module "node:child_process"/],
  [syncCliFile, 'writeFileSync("/tmp/x", "y");', /file-write API/],
];
for (const [file, text, expected] of edgeBad) {
  const v = checkEdgeFile(file, text);
  assert.ok(v.some((x) => expected.test(x)), `edge self-test: expected ${expected} for: ${text}\n got: ${v.join("; ")}`);
}
assert.deepEqual(checkEdgeFile(persistFile, 'import { persistTenantSegments } from "../src/core/compression/store";\nimport { parseOptions } from "./compress-tenant";'), []);
assert.deepEqual(checkEdgeFile(syncCliFile, 'import { persistTenantSegments } from "../src/core/compression/store";\nimport { anchorStateChainHead } from "../src/core/compression/anchor-store";\nimport { readUrl } from "./compress-tenant";'), []);
assert.deepEqual(checkEdgeFile(anchorCliFile, 'import { persistTenantSegments } from "../src/core/compression/store";\nimport { anchorStateChainHead } from "../src/core/compression/anchor-store";\nimport { parseOptions } from "./compress-tenant";'), []);
assert.deepEqual(checkEdgeFile(cliFile, 'import { readFileSync } from "node:fs";\nimport { compressTenant } from "../src/core/compression/index";\nimport { checkDatabaseUrl } from "../src/core/neon-db";'), []);
console.log(`PASS edge self-test (${edgeBad.length} forbidden patterns rejected)`);

const edgeFiles = [sourceFile, cliFile, persistFile, anchorCliFile, syncCliFile, join(compressionDir, "store.ts"), join(compressionDir, "anchor-store.ts"), join(compressionDir, "export-reader.ts")];
for (const f of edgeFiles) assert.ok(existsSync(f), `missing ${posix(f)}`);
const edgeViolations = [...edgeFiles.flatMap((f) => checkEdgeFile(f, readFileSync(f, "utf8"))), ...edgeTransitive(edgeFiles)];
if (edgeViolations.length) {
  for (const x of edgeViolations) console.error(`FAIL ${x}`);
  process.exit(1);
}
console.log("PASS edge boundary (source.ts, store.ts, anchor-store.ts, export-reader.ts and the four CLIs (compress, persist, anchor, sync): no file writes; write SQL only in store.ts (INSERT INTO shiyan.state_segments) and anchor-store.ts (INSERT INTO shiyan_anchor.state_chain_anchors); writers imported only by their CLIs; no route/Level 4/engine imports)");

// ---------- M4/M5: repo-wide wiring check ----------
// Nothing in src/ outside src/core/compression imports the compression modules, EXCEPT exactly one consumer:
// the customer proof export route may import exactly export-reader.ts. Writers are imported only by their CLIs
// and test-only check scripts. The export reader's transitive imports never reach a writer or source.ts.
const wiring: string[] = [];
const consumers: string[] = [];
for (const f of [...listTs(src), ...listTs(join(root, "scripts"))]) {
  const rel = posix(f);
  if (rel.startsWith("src/core/compression/")) continue;
  for (const spec of specifiers(readFileSync(f, "utf8"))) {
    const target = resolveSpec(f, spec);
    if (target === null) continue;
    const t = posix(target);
    if (rel.startsWith("src/") && t.startsWith("src/core/compression/")) {
      if (rel === EXPORT_CONSUMER && t === EXPORT_READER_FILE) consumers.push(rel);
      else wiring.push(`${rel}: imports ${t} (only ${EXPORT_CONSUMER} may import, and only ${EXPORT_READER_FILE})`);
    }
    if (WRITER_IMPORTERS[t] && !WRITER_IMPORTERS[t].includes(rel) && !/^scripts\/check-[a-z0-9-]+\.ts$/.test(rel)) wiring.push(`${rel}: imports the writer ${t}`);
  }
}
if (consumers.length !== 1) wiring.push(`expected exactly one export consumer import (${EXPORT_CONSUMER} -> ${EXPORT_READER_FILE}), found ${consumers.length}`);
{
  const seen = new Set<string>();
  const stack = [join(root, EXPORT_READER_FILE)];
  while (stack.length) {
    const file = stack.pop()!;
    if (seen.has(file) || !existsSync(file)) continue;
    seen.add(file);
    for (const spec of specifiers(readFileSync(file, "utf8"))) {
      const target = resolveSpec(file, spec);
      if (target === null) continue;
      const t = posix(target);
      if (WRITER_IMPORTERS[t] || t === "src/core/compression/source.ts" || isForbidden(t)) wiring.push(`export reader reaches ${t} via ${posix(file)}`);
      stack.push(target);
    }
  }
}
if (wiring.length) {
  for (const x of wiring) console.error(`FAIL ${x}`);
  process.exit(1);
}
console.log("PASS wiring (only the customer-proof export route imports compression, and only export-reader.ts, which never reaches a writer or source.ts; store.ts imported only by the persist/anchor/sync CLIs, anchor-store.ts only by the anchor/sync CLIs, plus check scripts)");
