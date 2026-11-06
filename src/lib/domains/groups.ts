import type { DomainGroup } from "./experience-rank";

export const DOMAIN_GROUPS: DomainGroup[] = [
  {
    label: "Know",
    items: [
      { label: "Diagnostics", href: "/workbench/diagnostic" },
      { label: "Safety", href: "/workbench/safety" },
      { label: "Global · misdiagnosis", href: "/workbench/global" },
      { label: "Medicare · Public Data Intelligence", href: "/workbench/medicare" },
      { label: "Level 4 status", href: "/workbench/status" },
      { label: "Long-horizon robotics policies", href: "/workbench/robotics" },
      { label: "Robotics benchmark", href: "/workbench/robotics/benchmark" },
      { label: "Robotics value", href: "/workbench/robotics/value" },
      { label: "Robotics experiment", href: "/workbench/robotics/experiment" },
      { label: "Robotics policies", href: "/workbench/robotics/policies" },
    ],
  },
  {
    label: "Know How",
    items: [
      { label: "Loop · closed loop", href: "/loop" },
      { label: "Level 4 run", href: "/workbench/autonomous", experience: { reuse: true } },
      { label: "ROE · Reciprocal Optimization Engine", href: "/workbench/autonomous?roe_drive=1" },
    ],
  },
  {
    label: "Show",
    items: [
      { label: "Proof", href: "/workbench/proof" },
      { label: "Result", href: "/workbench/result" },
      { label: "History", href: "/workbench/history" },
    ],
  },
  {
    label: "Do",
    items: [
      { label: "Proof-to-Payment Engine", href: "/workbench/engine" },
      { label: "End-to-end proof journey", href: "/workbench/journey" },
      { label: "Customer opportunity", href: "/workbench/opportunity" },
      { label: "Acquisition agent", href: "/workbench/acquisition" },
      { label: "Proof contract", href: "/workbench/contract" },
      { label: "Workbench execution", href: "/workbench/execute" },
      { label: "Authoritative evidence", href: "/workbench/evidence" },
      { label: "Human disposition", href: "/workbench/review" },
      { label: "Conversion", href: "/workbench/convert" },
      { label: "Engine status", href: "/workbench/status" },
      { label: "Start a durable run", href: "/workbench#guided-run" },
      { label: "Offer", href: "/workbench/offer" },
      { label: "Pilot", href: "/workbench/pilot" },
      { label: "Marketplace", href: "/workbench/marketplace", experience: { reuse: true } },
    ],
  },
];

export const DOMAIN_ITEMS = DOMAIN_GROUPS.flatMap((group) => group.items);