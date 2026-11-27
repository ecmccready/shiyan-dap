/** TEST ONLY. Licensing text is verbatim, and production app/lib code does not import 4D-SCP.
 * No network, no writes.
 * Run: npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-licensing-boundaries.ts
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import {
  LICENSE_COPYRIGHT,
  LICENSE_TITLE,
  LICENSING_PARAGRAPHS,
  PACKAGE_LICENSE,
  TRAJECTORY_PARAGRAPHS,
} from "../src/lib/licensing";

const root = resolve(join(import.meta.dirname, ".."));
const read = (p: string) => readFileSync(join(root, p), "utf8");
let n = 0;
function check(name: string, cond: boolean, detail = ""): void {
  n += 1;
  console.log(`${cond ? "ok  " : "FAIL"} ${name}${detail ? `\n     ${detail}` : ""}`);
  if (!cond) process.exitCode = 1;
}

const licensePath = join(root, "LICENSE");
check("LICENSE exists", existsSync(licensePath));
const license = existsSync(licensePath) ? readFileSync(licensePath, "utf8") : "";
check("LICENSE title and copyright are the published lines",
  license.startsWith(`${LICENSE_TITLE}\n`) && license.includes(LICENSE_COPYRIGHT));
check("LICENSE contains the licensing paragraphs verbatim",
  LICENSING_PARAGRAPHS.every((p) => license.includes(p)));

const pkg = JSON.parse(read("package.json")) as { license?: string; private?: boolean };
check("package.json stays private and license is SEE LICENSE IN LICENSE",
  pkg.private === true && pkg.license === PACKAGE_LICENSE);

const readmeRaw = read("README.md");
const readme = readmeRaw.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
check("README contains the licensing paragraphs verbatim",
  !readmeRaw.includes("### Propriety")
  && readme.includes("## Licensing")
  && LICENSING_PARAGRAPHS.every((p) => readme.includes(p)));
check("README contains the trajectory paragraphs verbatim",
  readme.includes("## Trajectory") && TRAJECTORY_PARAGRAPHS.every((p) => readme.includes(p)));
check("README points to LICENSE", readmeRaw.includes("](LICENSE)"));

const surfaces = [
  "src/app/workbench/compute-proof/page.tsx",
  "src/app/workbench/offer/page.tsx",
  "src/app/workbench/pilot/page.tsx",
];
check("compute-proof, offer, and pilot render LicensingNotice",
  surfaces.every((p) => read(p).includes("<LicensingNotice")));
check("compute-proof renders the trajectory",
  read("src/app/workbench/compute-proof/page.tsx").includes("showTrajectory"));

const notice = read("src/components/LicensingNotice.tsx");
check("the notice links the published owner profile and /workbench/pilot",
  notice.includes("OWNER_CONTACT_URL") && notice.includes("PILOT_PATH") && notice.includes("href={PILOT_PATH}"));

function walk(dir: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) walk(abs, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(abs);
  }
}

function specifiers(text: string): string[] {
  const specs: string[] = [];
  const patterns = [
    /\b(?:import|export)\s[\s\S]*?\bfrom\s+["']([^"']+)["']/g,
    /\bimport\s+["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const re of patterns) {
    for (const m of text.matchAll(re)) {
      if (m[1]) specs.push(m[1]);
    }
  }
  return specs;
}

function forbidden(fileAbs: string, spec: string): boolean {
  const norm = spec.replaceAll("\\", "/");
  if (norm.includes("hw/scp4d")) return true;
  if (/(^|\/)src\/scp(\/|$)/.test(norm)) return true;
  if (norm === "@/scp" || norm.startsWith("@/scp/")) return true;
  if (/(^|\/)scp4d(\/|$)/.test(norm)) return true;
  let abs: string | null = null;
  if (norm.startsWith("@/")) abs = resolve(root, "src", norm.slice(2));
  else if (norm.startsWith(".")) abs = resolve(dirname(fileAbs), norm);
  if (!abs) return false;
  const rel = relative(root, abs).split(sep).join("/");
  return rel === "src/scp" || rel.startsWith("src/scp/")
    || rel === "hw/scp4d" || rel.startsWith("hw/scp4d/")
    || /(^|\/)scp4d(\/|$)/.test(rel);
}

const files: string[] = [];
walk(join(root, "src/app"), files);
walk(join(root, "src/lib"), files);
const hits: string[] = [];
for (const abs of files) {
  const text = readFileSync(abs, "utf8");
  for (const spec of specifiers(text)) {
    if (forbidden(abs, spec)) hits.push(`${relative(root, abs).split(sep).join("/")} imports ${spec}`);
  }
}
check("src/app and src/lib do not import 4D-SCP RTL or src/scp modules", hits.length === 0,
  hits.length ? hits.join("; ") : "no hw/scp4d, src/scp, or scp4d module imports in src/app or src/lib");

if (process.exitCode) process.exit(1);
console.log(`PASS check-licensing-boundaries (${n} checks)`);
