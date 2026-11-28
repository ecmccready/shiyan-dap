/** TEST ONLY. Semiconductor journey pages stay free of other-domain copy, and front-door links resolve.
 * The Physical AI front door (src/app/page.tsx) may name Medicare and the selector domains.
 * The Compute / Silicon layer (SemiconductorDoor) may not.
 * Run: npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-semiconductor-nav.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import summary from "../fixtures/scp/versa-bitstream/summary.json";
import { JOURNEY } from "../src/lib/semiconductor/journey";
import {
  ADVANTAGE,
  ADVANTAGE_LIMIT,
  FEEDS_NEXT,
  LOOP_LAYERS,
  RETENTION_SENTENCE,
  versa,
} from "../src/lib/semiconductor/loop";

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

/** Digits are refused unless that same source is labeled synthetic and cites a fixture. */
function roboticsDigitsOk(source: string, text: string): boolean {
  const hasDigit = /\d/.test(text);
  const hasUnit = /%|MHz|ΔΦ|delta_phi|success rate/i.test(text);
  if (!hasDigit && !hasUnit) return true;
  return /synthetic/i.test(source) && /fixtures\//.test(source) && !hasUnit;
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
const loopSources = [
  "src/components/RecursiveLoop.tsx",
  "src/components/LoopStrip.tsx",
  "src/lib/semiconductor/loop.ts",
];
for (const rel of [...linkedPages, ...loopSources]) {
  const text = read(rel);
  for (const m of text.matchAll(/href="(\/[^"#?]*)/g)) hrefs.add(m[1]!);
  for (const m of text.matchAll(/href:\s*"(\/[^"#?]*)"/g)) hrefs.add(m[1]!);
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
check("robotics copy has no digits unless fixture-derived and labeled synthetic",
  roboticsDigitsOk(robotics, roboticsText),
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

const full = read("src/components/RecursiveLoop.tsx");
const strip = read("src/components/LoopStrip.tsx");
const loopLib = read("src/lib/semiconductor/loop.ts");
const headings = [
  "Layer One — Compute / Silicon",
  "Layer Two — Physical AI / Robotics",
  "Layer Three — Telemetry / Governance",
];

check("three layer headings",
  /<h2[^>]*>\s*Compute \/ Silicon\s*<\/h2>/.test(door)
  && /<h2[^>]*>\s*Physical AI \/ Robotics\s*<\/h2>/.test(front)
  && /<h2[^>]*>\s*Telemetry \/ Governance\s*<\/h2>/.test(front)
  && LOOP_LAYERS.every((layer, i) => layer.heading === headings[i]));
check("front door renders the recursive loop", front.includes("<RecursiveLoop"));
check("loop section marker", full.includes("data-recursive-loop") && full.includes('id="convergence-loop"'));
check("three feeds-next steps",
  LOOP_LAYERS.length === 3
  && FEEDS_NEXT.length === 3
  && LOOP_LAYERS.every((layer, i) => layer.feedsNext === FEEDS_NEXT[i])
  && FEEDS_NEXT.every((line) => readme.includes(line) && loopLib.includes(line))
  && full.includes("data-feeds-next={silicon.feeds}")
  && full.includes("data-feeds-next={robotics.feeds}")
  && full.includes("data-feeds-next={governance.feeds}")
  && strip.includes("data-feeds-next={layer.feeds}"));
check("feed ids",
  LOOP_LAYERS.map((layer) => layer.feeds).join(",")
  === "silicon-evidence-to-robotics,robotics-evaluation-to-governance,governance-retention-to-next-run");
check("retention/baseline sentence",
  RETENTION_SENTENCE === "Qualifying results are retained and become the baseline for the next run."
  && readme.includes(RETENTION_SENTENCE)
  && loopLib.includes(RETENTION_SENTENCE)
  && full.includes("{RETENTION_SENTENCE}")
  && strip.includes("{RETENTION_SENTENCE}"));
check("convergence to emergence",
  ADVANTAGE.includes("convergence to emergence")
  && /convergence to emergence/i.test(readme)
  && /convergence to emergence/i.test(full)
  && front.includes("{ADVANTAGE}")
  && full.includes("{ADVANTAGE}")
  && strip.includes("{ADVANTAGE}"));
check("advantage limit is on the door and in the README",
  front.includes("{ADVANTAGE_LIMIT}") && readme.includes(ADVANTAGE_LIMIT) && full.includes("{ADVANTAGE_LIMIT}"));
check("loop headings render", full.includes("{silicon.heading}") && strip.includes("{layer.heading}"));

const telemetryStart = front.indexOf('data-front-door-layer="telemetry-governance"');
const telemetry = telemetryStart >= 0 ? front.slice(telemetryStart) : "";
const govAt = full.indexOf('data-loop-layer="governance"');
const govEnd = full.indexOf("</ol>", govAt);
const governanceStep = govAt >= 0 && govEnd > govAt ? full.slice(govAt, govEnd) : "";
check("Medicare link in Layer Three", telemetry.includes('href="/workbench/medicare"'));
check("Medicare link in the loop governance step", governanceStep.includes('href="/workbench/medicare"'));

const robAt = full.indexOf('data-loop-layer="robotics"');
const robEnd = full.indexOf('data-loop-layer="governance"');
const loopRobotics = robAt >= 0 && robEnd > robAt ? full.slice(robAt, robEnd) : "";
const loopRoboticsText = visibleText(loopRobotics);
check("loop robotics step has no digits unless fixture-derived and labeled synthetic",
  roboticsDigitsOk(loopRobotics, loopRoboticsText),
  loopRoboticsText.replace(/\s+/g, " ").trim());

const stripPages = [
  "src/app/assess/page.tsx",
  "src/app/journey/characterize/page.tsx",
  "src/app/journey/optimize/page.tsx",
  "src/app/journey/prove/page.tsx",
  "src/app/journey/deploy/page.tsx",
  "src/app/workbench/compute-proof/page.tsx",
];
for (const rel of stripPages) {
  const text = read(rel);
  check(`${rel} places this step in the loop`, text.includes("<LoopStrip") && text.includes('here="silicon"'));
}
check("loop strip has no other-domain terms", !forbidden.test(strip) && !forbidden.test(loopLib));
check("strip names where this step sits", strip.includes("Where this step sits in the loop"));

check("loop figures match the fixture",
  versa.shownFmax === summary.fmax_mhz_median.toFixed(2)
  && versa.shownPct === ((used / avail) * 100).toFixed(1)
  && versa.combUsedLabel === used.toLocaleString("en-US")
  && versa.combAvailLabel === avail.toLocaleString("en-US")
  && versa.routes === routed
  && versa.seeds === summary.seeds.length
  && versa.power === summary.power);
check("loop sources do not hardcode the reference numbers",
  hardcoded.every((token) => !full.includes(token) && !strip.includes(token) && !loopLib.includes(token)),
  hardcoded.filter((token) => full.includes(token) || strip.includes(token) || loopLib.includes(token)).join(", "));
check("loop renders the derived figures",
  full.includes("versa.shownFmax") && full.includes("versa.shownPct") && full.includes("versa.power") && strip.includes("versa.power"));

const qualified = [frontDoor, silicon, ...loopSources, "README.md", ...journeyPages];
const unqualified: string[] = [];
for (const rel of qualified) {
  const text = read(rel);
  for (const m of text.matchAll(/physically validated/gi)) {
    const index = m.index ?? 0;
    const before = text.slice(Math.max(0, index - 16), index);
    if (!/not yet\s*$/i.test(before)) unqualified.push(`${rel}: …${before.replace(/\s+/g, " ")}physically validated`);
  }
}
check("no physically validated claim without Not yet", unqualified.length === 0, unqualified.join("\n"));

if (failed) process.exit(1);
console.log(`PASS check-semiconductor-nav (${n} checks)`);
