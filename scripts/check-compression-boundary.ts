/** TEST ONLY. Import-boundary check for src/core/compression/**. Reads source files; no network, no writes.
 * Fails (exit 1) if a compression module imports anything outside its allowlist, reaches a forbidden
 * module transitively (MetamorphicEngine, metamorphic-runtime, deterministic-proof, self-engine, src/lib/level4),
 * or uses a non-deterministic / I/O primitive directly.
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
export function checkCompressionFile(file: string, text: string): string[] {
  const rel = posix(file);
  const v: string[] = [];
  for (const [re, name] of BANNED_TOKENS) if (re.test(text)) v.push(`${rel}: uses ${name}`);
  for (const spec of specifiers(text)) {
    const target = resolveSpec(file, spec);
    if (target === null) {
      if (!ALLOWED_BUILTINS.includes(spec)) v.push(`${rel}: imports non-allowlisted module "${spec}"`);
      continue;
    }
    const t = posix(target);
    if (isForbidden(t)) v.push(`${rel}: imports forbidden module ${t}`);
    else if (t === "src/core/compression/source.ts" && rel !== "src/core/compression/source.ts") v.push(`${rel}: pure core imports the I/O module ${t}`);
    else if (t.startsWith("src/core/compression/")) continue;
    else if (ALLOWED_CORE.includes(t)) continue;
    else if (t === SOURCE_ONLY && rel === "src/core/compression/source.ts") continue;
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
  ['const flag = process.env.SHIYAN_STATE_COMPRESSION;', /uses process\.env/],
];
for (const [text, expected] of bad) {
  const v = checkCompressionFile(fake, text);
  assert.ok(v.some((x) => expected.test(x)), `self-test: expected violation ${expected} for: ${text}\n got: ${v.join("; ")}`);
}
assert.deepEqual(checkCompressionFile(fake, 'import { canonical } from "../reconcile";\nimport { createHash } from "node:crypto";\nimport type { StatePoint } from "./types";'), []);
assert.deepEqual(checkCompressionFile(join(compressionDir, "source.ts"), 'import { poolFor } from "../neon-db";'), [], "neon-db allowed only in source.ts");
console.log(`PASS self-test (${bad.length} forbidden patterns rejected)`);

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
const sourceFile = join(compressionDir, "source.ts");
const CLI_ALLOWED_BUILTINS = ["node:fs", "node:os", "node:path", "node:url"];
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
  for (const [re, name] of WRITE_TOKENS) if (re.test(text)) v.push(`${rel}: uses ${name}`);
  for (const spec of specifiers(text)) {
    const target = resolveSpec(file, spec);
    if (target === null) {
      // source.ts builtins are already limited by checkCompressionFile (node:crypto only).
      if (rel === "scripts/compress-tenant.ts" && !CLI_ALLOWED_BUILTINS.includes(spec)) v.push(`${rel}: imports non-allowlisted module "${spec}"`);
      continue;
    }
    const t = posix(target);
    if (isEdgeForbidden(t)) v.push(`${rel}: imports forbidden module ${t}`);
    else if (rel === "scripts/compress-tenant.ts" && !t.startsWith("src/core/compression/") && !CLI_ALLOWED.includes(t)) {
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
];
for (const [file, text, expected] of edgeBad) {
  const v = checkEdgeFile(file, text);
  assert.ok(v.some((x) => expected.test(x)), `edge self-test: expected ${expected} for: ${text}\n got: ${v.join("; ")}`);
}
assert.deepEqual(checkEdgeFile(cliFile, 'import { readFileSync } from "node:fs";\nimport { compressTenant } from "../src/core/compression/index";\nimport { checkDatabaseUrl } from "../src/core/neon-db";'), []);
console.log(`PASS edge self-test (${edgeBad.length} forbidden patterns rejected)`);

const edgeFiles = [sourceFile, cliFile];
for (const f of edgeFiles) assert.ok(existsSync(f), `missing ${posix(f)}`);
const edgeViolations = [...edgeFiles.flatMap((f) => checkEdgeFile(f, readFileSync(f, "utf8"))), ...edgeTransitive(edgeFiles)];
if (edgeViolations.length) {
  for (const x of edgeViolations) console.error(`FAIL ${x}`);
  process.exit(1);
}
console.log("PASS read-only edge boundary (source.ts, scripts/compress-tenant.ts: no write SQL, no file writes, no route/Level 4/engine/write-module imports)");
