/** TEST ONLY. Semiconductor pages stay free of other-domain copy, and their links resolve.
 * Run: npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-semiconductor-nav.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { JOURNEY } from "../src/lib/semiconductor/journey";

const root = resolve(join(import.meta.dirname, ".."));
const pages = [
  "src/components/SemiconductorDoor.tsx",
  "src/app/page.tsx",
  "src/app/assess/page.tsx",
  "src/app/journey/characterize/page.tsx",
  "src/app/journey/optimize/page.tsx",
  "src/app/journey/prove/page.tsx",
  "src/app/journey/deploy/page.tsx",
  "src/app/workbench/reference-ledger/page.tsx",
  "src/app/workbench/compute-proof/page.tsx",
  "src/app/workbench/acquisition/page.tsx",
];
const forbidden = /\b(Medicare|ACA|Misdiagnosis|healthcare)\b/i;
let n = 0;
let failed = false;
function check(name: string, cond: boolean): void {
  n += 1;
  console.log(`${cond ? "ok  " : "FAIL"} ${name}`);
  if (!cond) failed = true;
}

for (const rel of pages) {
  const text = readFileSync(join(root, rel), "utf8");
  check(`${rel} has no other-domain terms`, !forbidden.test(text));
}

for (const stage of JOURNEY) {
  const file = stage.href === "/assess"
    ? "src/app/assess/page.tsx"
    : `src/app${stage.href}/page.tsx`;
  check(`${stage.n} ${stage.name} page exists`, existsSync(join(root, file)));
}

const hrefs = new Set<string>();
for (const rel of pages) {
  const text = readFileSync(join(root, rel), "utf8");
  for (const m of text.matchAll(/href="(\/[^"#?]*)/g)) hrefs.add(m[1]!);
}
const missing: string[] = [];
for (const href of [...hrefs].sort()) {
  if (href.startsWith("/api/")) continue;
  const file = href === "/" ? "src/app/page.tsx" : `src/app${href}/page.tsx`;
  if (!existsSync(join(root, file))) missing.push(`${href} -> ${file}`);
}
check(`internal links resolve (${hrefs.size} hrefs)`, missing.length === 0);
if (missing.length) console.log(missing.join("\n"));

if (failed) process.exit(1);
console.log(`PASS check-semiconductor-nav (${n} checks)`);
