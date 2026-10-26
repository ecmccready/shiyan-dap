## Tensor Scope: Verifying Latent State

**Definition.** The tensor scope brings tensors into verification alongside the text and state logs. A tensor T ∈ ℝ^(d₁×…×dₙ) can be an embedding, an activation state, a logit distribution, or a sensor vector. It is stored row-major with its shape.

**Proprietary scope — Workspace A → Workbench B → Z, governed by ROE.** The proprietary opportunity is the integrated, testable loop that turns a declared goal into a bounded run, checks the result against evidence, and retains only experience that qualifies for reuse. Its value is not a claim of machine consciousness: “conscious” is a product metaphor for persistent state, feedback, and continuity across runs. The commercial thesis is that this continuity can reduce repeated work and next-action error; retention, savings, and willingness to pay must be demonstrated with external users and measured outcomes.

1. *Workspace A — Goal, reference, planning, and oversight.* Workspace A defines the intended outcome and reference, coordinates the run, and remains the control and feedback layer. It does not treat a proposal as proof or let a model bypass the execution gates.
2. *Workbench B — Execution, observation, and verification.* Workbench B is the execution environment. It applies permitted actions, observes state, measures error e and Δe, checks safety, budget, idempotency and any supplied tensor constraint, and records the run. The Workbench B MCP contract is `aethel.loop.v1`; the `aethel-anchor/1` payload and independent replay verification are implemented.
3. *Z — Evidence-qualified verified experience.* Z is the outcome eligible to inform future runs: provenance, measured result, verification status, and reuse eligibility. It is not simply a successful-looking action. The live experience store is Upstash-backed and idempotent per run and iteration; the public experience API exposes the recorded evidence. `GET /api/level4/verify` replays the demo run on a fresh plant and currently reports 26/26 checks. `GET /api/level4/anchor` prepares a Merkle root with `anchored:false`; on-chain submission is not live.
4. *ROE — Reciprocal Optimization Engine.* ROE evaluates improvement against the reference and governs how improvement evidence informs selection and reuse. Implemented slices include normalized RMS checking, gated improvement I_t, adaptive ε for the normalized/RMS mode, a reuse-eligibility overlay, a step-aware next-action objective, and the opt-in `?roe_drive=1` selector. Some ROE views are informational or inspect-only; the opt-in selector changes action choice, while the existing planner remains the default. Learned cost/risk models and a richer state model are directional.
5. *Retention and revalidation.* The durable experience feed supports continuity across runs, but retention must be earned by evidence. Reuse requires eligible experience and the ROE eligibility overlay; the autonomous page replays a durable sequence client-side and falls back to the built-in sequence when stored experience is missing, invalid, or does not meet the goal. Retained experience should be revalidated when its reference, environment, constraints, or relevant state changes. The current system demonstrates persistence and constrained reuse on its reference plants, not universal validity across domains.

**What is live today:** the Level 4 reference plant; durable run and experience records; measured e, Δe, cold `Self()` baseline, Φ and ROE I_t; pre-action safety/budget checks and idempotency; tensor commitment and independent distance checks; the Workbench MCP contract; replay verification; an anchor payload and Merkle-root calculation; the ROE inspection endpoints and opt-in selector; and client-side validation of durable sequences before reuse.

**Domain Workbench plugins, micro-ledger and diagnostics (live on main, early-stage):** these sit beside the Level 4 plant and do not change it. The default Level 4 path, its demo numbers and `aethel.loop.v1` are untouched.

- *Domain Workbench Plugin Architecture.* Plugins register through `workbenchRegistry`: `music-studio`, `diagnostics-safety`, and `agent-compute`. Each exposes tools, an optional `onLedgerEvent` hook, and a `renderPanel` component, and appears in the Plugins section of `/workbench/workspace`. Tools are callable over HTTP (`POST /api/v1/plugins/tools/execute`) and over MCP (`POST /api/mcp?plugins=1`, named `pluginId__toolName`; the default MCP list remains the six Level 4 tools). Writing tools and demo buttons in the UI need `?demo=1`.
- *Invisible Micro-Ledger.* `POST /api/v1/ledger/commit` persists events to Upstash, chains `previousHash` per asset, and records a signature status: HMAC-SHA256 by default, or a basic EIP-191 `personal_sign` wallet check that yields `wallet_verified` or `wallet_unverified` with a reason and never rejects. Each commit carries a settlement intent (`INTERNAL_MICRO` settled internally; `STRIPE` and `X_MONEY` queued unless configured), recorded per recipient. When Stripe is configured, a verified commit with an explicit amount creates a PaymentIntent and records it, and test-mode Connect `acct_` recipients get Transfers (live keys skip transfers unless explicitly enabled). The provenance panel is collapsible. Admin soft-hide and hard-purge sit behind `LEDGER_ADMIN_SECRET`. Writes are rate-limited per IP. `GET /api/v1/status` reports plugins, ledger count and latest tx hash, configuration booleans (never values), and supported rails.
- *SIWE-style message structure.* For `signatureType: "wallet"`, an optional `siweMessage` (EIP-4361 shape) is the signed text, must still contain the event's canonical string, and is parsed into `siwe` fields (domain, address, statement, URI, version, chain ID, nonce, issued-at) with a list of structural issues on the stored event. It also checks the message domain against the allowed domains (`SIWE_ALLOWED_DOMAINS`, else the request host), that `issuedAt` is within 10 minutes and not in the future, and that a nonce is present, recording a verified nonce so a replay is flagged. `GET /api/v1/siwe/nonce` issues single-use server nonces; when a siweMessage is present the stored `signatureStatus` is a combined `wallet_siwe_verified` (EIP-191 passed, SIWE checks clean, server-issued nonce consumed) or `wallet_siwe_partial` (with reasons), and the raw result stays in `eip191Status`. Without a siweMessage the plain EIP-191 behavior is unchanged. `contractWallet: true` is recorded as `eip1271_unsupported` and verifies nothing. Neither status unlocks Stripe.
- *Anchor preparation and dry run (not on-chain).* `GET /api/v1/ledger/anchor` returns a Merkle root (`sha256-merkle-v1`) over the latest ledger events with the event count, `anchored: false`, and an optional inclusion proof for one event. `POST /api/v1/ledger/anchor` with `{"dryRun": true}` records a logged dry-run attempt and returns a simulated tx hash and block number with status `dry-run` and `anchored: false`. The root and the last dry run are shown in `GET /api/v1/status` and the provenance panel. Nothing is submitted on-chain, and the simulated hash and block do not exist on any chain.
- *Diagnostics Compliance & Risk Audit (mock, heuristic).* `POST /api/v1/diagnostics/scan` and the `music-studio.create_music_asset` flow (asset → scan → two chained ledger commits with splits) return a `certificateHash`, a simulated `fingerprint` (a metadata-only hash of the normalized title, rounded duration and asset type, shown in the Music Studio result; `audioFingerprint` is always `null`/`not_implemented`), and `overallStatus` (`PASSED`, `FLAGGED` or `REJECTED`) plus a `reasons` list that explains every term in the score. Scoring is a deterministic keyword, title, duration and length heuristic: the same contentHash, assetType, title and duration always give the same score and certificate. It is not a real compliance, legal or clinical check, and the certificate is a record of that heuristic, not a third-party attestation.
- *Estimated compute records.* `agent-compute.record_compute_usage` records AGENT_COMPUTE events and can attach a self-reported FLOP and cost estimate (`usageEstimate`, always marked estimated and not metered). Nothing is metered, billed or paid out.

**Directional, not live:**

- Generalized, validated multi-domain workbenches. The loop is designed to be domain-independent, and the plugin architecture is now live with three plugins, but validated demonstrations are still reference plants and the diagnostics scan is a mock; music is the first vertical. Healthcare diagnostics is a later, higher-risk direction, not a diagnostic product, and this system handles no PHI.
- On-chain submission of anchor roots, for both the Level 4 run and the micro-ledger. Partial progress: the Level 4 anchor payload and Merkle root, the micro-ledger Merkle root with inclusion proofs, a logged dry-run submission that returns a simulated tx hash and block number (the provenance panel lists the last three attempts with network, simulated tx and gas; with an optional `network` of ethereum, sepolia, polygon, base, optimism or arbitrum it also returns a simulated receipt: chain id, gas used from a documented gas model, an illustrative fee at a fixed non-live gas price, `anchored: false`), and the `AnchorAdapter` interface exist. No chain connection exists: nothing is submitted on-chain, no real transaction or block is produced, and nothing is verified against a chain.
- Real money movement to recipients in live mode. Stripe PaymentIntent and test-mode Connect Transfer recording exist and are guarded; live-mode transfers are off by default and have not been exercised with a real live account. The project owner has confirmed that `LEDGER_SIGNING_SECRET` and `LEDGER_ADMIN_SECRET` are now set on Vercel (`GET /api/v1/status` reports `signingSecretConfigured` and `adminSecretConfigured` as true), so the Stripe signing guard and admin hide/purge are available in production; the assistant that maintains this repo does not hold the admin secret and has not run a purge, and Stripe settlement against a real live account remains unexercised. X Money settlement is queued only; there is no integration.
- Stronger wallet identity: full SIWE (Sign-In with Ethereum) verification and reliable EIP-1271 contract-wallet signatures. Partial progress: an optional SIWE-style message is parsed and its domain, issued-at freshness and nonce replay are checked; `GET /api/v1/siwe/nonce` issues single-use server nonces (accepted-but-flagged for legacy client nonces; `SIWE_REQUIRE_ISSUED_NONCE=1` makes them an issue); and a combined `wallet_siwe_verified` / `wallet_siwe_partial` status folds the EIP-191 result, the SIWE checks and nonce source into one field. Nothing rejects a commit. A chain policy stub compares the message's Chain ID with `SIWE_ALLOWED_CHAIN_IDS` (default 1,137) and records the result in `siwe.policy`; it is informational unless `SIWE_ENFORCE_CHAIN=1`. Domain binding no longer trusts the request Host by default: allowed domains are `SIWE_ALLOWED_DOMAINS`, else the fixed `shiyan-dap.vercel.app` plus the platform-set production URL (so preview and custom domains do not match unless listed; `SIWE_TRUST_REQUEST_HOST=1` restores the old request-host behaviour, and non-production runs still accept their own host). EIP-1271 is now callable: with `contractWallet: true` and an https `ETH_RPC_URL`, the server makes one `eth_call` to `isValidSignature(bytes32,bytes)` on the wallet and records `eip1271_verified`, `eip1271_failed` (with a reason) or `eip1271_unsupported` (no RPC). That call has not been run against a real chain or contract wallet (only a mock RPC), `ETH_RPC_URL` is not set on Vercel, and it trusts the RPC provider, serves one chain, has no ERC-6492 (undeployed wallets) and no retries. With a siweMessage the server now also records `siwe.cryptoVerified`: true only when the recovered signer equals the claimed address, the address inside the message is that same address, and the signature was checked over exactly the stored message text (EIP-55 checksum of the message address is reported but informational). It is server-computed and now feeds the combined status: when it is false the commit is `wallet_siwe_partial` with a `siwe_crypto_not_verified (...)` reason (including a contract wallet that accepted the signature but is not the address named in the message). Plain EIP-191 commits without a siweMessage are unchanged and nothing is rejected. A single `siwe.overallValid` boolean (with `overallFailures`) summarises every check: it is true only when the crypto check, structure, domain, issuedAt freshness, first-use server-issued nonce and an allowed chain all pass. It is shown in the commit response, the provenance panel and (read-only, per ledger record) the Music Studio result, which says so explicitly when a record carries no SIWE data; the Music Studio flows are server-signed by default (no wallet message, so they show that no-SIWE line), but Music Studio can now optionally submit a wallet signature: the form has an optional wallet section (address, a Prepare button that fetches a server nonce and builds the SIWE text containing the canonical string, and a signature box; you sign in your own wallet), and the `create_music_asset` tool accepts `walletAddress`, `signature`, `siweMessage` or `walletMessage`, plus the `assetId` and `timestamp` that were signed. That signature replaces the server HMAC for the MUSIC_TRACK event only (the audit event stays server-signed), goes through the normal EIP-191/SIWE pipeline and shows `overallValid` in the result; the wallet record is never `verified`, so it does not unlock Stripe transfers; I have not tested it with a real browser wallet, does not change `signatureStatus` (an unenforced chain outside the allowed list is still `wallet_siwe_verified` but not `overallValid`) and never rejects a commit. Not done: full SIWE verification (`cryptoVerified` does not cover domain, nonce, expiry or chain policy, which stay separate informational checks), and any other on-chain check. Server nonces need Upstash to work across serverless instances. No wallet status unlocks Stripe.
- Settlement or monetization of verified tensor transformations (T_in → T_out). The ledger's settlement intents apply to plugin assets, not to tensor transformations.
- FLOP-based micro-payments. Partial progress: the `agent-compute` plugin records compute usage with an optional self-reported FLOP and cost estimate as ledger events. Nothing is metered (FLOPs are not measured), billed or paid out.
- Real diagnostics and compliance checks to replace the heuristic scan. Partial progress: the scan is now deterministic and explains its score, and it emits a simulated metadata fingerprint, but it is still a keyword and length heuristic. The `fingerprint` is a hash of title, duration and asset type only. There is now an audio hook: the scan route and `create_music_asset` accept optional `audioBase64` (max 2 MB) or `audioHash` (64-hex SHA-256) and return `audioFingerprint` as `sha256:<hex>` with status `content_hash_only` (bytes the server hashed) or `content_hash_provided` (client-supplied, unverified); with neither it stays null (`not_implemented: no audio bytes analyzed`). That is a content hash of byte-identical files, not a perceptual or acoustic fingerprint: it cannot match re-encodes, edits or copies, the audio is never stored and the hash is not written to the ledger, and the score and `certificateHash` are unchanged. Real audio fingerprinting (Chromaprint or a matching service) is still not built; the hook is `computeAudioFingerprint()` in `src/services/diagnostics-core.ts`. There is no external database.
- Hosted-model tensors in the live demo. The Level 4 demo uses a deterministic proposer and deterministic demo sensor tensor, not embeddings, activations, or logits from a hosted model.
- Learned cost/risk models and a generalized state-aware ROE objective.

**Commercial framing.** The product proposition is evidence-backed autonomous execution with durable, qualified experience: define an outcome, run within constraints, inspect the result, and reuse only what passes the relevant checks. The potential advantage is the accumulated implementation, integration, evidence, and validated workflow—not a single formula or an unsupported “consciousness” claim. Customer retention is an outcome to prove through repeat usage, verified improvement, lower repeated-work cost, and paid pilots; it is not established merely by having a retention layer.
## Live commercial path

| Surface | Role | Live |
| --- | --- | --- |
| / | Commercial center | https://shiyan-dap.vercel.app/ |
| /workbench/diagnostic/reference | Evidence-gate reference fixture | https://shiyan-dap.vercel.app/workbench/diagnostic/reference |
| /workbench/review | Acquirer / funding one-pager | https://shiyan-dap.vercel.app/workbench/review |
| /workbench/offer | Solicitation | https://shiyan-dap.vercel.app/workbench/offer |
| /workbench/client | Target-client pipeline + exportable Run | https://shiyan-dap.vercel.app/workbench/client |
| /workbench/pilot | Paid pilot gate | https://shiyan-dap.vercel.app/workbench/pilot |
| /workbench/autonomous | Level 4 autonomous run | https://shiyan-dap.vercel.app/workbench/autonomous |
| /workbench/autonomous/proof | End-to-end recovery + gate proof | https://shiyan-dap.vercel.app/workbench/autonomous/proof |
| /workbench#guided-run | Guided first run | https://shiyan-dap.vercel.app/workbench#guided-run |
| /workbench/outcome | External client declares a measurable goal | https://shiyan-dap.vercel.app/workbench/outcome |
| /workbench/result | Simple verified result view | https://shiyan-dap.vercel.app/workbench/result |
| /workbench/status | Level 4 durability and acquisition status | https://shiyan-dap.vercel.app/workbench/status |
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
- Guided first-run entry integrated into `/workbench` (`/workbench#guided-run`); `/workbench/start` redirects there for existing links.
- External client path: declare a measurable goal (`/workbench/outcome`) → run → view verified result (`/workbench/result`). The result page is server-rendered from the durable store, so the latest eligible result is visible without JavaScript.
- Status (`/workbench/status`) reads the durable store directly: guided starts, recent runs, latest verified result, and recent verified steps.
- One shared Level 4 navigation across start, outcome, autonomous run, result, recovery proof, status, spine, and roadmap.
- Product spine view and status summary with cross-links.

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
