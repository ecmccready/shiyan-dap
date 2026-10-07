export const SAAS = {
  name: "Aethel Node SaaS",
  unit: "Run",
  metric:
    "A Run that prints z, e, and Δe. Not a count of AI conversations.",
  ownsEveryWorkbench: false,
  trajectory: [
    "SaaS product",
    "multi-tenant platform",
    "P2P Workbench network",
    "experience marketplace",
  ],
  stack: [
    {
      id: "organization",
      label: "Organization",
      role: "Tenant. Billing boundary. Platform fee.",
    },
    {
      id: "workspace",
      label: "Workspace A Controller",
      role: "Controller A. Names y. Does not own the plant.",
      href: "/workspace",
    },
    {
      id: "workbench",
      label: "Workbench B SaaS execution",
      role: "MCP server. Aethel-owned, or brought by a customer or partner.",
      href: "/workbench",
    },
  ],
  branches: [
    {
      id: "run",
      label: "Run",
      chain: ["outcome z", "error e", "Δe", "verified Experience", "reuse / marketplace"],
      href: "/workbench",
    },
    {
      id: "diagnostic",
      label: "Diagnostic",
      chain: ["gate", "reference", "HOLD / CLINICIAN_REVIEW / ESCALATE"],
      href: "/workbench/safety",
    },
    {
      id: "audit",
      label: "Audit",
      chain: ["frozen digest", "human review"],
      href: "/audit",
    },
  ],
  commercial: {
    shape: "Platform subscription + usage",
    lines: [
      { id: "platform", label: "Platform", price: "organization / workspace fee" },
      { id: "workbench", label: "Workbench", price: "per operational domain" },
      { id: "runs", label: "Runs", price: "usage-based" },
      { id: "experience", label: "Experience", price: "premium / reusable capability" },
      {
        id: "enterprise",
        label: "Enterprise",
        price: "private MCP Workbenches, audit, governance",
      },
    ],
  },
  rules: [
    "A new Workbench B speaks MCP. No fork of Controller A.",
    "Safety remains the buyer-facing proof.",
    "Better means a lower final e. A tie is not an error win.",
    "Customer value means a settled payment for that record.",
    "Self() does not read prior Runs.",
  ],
} as const;