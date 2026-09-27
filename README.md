# Shiyan

Live: https://shiyan-dap.vercel.app

Repo: https://github.com/ecmccready/shiyan-dap

Workspace A is a **model-portable autonomous controller**.

Workbench B can still measure state `z`.

**You Buy as B.** Workspace B is a **potential customer in scope**, not an environment-only out-of-scope role.

Music is the first vertical, not the product boundary.

Grok fast, Hy4 deep, and Grok Bot orchestrate A.

This is **not SIMA 2, not AGI, and not unsupervised clinical diagnosis or treatment**.

## Commercial intent

This repository states intent to commercially implement:

1. **Healthcare** pathways — operations and agentic workflows with a human gate. Not unsupervised diagnosis or treatment.
2. **Enterprise agentic workflows** — plan → tool calls → human approval → audit.
3. **General-purpose software-as-a-service (SaaS)** pathways — tenant, buyer workspace, paid rail.

OnRail folders in this repo:

| Path | Role | Status |
| --- | --- | --- |
| `onrail/platform` | Workspace A / vendor environment | Internal |
| `onrail/customer-b` | Workspace B / potential customer | **IN SCOPE** |

Buy as B must stay in scope versus out. B is a buyer identity, not a disposable second environment.

## What it is

A Workspace that:

1. Uses workbenches as measurable environments
2. Turns actions `y` into experience
3. Maintains state `z`
4. Predicts outcomes
5. Measures error
6. Uses `Self()` to select or revise the next action
7. Sells to B as a potential customer on healthcare, enterprise agentic, and general SaaS pathways

Portable means: keep A, `Self()`, and memory `M`. Swap the workbench `W` and the measurement of `z`. Carry `M` to the next host. Keep B in scope as the buyer.

## Repo layout

onrail/
  onrail.code-workspace
  README.md
  platform/          # Workspace A — environment
  customer-b/        # Workspace B — potential customer (Buy as B)


## Pathways

- Healthcare: prior auth intake, care-ops handoff, audit trail, BAA-aware tenancy notes.
- Enterprise agentic: goal → plan → tool calls → approval gate → result.
- General-purpose SaaS: tenant isolation, customer workspace, subscription intent.

## Status

Scaffold only. No production PHI, no live claims, no unsupervised clinical decisions.
# Workspace A — Platform Environment

This folder is the **vendor environment**.

It is not the customer. It owns:

- agent runtime
- tenancy and SaaS control plane
- healthcare / enterprise / general pathway adapters
- what a buyer (Workspace B) purchases

B evaluates A. A does not pretend to be B.

# Scope: Buy as B must stay in

## In scope
- Workspace B is a potential customer.
- Customer can buy healthcare, enterprise agentic, and general SaaS pathways.
- Customer tenant is isolated from the platform environment.
- Human approval gates on healthcare-facing and high-risk enterprise actions.
- Commercial packaging: plan, seat, workflow pack.

## Out of scope
- Treating Workspace B as “just another environment.”
- Shipping B’s files as if they were platform internals.
- Unsupervised clinical diagnosis or treatment decisions.
- Using real patient data in this scaffold.

# Workspace B — Potential Customer

**You Buy as B.**

This workspace is a **potential customer**, not an environment.

## In scope
- I am the buyer.
- I evaluate OnRail for commercial use.
- I may purchase:
  - healthcare pathways
  - enterprise agentic workflows
  - general-purpose SaaS pathways
- My tenant, brand, users, and data boundary stay on the customer side.

## Out of scope
- Being treated as a second copy of the platform environment.
- Sharing vendor secrets or platform-only config.
- Running as if I were Workspace A.

## What B needs from A
- A provisioned customer workspace
- Pathway catalog and pricing intent
- Approval-gated agentic runs
- Audit export
- Healthcare: BAA / tenancy discussion before any PHI

# Buy as B

Workspace: B  
Role: potential customer  
Status: **IN SCOPE**

## Buying situation
New-task commercial evaluation of OnRail.

## Must-have
- Healthcare commercial pathway (ops / workflow, not unsupervised clinical care)
- Enterprise agentic workflows with human gates
- General-purpose SaaS tenancy I can actually buy

## Must-not
- “B is just an environment”
- Demo-only identity that cannot become a paying tenant
