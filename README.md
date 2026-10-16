# Aethel Node

Sovereign multi-model orchestration and multi-domain workspace infrastructure (formerly Shiyan-DAP).

Live: [https://shiyan-dap.vercel.app](https://shiyan-dap.vercel.app)  
Repo: [https://github.com/ecmccready/shiyan-dap](https://github.com/ecmccready/shiyan-dap)

Aethel Node is commercial development on what Shiyan already built.  
The repo name is still `shiyan-dap`.  
The product name is Aethel Node.  
The engine did not get replaced.

Keep what works. Add the next commercial plant. Do not reset traction.

## What it is now

A durable, bounded autonomous system that takes a goal, plans, acts, observes, verifies, and resumes after interruption without losing state or repeating unintended actions.

Customers do not buy an AI or a state machine. They buy a system that repeatedly reduces error against a reference, under explicit safety and budget constraints, and records eligible experience for reuse.

- Unit of operation: a **Run** on **Workbench**. Metric: **Δe**.
- Home (Workspace) is the controller. Workbench is the execution environment.
- Level 4 is the current plant: plan, act, observe, verify, learn, and recover.

## Live commercial path

| Surface | Role | Live |
| --- | --- | --- |
| /workbench | Commercial center | https://shiyan-dap.vercel.app/workbench |
| /workbench/review | Acquirer / funding one-pager | https://shiyan-dap.vercel.app/workbench/review |
| /workbench/offer | Solicitation | https://shiyan-dap.vercel.app/workbench/offer |
| /workbench/optimus | Model 3 sealed + Optimus 2026 proof | https://shiyan-dap.vercel.app/workbench/optimus |
| /workbench/client | Target-client pipeline + exportable Run | https://shiyan-dap.vercel.app/workbench/client |
| /workbench/pilot | Paid pilot gate | https://shiyan-dap.vercel.app/workbench/pilot |
| /workbench/autonomous | Level 4 autonomous run | https://shiyan-dap.vercel.app/workbench/autonomous |
| /workbench/autonomous/proof | End-to-end recovery + gate proof | https://shiyan-dap.vercel.app/workbench/autonomous/proof |
| /workbench/start | Guided first run | https://shiyan-dap.vercel.app/workbench/start |
| /workbench/outcome | External client declares a measurable goal | https://shiyan-dap.vercel.app/workbench/outcome |
| /workbench/result | Simple verified result view | https://shiyan-dap.vercel.app/workbench/result |
| /workbench/status | Level 4 durability and acquisition status | https://shiyan-dap.vercel.app/workbench/status |
| /workbench/spine | Product spine view | https://shiyan-dap.vercel.app/workbench/spine |
| /roadmap | Durability and acquisition priorities | https://shiyan-dap.vercel.app/roadmap |
| /workbench/history | Inspectable Runs | https://shiyan-dap.vercel.app/workbench/history |
| /workbench/marketplace | Verified sequences | https://shiyan-dap.vercel.app/workbench/marketplace |
| /workbench/proof | Safety proof | https://shiyan-dap.vercel.app/workbench/proof |

Φ only when final e falls. Same sealed sequence across Safety, Optimus, and Client plants.  
Not a diagnosis. No PHI. Not revenue until a client settles.  
Healthcare diagnostics remains a higher-risk, later vertical.

## What’s built

Level 4 durability plant (this slice):

- Durable state and checkpoint recovery (client + server).
- Server record in Upstash Redis (`/api/level4/run`) that survives cold starts and redeploys.
- Idempotent handling of retried actions.
- Pre-action safety and budget gate before every permitted action.
- Verified results recorded in run history and the durable experience store (`/api/level4/experience`).
- End-to-end recovery proof that also exercises the pre-action gate.
- Unique run id per guided start; recent runs tracked.
- Acquisition counters that persist (`/api/level4/acquisition`).
- Guided first-run entry (`/workbench/start`).
- External client path: declare a measurable goal (`/workbench/outcome`) → run → view verified result (`/workbench/result`).
- Product spine view and status summary with cross-links.
- Roadmap that surfaces the priorities and links.

Supporting modules under `src/lib/level4/`: checkpoint, idempotency, precheck, verified, server-record, acquisition.

## Wins

- A run can be interrupted and resumed without losing progress or repeating side effects.
- Safety and budget limits are enforced before any action is applied.
- Eligible verified results are stored durably and available for reuse by Self().
- New users have a clear starting point and an understandable result without needing to understand the algorithm.
- Acquisition is measured: guided starts and recent runs are recorded and persist.
- The external client path is closed: declare outcome → bounded run → verified result.

## Continuity

This plant builds on the existing Level 3 implementation (Self() retrieves only approved, safety-passed, positive-Φ experience; causal comparison; persisted Runs; client export).

Level 4 does not replace the engine. It adds durability, recovery, and a measurable external path on top of the same controller, safety gate, and history.

Marketplace remains downstream of the proof system. A lower aggregate error does not override a failed safety constraint or a required human review.

## Next

- External client with a predeclared measurable outcome that settles.
- Measured acquisition traffic against the durable counters.
- Server-side verified experience available to Self() across runs and restarts.
- Durable store already live (Upstash); next is volume and external settlement.

## Assets that stay listed

Do not orphan traction while the engine generalizes.

Music is the first vertical, not the product boundary.