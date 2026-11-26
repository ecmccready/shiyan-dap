/** What each domain actually has in this repository. Unknown items stay marked planned. */
export type DomainPipeline = {
  name: string;
  role: string;
  routes: { label: string; href: string }[];
  inputs: string;
  rules: string;
  permissions: string;
  agents: string;
  measurement: string;
  evidence: string;
};

export const PLATFORM =
  "The common platform supplies orchestration, computation, optimization, measurement and provenance. Aethel Node orchestrates. 4D-SCP owns representations and operations. Shiyan DAP records and evaluates.";

export const SCOPE =
  "There is no path from an arbitrary RTL upload to an optimized-chip promise. The initial offer is a controlled workload assessment. The supported FPGA target is the ECP5 Versa (LFE5UM-45F) only.";

export const DOMAIN_PIPELINES: DomainPipeline[] = [
  {
    name: "Semiconductor / FPGA (Core)",
    role: "Default. Primary product: semiconductor computation and verification.",
    routes: [
      { label: "Front door", href: "/" },
      { label: "Stage 01 Discover", href: "/assess" },
      { label: "Reference Data Ledger", href: "/workbench/reference-ledger" },
      { label: "Computational Improvement Proof", href: "/workbench/compute-proof" },
    ],
    inputs: "A described workload at /assess. The only supported device is the ECP5 Versa, LFE5UM-45F. Arbitrary RTL upload is not accepted.",
    rules: "Pre-register, freeze a procedure hash, then measure. Bit-exact simulation and five-seed place-and-route are separate labels. See fixtures/scp/v0131-prereg.json and docs/hw/versa-runbook.md.",
    permissions: "No PHI. The hardware-receipt private key stays on the runner and is not committed (docs/hw/versa-runbook.md). A customer login for assessments is not built.",
    agents: "No intake agent is wired. The measurement runners are the check scripts. The acquisition agent at /workbench/acquisition is not the FPGA flow.",
    measurement: "Median Fmax, TRELLIS_COMB, route count, and Icarus bit-exact checks. Power is not measured.",
    evidence: "simulated and routed. Promotion to verified requires a physical measurement on the Versa. None is recorded.",
  },
  {
    name: "AI / Computational workloads",
    role: "Existing computational workbench. It does not redefine the semiconductor core.",
    routes: [
      { label: "Workbench", href: "/workbench" },
      { label: "Durable run", href: "/workbench/home" },
      { label: "Level 4 run", href: "/workbench/autonomous" },
      { label: "Robotics", href: "/workbench/robotics" },
      { label: "Marketplace", href: "/workbench/marketplace" },
    ],
    inputs: "A declared goal for a Level 4 run, or the synthetic robotics fixtures.",
    rules: "Reuse annotation requires an eligible COMPLETE record with Φ > 0 (src/lib/domains/experience-rank.ts). The Level 4 plant is not modified here.",
    permissions: "Production writes are tenant-scoped when configured. This selector does not grant them.",
    agents: "ROE is /workbench/autonomous?roe_drive=1. The acquisition agent is /workbench/acquisition. Neither runs the FPGA assessment.",
    measurement: "Φ against a cold baseline on Level 4. Robotics pages use synthetic fixtures.",
    evidence: "Experience records. They are not semiconductor ledger entries and are not physically measured FPGA results.",
  },
  {
    name: "Global Misdiagnosis",
    role: "Existing vertical page. Its logic is unchanged.",
    routes: [{ label: "Global · misdiagnosis", href: "/workbench/global" }],
    inputs: "Run rows already loaded on that page (run id, iteration, e, Φ). It does not accept patient data.",
    rules: "The page classifies loaded rows. The classification code is not edited by the semiconductor front door.",
    permissions: "The snapshot copy stays on the local clipboard. No PHI.",
    agents: "No separate agent is wired on this page.",
    measurement: "e and Φ on the loaded rows. Not a clinical outcome.",
    evidence: "A copyable snapshot. Not the Reference Data Ledger, and not a physical FPGA measurement.",
  },
  {
    name: "ACA / Medicare",
    role: "Existing public-data workbench. Not a coverage product.",
    routes: [{ label: "Medicare · Public Data Intelligence", href: "/workbench/medicare" }],
    inputs: "The committed synthetic Medicare-style fixture. The page states there is no live CMS feed and no PHI. No /workbench/aca route exists.",
    rules: "Know, Show, and Do over that fixture. Baselines live in src/lib/medicare.",
    permissions: "Interactive review uses the local clipboard and tab-local events. Nothing is submitted.",
    agents: "No live coverage agent is wired.",
    measurement: "Fixture investigation and baseline ratios. Not a clinical or insurance decision.",
    evidence: "Synthetic fixture packs. Separate from the semiconductor ledger.",
  },
  {
    name: "International healthcare",
    role: "Planned. No route.",
    routes: [],
    inputs: "Unknown. Planned.",
    rules: "Unknown. Planned.",
    permissions: "Unknown. Planned.",
    agents: "Unknown. Planned.",
    measurement: "Unknown. Planned.",
    evidence: "Unknown. Planned. This domain does not redefine the semiconductor core.",
  },
];
