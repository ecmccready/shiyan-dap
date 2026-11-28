/** TEST ONLY. Semiconductor journey pages stay free of other-domain copy, and front-door links resolve.
 * The Physical AI front door (src/app/page.tsx) may name Medicare and the selector domains.
 * The Compute / Silicon layer (SemiconductorDoor) may not.
 * Run: npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-semiconductor-nav.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import summary from "../fixtures/scp/versa-bitstream/summary.json";
import { JOURNEY } from "../src/lib/semiconductor/journey";

const root = resolve(join(import.meta.dirname, ".."));
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

const silicon = "src/components/SemiconductorDoor.tsx";
const frontDoor = "src/app/page.tsx";
const journeyPages = [
  silicon,
  "src/app/assess/page.tsx",
  "src/app/journey/characterize/page.tsx",
  "src/app/journey/optimize/page.tsx",
  "src/app/journey/prove/page.tsx",
  "src/app/journey/deploy/page.tsx",
  "src/app/workbench/reference-ledger/page.tsx",
  "src/app/workbench/compute-proof/page.tsx",
  "src/app/workbench/acquisition/page.tsx",
];
const linkedPages = [frontDoor, ...journeyPages];
const forbidden = /\b(Medicare|ACA|Misdiagnosis|healthcare)\b/i;
const bridge = "bridge the gap between silicon performance and real-world physical autonomy";
const roboticsRoutes = [
  "/workbench/robotics",
  "/workbench/robotics/benchmark",
  "/workbench/robotics/value",
  "/workbench/robotics/experiment",
  "/workbench/robotics/policies",
];

let n = 0;
let failed = false;
function check(name: string, cond: boolean, detail = ""): void {
  n += 1;
  console.log(`${cond ? "ok  " : "FAIL"} ${name}${!cond && detail ? `\n     ${detail}` : ""}`);
  if (!cond) failed = true;
}

function visibleText(block: string): string {
  return block
    .replace(/className="[^"]*"/g, " ")
    .replace(/className=\{[^}]*\}/g, " ")
    .replace(/href="[^"]*"/g, " ")
    .replace(/title="[^"]*"/g, " ")
    .replace(/\{[^{}]*\}/g, " ")
    .replace(/<[^>]+>/g, " ");
}

for (const rel of journeyPages) {
  check(`${rel} has no other-domain terms`, !forbidden.test(read(rel)));
}

for (const stage of JOURNEY) {
  const file = stage.href === "/assess"
    ? "src/app/assess/page.tsx"
    : `src/app${stage.href}/page.tsx`;
  check(`${stage.n} ${stage.name} page exists`, existsSync(join(root, file)));
}

const hrefs = new Set<string>();
for (const rel of linkedPages) {
  for (const m of read(rel).matchAll(/href="(\/[^"#?]*)/g)) hrefs.add(m[1]!);
}
const missing: string[] = [];
for (const href of [...hrefs].sort()) {
  if (href.startsWith("/api/")) continue;
  const file = href === "/" ? frontDoor : `src/app${href}/page.tsx`;
  if (!existsSync(join(root, file))) missing.push(`${href} -> ${file}`);
}
check(`internal links resolve (${hrefs.size} hrefs)`, missing.length === 0, missing.join("\n"));

const front = read(frontDoor);
const door = read(silicon);
const readme = read("README.md");

check("bridge language on the front door", front.includes(bridge));
check("bridge language in the README", readme.includes(bridge));
check("front door h1 is Physical AI", /<h1[^>]*>\s*Physical AI\s*<\/h1>/.test(front));
check("Compute / Silicon layer is present", door.includes("Compute / Silicon") && door.includes('data-front-door-layer="compute-silicon"'));
check("Physical AI / Robotics layer is present", front.includes("Physical AI / Robotics") && front.includes('data-front-door-layer="physical-ai-robotics"'));
check("Telemetry / Governance layer is present", front.includes("Telemetry / Governance") && front.includes('data-front-door-layer="telemetry-governance"'));
check("README names the three layers",
  readme.includes("Compute / Silicon") && readme.includes("Physical AI / Robotics") && readme.includes("Telemetry / Governance"));
check("other domains are not a heading",
  !/<h[12][^>]*>[^<]*Misdiagnosis/.test(front) && !/<h[12][^>]*>[^<]*\bACA\b/.test(front));

const cardAt = door.indexOf("data-reference-card");
const card = cardAt >= 0 ? door.slice(cardAt) : "";
const cardLabels = [
  "v0.1.31",
  "Not yet physically validated",
  "bitstream ready, awaiting physical board",
  "bit-exact",
  "TRELLIS_COMB",
  "seeds routed",
  "Median Fmax",
  "utilization",
];
check("reference card marker", cardAt >= 0);
for (const label of cardLabels) check(`reference card label: ${label}`, card.includes(label));
check("power label uses the fixture field", /Power:\s*\{summary\.power\}\./.test(card));
check("median is derived from the fixture",
  door.includes("summary.fmax_mhz_median") && door.includes(".toFixed(2)") && card.includes("{shownFmax}"));
check("utilization is derived from the fixture", door.includes(".toFixed(1)") && card.includes("{shownPct}") && card.includes('toLocaleString("en-US")'));
check("route count is derived from the fixture", card.includes("{routes}/{summary.seeds.length} seeds routed"));
check("reference card imports the versa summary", door.includes("fixtures/scp/versa-bitstream/summary.json"));

const hardcoded = ["53.62", "53.619", "5.6%", "5.58", "2447", "2,447", "43848", "43,848", "5/5"];
check("reference numbers are not hardcoded", hardcoded.every((token) => !door.includes(token)),
  hardcoded.filter((token) => door.includes(token)).join(", "));

const used = summary.seeds[0]?.trellis_comb.used ?? 0;
const avail = summary.seeds[0]?.trellis_comb.available ?? 0;
const routed = summary.seeds.filter((s) => s.exit_code === 0).length;
check("fixture median displays 53.62", summary.fmax_mhz_median.toFixed(2) === "53.62");
check("fixture utilization displays 5.6", avail > 0 && ((used / avail) * 100).toFixed(1) === "5.6");
check("fixture comb counts are 2447/43848", used === 2447 && avail === 43848);
check("fixture counts group as 2,447/43,848",
  used.toLocaleString("en-US") === "2,447" && avail.toLocaleString("en-US") === "43,848");
check("fixture routes are 5/5", routed === 5 && summary.seeds.length === 5);
check("fixture power is needs real board", summary.power === "needs real board");

const requiredHrefs = [
  ["/assess", door],
  ["/workbench/compute-proof", door],
  ["/workbench/reference-ledger", door],
  ["/workbench/medicare", front],
  ["/workbench/offer", front],
  ["/workbench/pilot", front],
  ["/workbench/autonomous", front],
  ["/workbench/proof", front],
  ["/workbench/evidence", front],
] as const;
for (const [href, source] of requiredHrefs) {
  check(`links ${href}`, source.includes(`href="${href}"`));
}

const roboticsStart = front.indexOf('data-front-door-layer="physical-ai-robotics"');
const roboticsEnd = front.indexOf('data-front-door-layer="telemetry-governance"');
check("robotics layer is before governance", roboticsStart >= 0 && roboticsEnd > roboticsStart);
const robotics = roboticsStart >= 0 && roboticsEnd > roboticsStart ? front.slice(roboticsStart, roboticsEnd) : "";
const roboticsText = visibleText(robotics);
check("robotics copy has no digits or unit metrics", !/\d|%|MHz|ΔΦ|delta_phi|success rate/i.test(roboticsText),
  roboticsText.replace(/\s+/g, " ").trim());
check("robotics layer is labeled synthetic", /synthetic/i.test(roboticsText));
const roboticsHrefs = [...robotics.matchAll(/href="(\/[^"]+)"/g)].map((m) => m[1]!);
check("robotics layer links the existing routes",
  roboticsRoutes.every((href) => roboticsHrefs.includes(href))
  && roboticsHrefs.every((href) => roboticsRoutes.includes(href)));
for (const href of roboticsRoutes) {
  const file = `src/app${href}/page.tsx`;
  check(`robotics page exists ${href}`, existsSync(join(root, file)));
}
const leaked = ["0.041", "0.027", "0.018", "0.159", "0.847", "0.1612", "delta_phi"];
check("front door does not copy robotics fixture metrics", leaked.every((token) => !front.includes(token) && !door.includes(token)));

if (failed) process.exit(1);
console.log(`PASS check-semiconductor-nav (${n} checks)`);
