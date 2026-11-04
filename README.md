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
|---|---|---|
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
| Show | Proof | /workbench/proof |
| Show | Result | /workbench/result |
| Show | History | /workbench/history |
| Do | Start a durable run | /workbench#guided-run |
| Do | Offer | /workbench/offer |
| Do | Pilot | /workbench/pilot |
| Do | Marketplace | /workbench/marketplace |
| Do | Acquisition Intelligence | /workbench/acquisition |

The dropdown is also a read-only view of the verified-experience store. After load it fetches eligible records once and annotates the best Φ on relevant entries. Choosing Level 4 run opens the reuse hand-off when the record passes the same gates as the durable feed.

## Core loop

The closed loop is kept. Aethel Node commercializes it without replacing it.

- Workspace A declares the outcome and reference.
- Workbench B runs the bounded sequence.
- Z is measured and e is scored.
- ROE uses verified experience to inform the next action.

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

## Level 4

The Level 4 plant, durable experience store, and replay verification are live and are not modified by the surfaces above. Commercial pages are inspect-only or human-in-the-loop. Demonstration data is synthetic. No PHI is handled.

## Local development

```bash
git pull origin main
npm ci
npx tsx scripts/check-medicare.ts
npx tsx scripts/check-roe-lookback.ts
npx tsx scripts/check-robotics-experiment.ts

## End-to-end proof journey

- Customer-facing journey: `/workbench/journey`, available from Domains → Do → End-to-end proof journey.
- The guided flow joins Know → Know How → Show → Do: declare a bounded experiment, compare paired policies, verify evidence integrity, and record a human disposition.
- Robotics evidence schema v2 separates a reproducibility fingerprint (stable for identical inputs) from the run-specific evidence-pack hash (includes generation time). Trial hashes use full SHA-256.
- Verification recomputes each trial hash, paired-trial structure, aggregate metrics, reproducibility fingerprint, and complete pack hash. Integrity verification is separate from outcome: a valid pack can report look-back better, greedy better, or a tie.
- The journey also reads the existing durable Level 4 experience API and links each recorded run to its public replay-verification endpoint. If the store is unavailable, the page reports that state rather than inventing records. The robotics runner remains a deterministic synthetic fixture. Journey review state is stored in the current browser only. It does not establish physical performance, independent attestation, customer acceptance, revenue, or persistent server-side customer records.
- Acquisition remains gated until non-synthetic customer-relevant evidence, reproducibility, independent review, a measured customer outcome, and explicit owner approval are present. No automated outreach is enabled.
