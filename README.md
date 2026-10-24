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

## Global value: ending the misdiagnosis of the next action

In Aethel Node, **misdiagnosis** is an engine term rather than a clinical one. It means a systemic error that happens in every domain: picking a next action that changes the state of a system without moving it closer to its reference. That action can look like progress while variance stays the same or a structural defect stays hidden. Left unchecked, these errors compound across teams, tools, and models.

**Global value.** The engine ends the misdiagnosis of the next action. It measures error (e) against a reference before and after each step, enforces safety and budget constraints before anything is applied, and records durable proof of what worked: Δe, and Φ against a cold `Self()` baseline.

**Pain point solved.** An unverified proposal does not become accepted experience. Every action passes the pre-action safety and budget gate and an idempotency check before it is applied. Each step is then scored by measuring e on the core plant. Only a step that reaches the goal is marked eligible and kept as experience. Proposals that change state but fail to reduce error stay on the record as ineligible and are never kept as experience, and a lower error never overrides a failed safety constraint. What's live today: run records and verified experience stored in Upstash, the pre-action gate, idempotent experience writes, measured Δe, and a public experience API (`/api/level4/experience`).

**Domain-agnostic by design.** The loop, the safety gate, and the experience store make no assumptions about the domain. Anything that can be expressed as observed variance against a reference can use them, whether that's software delivery, logistics, clinical workflows, or creative assets. Today the engine runs on the reference cases in the live plants, with music as the first vertical. Healthcare diagnostics stays a later, higher-risk vertical: this is not a diagnosis tool and handles no PHI.

**Engineering direction (intentional abstraction, not yet shipped as a multi-domain simulation):** generalized plant and reference types, one uniform variance formula for e across domains, a safety gate that doesn't depend on the domain, and a tamper-evident public ledger for verified experience.

## Tensor Scope: Verifying Latent State

**Definition.** The tensor scope brings tensors into verification alongside the text and state logs. A tensor T ∈ ℝ^(d₁×…×dₙ) can be an embedding, an activation state, a logit distribution, or a sensor vector. It is stored row-major with its shape.

- **Commitment.** H(T) = sha256(serialize(T)), written `sha256:<64 hex>`. A ledger stores the hash and the distance, never the raw tensor. `serialize` is the ASCII header `AETHEL-T1;<dtype>;<d₁>x…x<dₙ>;` followed by the values as little-endian IEEE-754 (f64 by default, or f32). The bytes, and therefore the hash, are the same in Node and in the browser.
- **Independent check.** At `request_independent_check`, T_out is compared with a sealed T_ref using the Frobenius norm ‖T_out − T_ref‖_F or the cosine distance 1 − cos(T_out, T_ref). If a sealed H(T_ref) is supplied, T_ref must hash to it.
- **Seal.** If the distance is greater than ε, or T_ref does not match its sealed hash, the step is a **misdiagnosis violation** (`MISDIAGNOSIS_VIOLATION`). The `seal_pack` step then fails and nothing is marked eligible. Otherwise the step is `TENSOR_VERIFIED`, and H(T_out), H(T_ref), and the distance are bound into the seal.
- **Additional gate.** The tensor check is an extra gate alongside Δe and Φ, not a replacement for them. A step is eligible only if the existing logic marks it eligible and, when a tensor was supplied, the tensor check also passes. Without a tensor, behavior is unchanged.

**Implemented now:**

- `src/lib/level4/tensor.ts`: the `Tensor` type, `validateTensor`, `serializeTensor`, `commitTensor` (a synchronous, dependency-free SHA-256), `frobeniusDistance`, `cosineSimilarity`, `cosineDistance`, `independentTensorCheck`, and `combineEligibility`.
- `src/lib/level4/seal.ts`: `parseTensorPayload`, `requestIndependentTensorCheck`, `sealTensorBinding`, and `experienceTensorFields`.
- `src/lib/mcp/handler.ts` (Workbench B MCP server, `/api/mcp`): `request_independent_check`, `seal_pack`, and `run_sealed_sequence` accept an optional `tensor` argument (`{ out, ref, epsilon, metric?, refCommitment? }`). On a violation, `seal_pack` is not applied and the result reports `sealed: false`. Calls without a tensor return exactly what they did before.
- `/api/level4/tensor-check`: a stateless POST endpoint that runs the independent check and returns the seal fields. It stores nothing.
- `/api/level4/experience`: optional `tensor_commitment` and `tensor_distance` fields on POST. The default GET is unchanged. In `?format=ledger`, entries that carry tensor fields gain `TENSOR=<sha256:…> T_DIST=<x>`.
- `src/lib/level4/demo-tensor.ts` (`/workbench/autonomous`): a deterministic demo tensor, the plant's 4-component sensor vector, checked against measureE's sealed reference at `request_independent_check` and `seal_pack` (Frobenius, ε = 0.16). It is an observation only and does not change e or the proposer. In the demo, iteration 3 is a real `MISDIAGNOSIS_VIOLATION` (distance 0.594, not yet eligible anyway) and iteration 4 is `TENSOR_VERIFIED` (distance 0.151). Both entries carry `tensor_commitment` and `tensor_distance`. See [docs/level4-tensor-demo.md](docs/level4-tensor-demo.md), including an `/api/mcp` `run_sealed_sequence` example.
- **Holographic bound (opt-in).** `calculateDynamicThreshold` and `verifyHolographicBound` in `tensor.ts` scale ε with tensor size: ε_dyn = ε_base · √(N / N_base), with ε_base = 0.16 at N_base = 4 elements (so a 4-element tensor keeps exactly 0.16; 16 elements gives 0.32). Available on `/api/level4/tensor-check` with `mode: "holographic"` (or `?mode=holographic`, optional `baseEpsilon`), which adds `holographic: { verified, distance, maxAllowable }`. It is not the default for the live demo, which keeps fixed ε = 0.16. Check: `npx tsx scripts/check-holographic.ts`.
  - *Rationale (analogy, not a derivation).* The name borrows from the Bekenstein / holographic bound, where the maximum information in a region scales with its boundary surface area rather than its volume. The analogy here is narrower: the Frobenius distance of a tensor with N entries that are each off by the same amount grows as √N, so a fixed ε gets stricter per element as tensors grow. Scaling the allowed distance by √(N / N_base) keeps the per-element tolerance (information density) constant across sizes.
  - *Why √(N/4).* The base is ε = 0.16 at N_base = 4 (a 2×2 tensor), so √(4/4) = 1 and the demo tensor keeps exactly 0.16.
  - *Inspectable.* Holographic-mode responses (tensor-check and MCP) also carry `holographic_ledger: "H_MAX=<maxAllowable> H_DIST=<d> H_VERIFIED=<bool>"`. Stored experience entries and existing ledger lines are unchanged.
  - *Status.* This is an engineering heuristic, not a physical derivation. It is opt-in on `/api/level4/tensor-check` and the MCP tools (`holographic: true`); the live demo default stays fixed ε = 0.16.
  - *Default (update).* For new calls, the holographic bound is now the default verdict on `/api/level4/tensor-check` (mode omitted) and on MCP `request_independent_check` / `seal_pack` (with a Frobenius tensor). `check` gains `bound`, `max_allowable` and `fixed_epsilon`. For the old fixed-ε path, pass `mode: "fixed"` (body or `?mode=fixed`) or `holographic: false` on MCP. The live demo, verify replay and stored results stay pinned to fixed ε = 0.16 (they call `independentTensorCheck` directly). `GET /api/level4/verify` adds an informational `holographic` array per tensor iteration; verdict and checks are unchanged. A 4-element tensor gets the same verdict either way.

**Proprietary scope — Workspace A → Workbench B → Z, governed by ROE.** The proprietary opportunity is the integrated, testable loop that turns a declared goal into a bounded run, checks the result against evidence, and retains only experience that qualifies for reuse. Its value is not a claim of machine consciousness: “conscious” is a product metaphor for persistent state, feedback, and continuity across runs. The commercial thesis is that this continuity can reduce repeated work and next-action error; retention, savings, and willingness to pay must be demonstrated with external users and measured outcomes.

1. *Workspace A — Goal, reference, planning, and oversight.* Workspace A defines the intended outcome and reference, coordinates the run, and remains the control and feedback layer. It does not treat a proposal as proof or let a model bypass the execution gates.
2. *Workbench B — Execution, observation, and verification.* Workbench B is the execution environment. It applies permitted actions, observes state, measures error e and Δe, checks safety, budget, idempotency and any supplied tensor constraint, and records the run. The Workbench B MCP contract is `aethel.loop.v1`; the `aethel-anchor/1` payload and independent replay verification are implemented.
3. *Z — Evidence-qualified verified experience.* Z is the outcome eligible to inform future runs: provenance, measured result, verification status, and reuse eligibility. It is not simply a successful-looking action. The live experience store is Upstash-backed and idempotent per run and iteration; the public experience API exposes the recorded evidence. `GET /api/level4/verify` replays the demo run on a fresh plant and currently reports 26/26 checks. `GET /api/level4/anchor` prepares a Merkle root with `anchored:false`; on-chain submission is not live.
4. *ROE — Reciprocal Optimization Engine.* ROE evaluates improvement against the reference and governs how improvement evidence informs selection and reuse. Implemented slices include normalized RMS checking, gated improvement I_t, adaptive ε for the normalized/RMS mode, a reuse-eligibility overlay, a step-aware next-action objective, and the opt-in `?roe_drive=1` selector. Some ROE views are informational or inspect-only; the opt-in selector changes action choice, while the existing planner remains the default. Learned cost/risk models and a richer state model are directional.
5. *Retention and revalidation.* The durable experience feed supports continuity across runs, but retention must be earned by evidence. Reuse requires eligible experience and the ROE eligibility overlay; the autonomous page replays a durable sequence client-side and falls back to the built-in sequence when stored experience is missing, invalid, or does not meet the goal. Retained experience should be revalidated when its reference, environment, constraints, or relevant state changes. The current system demonstrates persistence and constrained reuse on its reference plants, not universal validity across domains.

**What is live today:** the Level 4 reference plant; durable run and experience records; measured e, Δe, cold `Self()` baseline, Φ and ROE I_t; pre-action safety/budget checks and idempotency; tensor commitment and independent distance checks; the Workbench MCP contract; replay verification; an anchor payload and Merkle-root calculation; the ROE inspection endpoints and opt-in selector; and client-side validation of durable sequences before reuse.

**Directional, not live:**

- Generalized, validated multi-domain workbenches. The loop is designed to be domain-independent, but current demonstrations are reference plants; music is the first vertical. Healthcare diagnostics is a later, higher-risk direction, not a diagnostic product, and this system handles no PHI.
- On-chain submission of anchor roots. The anchor payload, Merkle root, and `AnchorAdapter` interface exist; only a dry-run `NullAnchorAdapter` ships and nothing is submitted on-chain.
- Settlement or monetization of verified tensor transformations (T_in → T_out).
- FLOP-based micro-payments.
- Hosted-model tensors in the live demo. The Level 4 demo uses a deterministic proposer and deterministic demo sensor tensor, not embeddings, activations, or logits from a hosted model.
- Learned cost/risk models and a generalized state-aware ROE objective.

**Commercial framing.** The product proposition is evidence-backed autonomous execution with durable, qualified experience: define an outcome, run within constraints, inspect the result, and reuse only what passes the relevant checks. The potential advantage is the accumulated implementation, integration, evidence, and validated workflow—not a single formula or an unsupported “consciousness” claim. Customer retention is an outcome to prove through repeat usage, verified improvement, lower repeated-work cost, and paid pilots; it is not established merely by having a retention layer.
## Level 4: durable feed, write gate, dataset card

- **Self() durable feed.** `src/lib/level4/durable-self.ts` (client) and `durable-self-server.ts` (server, direct Upstash) read the experience store, keep entries that are `eligible`, `COMPLETE`, Φ > 0 (and within the demo tensor ε when a distance is stored), map them to the `ApprovedExperience` shape, and pick the highest Φ with the same rule as `SelfFromApproved`. The winning run's ordered action sequence is reused. Entries do not record a `safety_passed` flag; reaching `COMPLETE` implies every step passed the precheck and safety gate. On by default on `/workbench/autonomous` (`?durable=0` disables; `?durable=1` still accepted). Before use, the durable sequence is replayed client-side and used only if its final e is ≤ the built-in sequence's and meets the goal (e < 0.16); the page shows the source (durable run id or built-in). With no usable experience or on any error, the built-in approved sequence is used.
- **Level 4 write gate.** Optional `LEVEL4_WRITE_TOKEN` (bearer), `LEVEL4_ALLOW_SAME_ORIGIN`, and `LEVEL4_ALLOWED_ORIGINS` gate POST/DELETE on `/api/level4/run`, `/experience`, and `/acquisition`, and POST on `/api/memory` and `/api/mint` (both commit to the founder-z Hugging Face dataset). Unset means unchanged behavior. GETs stay public. See [docs/level4-write-auth.md](docs/level4-write-auth.md).
- **founder-z dataset card.** [docs/founder-z-dataset-card.md](docs/founder-z-dataset-card.md), Its YAML validates with `huggingface_hub`'s `DatasetCard`. Partly published: the dataset's Hugging Face [README.md](https://huggingface.co/datasets/shiyan-dap/founder-z/blob/main/README.md) carries the card's YAML metadata (including the `outcomes` / `events` / `mints` configs), but the card's prose body is not yet uploaded.
- **Request a pilot.** `/workbench/pilot`, `/offer`, and `/workbench/offer` carry a "Request a pilot" call to action that leads to the existing client pipeline (`/workbench/client`) and pilot terms. No new prices.
- **Anchoring path (directional).** `src/lib/level4/anchor.ts` builds a canonical `aethel-anchor/1` payload of a run's tensor commitments and a SHA-256 Merkle root (leaf = H(0x00‖canonical JSON), node = H(0x01‖left‖right), odd node promoted), plus an `AnchorAdapter` interface with only a dry-run `NullAnchorAdapter`. `GET /api/level4/anchor?run_id=` returns the payload and root with `anchored: false`. Nothing is submitted on-chain.
- **Independent run verification.** `GET /api/level4/verify?run_id=` replays a stored run's actions on a fresh plant and recomputes e, e0, cold e, Φ, eligibility, the demo tensor commitments and distances, and the anchor Merkle root, returning PASS/FAIL/SKIP per check, so the ledger can be checked without trusting it.
- **Verify/anchor links in the UI.** `/workbench/status` and `/workbench/autonomous/proof` show GET links to `/api/level4/verify` and `/api/level4/anchor` for the latest eligible run; `/workbench/result` and `/workbench/status` add "Verify this run" / "Anchor this run". Hidden when no experience is recorded.
- **Evidence export and inline verdict.** `/workbench/result` shows the `GET /api/level4/verify` verdict inline (PASS/FAIL, N/N checks, failing check names on FAIL). Status and result add "Download ledger" / "Export evidence (JSON)" for the latest eligible run via `GET /api/level4/experience?format=ledger&run_id=` — `run_id` is an optional filter; without it the response is unchanged. Pilot/offer pages carry a "What you get" list (live vs directional marked).
- **Proof polish.** `/workbench/autonomous/proof` shows the verify verdict and ledger/evidence links. `/workbench/result?run_id=<id>` selects that run's latest eligible entry (absent → latest overall) and has a "Share this result" copy-link. Status and result show "Anchor root: sha256:…" from `GET /api/level4/anchor` (prepared Merkle root, not on-chain, `anchored:false`) and "Last verified <local time>". The pilot page states the success metric: e < 0.16 with positive Φ vs cold Self(), no charge on ties or regressions.
- **Share polish.** Status shows "Share this result" (public `/workbench/result?run_id=<latest eligible>`). Result and status have a "Copy anchor root" button (full `sha256:` root, "Copied ✓" auto-resets). `/offer` states what success looks like, reusing the pilot success metric.
- **Share polish 2.** Copy actions ("Copy anchor root", "Share this result", "Copy full public link") show a bottom-center toast (aria-live, ~2.5 s) alongside the button text. Result and status add "Copy full public link" (absolute URL). Status has a labeled "Share" section with the public URL for the latest eligible run.
- **Share polish 3.** Copy buttons (anchor root, share, full public link, run id) stay "Copied ✓" until the next copy anywhere on the page (shared last-copied key); failures still show briefly. `/workbench/result` has the labeled Share section (honors `?run_id=`). "Copy run id" sits next to the run id on result and status. `/workbench/pilot` lists "Evidence you can share".
- **Share polish 4.** The most recently copied button gets an emerald ring; a "Clear copied" text button (in the Share controls, shown only while something is Copied) resets the shared state. `/workbench/autonomous/proof` has the Share section for the latest eligible run (hidden without data). The latest-result card has "Copy Φ" and "Copy e" (copies the displayed value). `/offer` lists "Share the proof".
- **Share polish 5.** The latest-result card has "Copy all metrics" (`run=<id> e=… Δe=… Φ=…`, as displayed). Result and status show the latest eligible ledger line with "Copy ledger line" (hidden when unavailable). A sticky "Copied: <label> · Clear" pill on Level 4 pages replaces the inline "Clear copied". `/workbench/pilot` lists "Proof you can send".
- **Share polish 6.** Result and status have "Copy full evidence pack" (run id, e, Δe, Φ, latest eligible ledger line, public proof URL, verify URL). Result and proof have "Copy verify summary" (built from the live `/api/level4/verify` response). The Copied pill clears on Esc and can be collapsed. `/offer` has a one-line "Send the proof" CTA.
- **Share polish 7.** Next to "Copy full evidence pack" on result and status: "Copy as Markdown" (same data as simple Markdown) and "Copy public URL only". The proof page Share section now carries both evidence pack buttons. `/workbench/pilot` has a one-line "Get the proof".
- **Share polish 8.** The evidence pack group (result, status, proof) adds "Copy as JSON", "Copy verify URL only" and "Share pack" (native share sheet, else a mailto with no recipient, carrying the Markdown pack). `/offer` has a one-line "Proof ready" note.

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
| /workbench/shiyan | Shiyan plant | https://shiyan-dap.vercel.app/workbench/shiyan |

Φ only when final e falls. Same sealed sequence across Safety, Shiyan, and Client plants.  
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
- Eligible verified results are stored durably and are publicly inspectable (`/api/level4/experience`). They feed back into Self() across runs via the durable feed on `/workbench/autonomous` (see Self() durable feed).
- New users have a clear starting point and an understandable result without needing to understand the algorithm.
- Acquisition is measured: guided starts and recent runs are recorded and persist.
- The external client path is closed: declare outcome → bounded run → verified result.
- Measured Δe is inspectable: every verified step carries e, e0, Δe, the cold baseline, and Φ in a public record.

## Evidence & data support

What an acquirer can check today, without trusting this repo. Live unless marked directional.

- **Independent verify (live).** `GET /api/level4/verify?run_id=` replays a stored run on a fresh plant and returns PASS/FAIL/SKIP per check. The demo run `run_mvculg3c_wn6w0q` returns PASS 26/26. Anyone can re-run it.
- **Anchor root (live; on-chain anchoring directional).** `GET /api/level4/anchor?run_id=` returns the `aethel-anchor/1` payload and a SHA-256 Merkle ledger root with `anchored: false`: a prepared root, not on-chain. Only a dry-run adapter exists; on-chain submission is planned, not live.
- **Public ledger (live).** `GET /api/level4/experience` is the durable, public record; `?format=ledger` returns ledger lines and `?run_id=` optionally filters to one run.
- **founder-z outcome log (live).** Outcome, event, and mint records are published to the public Hugging Face dataset [shiyan-dap/founder-z](https://huggingface.co/datasets/shiyan-dap/founder-z). The dataset card is [docs/founder-z-dataset-card.md](docs/founder-z-dataset-card.md) (publication status above). The Hub's Dataset Viewer shows a `CastError` because the files have mixed schemas; the data is intact and loads file by file.
- **Durable feed (live).** `/workbench/autonomous` uses the Self() durable feed by default (`?durable=0` opts out), vetted by client-side replay, with the built-in sequence as fallback.
- **Write gate (live, opt-in).** With `LEVEL4_WRITE_TOKEN` set, POST on `/api/memory` (and the other Level 4 writes) needs `Authorization: Bearer <token>` or an allowed origin; unset, writes are unchanged. GETs stay public. See [docs/level4-write-auth.md](docs/level4-write-auth.md).

**Copy / share controls (live).**

| Control | Pages |
| --- | --- |
| Copy all metrics, Copy Φ, Copy e, Copy run id (latest-result card) | result, status |
| Copy ledger line, Copy anchor root | result, status |
| Copy full evidence pack, Copy as Markdown, Copy as JSON, Copy public URL only, Copy verify URL only, Share pack | result, status, proof (`/workbench/autonomous/proof`) |
| Copy verify summary | result, proof |
| Share section | result, status, proof |

All copy actions share a lasting "Copied ✓" state, a high-contrast toast, and a sticky "Copied: <label> · Clear" toolbar that collapses and clears on Esc. Share pack uses the native share sheet, else a mailto with no recipient.

**Commercial lines (live).**

- `/offer`: "What success looks like: the run reaches the goal threshold e < 0.16 with a positive Φ vs cold Self(); no charge on ties or regressions." · "Send the proof" and a "Proof ready" badge (public proof URL, verify endpoint for the demo run, Request a pilot).
- `/workbench/pilot`: the success metric; "Evidence you can share" (public proof URL, downloadable ledger, verify and anchor endpoints); "Proof you can send" (public URL checkable against `/api/level4/verify`); "Get the proof" (open the result, check it against verify, then Request a pilot).

## Continuity

This plant builds on the existing Level 3 implementation and does not replace it. Level 4 adds durability, recovery, and a measurable external path on top of the same controller, safety gate, and history.

Marketplace remains downstream of the proof system. A lower aggregate error does not override a failed safety constraint or a required human review.

The Model 3 sealed sequence remains in the continuity and proof language. The Shiyan plant is live at [/workbench/shiyan](https://shiyan-dap.vercel.app/workbench/shiyan).

## Next

- External client with a predeclared measurable outcome that settles.
- Measured acquisition traffic against the durable counters.
- Server-side Self() across runs and restarts. Live: verified experience persists in the Upstash store and `/workbench/autonomous` reuses it across runs and restarts through `loadDurablePlan` (client, via `GET /api/level4/experience`). Directional: no server route consumes it yet; `loadDurablePlanServer` (`durable-self-server.ts`) exists but is not called.
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


## Model Portability & Open Evidence

* **Model-portable proposer:** Models only propose; they never bypass the loop. One adapter (`src/lib/model-adapter.ts`) puts Grok (xAI API), Hy4, OpenAI, and a deterministic mock behind the same interface. The Grok Bot routing layer (`src/lib/router.ts`) runs Grok alone on the fast path and Grok and Hy4 in parallel on the deep path, scoring how much they disagree. In Level 4, the proposer is an injectable function, so a different model can be swapped in without changing the closed loop, the safety gate, measurement of e, or the experience store. Hy4 falls back to a stub unless `HY4_API_URL` is set. The live Level 4 demo run uses the deterministic experience proposer, not a hosted model.
* **Open evidence dataset (founder-z):** Outcome, event, and mint records are published to the public Hugging Face dataset [shiyan-dap/founder-z](https://huggingface.co/datasets/shiyan-dap/founder-z). `/api/memory` reads its `latest-z.json` head (overridable with `HF_DATASET`) and commits new records when a Hugging Face token is configured. The dataset card is `docs/founder-z-dataset-card.md` (see the founder-z dataset card note for its publication status).

## Decentralized Asset Engine & Independent Settlement

The system’s primary commercial goal is to let external clients declare a measurable outcome that eventually settles based on verified performance. Settlement is the goal, not a live function today.

- **State Inscription for Inspection:** The Level 4 plant records run state and verified experience in a durable Upstash Redis store. Every verified step carries e, Δe, the cold baseline, and Φ, and is publicly inspectable at `/api/level4/experience`. Redis is a durable store, not an immutable ledger: records can be overwritten or deleted. It mirrors a ledger for inspection; on-chain persistence is the planned rail for tamper-evident records.
- **Authentication and Signatures (planned):** The Level 4 write endpoints currently have no authentication. Endpoint auth and free cryptographic text signatures from browser wallets, to authenticate and trigger runtime operations, are planned, not live.

## Tokenization of Verified Experience

The core engine operates on a loop that captures positive experiences (Φ) where error successfully falls.

- **Data Provenance:** In a tokenized ecosystem, these sealed sequences would represent the tokenization of AI compute history. Each verified step records that a specific sequence of actions reduced error under safety and budget constraints, which is the provenance a reusable digital asset would need.
- **Distributed Compute Marketplace:** The long-term roadmap positions a verified marketplace downstream of the proof system, so verified autonomous sequences could be discovered, traded, or used across distributed AI nodes. Today `/workbench/marketplace` lists verified sequences; trading and settlement are not live.

## NFT Analogy: Runs as Unique Digital Assets

The repo does not mint ERC-721 tokens. Structurally, individual execution records resemble NFTs:

- **Unique Run Identities:** Every guided start generates a unique run id.
- **Idempotency and Non-Fungibility:** Experience writes are idempotent per run and iteration, and a double-action guard keeps an action from being applied twice. The run record itself is overwritten at each step, and duplicate protection on experience entries expires after 30 days. Each verified experience entry is a unique, non-fungible proof of work for audit; it is not tamper-proof until records move to a tamper-evident rail.

## Technical Continuity Matrix

| Component | Current Software Implementation | Planned mapping |
| --- | --- | --- |
| The Ledger | Durable Upstash Redis records (`/api/level4/run`, `/api/level4/experience`); overwritable | On-chain state persistence / Distributed Ledger Technology (DLT) |
| The Asset | Verified experience entries with calculated Δe and Φ | Tokenized data assets / Provenance protocol layers |
| The Smart Contract | Pre-action safety & budget gates checking execution boundaries | Programmable, trustless execution constraints |
| Commercial Vector | Paid-pilot gate (`/workbench/pilot`); settlement not live | Escrow, Web3 transaction triggers, and utility token gates |

Aethel Node provides the infrastructure to orchestrate AI models within safety and budget constraints, with Web3 rails as a planned path for decentralized compute funding, wallet-based access controls, and programmatic settlement.
