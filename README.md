# Aethel Node

Aethel Node turns a declared goal into a bounded run, measures the result against evidence, and keeps only the experience that qualifies for reuse.

The claim is narrow: a verified, reusable workflow can reduce repeated work and next-action error. Retention, savings, and willingness to pay still have to be shown with external users and measured outcomes. “Conscious” is a product metaphor for persistent state, feedback, and continuity across runs, not a claim about machine consciousness.

Live: https://shiyan-dap.vercel.app  
Repo: https://github.com/ecmccready/shiyan-dap

Scope: diagnostics and the related pipelines (Level 4 plant, safety, MCP, micro-ledger, proof-to-pilot). Nothing here is a clinical product, and the system handles no PHI.

## Status

Phase 1 is complete. Phase 2 (MCP + boundary) is current. Phase 3 asset map and audit summary are live. Work is focused on the proof-to-pilot journey on the existing engine. No new architectural phases are planned.

- Level 4 plant, durable experience store, replay verification, and the Workbench MCP contract are live and are not modified by the commercial surfaces.
- Phase 3 surfaces (asset map, audit summary) are read-only and off-chain.
- Eight original test events remain in the ledger. Only the project owner can purge them.

## Surfaces and the Domains dropdown

Pages that use the shared header show a Domains dropdown with four groups: Know, Know How, Show, and Do. Selecting an item navigates to it. The current page is preselected.

| Group | Entry | Path |
| --- | --- | --- |
| Know | Diagnostics | /workbench/diagnostic |
| Know | Safety | /workbench/safety |
| Know | Global · misdiagnosis | /workbench/global |
| Know | Medicare · Public Data Intelligence | /workbench/medicare |
| Know | Level 4 status | /workbench/status |
| Know | Long-horizon robotics policies | /workbench/robotics |
| Know | Robotics benchmark | /workbench/robotics/benchmark |
| Know | Robotics value | /workbench/robotics/value |
| Know | Robotics experiment | /workbench/robotics/experiment |
| Know | Robotics policies | /workbench/robotics/policies |
| Know How | Loop · closed loop | /loop |
| Know How | Level 4 run | /workbench/autonomous |
| Know How | ROE · Reciprocal Optimization Engine | /workbench/autonomous?roe_drive=1 |
| Know How | Recursive improvement | /workbench/loop |
| Show | Proof | /workbench/proof |
| Show | Metamorphic proof pack | /workbench/proof |
| Show | Result | /workbench/result |
| Show | History | /workbench/history |
| Do | Proof-to-Payment Engine | /workbench/engine |
| Do | End-to-end proof journey | /workbench/journey |
| Do | Customer opportunity | /workbench/opportunity |
| Do | Acquisition agent | /workbench/acquisition |
| Do | Proof contract | /workbench/contract |
| Do | Workbench execution | /workbench/execute |
| Do | Authoritative evidence | /workbench/evidence |
| Do | Human disposition | /workbench/review |
| Do | Conversion | /workbench/convert |
| Do | Engine status | /workbench/status |
| Do | Founder Reference Flywheel | /workbench/flywheel |
| Do | Start a durable run | /workbench#guided-run |
| Do | Offer | /workbench/offer |
| Do | Pilot | /workbench/pilot |
| Do | Marketplace | /workbench/marketplace |
| Do | Acquisition Intelligence | /workbench/acquisition |
| Do | Five evidence conditions | /workbench/conditions |

The dropdown is also a read-only view of the verified-experience store. After load it fetches eligible records once and annotates the best Φ on relevant entries. Choosing Level 4 run opens the reuse hand-off when the record passes the same gates as the durable feed.

## Core loop

The closed loop is kept. Aethel Node commercializes it without replacing it.

- Workspace A declares the outcome and reference.
- Workbench B runs the bounded sequence.
- Z is measured and e is scored.
- ROE uses verified experience to inform the next action.

## Endogenous commercial loop

Aethel Node observes itself (recorded runs, outcomes, errors).  
ROE evaluates experience (what worked, what failed, what should be reused).  
Evidence becomes a product asset (reproducible, inspectable, customer-relevant proof).  
Customer experience (problem, evidence, result, value).  
Acquisition agent (evidence-backed discovery and approved outreach).  

New customer outcomes feed the next optimization cycle.  
The proof journey at `/workbench/journey` is the front door. Acquisition remains gated until the five evidence conditions are met.

## Metamorphic Perturbation Engine

The ROE path includes a controlled runtime anomaly injection (`src/core/metamorphic.ts`).

- The experiment script (`scripts/check-robotics-experiment.ts`) rolls a stochastic dice against the deterministic anchor.
- It records predicted vs emergent observation and whether system identity (Φ) holds under high-entropy drift.
- The result is surfaced on `/workbench/execute`, exported as a high-entropy proof pack on `/workbench/proof`, and included in the commercial offer and conversion surfaces.
- The pack is available at `/api/metamorphic` and can be content-hashed for independent verification.

This turns drift from a passive error into an active evolutionary feature of the persistent-autonomy benchmark.

## Platform contract

Aethel Node Extension Architecture v1.1.

A third-party Workbench produces ExperienceRecord, VerificationResult, MetamorphicResult, and NextActionProposal without modifying the core engine.

- Level 4: authoritative execution and verification records.
- Hugging Face: durable, versioned founder experience archive.
- ROE: retrieval, qualification and next-action selection.
- Flywheel: live, inspectable presentation of the resulting cycle.

## Live telemetry

POST `/api/v1/telemetry` with predicted and observed values. The metamorphic engine evaluates Φ under drift. POST `/api/v1/proof` hashes and stores the result as an experience record.

Both routes are marked `force-dynamic` for Vercel.

## Four-stage graph

Every commercial surface uses the same stages:

- **Know** — Ingest, validate schema, preserve provenance.
- **Know How** — Relate against rules and baselines; rank potential anomalies or policies.
- **Show** — Link each finding to source records, transformations, and uncertainty.
- **Do** — Generate a report, route for human review, and record the disposition.

Domain rules stay isolated. The engine does not change when a new vertical is added.

## Commercial cases

- Medicare · Public Data Intelligence is the first named vertical under Global · misdiagnosis. It turns raw public CMS data into a source-linked investigation finding with human review.
- Long-horizon robotics policies is the second commercial case. It applies the same ranking and evidence pattern to a synthetic policy fixture at `/workbench/robotics`.
- Persistent-autonomy benchmark at `/workbench/robotics/benchmark` lists the protocol measures (predicted-vs-observed, drift, recovery, interventions, look-back vs greedy).
- Value summary at `/workbench/robotics/value` is the shareable reference for customer acquisition.
- Experiment runner at `/workbench/robotics/experiment` is a deterministic simulator. A reviewer can change seeds, run look-back versus greedy, download a content-hashed evidence pack, and paste it back to verify the hash. Synthetic fixture today. Real robot control remains outside the engine.
- Policies page at `/workbench/robotics/policies` describes the look-back and greedy policies under identical conditions.
- Acquisition Intelligence at `/workbench/acquisition` lists synthetic opportunities. Each links to an evidence-pack hash and the originating run. Copy opportunity exports a shareable JSON pack.
* Metamorphic perturbation engine (`src/core/metamorphic.ts`) injects a controlled runtime anomaly into the deterministic simulator. The experiment script records predicted vs emergent observation and whether system identity (Φ) holds under high-entropy drift. The result is surfaced on `/workbench/execute`, exported as a high-entropy proof pack on `/workbench/proof`, and included in the commercial offer and conversion surfaces. Available at `/api/metamorphic`.

## Level 4

The Level 4 plant, durable experience store, and replay verification are live and are not modified by the surfaces above. Commercial pages are inspect-only or human-in-the-loop. Demonstration data is synthetic. No PHI is handled.

## Local development

```bash
git pull origin main
npm ci
npx tsx scripts/check-medicare.ts
npx tsx scripts/check-roe-lookback.ts
npx tsx scripts/check-robotics-experiment.ts