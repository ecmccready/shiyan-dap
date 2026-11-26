/** TEST ONLY. Licensing text is verbatim, and production app/lib code does not import 4D-SCP.
 * No network, no writes.
 * Run: npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-licensing-boundaries.ts
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { LICENSING_PARAGRAPHS, TRAJECTORY_PARAGRAPHS } from "../src/lib/licensing";

const root = resolve(join(import.meta.dirname, ".."));
const read = (p: string) => readFileSync(join(root, p), "utf8");
let n = 0;
function check(name: string, cond: boolean, detail = ""): void {
  n += 1;
  console.log(`${cond ? "ok  " : "FAIL"} ${name}${detail ? `\n     ${detail}` : ""}`);
  if (!cond) process.exitCode = 1;
}

const pkg = JSON.parse(read("package.json")) as { license?: string; private?: boolean };
check("no LICENSE file and package.json has no license field",
  !existsSync(join(root, "LICENSE")) && !existsSync(join(root, "LICENSE.md")) && pkg.license === undefined && pkg.private === true);

const readme = read("README.md").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
check("README contains the licensing paragraphs verbatim",
  LICENSING_PARAGRAPHS.every((p) => readme.includes(p)) && readme.includes("## Licensing"));
check("README contains the trajectory paragraphs verbatim",
  TRAJECTORY_PARAGRAPHS.every((p) => readme.includes(p)) && readme.includes("## Trajectory"));

const surfaces = [
  "src/app/workbench/compute-proof/page.tsx",
  "src/app/workbench/offer/page.tsx",
  "src/app/workbench/pilot/page.tsx",
];
check("compute-proof, offer, and pilot render LicensingNotice",
  surfaces.every((p) => read(p).includes("LicensingNotice")));

const notice = read("src/components/LicensingNotice.tsx");
check("the notice component links the published owner profile and /workbench/pilot",
  notice.includes("OWNER_CONTACT_URL") && notice.includes("PILOT_PATH") && notice.includes('href={PILOT_PATH}'));

function walk(dir: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) walk(abs, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(abs);
  }
}
const files: string[] = [];
walk(join(root, "src/app"), files);
walk(join(root, "src/lib"), files);
const importRe = /^\s*import\s[\s\S]*?from\s+["']([^"']+)["']/gm;
const hits: string[] = [];
for (const abs of files) {
  const text = readFileSync(abs, "utf8");
  for (const m of text.matchAll(importRe)) {
    const spec = m[1] ?? "";
    if (/scp4d|hw\/scp4d|(^|\/)src\/scp|@\/scp\b/.test(spec)) {
      hits.push(`${relative(root, abs).split(sep).join("/")} imports ${spec}`);
    }
  }
}
check("src/app and src/lib do not import 4D-SCP RTL or src/scp modules", hits.length === 0, hits.join("; "));

if (process.exitCode) process.exit(1);
console.log(`PASS check-licensing-boundaries (${n} checks)`);
