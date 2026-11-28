import type { DomainGroup } from "./experience-rank";

/**
 * Domain selector. The front door leads with Layer One — Compute / Silicon.
 * This menu starts at Layer Two. Every previous route is still listed.
 * ACA reference and International healthcare have no route and are marked planned.
 * Each domain keeps its own inputs, rules, agents, measurements, and evidence format.
 */
export const DOMAIN_GROUPS: DomainGroup[] = [
  {
    label: "Layer Two — Physical AI / Robotics",
    items: [
      { label: "Long-horizon robotics policies", href: "/workbench/robotics" },
      { label: "Robotics benchmark", href: "/workbench/robotics/benchmark" },
      { label: "Robotics value", href: "/workbench/robotics/value" },
      { label: "Robotics experiment", href: "/workbench/robotics/experiment" },
      { label: "Robotics policies", href: "/workbench/robotics/policies" },
    ],
  },
  {
    label: "Layer Three — Telemetry / Governance",
    items: [
      { label: "Reference Data Ledger", href: "/workbench/reference-ledger" },
      { label: "Computational Improvement Proof", href: "/workbench/compute-proof" },
      { label: "Level 4 run", href: "/workbench/autonomous", experience: { reuse: true } },
      { label: "Level 4 status", href: "/workbench/status" },
      { label: "Offer", href: "/workbench/offer" },
      { label: "Pilot", href: "/workbench/pilot" },
      { label: "End-to-end proof journey", href: "/workbench/journey" },
    ],
  },
  {
    label: "Medicare intelligence",
    items: [
      { label: "Medicare · Public Data Intelligence", href: "/workbench/medicare" },
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
    label: "ACA reference",
    items: [
      { label: "ACA reference market", href: "", planned: true },
    ],
  },
  {
    label: "AI / Computational workloads",
    items: [
      { label: "Workbench", href: "/workbench" },
      { label: "Marketplace", href: "/workbench/marketplace", experience: { reuse: true } },
      { label: "Loop · closed loop", href: "/loop" },
      { label: "Recursive improvement", href: "/workbench/loop" },
      { label: "ROE · Reciprocal Optimization Engine", href: "/workbench/autonomous?roe_drive=1" },
      { label: "Proof-to-Payment Engine", href: "/workbench/engine" },
      { label: "Customer opportunity", href: "/workbench/opportunity" },
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
    ],
  },
  {
    label: "Semiconductor / FPGA (Core)",
    items: [
      { label: "Semiconductor / FPGA (Core)", href: "/" },
      { label: "Workload assessment · Discover", href: "/assess" },
      { label: "Characterize", href: "/journey/characterize" },
      { label: "Optimize", href: "/journey/optimize" },
      { label: "Prove", href: "/journey/prove" },
      { label: "Deploy or hand off", href: "/journey/deploy" },
      { label: "Acquisition agent", href: "/workbench/acquisition" },
      { label: "Proof", href: "/workbench/proof" },
      { label: "Metamorphic proof pack", href: "/workbench/proof" },
      { label: "Result", href: "/workbench/result" },
      { label: "History", href: "/workbench/history" },
      { label: "Five evidence conditions", href: "/workbench/conditions" },
      { label: "Proof contract", href: "/workbench/contract" },
      { label: "Authoritative evidence", href: "/workbench/evidence" },
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
