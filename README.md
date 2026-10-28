# Aethel Node

Aethel Node turns a declared goal into a bounded run, checks the result against evidence, and keeps only the experience that qualifies for reuse. The claim to test is narrow: that a verified, reusable workflow can reduce repeated work and next-action error. Retention, savings and willingness to pay still have to be shown with external users and measured outcomes. "Conscious" is a product metaphor for persistent state, feedback and continuity across runs, not a claim about machine consciousness.

Live: https://shiyan-dap.vercel.app

Scope: Aethel Node, diagnostics and the related pipelines (Level 4 plant, safety, MCP, micro-ledger, proof-to-pilot journey). Nothing here is a clinical or diagnostic product, and the system handles no PHI.

## Contents

1. [Status](#status)
2. [Surfaces and the Domains dropdown](#surfaces-and-the-domains-dropdown)
3. [Core loop: Workspace A, Workbench B, Z, ROE](#core-loop-workspace-a-workbench-b-z-roe)
4. [Autonomy levels and Level 4](#autonomy-levels-and-level-4)
5. [Diagnostics and Global · misdiagnosis](#diagnostics-and-global--misdiagnosis)
6. [MCP](#mcp)
7. [Plugins and micro-ledger](#plugins-and-micro-ledger)
8. [Proof-to-pilot journey](#proof-to-pilot-journey)
9. [Two kinds of Φ](#two-kinds-of-φ)
10. [External confirmation](#external-confirmation)
11. [Evidence and data support](#evidence-and-data-support)
12. [Live vs directional](#live-vs-directional)
13. [Architecture notes](#architecture-notes)
14. [Next](#next)

## Status

**Phase 1 complete; Phase 2 (MCP + boundary) current; Phase 3 asset map and audit summary live.** The same line is `phaseLine` in `GET /api/v1/status`. No new architectural phases are planned; work is focused on the proof-to-pilot journey on the existing engine.

- Level 4 plant, durable experience store, replay verification and the Workbench MCP contract (`aethel.loop.v1`) are live and are not modified by the other surfaces below.
- Phase 3 surfaces (asset map, audit summary) are read-only and off-chain.
- Loose end: the 8 original test events are still in the ledger. Only the project owner can purge them, with `LEDGER_ADMIN_SECRET`. `GET /api/v1/status` lists their asset ids under `purgeReadiness` (`assetIds`, `assetIdsCsv`). The purge call is `DELETE /api/v1/ledger/commit?assetId=<ids>&purge=1` with the `x-admin-secret` header.
- `GET /api/v1/status` also reports `signingSecretConfigured` and `adminSecretConfigured` (both true on Vercel, confirmed by the project owner). The assistant that maintains this repo does not hold the admin secret and has not run a purge.

## Surfaces and the Domains dropdown

Pages that use the shared header show a **Domains** dropdown listing every in-scope surface. Selecting an item navigates to it. The current page is preselected (longest matching path, so `/workbench/diagnostic/reference` shows Diagnostics); on a page with no entry the dropdown shows "Select domain".

| Group | Entry | Path |
| --- | --- | --- |
| Domains | Diagnostics | `/workbench/diagnostic` |
| Domains | Safety | `/workbench/safety` |
| Domains | Global · misdiagnosis | `/workbench/global` |
| Level 3 / 4 | Level 4 run | `/workbench/autonomous` |
| Level 3 / 4 | Level 4 status | `/workbench/status` |
| Level 3 / 4 | ROE · Reciprocal Optimization Engine | `/workbench/autonomous?roe_drive=1` |
| Level 3 / 4 | Level 3 Self() | `/workbench/self` |
| Evidence | Proof | `/workbench/proof` |
| Evidence | Shiyan + Model 3 proof | `/workbench/shiyan` |
| Evidence | Result | `/workbench/result` |
| Evidence | History | `/workbench/history` |
| Evidence | Review | `/workbench/review` |
| Workbench | Workspace | `/workbench/workspace` |
| Workbench | Peer | `/workbench/peer` |
| Workbench | Compare | `/workbench/compare` |
| Workbench | MCP | `/workbench/mcp` |
| Workbench | Actor network | `/workbench/network` |
| Commercial | Client pipeline | `/workbench/client` |
| Commercial | Offer | `/workbench/offer` |
| Commercial | Pilot | `/workbench/pilot` |

The homepage itself carries only the title, description, "Start a durable run" and the Create run button; everything else is reached through the dropdown.

Other live pages:

| Path | Role |
| --- | --- |
| `/` | Commercial center |
| `/workbench#guided-run` | Guided first run |
| `/workbench/outcome` | Client declares a measurable goal |
| `/workbench/autonomous/proof` | End-to-end recovery and gate proof |
| `/workbench/marketplace` | Verified sequences (listing only; no trading or settlement) |
| `/workbench/diagnostic/reference` | Evidence-gate reference fixture |
| `/workbench/independent`, `/workbench/independence` | MCP independent-plant comparisons |

Φ is reported only when final e falls. The same sealed sequence runs across the Safety, Shiyan and Client plants. Not a diagnosis, no PHI, and not revenue until a client settles.

## Core loop: Workspace A, Workbench B, Z, ROE

1. **Workspace A (goal, reference, planning, oversight).** Defines the intended outcome and reference, coordinates the run, and stays the control and feedback layer. A proposal is not proof, and a model cannot bypass the execution gates.
2. **Workbench B (execution, observation, verification).** Applies permitted actions, observes state, measures error e and Δe, checks safety, budget, idempotency and any supplied tensor constraint, and records the run. Its MCP contract is `aethel.loop.v1`. The `aethel-anchor/1` payload and independent replay verification are implemented.
3. **Z (evidence-qualified verified experience).** The outcome eligible to inform future runs: provenance, measured result, verification status and reuse eligibility. The live experience store is Upstash-backed and idempotent per run and iteration, and the public experience API exposes the record.
4. **ROE (Reciprocal Optimization Engine).** Evaluates improvement against the reference and governs how that evidence informs selection and reuse. Implemented: normalized RMS checking, gated improvement I_t, adaptive ε for the normalized/RMS mode, a reuse-eligibility overlay, a step-aware next-action objective, and the opt-in `?roe_drive=1` selector. Some ROE views are inspect-only, and the existing planner remains the default. Learned cost/risk models and a richer state model are directional.
5. **Retention and revalidation.** Reuse requires eligible experience and the ROE eligibility overlay. `/workbench/autonomous` replays a durable sequence client-side and falls back to the built-in sequence when stored experience is missing, invalid or does not meet the goal. Retained experience should be revalidated when its reference, environment, constraints or state change. The system demonstrates persistence and constrained reuse on its reference plants, not validity across domains.

**Tensor scope.** A tensor T ∈ ℝ^(d₁×…×dₙ) (an embedding, activation state, logit distribution or sensor vector) is stored row-major with its shape and can be verified alongside the text and state logs. Tensor commitment and independent distance checks are live. The Level 4 demo uses a deterministic proposer and a deterministic demo sensor tensor, not tensors from a hosted model.

## Autonomy levels and Level 4

- Level 1: execute and measure.
- Level 2: reuse verified experience.
- Level 3: learn across Runs. `Self()` retrieves only approved, safety-passed, positive-Φ experience; causal comparison separates improved, tied and regressed. Implemented and in use.
- Level 4: operate autonomously within constraints. This is the current plant and it is live.

Level 4 is a bounded control loop. It plans, checks a safety gate before every action, executes only permitted actions, records every transition, recovers from interruption, and records eligible experience for reuse. It builds on Level 3 and wraps the existing closed loop, `Self()`, measurement of e and safety modules without modifying them.

Each step is measured on the core plant: applied actions are replayed through the same engine that scores every Run, so e is computed, not reported. The recorded verified run (`demo-run`, readable at `/api/level4/experience`) takes four gated steps, e 1.561 → 0.151 (Δe 1.410), reaches COMPLETE, and beats a cold `Self()` baseline of 0.165 (Φ 0.014). Only the final step is marked eligible.

What is built:

- Durable state and checkpoint recovery (client and server); the server record is in Upstash Redis (`/api/level4/run`) and survives cold starts and redeploys.
- Idempotent handling of retried actions, and a pre-action safety and budget gate before every permitted action.
- Verified results in run history and the durable experience store (`/api/level4/experience`), idempotent per run and iteration.
- An end-to-end recovery proof that also exercises the gate.
- Acquisition counters (`/api/level4/acquisition`) incremented atomically.
- Guided first run at `/workbench#guided-run` (`/workbench/start` redirects there).
- External client path: declare a goal (`/workbench/outcome`), run, view the verified result (`/workbench/result`, server-rendered from the durable store).
- Status (`/workbench/status`) reads the durable store directly.

Modules are under `src/lib/level4/`: controller, goal, loop, safety-gate, checkpoint, idempotency, precheck, verified, measured, server-record, acquisition, plus `systemic.ts` (the domain-agnostic view used for Global · misdiagnosis).

## Diagnostics and Global · misdiagnosis

- **Diagnostics** (`/workbench/diagnostic`, reference fixture at `/workbench/diagnostic/reference`) and **Safety** (`/workbench/safety`) are the evidence-gate surfaces.
- **Global · misdiagnosis** (`/workbench/global`) is the single consolidated view of misdiagnosis as a global systemic error. "Misdiagnosis" here means a wrong next action, not a clinical finding. The page is read-only: it reads `/api/level4/experience`, keeps the latest iteration per run, and shows e, Δe and Φ with a derived status and a link to `/api/level4/verify?run_id=…`. Statuses: `ELIGIBLE_EXPERIENCE` (eligible), `MISDIAGNOSIS_REJECTED` (run ended COMPLETE without being eligible), `IN_PROGRESS` (otherwise). Φ is against the recorded baseline for that run, not an independent cold run. It changes no Level 4 code.
- **Diagnostics compliance scan (mock, heuristic).** `POST /api/v1/diagnostics/scan` returns `certificateHash`, a simulated `fingerprint` (a hash of the normalized title, rounded duration and asset type), `overallStatus` (`PASSED`, `FLAGGED` or `REJECTED`) and a `reasons` list explaining every term of the score. Scoring is a deterministic keyword, title, duration and length heuristic: the same inputs always give the same score and certificate. It is not a compliance, legal or clinical check, and the certificate records the heuristic, not a third-party attestation. Optional `audioBase64` (max 2 MB) or `audioHash` (64-hex SHA-256) returns a content hash only (`content_hash_only` or `content_hash_provided`); it cannot match re-encodes or edits, is never stored, and does not change the score. `computeAudioFingerprint()` in `src/services/diagnostics-core.ts` is the hook for a real fingerprinting service, which is not built.

## MCP

- The default `POST /api/mcp` tool list is the six Level 4 tools. `POST /api/mcp?plugins=1` adds plugin tools named `pluginId__toolName` (10 tools in total today).
- Independent MCP plants: `/api/mcp/independent` and `/api/b2` (B1 and B2). `score_sequence` is a stateless dry-run tool: one request replays a sequence on a fresh plant and stores nothing. It is listed in every endpoint's `tools/list` but only B1 implements it; B2 answers it as unsupported.
- `/workbench/mcp` is the MCP surface in the Domains dropdown.

## Plugins and micro-ledger

These live on main, are early-stage, and sit beside the Level 4 plant without changing it.

- **Plugin architecture.** Plugins register through `workbenchRegistry`: `diagnostics-safety` and `agent-compute`. Each exposes tools, an optional `onLedgerEvent` hook and a `renderPanel` component, and appears in the Plugins section of `/workbench/workspace`. Tools are callable over HTTP (`POST /api/v1/plugins/tools/execute`) and over MCP. Writing tools and demo buttons in the UI need `?demo=1`.
- **Micro-ledger.** `POST /api/v1/ledger/commit` persists events to Upstash, chains `previousHash` per asset, and records a signature status: HMAC-SHA256 by default, or an EIP-191 `personal_sign` wallet check that yields `wallet_verified` or `wallet_unverified` and never rejects. Asset domains for new commits are `STEM`, `DIAGNOSTIC_AUDIT`, `AGENT_COMPUTE` and `ECONOMIC_BENEFIT`. Each commit carries a settlement intent per recipient: `INTERNAL_MICRO` settles internally; `STRIPE` and `X_MONEY` are queued unless configured. With Stripe configured, a verified commit with an explicit amount creates a PaymentIntent, and test-mode Connect `acct_` recipients get Transfers (live keys skip transfers unless explicitly enabled). Writes are rate-limited per IP. Admin soft-hide and hard-purge sit behind `LEDGER_ADMIN_SECRET`. Older stored events remain readable. API details: [docs/ledger-api.md](docs/ledger-api.md).
- **Asset map and audit summary (Phase 3, read-only).** `GET /api/v1/ledger/assets` returns one row per `assetId` (newest first) with its latest `domain`, `createdDomain`, the ordered `domains` it passed through, a `timeline`, `latestAuditStatus`, `signatureStatus` and `settlementRail`. `GET /api/v1/audit/summary` returns counts by domain, signature status and settlement rail, an `audit` block from the heuristic mock scan, and the Merkle root over the latest 100 events with `anchored: false`. Both read the latest 500 events, exclude hidden assets and report `windowTruncated` when older events were not counted. They are shown on `/workbench/workspace` (an Assets block with client-side filters, and a collapsible Audit summary block, each with a Download JSON link) and linked from `/workbench/offer`, `/workbench/review` and `/workbench/pilot`.
- **Wallet identity (partial).** For `signatureType: "wallet"`, an optional `siweMessage` (EIP-4361 shape) is parsed and checked for domain, `issuedAt` freshness (10 minutes, not in the future), nonce and chain policy. `GET /api/v1/siwe/nonce` issues single-use server nonces. The stored status is `wallet_siwe_verified` or `wallet_siwe_partial` (with reasons), and `siwe.overallValid` summarises every check. Nothing rejects a commit and no wallet status unlocks Stripe. EIP-1271 contract-wallet checks are implemented with an https `ETH_RPC_URL` but have only been run against a mock RPC, and `ETH_RPC_URL` is not set on Vercel. Full SIWE verification is not done. Server nonces need Upstash to work across serverless instances.
- **Anchor preparation and dry run (not on-chain).** `GET /api/v1/ledger/anchor` returns a Merkle root (`sha256-merkle-v1`) with an event count, `anchored: false` and an optional inclusion proof. `POST /api/v1/ledger/anchor` with `{"dryRun": true}` records a logged dry run and returns a simulated tx hash and block number (status `dry-run`); with an optional `network` it also returns a simulated receipt. Nothing is submitted on-chain and the simulated values do not exist on any chain.
- **Estimated compute records.** `agent-compute.record_compute_usage` records `AGENT_COMPUTE` events and can attach a self-reported FLOP and cost estimate (`usageEstimate`, always marked estimated). Nothing is metered, billed or paid out.

**Demo of the asset map and audit summary** (read-only; the audit is a heuristic mock scan and the Merkle root is not anchored):

1. Open [/workbench/workspace](https://shiyan-dap.vercel.app/workbench/workspace) and find the Assets block in the Plugins section.
2. Expand the Audit summary block for counts and the current Merkle root.
3. Use the Download JSON links, or open `/api/v1/ledger/assets` and `/api/v1/audit/summary` directly (also listed as `demoHints` in `GET /api/v1/status`).
4. Optional: with `?demo=1`, the dry-run button in the Audit summary block writes a simulated, unanchored record. Skip it if you do not want one.

## Proof-to-pilot journey

One customer path over the existing surfaces. Nothing here is a new architecture: the Level 4 run, the safety gates, the experience store, the verify and anchor endpoints and the micro-ledger stay the authority.

1. **Declare the problem.** The customer states a measurable outcome, baseline, constraints and success threshold on [/workbench/outcome](https://shiyan-dap.vercel.app/workbench/outcome) or [/workbench/client](https://shiyan-dap.vercel.app/workbench/client).
2. **Bounded execution.** The Level 4 run executes under its safety and budget gates and records every transition ([/workbench/autonomous](https://shiyan-dap.vercel.app/workbench/autonomous), [/workbench/safety](https://shiyan-dap.vercel.app/workbench/safety), [/workbench/history](https://shiyan-dap.vercel.app/workbench/history)).
3. **Verified evidence.** [/workbench/result](https://shiyan-dap.vercel.app/workbench/result) shows e, Δe and Φ, the verify and anchor (dry run) links, and the ledger and audit summary links. "Export evidence pack" downloads one JSON file with those values, the recorded baseline fields, every link and a list of disclosures (failed or missing values, dry-run anchor, heuristic audit scan).
4. **Customer validates the value.** The customer reviews the result and decides on a paid pilot on [/workbench/pilot](https://shiyan-dap.vercel.app/workbench/pilot), [/workbench/review](https://shiyan-dap.vercel.app/workbench/review) and [/workbench/offer](https://shiyan-dap.vercel.app/workbench/offer).

**Pilot terms.** Pricing is set per pilot against the measured Φ, with no charge on ties or regressions. There is no fixed price and no self-serve checkout. `/workbench/pilot` shows "Ready for paid pilot?" only for an eligible run with an exportable pack and Φ > 0; it approves and charges nothing.

**Self-reported economic benefit (optional).** The customer can record an amount and unit or a short note, with a timestamp, on `/workbench/pilot` or `/workbench/result`. It is stored only in the customer's browser (localStorage, per run id) and is not verified. The opt-in "Record benefit on ledger" button calls `POST /api/v1/ledger/benefit`, which appends one unsigned `ECONOMIC_BENEFIT` event on asset `benefit_<runId>` (status `unverified`, marked self-reported). The ledger shows that the entry was recorded, not that it is true. It is permanent and append-only (only an admin can purge it), and the generic commit endpoint rejects this domain. If present, it is added to the evidence pack as `self_reported_economic_benefit` with the tx hash when recorded.

**Journey indicator.** `/workbench/result` and `/workbench/pilot` show a four-step indicator for the run (on the pilot page, this browser session's run, else the latest eligible run): step 1 no run, step 2 goal threshold not met, step 3 eligible run, step 4 a self-reported benefit saved in this browser. Step 4 does not mean a pilot was approved. The same steps are returned as `journeySteps` in `GET /api/v1/status` and shown as a one-line note on the review, offer, pilot and client pages.

**Agent roles.** Agent A (customer acquisition) and Agent B (product evidence) are defined in [docs/agent-roles.md](docs/agent-roles.md) with their human-approval gates. They are role definitions only; no autonomous agent for either is built, and outreach is always sent by a person.

## Two kinds of Φ

- **Cold-run comparison (`/workbench/proof`).** Compares the reuse final e with a real cold `Self()` run on the Safety plants. An *error win* means the reuse final e is strictly below the cold final e.
- **Improvement against a baseline (`/workbench/peer`, `/workbench/compare`, `/workbench/independent`, `/workbench/independence`).** Runs the sealed sequence on the MCP plants B1 and B2 and compares it with the plant's starting error (`observe` or `mark_boundary`, neither of which changes e; each run uses a fresh case). This is an improvement against a baseline, not a cold-run win, and the numbers are not comparable with the proof page. B2 is a fixed fixture with no `Self()` run.

**Optional true cold run on B1.** On `/workbench/peer` and `/workbench/compare` (and on the independent pages) the checkbox "Measure a true cold Self() run on B1 first" drives B1 over MCP. At each of up to four steps the controller asks B1 to score every candidate action (`complete_field`, `request_independent_check`, `mark_boundary`, `seal_pack`) appended to the actions chosen so far, keeps the lowest final e, and stops when none lowers e strictly. It uses `score_sequence`, so results are the same on every serverless instance (B1's plant lives in each instance's memory, which made an earlier cross-request version inconsistent on Vercel). It reads no prior Runs. It is a greedy one-step-lookahead controller over MCP, not the Safety-proof `Self()`, and it takes about 17 MCP calls. Φ is the cold final e minus the sealed-sequence final e, and it is an error win only when strictly positive (`src/lib/mcp/cold.ts`).

- **B1 default start: not a win.** The cold run reaches e 0.184 (`request_independent_check`, then `complete_field` three times) against 0.235 for the sealed sequence, so Φ is −0.051. This is structural. Over every sequence of up to four MCP tools on B1's fixed starting plant, any sequence ending in `seal_pack` finishes at 0.235, because `seal_pack` sets completeness to 0.849 and no MCP tool lowers contradiction (0.18). The best order overall reaches 0.18 only by editing the pack after sealing it. Changing this would mean changing `seal_pack` in `closed-loop.ts` or the fixed `SEALED_SEQUENCE`, which Level 4 and the proof share, so it was not changed.
- **MCP commercial case: a win over the greedy cold run.** A second opt-in checkbox selects a constructed B1 starting plant (completeness 0.80, contradiction 0.08, missing 0.40) for case ids that start with `commercial`. Every other case id, the Safety-proof plants and Level 4 are unchanged. The sealed sequence ends at 0.171 and the greedy cold controller stops at 0.33, so Φ is +0.159. The reason: `seal_pack` takes completeness from 0.98 to 0.849, just under the 0.85 review gate, and zeroes missing, while the greedy controller cannot reach the seal because `mark_boundary` alone does not change e. An exhaustive search of all four-step orders also reaches 0.171, so the sealed sequence ties the best possible four-step result and does not beat an exhaustive search. The case is constructed, not customer data. The evidence pack's `mcp_cold_comparison` records which starting plant was used.

## External confirmation

What an outside party can check today without the team narrating it:

- **Safety-proof error wins.** `/workbench/proof` recomputes three cold-versus-reuse pairs in the browser from code in this repo: Φ 0.014 (incomplete evidence pack), 0.065 (missing measurements), 0.065 (provenance gap).
- **Recorded run verification.** `GET /api/level4/verify?run_id=…` replays a recorded Level 4 run and recomputes its stored e, e0, cold e, Φ and eligibility. It covers recorded runs, not the three proof plants.
- **MCP commercial case.** On the peer, compare, independent and independence pages, tick the cold-run checkbox and then the commercial-case checkbox: 0.171 against a greedy cold run at 0.33, Φ +0.159. The plant is constructed by us, and an exhaustive search also reaches 0.171. On B1's default start the same comparison gives Φ −0.051, not a win.
- **Evidence pack and pilot checklist.** `/workbench/result` exports the evidence pack with its disclosures and the `mcp_cold_comparison` block when a cold run was made in that browser.

Not yet externally confirmed:

- No paid pilot has happened, and no customer has validated the value. Nothing is settled or revenue.
- No third-party attestation. The audit summary is a heuristic mock scan, and no outside party has reviewed or replicated these results.
- Any economic benefit is self-reported, stored in the customer's browser, and not verified.
- The anchor is a dry run: the Merkle root is prepared and nothing is submitted on-chain. The micro-ledger holds test events, not customer settlements.
- The proof plants and the commercial case are our own constructed cases, and the Level 4 runs were made by us.

The same text is on `/workbench/offer` and `/workbench/pilot`. How evidence moves from Agent B to a human reviewer before anything is shared: [docs/agent-roles.md](docs/agent-roles.md#external-confirmation-workflow).

## Evidence and data support

What an acquirer can check today without trusting this repo. Live unless marked directional.

- **Independent verify (live).** `GET /api/level4/verify?run_id=` replays a stored run on a fresh plant and returns PASS, FAIL or SKIP per check. The demo run `run_mvculg3c_wn6w0q` returns PASS 26/26, and anyone can re-run it.
- **Anchor root (live; on-chain anchoring directional).** `GET /api/level4/anchor?run_id=` returns the `aethel-anchor/1` payload and a SHA-256 Merkle ledger root with `anchored: false`. Only a dry-run adapter exists.
- **Public record (live).** `GET /api/level4/experience` is the durable public record. `?format=ledger` returns ledger lines and `?run_id=` filters to one run.
- **founder-z outcome log (live).** Outcome and event records are published to the public Hugging Face dataset [shiyan-dap/founder-z](https://huggingface.co/datasets/shiyan-dap/founder-z); card: [docs/founder-z-dataset-card.md](docs/founder-z-dataset-card.md). The Hub's Dataset Viewer shows a `CastError` because the files have mixed schemas; the data is intact and loads file by file. `/api/memory` reads its `latest-z.json` head (overridable with `HF_DATASET`) and commits new records when a Hugging Face token is configured.
- **Durable feed (live).** `/workbench/autonomous` uses the `Self()` durable feed by default (`?durable=0` opts out), vetted by client-side replay, with the built-in sequence as fallback.
- **Write gate (live, opt-in).** With `LEVEL4_WRITE_TOKEN` set, POST on `/api/memory` and the other Level 4 writes needs `Authorization: Bearer <token>` or an allowed origin; unset, writes are unchanged. GETs stay public. See [docs/level4-write-auth.md](docs/level4-write-auth.md).

**Copy and share controls (live).** Copy all metrics, Φ, e, run id, ledger line, anchor root, full evidence pack (Markdown or JSON), public URL only, verify URL only, and verify summary are available on the result, status and proof pages as relevant; Share pack uses the native share sheet, else a mailto with no recipient. Copy actions show a lasting "Copied ✓" state and a toolbar that clears on Esc.

## Live vs directional

**Live today:** the Level 4 reference plant; durable run and experience records; measured e, Δe, cold `Self()` baseline, Φ and ROE I_t; pre-action safety and budget checks and idempotency; tensor commitment and independent distance checks; the Workbench MCP contract and independent MCP plants; replay verification; an anchor payload and Merkle-root calculation; ROE inspection endpoints and the opt-in selector; client-side validation of durable sequences; the plugin registry and micro-ledger; the read-only asset map and audit summary; Global · misdiagnosis; the proof-to-pilot pages.

**Directional, not live:**

- **Multi-domain workbenches.** The loop is designed to be domain-independent and the plugin architecture has two plugins, but validated demonstrations are reference plants and the diagnostics scan is a mock. Healthcare diagnostics is a later, higher-risk direction.
- **On-chain anchoring.** Anchor payloads, Merkle roots, inclusion proofs, a dry run with simulated receipts and the `AnchorAdapter` interface exist. There is no chain connection and nothing is verified against a chain.
- **Real money movement in live mode.** Stripe PaymentIntent and test-mode Connect Transfer recording exist and are guarded; live-mode transfers are off by default and have not been exercised with a real live account. X Money settlement is queued only; there is no integration.
- **Stronger wallet identity.** Full SIWE verification and tested EIP-1271 (see Plugins and micro-ledger).
- **Settlement of verified tensor transformations (T_in → T_out).** Ledger settlement intents apply to plugin assets, not tensor transformations.
- **FLOP-based micro-payments.** Compute records exist with self-reported estimates; nothing is metered, billed or paid out.
- **Real diagnostics and compliance checks** to replace the heuristic scan.
- **Hosted-model tensors** in the live demo.
- **Learned cost/risk models** and a generalized state-aware ROE objective.
- **Authentication on Level 4 writes** beyond the opt-in write gate, and wallet-signature authentication of runtime operations.
- **Server-side `Self()` across runs.** Verified experience persists and `/workbench/autonomous` reuses it through `loadDurablePlan` (client, via `GET /api/level4/experience`). No server route consumes it yet; `loadDurablePlanServer` (`durable-self-server.ts`) exists but is not called.
- **Tokenization and trading.** The repo does not mint tokens or NFTs. Run ids are unique and experience writes are idempotent, but Redis records can be overwritten and duplicate protection expires after 30 days, so entries are not tamper-proof until moved to a tamper-evident rail. `/workbench/marketplace` lists verified sequences only; trading and settlement are not live. The marketplace stays downstream of the proof system: lower aggregate error does not override a failed safety constraint or a required human review.

## Architecture notes

- **Models only propose.** One adapter (`src/lib/model-adapter.ts`) puts Grok (xAI API), Hy4, OpenAI and a deterministic mock behind one interface. The routing layer (`src/lib/router.ts`) runs Grok alone on the fast path and Grok and Hy4 in parallel on the deep path, scoring their disagreement. In Level 4 the proposer is an injectable function, so a different model can be swapped in without changing the closed loop, the safety gate, measurement of e or the experience store. Hy4 falls back to a stub unless `HY4_API_URL` is set. The live Level 4 demo uses the deterministic experience proposer, not a hosted model.
- **Planning is separate from tool execution**, and the MCP boundary keeps client data layers outside the orchestration loop. This is a design property, not a security certification.
- **Evidence by inscription.** Client, operator, proposer, safety gate, plant and durable store only count when their contribution is recorded as a measurable step: a proposal becomes an action only by passing the pre-action gate, and each step is written as a run record and, when it verifies, an experience entry. Because the loop is held together by these records rather than by any one model, the proposer can be swapped.
- **Durable, inspectable evidence.** Run records, verified experience and counters persist in Upstash Redis. Redis is a durable store, not an immutable ledger.
- **Additive by construction.** Level 4 wraps the existing closed loop; commercial surfaces read the same evidence the engine writes.

| Component | Current implementation | Planned mapping |
| --- | --- | --- |
| Ledger | Durable Upstash Redis records (`/api/level4/run`, `/api/level4/experience`); overwritable | On-chain state persistence |
| Asset | Verified experience entries with calculated Δe and Φ | Tokenized data assets |
| Constraints | Pre-action safety and budget gates | Programmable execution constraints |
| Commercial | Paid-pilot gate (`/workbench/pilot`); settlement not live | Escrow and settlement triggers |

## Next

- An external client with a predeclared measurable outcome that settles.
- Measured acquisition traffic against the durable counters.
- Volume on the existing durable store, then external settlement.
- Server-side `Self()` across runs and restarts (see Live vs directional).
