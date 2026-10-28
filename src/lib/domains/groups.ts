import type { DomainGroup } from "./experience-rank";

/**
 * Static Domains dropdown: every in-scope surface and reference link under Know / Know How / Show / Do.
 * Reference links (/api/...) open the live JSON record. Keep Diagnostics and its related data together.
 *
 * `experience` (optional) says which verified-experience records back an item, so the dropdown can annotate
 * it with the best eligible Φ (see experience-rank.ts). `{}` means all reusable records; `reuse: true` means
 * the destination accepts `?reuse=<run id>` (only /workbench/autonomous does).
 */
export const REF_RUN = "run_mvmt18dm_dpbybz"; // recorded eligible Level 4 run

export const DOMAIN_GROUPS: DomainGroup[] = [
  {
    label: "Know",
    items: [
      { label: "Diagnostics", href: "/workbench/diagnostic", experience: {} },
      { label: "Diagnostic reference fixture", href: "/workbench/diagnostic/reference" },
      { label: "Safety", href: "/workbench/safety", experience: {} },
      { label: "Global · misdiagnosis", href: "/workbench/global" },
      { label: "Level 4 status", href: "/workbench/status" },
      { label: "Review", href: "/workbench/review" },
    ],
  },
  {
    label: "Know How",
    items: [
      { label: "Loop · closed loop", href: "/loop" },
      { label: "Level 4 run", href: "/workbench/autonomous", experience: { reuse: true } },
      { label: "ROE · Reciprocal Optimization Engine", href: "/workbench/autonomous?roe_drive=1", experience: { selector: "roe_step_aware" } },
      { label: "Level 3 Self()", href: "/workbench/self" },
      { label: "Workspace", href: "/workbench/workspace" },
      { label: "MCP", href: "/workbench/mcp" },
      { label: "Actor network", href: "/workbench/network" },
    ],
  },
  {
    label: "Show",
    items: [
      { label: "Proof", href: "/workbench/proof" },
      { label: "Result", href: "/workbench/result", experience: {} },
      { label: "History", href: "/workbench/history" },
      { label: "Peer", href: "/workbench/peer" },
      { label: "Compare", href: "/workbench/compare" },
      { label: "Shiyan + Model 3 proof", href: "/workbench/shiyan" },
      { label: "Ref · Experience record (JSON)", href: "/api/level4/experience" },
      { label: "Ref · Verify eligible run (JSON)", href: `/api/level4/verify?run_id=${REF_RUN}` },
      { label: "Ref · Anchor payload (JSON)", href: `/api/level4/anchor?run_id=${REF_RUN}` },
      { label: "Ref · Audit summary (JSON)", href: "/api/v1/audit/summary" },
      { label: "Ref · Asset map (JSON)", href: "/api/v1/ledger/assets" },
    ],
  },
  {
    label: "Do",
    items: [
      { label: "Start a durable run", href: "/workbench#guided-run" },
      { label: "Declare an outcome", href: "/workbench/outcome" },
      { label: "Client pipeline", href: "/workbench/client" },
      { label: "Offer", href: "/workbench/offer" },
      { label: "Pilot", href: "/workbench/pilot" },
    ],
  },
];

export const DOMAIN_ITEMS = DOMAIN_GROUPS.flatMap((g) => g.items);
