export const DOMAIN_GROUPS = [
  {
    name: "Know",
    entries: [
      { label: "Diagnostics", href: "/workbench/diagnostic" },
      { label: "Safety", href: "/workbench/safety" },
      { label: "Global · misdiagnosis", href: "/workbench/global" },
      { label: "Medicare · Public Data Intelligence", href: "/workbench/medicare" },
      { label: "Level 4 status", href: "/workbench/status" },
      { label: "Long-horizon robotics policies", href: "/workbench/robotics" },
    ],
  },
  {
    name: "Know How",
    entries: [
      { label: "Loop · closed loop", href: "/loop" },
      { label: "Level 4 run", href: "/workbench/autonomous" },
      { label: "ROE · Reciprocal Optimization Engine", href: "/workbench/autonomous?roe_drive=1" },
    ],
  },
  {
    name: "Show",
    entries: [
      { label: "Proof", href: "/workbench/proof" },
      { label: "Result", href: "/workbench/result" },
      { label: "History", href: "/workbench/history" },
    ],
  },
  {
    name: "Do",
    entries: [
      { label: "Start a durable run", href: "/workbench#guided-run" },
      { label: "Offer", href: "/workbench/offer" },
      { label: "Pilot", href: "/workbench/pilot" },
      { label: "Marketplace", href: "/workbench/marketplace" },
    ],
  },
];

export const DOMAIN_ITEMS = DOMAIN_GROUPS.flatMap((g) => g.entries);