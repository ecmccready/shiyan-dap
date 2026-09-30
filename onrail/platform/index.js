/**
 * OnRail platform entry (Workspace A — environment)
 * Buy as B is in scope: this process serves a customer tenant, it is not the customer.
 */

export const PATHWAYS = Object.freeze({
  healthcare: "healthcare",
  enterpriseAgentic: "enterprise-agentic",
  generalSaas: "general-purpose-saas"
});

export function createTenant(buyer) {
  if (!buyer || buyer.workspace !== "B") {
    throw new Error("Potential customer B is in scope. Reject non-B buyer identity.");
  }

  return {
    tenantId: buyer.tenantId,
    workspace: "B",
    role: "potential-customer",
    inScope: true,
    pathwaysEnabled: buyer.pathways ?? [PATHWAYS.generalSaas]
  };
}

export function runAgenticWorkflow({ tenant, goal, pathway, requireApproval = true }) {
  if (!tenant?.inScope || tenant.workspace !== "B") {
    throw new Error("Workflow must run for in-scope customer B, not for an environment.");
  }

  const plan = [
    { step: 1, action: "interpret-goal", goal },
    { step: 2, action: "select-pathway", pathway },
    { step: 3, action: "call-tools" },
    { step: 4, action: requireApproval ? "human-approval-gate" : "auto-continue" },
    { step: 5, action: "persist-audit" }
  ];

  return {
    status: requireApproval ? "awaiting-approval" : "complete",
    tenantId: tenant.tenantId,
    pathway,
    plan
  };
}

const demoBuyer = {
  workspace: "B",
  tenantId: "cust_b_001",
  pathways: [PATHWAYS.healthcare, PATHWAYS.enterpriseAgentic, PATHWAYS.generalSaas]
};

const tenant = createTenant(demoBuyer);
const result = runAgenticWorkflow({
  tenant,
  goal: "Stand up customer workspace and first enterprise agentic run",
  pathway: PATHWAYS.enterpriseAgentic
});

console.log(JSON.stringify({ tenant, result }, null, 2));