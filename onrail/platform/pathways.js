export const healthcarePathway = {
  id: "healthcare",
  commercial: true,
  buyer: "B",
  notes: [
    "Intended for commercial healthcare operations workflows.",
    "Human review required before any patient-facing or coverage decision.",
    "No PHI in this scaffold."
  ],
  stages: ["intake", "eligibility-check", "work-queue", "human-review", "audit"]
};

export const enterpriseAgenticPathway = {
  id: "enterprise-agentic",
  commercial: true,
  buyer: "B",
  notes: [
    "Multi-step agents for enterprise operations.",
    "Tool use + approval gate + persisted trail."
  ],
  stages: ["goal", "plan", "tools", "approval", "result"]
};

export const generalSaasPathway = {
  id: "general-purpose-saas",
  commercial: true,
  buyer: "B",
  notes: [
    "Multi-tenant SaaS packaging, billing intent, customer workspace."
  ],
  stages: ["signup", "tenant-provision", "configure", "subscribe", "operate"]
};