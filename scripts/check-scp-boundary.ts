/** TEST ONLY. Import-boundary check for src/scp/** (4D-SCP stubs). Reads source files; no network, no writes.
 * Fails (exit 1) if a file under src/scp imports Level 4, an app route, MetamorphicEngine / metamorphic-runtime,
 * or uses process.env; or if anything outside tests/scripts imports src/scp.
 *
 * Decision 4 (owner, 2026-11-17): src/scp may use type-only imports from the compression engine's
 * public surface (src/core/compression/index.ts and types.ts). Runtime imports of that surface,
 * and any import of writers (store.ts, source.ts, anchor-store.ts) or other non-public modules,
 * remain forbidden in src/scp. Runtime engine calls belong in scripts/tests only.
 *
 * Run: npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-scp-boundary.ts
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

const root = resolve(join(import.meta.dirname, ".."));
const src = join(root, "src");
const scpDir = join(src, "scp");
const posix = (p: string) => relative(root, p).split(sep).join("/");

const FORBIDDEN_FILES = [
  "src/core/metamorphic.ts",
  "src/core/metamorphic-runtime.ts",
  "src/core/deterministic-proof.ts",
  "src/core/self-engine.ts",
];
const FORBIDDEN_PREFIXES = ["src/lib/level4/", "src/app/"];
const BANNED_TOKENS: [RegExp, string][] = [
  [/\bprocess\.env\b/, "process.env"],
  [/\bDate\.now\s*\(/, "Date.now"],
  [/\bMath\.random\s*\(/, "Math.random"],
];
/** Public surface only (decision 4). Type-only imports of these are allowed in src/scp. */
const PUBLIC_COMPRESSION = new Set([
  "src/core/compression/index.ts",
  "src/core/compression/types.ts",
]);

function listTs(dir: string): string[] {
  const out: string[] = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...listTs(p));
    else if (name.endsWith(".ts") || name.endsWith(".tsx")) out.push(p);
  }
  return out;
}

function listProjectTs(): string[] {
  const skip = new Set(["node_modules", ".git", ".next", "dist"]);
  const walk = (dir: string): string[] => {
    const out: string[] = [];
    for (const name of readdirSync(dir)) {
      if (skip.has(name)) continue;
      const p = join(dir, name);
      const st = statSync(p);
      if (st.isDirectory()) out.push(...walk(p));
      else if (name.endsWith(".ts") || name.endsWith(".tsx") || name.endsWith(".mts")) out.push(p);
    }
    return out;
  };
  return walk(root);
}

export interface ImportRef { spec: string; typeOnly: boolean }

function isTypeOnlyClause(clause: string): boolean {
  const inner = clause.trim();
  if (!inner.startsWith("{")) return false;
  const end = inner.lastIndexOf("}");
  if (end < 0) return false;
  const parts = inner.slice(1, end).split(",").map((s) => s.trim()).filter(Boolean);
  return parts.length > 0 && parts.every((p) => /^type\s+/.test(p));
}

/** Classify static and dynamic imports. `import type` / `export type` and `{ type A, type B }` are type-only. */
export function importRefs(text: string): ImportRef[] {
  const out: ImportRef[] = [];
  const fromRe = /(?:^|[\s;])(?:export\s+)?import\s+(type\s+)?(?:([^'"();]+?)\s+from\s*)?["']([^"']+)["']/g;
  for (const m of text.matchAll(fromRe)) {
    const typeKw = Boolean(m[1]);
    const clause = (m[2] ?? "").trim();
    out.push({ spec: m[3], typeOnly: typeKw || isTypeOnlyClause(clause) });
  }
  const side = /(?:^|[\s;])import\s*["']([^"']+)["']/g;
  for (const m of text.matchAll(side)) out.push({ spec: m[1], typeOnly: false });
  const dyn = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;
  for (const m of text.matchAll(dyn)) out.push({ spec: m[1], typeOnly: false });
  const req = /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g;
  for (const m of text.matchAll(req)) out.push({ spec: m[1], typeOnly: false });
  return out;
}

export function specifiers(text: string): string[] {
  return importRefs(text).map((r) => r.spec);
}

function resolveSpec(fromFile: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = join(src, spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(dirname(fromFile), spec);
  else return null;
  for (const c of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts")]) {
    if (existsSync(c) && statSync(c).isFile()) return c;
  }
  return base.endsWith(".ts") ? base : `${base}.ts`;
}

const isForbidden = (rel: string) =>
  FORBIDDEN_FILES.includes(rel) || FORBIDDEN_PREFIXES.some((d) => rel.startsWith(d));

function isScpTarget(rel: string): boolean {
  return rel === "src/scp" || rel.startsWith("src/scp/");
}

function allowedImporter(rel: string): boolean {
  return rel.startsWith("scripts/") || rel.startsWith("tests/") || rel.includes(".test.") || rel.includes(".spec.");
}

function checkScpFile(file: string, text: string): string[] {
  const rel = posix(file);
  const v: string[] = [];
  for (const [re, name] of BANNED_TOKENS) if (re.test(text)) v.push(`${rel}: uses ${name}`);
  for (const { spec, typeOnly } of importRefs(text)) {
    const target = resolveSpec(file, spec);
    if (target === null) {
      if (spec.startsWith("node:") || spec === "node:crypto") continue;
      if (!spec.startsWith(".")) v.push(`${rel}: imports non-local module "${spec}"`);
      continue;
    }
    const t = posix(target);
    if (isForbidden(t)) v.push(`${rel}: imports forbidden module ${t}`);
    else if (t.startsWith("src/scp/")) continue;
    else if (PUBLIC_COMPRESSION.has(t) && typeOnly) continue;
    else if (PUBLIC_COMPRESSION.has(t)) {
      v.push(`${rel}: runtime import of compression public surface ${t} (type-only imports only)`);
    } else {
      v.push(`${rel}: imports outside src/scp (${t})`);
    }
  }
  return v;
}

function checkImporters(): string[] {
  const v: string[] = [];
  for (const file of listProjectTs()) {
    const rel = posix(file);
    if (rel.startsWith("src/scp/")) continue;
    if (allowedImporter(rel)) continue;
    const text = readFileSync(file, "utf8");
    for (const spec of specifiers(text)) {
      let relTarget: string | null = null;
      if (spec === "@/scp" || spec.startsWith("@/scp/")) relTarget = `src/scp/${spec.replace(/^@\/scp\/?/, "")}`.replace(/\/$/, "") || "src/scp";
      else if (spec.startsWith(".")) {
        const resolved = resolveSpec(file, spec);
        if (resolved) relTarget = posix(resolved);
      } else if (spec.includes("src/scp")) relTarget = spec;
      if (relTarget && isScpTarget(relTarget)) v.push(`${rel}: imports ${spec} (only tests/scripts may import src/scp)`);
    }
  }
  return v;
}

// ---------- Self-test ----------
{
  const fake = join(scpDir, "types.ts");
  const forbidden: [string, string, RegExp][] = [
    [fake, 'import { autonomousStep } from "@/lib/level4/roe";', /forbidden module src\/lib\/level4\//],
    [fake, 'import Route from "@/app/workbench/global/page";', /forbidden module src\/app\//],
    [fake, 'import { MetamorphicEngine } from "../core/metamorphic";', /forbidden module src\/core\/metamorphic\.ts/],
    [fake, "const x = process.env.SHIYAN_SCP;", /process\.env/],
  ];
  for (const [file, text, re] of forbidden) {
    const v = checkScpFile(file, text);
    assert.ok(v.some((x) => re.test(x)), `self-test: expected ${re} for: ${text}\n got: ${v.join("; ")}`);
  }
  console.log(`PASS self-test (${forbidden.length} forbidden patterns rejected)`);

  const allowedTypeOnly = [
    'import type { StateVector } from "../core/compression";',
    'import type { StateVector } from "@/core/compression";',
    'import { type StateVector } from "../core/compression/types";',
    'export type { StateVector } from "../core/compression";',
  ];
  for (const text of allowedTypeOnly) {
    const v = checkScpFile(fake, text);
    assert.equal(v.length, 0, `self-test: type-only public-surface import should be allowed: ${text}\n got: ${v.join("; ")}`);
  }
  console.log(`PASS self-test (${allowedTypeOnly.length} type-only public-surface imports allowed)`);

  const runtimeOrPrivate: [string, RegExp][] = [
    ['import { compressPoints } from "../core/compression";', /runtime import of compression public surface/],
    ['import { type StateVector, compressPoints } from "../core/compression";', /runtime import of compression public surface/],
    ['import type { PersistResult } from "../core/compression/store";', /imports outside src\/scp \(src\/core\/compression\/store\.ts\)/],
    ['import type { SourceRow } from "../core/compression/source";', /imports outside src\/scp \(src\/core\/compression\/source\.ts\)/],
    ['import type { AnchorWrite } from "../core/compression/anchor-store";', /imports outside src\/scp \(src\/core\/compression\/anchor-store\.ts\)/],
  ];
  for (const [text, re] of runtimeOrPrivate) {
    const v = checkScpFile(fake, text);
    assert.ok(v.some((x) => re.test(x)), `self-test: expected ${re} for: ${text}\n got: ${v.join("; ")}`);
  }
  console.log(`PASS self-test (${runtimeOrPrivate.length} runtime / non-public compression imports rejected)`);
}

// ---------- Real tree ----------
assert.ok(existsSync(scpDir), "src/scp is missing");
const scpFiles = listTs(scpDir);
assert.ok(scpFiles.length >= 3, "src/scp should contain types.ts, not-implemented.ts, index.ts");
const scpViolations = scpFiles.flatMap((f) => checkScpFile(f, readFileSync(f, "utf8")));
if (scpViolations.length) {
  for (const x of scpViolations) console.error(`FAIL ${x}`);
  process.exit(1);
}
console.log(`PASS scp package (${scpFiles.length} files: ${scpFiles.map((f) => posix(f).replace("src/scp/", "")).join(", ")}): no Level 4 / app / engine runtime imports, no process.env`);

const importViolations = checkImporters();
if (importViolations.length) {
  for (const x of importViolations) console.error(`FAIL ${x}`);
  process.exit(1);
}
console.log("PASS importers (nothing outside tests/scripts imports src/scp)");
console.log("PASS check-scp-boundary");
