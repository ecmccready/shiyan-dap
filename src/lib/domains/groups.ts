import type { DomainGroup } from "./experience-rank";

/**
 * Domain selector. The front door is semiconductor-first; this menu is how a
 * reader reaches another domain. Every previous route is still listed.
 * International healthcare has no route and is marked planned.
 * Each domain keeps its own inputs, rules, agents, measurements, and evidence format.
 */
export const DOMAIN_GROUPS: DomainGroup[] = [
  {
    label: "Semiconductor / FPGA (Core)",
    items: [
      { label: "Workload assessment", href: "/assess" },
      { label: "Reference Data Ledger", href: "/workbench/reference-ledger" },
      { label: "Computational Improvement Proof", href: "/workbench/compute-proof" },
      { label: "Proof", href: "/workbench/proof" },
      { label: "Metamorphic proof pack", href: "/workbench/proof" },
      { label: "Result", href: "/workbench/result" },
      { label: "History", href: "/workbench/history" },
      { label: "Five evidence conditions", href: "/workbench/conditions" },
      { label: "Proof contract", href: "/workbench/contract" },
      { label: "Authoritative evidence", href: "/workbench/evidence" },
      { label: "End-to-end proof journey", href: "/workbench/journey" },
    ],
  },
  {
    label: "AI / Computational workloads",
    items: [
      { label: "Workbench", href: "/workbench" },
      { label: "Level 4 run", href: "/workbench/autonomous", experience: { reuse: true } },
      { label: "Marketplace", href: "/workbench/marketplace", experience: { reuse: true } },
      { label: "Loop · closed loop", href: "/loop" },
      { label: "Recursive improvement", href: "/workbench/loop" },
      { label: "ROE · Reciprocal Optimization Engine", href: "/workbench/autonomous?roe_drive=1" },
      { label: "Level 4 status", href: "/workbench/status" },
      { label: "Long-horizon robotics policies", href: "/workbench/robotics" },
      { label: "Robotics benchmark", href: "/workbench/robotics/benchmark" },
      { label: "Robotics value", href: "/workbench/robotics/value" },
      { label: "Robotics experiment", href: "/workbench/robotics/experiment" },
      { label: "Robotics policies", href: "/workbench/robotics/policies" },
      { label: "Proof-to-Payment Engine", href: "/workbench/engine" },
      { label: "Customer opportunity", href: "/workbench/opportunity" },
      { label: "Acquisition agent", href: "/workbench/acquisition" },
      { label: "Workbench execution", href: "/workbench/execute" },
      { label: "Human disposition", href: "/workbench/review" },
      { label: "Conversion", href: "/workbench/convert" },
      { label: "Engine status", href: "/workbench/status" },
      { label: "Founder Reference Flywheel", href: "/workbench/flywheel" },
      { label: "Live telemetry", href: "/api/v1/telemetry" },
      { label: "Drift review", href: "/api/v1/telemetry" },
      { label: "Automated proof", href: "/api/v1/proof" },
      { label: "Live middleware", href: "/api/v1/telemetry" },
      { label: "Stream harness", href: "/workbench/flywheel" },
      { label: "Auto proof", href: "/api/v1/telemetry" },
      { label: "Start a durable run", href: "/workbench/home#guided-run" },
      { label: "Offer", href: "/workbench/offer" },
      { label: "Pilot", href: "/workbench/pilot" },
    ],
  },
  {
    label: "Global Misdiagnosis",
    items: [
      { label: "Diagnostics", href: "/workbench/diagnostic" },
      { label: "Safety", href: "/workbench/safety" },
      { label: "Global · misdiagnosis", href: "/workbench/global" },
    ],
  },
  {
    label: "ACA / Medicare",
    items: [
      { label: "Medicare · Public Data Intelligence", href: "/workbench/medicare" },
    ],
  },
  {
    label: "International healthcare",
    items: [
      { label: "International healthcare", href: "", planned: true },
    ],
  },
];

export const DOMAIN_ITEMS = DOMAIN_GROUPS.flatMap((group) => group.items);
