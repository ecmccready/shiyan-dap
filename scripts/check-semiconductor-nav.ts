/** TEST ONLY. Semiconductor journey pages stay free of other-domain copy, and front-door links resolve.
 * The front door (src/app/page.tsx) leads with Layer One and may name Medicare and the selector domains.
 * The Compute / Silicon layer (SemiconductorDoor) may not.
 * Run: npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-semiconductor-nav.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import summary from "../fixtures/scp/versa-bitstream/summary.json";
import { DOMAIN_GROUPS } from "../src/lib/domains/groups";
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
check("front door h1 is Compute / Silicon", /<h1[^>]*>\s*Compute \/ Silicon\s*<\/h1>/.test(door));
check("Layer One is the first content section",
  /<main[^>]*>\s*<SemiconductorDoor\s*\/>/.test(front)
  && front.indexOf("<SemiconductorDoor") < front.indexOf("<RecursiveLoop"));
check("Compute / Silicon layer is present", door.includes("Compute / Silicon") && door.includes('data-front-door-layer="compute-silicon"'));
check("moat sentence on the door", door.includes("software → virtualware → hardware"));
check("moat sentence in the README", readme.includes("software → virtualware → hardware"));
check("moat sits above the reference card",
  door.indexOf("software → virtualware → hardware") >= 0
  && door.indexOf("software → virtualware → hardware") < door.indexOf("data-reference-card"));
check("layers two and three are not homepage headline sections",
  !front.includes('data-front-door-layer="physical-ai-robotics"')
  && !front.includes('data-front-door-layer="telemetry-governance"')
  && !/<h[12][^>]*>\s*Physical AI \/ Robotics\s*<\/h[12]>/.test(front)
  && !/<h[12][^>]*>\s*Telemetry \/ Governance\s*<\/h[12]>/.test(front));
check("README names the three layers",
  readme.includes("Compute / Silicon") && readme.includes("Physical AI / Robotics") && readme.includes("Telemetry / Governance"));
check("other domains are not a heading",
  !/<h[12][^>]*>[^<]*Misdiagnosis/.test(front) && !/<h[12][^>]*>[^<]*\bACA\b/.test(front) && !/<h[12][^>]*>[^<]*Misdiagnosis/.test(door));

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

const groupsText = read("src/lib/domains/groups.ts");
const requiredHrefs = [
  ["/assess", door],
  ["/workbench/compute-proof", door],
  ["/workbench/reference-ledger", door],
  ["/workbench/medicare", groupsText],
  ["/workbench/offer", groupsText],
  ["/workbench/pilot", groupsText],
  ["/workbench/autonomous", groupsText],
  ["/workbench/proof", groupsText],
  ["/workbench/evidence", groupsText],
] as const;
for (const [href, source] of requiredHrefs) {
  const needle = source === groupsText ? `href: "${href}"` : `href="${href}"`;
  check(`links ${href}`, source.includes(needle));
}
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
  /<h1[^>]*>\s*Compute \/ Silicon\s*<\/h1>/.test(door)
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

const govAt = full.indexOf('data-loop-layer="governance"');
const govEnd = full.indexOf("</ol>", govAt);
const governanceStep = govAt >= 0 && govEnd > govAt ? full.slice(govAt, govEnd) : "";
check("Medicare link in Layer Three", governanceStep.includes('href="/workbench/medicare"'));
check("Medicare link in the loop governance step", governanceStep.includes('href="/workbench/medicare"'));

const robAt = full.indexOf('data-loop-layer="robotics"');
const robEnd = full.indexOf('data-loop-layer="governance"');
check("robotics layer is before governance", robAt >= 0 && robEnd > robAt);
const loopRobotics = robAt >= 0 && robEnd > robAt ? full.slice(robAt, robEnd) : "";
const loopRoboticsText = visibleText(loopRobotics);
check("robotics copy has no digits unless fixture-derived and labeled synthetic",
  roboticsDigitsOk(loopRobotics, loopRoboticsText),
  loopRoboticsText.replace(/\s+/g, " ").trim());
check("robotics layer is labeled synthetic", /synthetic/i.test(loopRoboticsText));
const roboticsHrefs = [...loopRobotics.matchAll(/href="(\/[^"]+)"/g)].map((m) => m[1]!);
check("robotics layer links the existing routes",
  roboticsRoutes.every((href) => roboticsHrefs.includes(href))
  && roboticsHrefs.every((href) => roboticsRoutes.includes(href)));
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

const honesty = [
  "Design rule. Nothing writes a bitstream measurement into a robotics policy.",
  "Design rule. A synthetic policy result does not open a commercial charge.",
  "Status: synthetic. No field metric.",
  "Next-run reuse of these fixtures is planned.",
  "Status: implemented for the Level 4 plant.",
  "Status: implemented, routed and simulated.",
  "Becoming the next place-and-route baseline is a design rule, not an automatic rewrite.",
  "Next-run reuse is planned.",
];
for (const line of honesty) check(`honesty label: ${line}`, full.includes(line));

const dropdownLabels = DOMAIN_GROUPS.map((g) => g.label);
check("dropdown group order",
  dropdownLabels.join(" | ") === [
    "Layer Two — Physical AI / Robotics",
    "Layer Three — Telemetry / Governance",
    "Medicare intelligence",
    "Global Misdiagnosis",
    "ACA reference",
    "AI / Computational workloads",
    "Semiconductor / FPGA (Core)",
    "International healthcare",
  ].join(" | "));
check("dropdown robotics routes",
  DOMAIN_GROUPS[0]?.items.map((i) => i.href).join(",") === roboticsRoutes.join(","));
check("dropdown governance routes",
  DOMAIN_GROUPS[1]?.items.map((i) => i.href).join(",") === [
    "/workbench/reference-ledger",
    "/workbench/compute-proof",
    "/workbench/autonomous",
    "/workbench/status",
    "/workbench/offer",
    "/workbench/pilot",
    "/workbench/journey",
  ].join(","));
check("dropdown medicare route",
  DOMAIN_GROUPS[2]?.label === "Medicare intelligence"
  && DOMAIN_GROUPS[2]?.items.map((i) => i.href).join(",") === "/workbench/medicare");
check("ACA reference has no route",
  DOMAIN_GROUPS.find((g) => g.label === "ACA reference")?.items.every((i) => i.planned === true && i.href === "") === true);

const previousHrefs = [
  "/",
  "/assess",
  "/journey/characterize",
  "/journey/optimize",
  "/journey/prove",
  "/journey/deploy",
  "/workbench/reference-ledger",
  "/workbench/compute-proof",
  "/workbench/acquisition",
  "/workbench/proof",
  "/workbench/result",
  "/workbench/history",
  "/workbench/conditions",
  "/workbench/contract",
  "/workbench/evidence",
  "/workbench/journey",
  "/workbench",
  "/workbench/autonomous",
  "/workbench/marketplace",
  "/loop",
  "/workbench/loop",
  "/workbench/autonomous?roe_drive=1",
  "/workbench/status",
  "/workbench/robotics",
  "/workbench/robotics/benchmark",
  "/workbench/robotics/value",
  "/workbench/robotics/experiment",
  "/workbench/robotics/policies",
  "/workbench/engine",
  "/workbench/opportunity",
  "/workbench/execute",
  "/workbench/review",
  "/workbench/convert",
  "/workbench/flywheel",
  "/api/v1/telemetry",
  "/api/v1/proof",
  "/workbench/home#guided-run",
  "/workbench/offer",
  "/workbench/pilot",
  "/workbench/diagnostic",
  "/workbench/safety",
  "/workbench/global",
  "/workbench/medicare",
];
const dropdownHrefs = new Set(DOMAIN_GROUPS.flatMap((g) => g.items.map((i) => i.href)));
const dropped = previousHrefs.filter((href) => !dropdownHrefs.has(href));
check("dropdown keeps every previous route", dropped.length === 0, dropped.join(", "));

const missingRoutes: string[] = [];
for (const item of DOMAIN_GROUPS.flatMap((g) => g.items)) {
  if (item.planned || item.href === "" || item.href.startsWith("/api/")) continue;
  const path = item.href.split("?")[0]!.split("#")[0]!;
  const file = path === "/" ? frontDoor : `src/app${path}/page.tsx`;
  if (!existsSync(join(root, file))) missingRoutes.push(`${item.href} -> ${file}`);
}
check("dropdown routes exist", missingRoutes.length === 0, missingRoutes.join("\n"));

if (failed) process.exit(1);
console.log(`PASS check-semiconductor-nav (${n} checks)`);
