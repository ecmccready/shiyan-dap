# Aethel Node

Sovereign Operating System for distributed AI compute.

Live: [https://shiyan-dap.vercel.app](https://shiyan-dap.vercel.app)  
Repo: [https://github.com/ecmccready/shiyan-dap](https://github.com/ecmccready/shiyan-dap)

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

## Autonomy levels

Level 1 — Execute and measure  
Level 2 — Reuse verified experience  
Level 3 — Learn across Runs (Self() uses approved historical experience)  
Level 4 — Operate autonomously within constraints  

Level 3 is implemented and remains in use: Self() retrieves only approved, safety-passed, positive-Φ experience; causal comparison distinguishes improved / tied / regressed; Runs are persisted; clients can export evidence.

Level 4 is the current plant and is live. A bounded control loop plans, checks a safety gate before every action, executes only permitted actions, records every transition, recovers from interruption, and records eligible experience for reuse. Recovery, idempotency, safety/budget enforcement, and an end-to-end proof are demonstrated. An external client path (declare outcome → run → verified result) is open.

Each autonomous step is measured on the core plant: applied actions are replayed through the same engine that scores every Run, so e is computed rather than reported. The live verified record (`demo-run`, readable at `/api/level4/experience`) runs four gated steps, e 1.561 → 0.151 (Δe 1.410), reaches COMPLETE, and beats a cold `Self()` baseline of 0.165 (Φ 0.014). Only that final step is marked eligible.

## What’s built

Level 4 durability plant (this slice):

- Durable state and checkpoint recovery (client + server).
- Autonomous steps measured on the core plant (`measured.ts` replays applied actions through the core engine; the core loop itself is unchanged).
- Server record in Upstash Redis (`/api/level4/run`) that survives cold starts and redeploys.
- Idempotent handling of retried actions.
- Pre-action safety and budget gate before every permitted action.
- Verified results recorded in run history and the durable experience store (`/api/level4/experience`, Upstash). Writes are idempotent: one entry per run and iteration.
- End-to-end recovery proof that also exercises the pre-action gate.
- Unique run id per guided start; recent runs tracked.
- Acquisition counters that persist (`/api/level4/acquisition`), incremented atomically so concurrent starts are not lost.
- Guided first-run entry (`/workbench/start`).
- External client path: declare a measurable goal (`/workbench/outcome`) → run → view verified result (`/workbench/result`). The result page is server-rendered from the durable store, so the latest eligible result is visible without JavaScript.
- Status (`/workbench/status`) reads the durable store directly: guided starts, recent runs, latest verified result, and recent verified steps.
- One shared Level 4 navigation across start, outcome, autonomous run, result, recovery proof, status, spine, and roadmap.
- Product spine view and status summary with cross-links.
- Roadmap that surfaces the priorities and links.

Supporting modules under `src/lib/level4/`: controller, goal, loop, safety-gate, checkpoint, idempotency, precheck, verified, measured, server-record, acquisition.

## Wins

- A run can be interrupted and resumed without losing progress or repeating side effects.
- Safety and budget limits are enforced before any action is applied.
- Eligible verified results are stored durably and are publicly inspectable (`/api/level4/experience`). Feeding them back into Self() across runs is not live yet (see Next).
- New users have a clear starting point and an understandable result without needing to understand the algorithm.
- Acquisition is measured: guided starts and recent runs are recorded and persist.
- The external client path is closed: declare outcome → bounded run → verified result.
- Measured Δe is inspectable: every verified step carries e, e0, Δe, the cold baseline, and Φ in a public record.

## Continuity

This plant builds on the existing Level 3 implementation and does not replace it. Level 4 adds durability, recovery, and a measurable external path on top of the same controller, safety gate, and history.

Marketplace remains downstream of the proof system. A lower aggregate error does not override a failed safety constraint or a required human review.

The Model 3 sealed sequence and Optimus reference remain in the continuity and proof language. `/workbench/optimus` is not a live surface; links that pointed to it now point to `/workbench/shiyan`.

## Next

- External client with a predeclared measurable outcome that settles.
- Measured acquisition traffic against the durable counters.
- Server-side verified experience available to Self() across runs and restarts.
- Durable store already live (Upstash); next is volume and external settlement.

## Assets that stay listed

Do not orphan traction while the engine generalizes.

Music is the first vertical, not the product boundary.

## Architectural Leverage & Enterprise Readiness

Aethel Node does not rely on fragile prompting or linear agent chains. Under the hood, it operates as a model-portable cognitive engine built for zero-downtime corporate environments:

* **Decoupled Orchestration:** Separates cognitive planning from tool execution, enabling seamless hot-swapping of underlying LLMs based on cost, latency, or compute needs.

* **Topological Fault Isolation:** Uses mereotopological boundaries instead of standard graph networks, allowing the system to naturally isolate, bypass, and recover from localized environment failures.

* **Enterprise Data Sovereignty:** Powered by a clean Model Context Protocol (MCP) refactor, ensuring client data layers never bleed into the orchestration loop, fulfilling strict security compliance out of the box.

* **Actor-Network Loop:** The closed loop is designed as an actor network in the sense of actor-network theory: human and non-human actors (client, operator, proposer models, safety gate, plant, durable store) only count when their contribution is translated into a recorded, measurable step. A client is enrolled by declaring an outcome or taking a guided start; a proposal is translated into action only by passing the pre-action gate, which every action must go through; and each translation is inscribed as a run record and, when it verifies, an experience entry. Because the network is held together by inscriptions rather than by any single model, a proposer can be swapped without breaking the loop.

* **Durable, Inspectable Evidence (Level 4, live):** Run records, verified experience, and guided-start counters persist in Upstash Redis and survive cold starts and redeploys. Experience writes are idempotent per run and iteration; counters increment atomically. Every verified step exposes e, Δe, the cold `Self()` baseline, and Φ at `/api/level4/experience`, and the same record renders server-side on `/workbench/result`.

* **Safety Before Side Effects:** Every action passes a pre-action safety and budget gate and an idempotency check before it is applied, so a retried or resumed run does not repeat side effects. The recovery proof (`/workbench/autonomous/proof`) exercises interruption, resume, and the gate end to end.

* **Additive by Construction:** Level 4 wraps the existing closed loop, `Self()`, measurement of e, and safety modules without modifying them. Commercial surfaces read from the same evidence the engine writes.

