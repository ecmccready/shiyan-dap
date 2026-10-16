# Aethel Node

Sovereign multi-model orchestration and multi-domain workspace infrastructure (formerly Shiyan-DAP).

Live: [https://shiyan-dap.vercel.app](https://shiyan-dap.vercel.app)  
Repo: [https://github.com/ecmccready/shiyan-dap](https://github.com/ecmccready/shiyan-dap)

Aethel Node is commercial development on what Shiyan already built.  
The repo name is still `shiyan-dap`.  
The product name is Aethel Node.  
The engine did not get replaced.

Keep what works. Add the next commercial plant. Do not reset traction.

## Live commercial path

Developmental stack is the product. Public packs are the proof. Client reference is the next plant.

| Surface | Role | Live |
| --- | --- | --- |
| /workbench | Commercial center | https://shiyan-dap.vercel.app/workbench |
| /workbench/review | Acquirer / funding one-pager | https://shiyan-dap.vercel.app/workbench/review |
| /workbench/offer | Solicitation | https://shiyan-dap.vercel.app/workbench/offer |
| /workbench/optimus | Model 3 sealed + Optimus 2026 proof | https://shiyan-dap.vercel.app/workbench/optimus |
| /workbench/client | Target-client pipeline + exportable Run | https://shiyan-dap.vercel.app/workbench/client |
| /workbench/pilot | Paid pilot gate (behind measured benefit) | https://shiyan-dap.vercel.app/workbench/pilot |
| /workbench/autonomous | Level 4 autonomous-run view | https://shiyan-dap.vercel.app/workbench/autonomous |
| /workbench/autonomous/proof | Level 4 proof suite | https://shiyan-dap.vercel.app/workbench/autonomous/proof |
| /workbench/history | Inspectable Runs | https://shiyan-dap.vercel.app/workbench/history |
| /workbench/marketplace | Verified sequences (not settled) | https://shiyan-dap.vercel.app/workbench/marketplace |
| /workbench/proof | Safety proof (Φ 0.014 / 0.065 / 0.065) | https://shiyan-dap.vercel.app/workbench/proof |

Φ only when final e falls. Same sealed sequence across Safety, Optimus, and Client plants.  
Not a diagnosis. No PHI. Not revenue until a client settles.  
Healthcare diagnostics remains a higher-risk, later vertical.

## What this is

Customers do not buy "Shiyan DAP," an AI, or a state machine.

They buy a system that repeatedly takes an action, observes the result, measures the error against a reference, and uses that experience to choose the next action.

- Sales: turn operational experience into the next best action.
- Technical: a model-portable closed-loop execution system where intelligence is measured by reduction of error, not by model output alone.
- Unit they operate: a **Run** on **Workbench**. Metric: **Δe**.

Home (Workspace A) is the controller. Workbench (Workbench B) is the execution environment.

## Navigation strategy

Home is the controller. Workbench is the environment. That split is the product.

| Surface | Role | Customer meaning |
| --- | --- | --- |
| / Home | Controller | Goal, task, namer of y. Music is the first vertical. |
| /workbench Workbench | Environment | The SaaS plant. Runs, domains, audit, listed experience, autonomous control. |
| Diagnostic | Plant on Workbench | Validation of y against a reference. Not a header product. |
| Proof | Plant on Workbench | Cold plant, then reuse plant. Not a header product. |
| Audit | Plant on Workbench | Frozen run + digest when Δe stalls. Human review desk. |
| MCP | Plant on Workbench | Open host/server contract. Not a header product. |
| Peer proof | Plant on Workbench | Same controller, two environments. Not a header product. |
| Actor network | Context on Workbench | Documented actors and handoffs. Not a controller. |
| Marketplace / Playlist / Songs | Kept rails | Assets already listed. Traction stays on the page. |

Diagnostic, Proof, Audit, MCP, the peer proof, and the actor network open from Workbench.

## Autonomy levels

Level 1 — Execute and measure  
Level 2 — Reuse verified experience  
Level 3 — Learn across Runs (Self() uses approved historical experience)  
Level 4 — Operate autonomously within constraints  

Level 3 is implemented: Self() retrieves only approved, safety-passed, positive-Φ experience; causal comparison distinguishes improved / tied / regressed; Runs are persisted; clients can export evidence.

Level 4 is the current architectural milestone. A bounded control loop plans, checks a safety gate before every action, executes only permitted actions, records every transition, and can resume from the last known state. It is not declared complete until recovery-from-restart, side-effect safety, and one external client with a predeclared measurable outcome are demonstrated.

## Level 4 surfaces

- Goal contract, durable state machine, and safety gate (`src/lib/level4/`).
- Autonomous-run view at `/workbench/autonomous`.
- Proof suite at `/workbench/autonomous/proof` (bounded completion, safety and budget enforcement, experience reuse, audit trail).
- Controller records can be persisted for recovery.

Marketplace remains downstream of the proof system. A lower aggregate error does not override a failed safety constraint or a required human review.

## Next development priorities (Level 4 durability)

- Durable, bounded autonomous system: plan/act/observe/verify/learn with checkpoint recovery after restart.
- Connected path: Workspace goal → Workbench execution; Workspace, Workbench, Runs, Self(), safety, and history as one system.
- Idempotent retries with duplicate-side-effect safeguards.
- Safety and budget enforcement before every permitted action.
- Verified results in existing run history and eligible experience store.
- End-to-end test proving recovery, safety, and completion (not just a demo).
- Acquisition-ready: guided first run, understandable result, demonstrable benefit without requiring users to understand the algorithm.
- Measure distribution and onboarding only after the above is coherent.

## Assets that stay listed

Do not orphan traction while the engine generalizes.

Music is the first vertical, not the product boundary.