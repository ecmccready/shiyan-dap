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
    ],
  },
  {
    label: "Know How",
    items: [
      { label: "Loop · closed loop", href: "/loop" },
      { label: "Level 4 run", href: "/workbench/autonomous", experience: { reuse: true } },
      { label: "ROE · Reciprocal Optimization Engine", href: "/workbench/autonomous?roe_drive=1", experience: { selector: "roe_step_aware" } },
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
      { label: "Start a durable run", href: "/workbench#guided-run" },
      { label: "Offer", href: "/workbench/offer" },
      { label: "Pilot", href: "/workbench/pilot" },
      { label: "Marketplace", href: "/workbench/marketplace", experience: { reuse: true } },
    ],
  },
];

export const DOMAIN_ITEMS = DOMAIN_GROUPS.flatMap((g) => g.items);