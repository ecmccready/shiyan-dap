
export const DOMAIN_GROUPS = [
  {
    name: "Know",
    entries: [
      { label: "Diagnostics", path: "/workbench/diagnostic" },
      { label: "Safety", path: "/workbench/safety" },
      { label: "Global · misdiagnosis", path: "/workbench/global" },
      { label: "Medicare · Public Data Intelligence", path: "/workbench/medicare" },
      { label: "Level 4 status", path: "/workbench/status" },
      { label: "Long-horizon robotics policies", path: "/workbench/robotics" },
    ],
  },
  {
    name: "Know How",
    entries: [
      { label: "Loop · closed loop", path: "/loop" },
      { label: "Level 4 run", path: "/workbench/autonomous" },
      { label: "ROE · Reciprocal Optimization Engine", path: "/workbench/autonomous?roe_drive=1" },
    ],
  },
  {
    name: "Show",
    entries: [
      { label: "Proof", path: "/workbench/proof" },
      { label: "Result", path: "/workbench/result" },
      { label: "History", path: "/workbench/history" },
    ],
  },
  {
    name: "Do",
    entries: [
      { label: "Start a durable run", path: "/workbench#guided-run" },
      { label: "Offer", path: "/workbench/offer" },
      { label: "Pilot", path: "/workbench/pilot" },
      { label: "Marketplace", path: "/workbench/marketplace" },
    ],
  },
];

export const DOMAIN_ITEMS = DOMAIN_GROUPS.flatMap((g) => g.entries);