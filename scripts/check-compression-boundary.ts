/** TEST ONLY. Import-boundary check for src/core/compression/**. Reads source files; no network, no writes.
 * Fails (exit 1) if a compression module imports anything outside its allowlist, reaches a forbidden
 * module transitively (MetamorphicEngine, metamorphic-runtime, deterministic-proof, self-engine, src/lib/level4),
 * or uses a non-deterministic / I/O primitive directly.
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
