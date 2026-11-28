/**
 * Customer-facing copy and fixture-derived figures for the three-layer loop.
 * Displayed silicon numbers are computed from the Versa summary. Do not hardcode them.
 * 4D-SCP RTL is not imported here.
 */
import summary from "../../../fixtures/scp/versa-bitstream/summary.json";

const combUsed = summary.seeds[0]?.trellis_comb.used ?? 0;
const combAvail = summary.seeds[0]?.trellis_comb.available ?? 0;
const combRatio = combAvail > 0 ? (combUsed / combAvail) * 100 : 0;

export const VERSA_SUMMARY_PATH = "fixtures/scp/versa-bitstream/summary.json";
export const VIRTUAL_CHIP_LEDGER_PATH = "fixtures/virtual-chip/ledger.json";
export const REFERENCE_LEDGER_PATH = "fixtures/reference-ledger/records.json";
export const LEVEL4_REUSE_PATH = "src/lib/level4/durable-self.ts";
export const ROE_SELECTOR_PATH = "src/core/roe-next-action.ts";

export const RETENTION_SENTENCE =
  "Qualifying results are retained and become the baseline for the next run.";

export const ADVANTAGE =
  "The advantage is convergence to emergence: verified results compound into the next run instead of starting over.";

export const ADVANTAGE_LIMIT =
  "That compounding is implemented for the Level 4 plant. Silicon results are retained in the Reference Data Ledger. A retained silicon row does not rewrite the next place-and-route by itself. The other feeds on this loop are a design rule, not an automatic rewrite.";

export const FEEDS_NEXT = [
  "Feeds next: robotics policy evaluation.",
  "Feeds next: governance and commercial conversion.",
  "Feeds next: the baseline of the next run.",
] as const;

export const versa = {
  shownFmax: summary.fmax_mhz_median.toFixed(2),
  exactFmax: summary.fmax_mhz_median,
  shownPct: combAvail > 0 ? combRatio.toFixed(1) : "",
  combUsed,
  combAvail,
  combUsedLabel: combUsed.toLocaleString("en-US"),
  combAvailLabel: combAvail.toLocaleString("en-US"),
  routes: summary.seeds.filter((s) => s.exit_code === 0).length,
  seeds: summary.seeds.length,
  power: summary.power,
  device: summary.device,
};

export type LoopLayerId = "silicon" | "robotics" | "governance";

export type LoopLayer = {
  id: LoopLayerId;
  heading: string;
  title: string;
  feeds: string;
  feedsNext: (typeof FEEDS_NEXT)[number];
  href: string;
  link: string;
};

export const LOOP_LAYERS: readonly LoopLayer[] = [
  {
    id: "silicon",
    heading: "Layer One — Compute / Silicon",
    title: "Compute / Silicon",
    feeds: "silicon-evidence-to-robotics",
    feedsNext: FEEDS_NEXT[0],
    href: "/workbench/compute-proof",
    link: "Computational Improvement Proof",
  },
  {
    id: "robotics",
    heading: "Layer Two — Physical AI / Robotics",
    title: "Physical AI / Robotics",
    feeds: "robotics-evaluation-to-governance",
    feedsNext: FEEDS_NEXT[1],
    href: "/workbench/robotics",
    link: "Long-horizon robotics policies",
  },
  {
    id: "governance",
    heading: "Layer Three — Telemetry / Governance",
    title: "Telemetry / Governance",
    feeds: "governance-retention-to-next-run",
    feedsNext: FEEDS_NEXT[2],
    href: "/workbench/reference-ledger",
    link: "Reference Data Ledger",
  },
];
