# Aethel Node

Aethel Node turns a declared goal into a bounded run, measures the result against evidence, and keeps only the experience that qualifies for reuse.

The claim is narrow: a verified, reusable workflow can reduce repeated work and next-action error. Retention, savings, and willingness to pay still have to be shown with external users and measured outcomes. “Conscious” is a product metaphor for persistent state, feedback, and continuity across runs, not a claim about machine consciousness.

Live: https://shiyan-dap.vercel.app  
Repo: https://github.com/ecmccready/shiyan-dap

Scope: diagnostics and the related pipelines (Level 4 plant, safety, MCP, micro-ledger, proof-to-pilot). Nothing here is a clinical product, and the system handles no PHI.

## My stack: Aethel Node / Shiyan DAP — scope, propriety, and 4D-SCP

This is my stack: Aethel Node, in this repository also called Shiyan DAP. Aethel Node turns a declared goal into a bounded run, measures the result against evidence, and keeps only the experience that qualifies for reuse. The loop is Connect → Execute → Prove → Learn.

### Scope and boundaries

The work is limited to diagnostics and related pipelines: the Level 4 plant, safety, MCP, the micro-ledger, and the proof-to-pilot journey. Nothing here is a clinical product, and the system handles no PHI. Demonstration, test, and benchmark data is synthetic or fixture data and is labelled as such.

Boundaries I keep:

- **Level 4 plant.** It is the authoritative execution and verification path. Other subsystems, including the commercial surfaces and the 4D-SCP proofs, do not modify it.
- **Tenant boundary.** Production writes, proofs, and anchors are scoped per tenant.
- **Commercial surfaces.** Workbench, customer proof export, and related pages are inspect-only or human-in-the-loop. They do not replace the closed loop or the plant.

### Propriety

This repository currently declares no open-source license: there is no `LICENSE` file, and `package.json` is marked private with no `license` field. The source is published here for inspection. That publication is not a grant of rights to use, copy, modify, or distribute the work beyond the terms of the host. I reserve rights in the Aethel Node stack, including the 4D state compression engine, the 4D-SCP (Four-Dimensional State Compression Processor) model and proofs, and the deterministic proof and anchoring layers, until a license is stated.

### Note: Early sole-founder and proprietary intent

I stated sole-founder and proprietary intent for this stack publicly from its early days:

- 2026-11-08: “I am the founder who implemented a stack to be run by Agents-Unicorn trajectory.” ([post](https://x.com/ecmccready/status/2119414352646463494))
- 2026-11-09: “Maximize probability, learning velocity, and evidence generation as the Sole Founder of a Unicorn running an autonomous company.” ([post](https://x.com/ecmccready/status/2119921969353347499))
- 2026-11-12: “Building, optimizing for differentiation, defensibility and proprietary” ([post](https://x.com/ecmccready/status/2120696926475874520))
- 2026-11-14: “this stack has be the messenger boy, monopoly of proprietary.” ([post](https://x.com/ecmccready/status/2121441168940823024))

### End-to-end with 4D-SCP

Aethel Node and 4D-SCP are one intended pipeline, from a declared goal to a compact, reusable state:

```mermaid
flowchart TD
  A["Goal declaration"] --> B["Bounded run: Level 4 plant, untouched"]
  B --> C["Measurement against evidence / persistent self-monitoring"]
  C --> D["Retain qualifying verified experience: persistence, proof, anchoring, sync"]
  D --> E["Compressed state S(x,y,z,t) for efficiency and reuse"]
```

Today that relationship is only partly in production, and I am precise about the split:

- The **4D state compression engine** (M1–M5) is live in production for `prod-a`: lossless and windowed summaries, append-only segments, customer proof export, chain-head anchoring, and scheduled state-chain sync. It serves the Learn end of Connect → Execute → Prove → Learn. Design: `docs/design/4d-state-compression.md`.
- **4D-SCP** (v0.1 through v0.1.14) is the Four-Dimensional State Compression Processor for the representation S(x,y,z,t). It is a software model with integer golden vectors plus RTL simulation and synthesis proofs, all on labelled synthetic and fixture data. The code lives in `src/scp/` and `hw/scp4d/`, is imported by no route and no Level 4 module, and is not wired into production. Cycle counts are measured in simulation. Energy and area figures are model or synthesis estimates, not measured silicon. Architecture and honest claims: `docs/design/4d-scp-architecture.md`. Check inventory: under Status below, and `scripts/check-scp-all.ts`.

The value of the build is the verified software model, the bit-exact proofs, and the isolated stack, not any single hardware timing result.

## Status

Phase 1 is complete. Phase 2 (MCP + boundary) is current. Phase 3 asset map and audit summary are live. Work is focused on the proof-to-pilot journey on the existing engine. No new architectural phases are planned.

- Level 4 plant, durable experience store, replay verification, and the Workbench MCP contract are live and are not modified by the commercial surfaces.
- Phase 3 surfaces (asset map, audit summary) are read-only and off-chain.
- Eight original test events remain in the ledger. Only the project owner can purge them.
- **Production status (2026-11-16):**
  - Neon storage and anchors projects are live in Production.
  - Tenant auth (`AETHEL_TENANT_KEYS`) is configured and verified on Production.
  - 4D state compression is live for `prod-a`: chain persisted and anchored, and the customer proof export shows `state_compression` present and anchored.
  - The GitHub Actions `state-chain-sync` workflow is live. Manual dry-run and write-mode runs both PASS, and the schedule (every 6 hours at :17 UTC hours 0/6/12/18) writes automatically.
  - Level 4 plant is untouched.
- Production security close-out (2026-11-14) is complete: anchor and GitHub credentials rotated, unused env vars removed, schema guard green, acceptance passing with independent anchors.
- 4D state compression engine:
  - **Built and tested:** M1 to M5:
    - M1: pure, lossless core.
    - M2: read-only per-tenant reader.
    - M3: 256-run windows with a 24 h cutoff, opt-in bounded-loss and per-segment context.
    - M4: append-only `shiyan.state_segments`, migration 004.
    - M5: customer proof export field, plus anchoring of the chain head in the anchors project, migration `db/migrations/005_shiyan_state_chain_anchors.sql`.
  - **Customer proof export:**
    - With `SHIYAN_STATE_COMPRESSION=1` on the deployment, `GET /api/v1/customer-proof/{id}` gains a read-only `state_compression` field: the tenant's chain head, segment count, sealed-through time and anchor status.
    - Off by default. When off, the response is byte-identical to before.
    - The field is outside `content_sha256` and never fails the export.
  - **Writes:** only through the local CLIs `scripts/persist-tenant-segments.ts` (storage) and `scripts/anchor-state-chain.ts` (anchors). Both need `SHIYAN_STATE_COMPRESSION=1` plus `--write`, refuse rather than overwrite, and print only hashes and counts.
  - **Scheduled sync (live):** `.github/workflows/state-chain-sync.yml` runs every 6 hours (`17 */6 * * *`) and calls `scripts/sync-state-chains.ts` for the tenants in the repository variable `SHIYAN_SYNC_TENANTS`.
    - Repository secrets `SHIYAN_STORAGE_URL` and `SHIYAN_ANCHOR_URL` hold the connection strings. Repository variables: `SHIYAN_SYNC_TENANTS=prod-a,prod-b`, `SHIYAN_SYNC_WRITE=true`.
    - Scheduled runs write because `SHIYAN_SYNC_WRITE` is `true`. Manual runs write only when dispatched with `write=true`.
    - Dry run first, idempotent, fail-closed per tenant; logs show only hashes, counts and pending-window times (`pending_opened_at` / `pending_seals_at`, or `pending_seals_at=none`).
    - GitHub may delay or drop scheduled runs; each run catches up, so this is harmless.
    - **Least-privilege roles (migration 006):** create non-admin Neon roles `shiyan_sync` (storage project) and `shiyan_anchor_sync` (anchors project) in the Console so Neon generates the passwords, then apply `db/migrations/006_shiyan_sync_role.sql` and `db/migrations/006_shiyan_anchor_sync_role.sql` as each project's owner. Confirm with `scripts/verify-sync-roles.ts --storage-file <sync-url> --anchor-file <anchor-sync-url>`, then point the `SHIYAN_STORAGE_URL` and `SHIYAN_ANCHOR_URL` Actions secrets at those role URLs. Apply steps: `docs/design/4d-state-compression.md`.
    - Disable with `gh workflow disable state-chain-sync.yml`, or return to dry runs with `gh variable delete SHIYAN_SYNC_WRITE`.
  - Design and decisions: `docs/design/4d-state-compression.md`.
  - **4D-SCP (v0.1 fixture proof + v0.1.1–v0.1.14, unwired):** architecture at `docs/design/4d-scp-architecture.md` (§7.6–§7.9, §11, §15 honest claims). Isolated stubs and measured packing helpers in `src/scp/` are imported by no route and no Level 4 module. Boundary check: `scripts/check-scp-boundary.ts`. Software proof (fixtures only): `scripts/check-scp-v01.ts`. Defensible size baselines: `scripts/check-scp-v011.ts`. Stress measurement: `scripts/check-scp-v012.ts`. Fair same-eps lossy baselines: `scripts/check-scp-v013.ts`. Software cost / latency / memory: `scripts/check-scp-v014.ts`. Layer 2 analytical hardware cost model (estimates only): `scripts/check-scp-v015.ts`. Divider-free reciprocal quantize variant (test-only; pack.ts unchanged): `scripts/check-scp-v016.ts`. Rounding-exact divider-free reciprocal variant (test-only; pack.ts unchanged): `scripts/check-scp-v017.ts`. Integer-only golden model and golden vectors (test-only; pack.ts unchanged): `scripts/check-scp-v018.ts`. Isolated subsystem `src/scp/subsystem/` (state_encoder … compression_bench) and four-strategy proof bench on fixtures plus a seeded synthetic 4D environment (software simulation; energy figures are estimates): `scripts/check-scp-v019-bench.ts`, report `fixtures/scp/v019-bench-report.json`, spec §16. Integer-only, hash-free scp4d golden model with fixed-point relations/low-rank, event-driven decoder, compute-energy verdict (MIXED; model estimates) and FPGA reference vectors (test-only): `scripts/check-scp-v0110.ts`, report `fixtures/scp/v0110-int-report.json`, vectors `fixtures/scp/golden-vectors-scp4d.json`, spec §17. Synthesizable Verilog decoder for the temporal-only event path in `hw/scp4d/`, bit-exact against the v0.1.10 model in Icarus Verilog, with measured cycle counts and Yosys/nextpnr estimates (energy not measured): `scripts/check-scp-v0111-rtl.ts`, report `fixtures/scp/v0111-rtl-report.json`, vectors `fixtures/scp/golden-vectors-scp4d-temporal.json`, spec §18. Verilog relations decoder for the event-driven path (`hw/scp4d/rtl/scp4d_rdec.v`), bit-exact on 8 relations streams with measured cycles; verdict on relations in hardware (DEPENDS: 1.84× fewer bytes for 1.84× the cycles; worth it only when stream bytes are expensive, labelled estimates): `scripts/check-scp-v0112-rtl.ts`, report `fixtures/scp/v0112-rtl-report.json`, vectors `fixtures/scp/golden-vectors-scp4d-relations.json`, spec §19. Front end reading W = 1, 2 or 4 bytes per cycle for both RTL decoders (`hw/scp4d/rtl/scp4d_fe_w.v`, `scp4d_tdec_w.v`, `scp4d_rdec_w.v`), bit-exact at every W with measured cycles (temporal-only env T64: 2.00× fewer cycles at W = 2, 3.67× at W = 4; relations: 1.16×); W = 2 is the wall-clock sweet spot (synthesis estimates; energy not measured): `scripts/check-scp-v0113-rtl.ts`, report `fixtures/scp/v0113-rtl-report.json`, spec §20. v0.1.14 adds an RTL encoder, `hw/scp4d/rtl/scp4d_tenc_w.v`, for the temporal-only path (2 bytes per cycle out, L = 1–8 integer codes per cycle in, zero / last / linear) and a closed encode → decode loop with `scp4d_tdec_w`. Its output matches the v0.1.10 model byte for byte on 18 jobs × 4 configurations, also under random gaps and backpressure. The loop is bit-exact on all 18 jobs. On env T64 the encoder takes 131,796 / 65,911 / 36,656 / 29,204 cycles at W1L1 / W2L2 / W2L4 / W2L8, and the loop at L = 8 takes 29,986 cycles. The decoder (W = 2) takes 28,444. Synthesis and P&R estimates for W2L8 on ECP5-45F: 12,360 LUT, 4,786 FF, 24 DP16KD, 1 MULT18 at 35.86 MHz, i.e. ~161 M values/s. The encoder keeps up per cycle only at L = 8, and in wall clock it does not (0.85× the decoder's ~190 M values/s at the estimated fmax). Energy was not measured. See `scripts/check-scp-v0114-rtl.ts`, report `fixtures/scp/v0114-rtl-report.json`, spec §21. All SCP checks: `scripts/check-scp-all.ts`.

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

## Drift review

When Φ does not converge, the telemetry response includes `review_flag: "DRIFT_EXCEEDED"`. Flag the runtime for human review.

## Automated proof

POST `/api/v1/proof` hashes the telemetry result and stores it as an experience record. The proof is content-hashed and available for inspection.

## Live middleware

/api/v1/telemetry accepts predicted and observed values. The metamorphic engine evaluates Φ under drift. Non-converged runs return review_flag: "DRIFT_EXCEEDED". /api/v1/proof hashes and stores the result as an experience record.

## Auto proof

Include `auto_proof: true` in the telemetry POST. The route hashes and stores the result as an experience record and returns `experience_id` and `hash`.

## Stream harness

scripts/stream-test-telemetry.ts posts two frames to /api/v1/telemetry. Start the dev server, then run `npx tsx scripts/stream-test-telemetry.ts`.

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
npx tsx scripts/check-compression.ts && npx tsx scripts/check-compression-boundary.ts
npx tsx scripts/check-compression-source.ts && npx tsx scripts/check-compression-m3.ts && npx tsx scripts/check-compression-m4.ts && npx tsx scripts/check-compression-m5.ts && npx tsx scripts/check-state-chain-sync.ts && npx tsx scripts/check-sync-roles.ts
# all 4D-SCP checks in one run; prints each script's pinned check count and fails on any drift:
npx tsx scripts/check-scp-all.ts
# 4D compression, local and read-only (off by default; prints hashes, ids and counts only, writes nothing):
SHIYAN_STATE_COMPRESSION=1 npx tsx scripts/compress-tenant.ts --tenant <tenant-id> --storage-file ~/.shiyan-storage-url --anchor-file ~/.shiyan-anchor-url
# opt-in bounded-loss example: add  --loss bounded --eps 0.001,0.001,0.0001
# M4 persistence (after applying migration 004): dry run by default; --write appends; --verify-stored is read-only
SHIYAN_STATE_COMPRESSION=1 npx tsx scripts/persist-tenant-segments.ts --tenant <tenant-id> --storage-file ~/.shiyan-storage-url --anchor-file ~/.shiyan-anchor-url [--write | --verify-stored]
# M5 anchor the stored head in the anchors project (after applying migration 005): dry run by default; --write anchors; --verify-anchor is read-only
SHIYAN_STATE_COMPRESSION=1 npx tsx scripts/anchor-state-chain.ts --tenant <tenant-id> --storage-file ~/.shiyan-storage-url --anchor-file ~/.shiyan-anchor-url [--write | --verify-anchor]
# Scheduled sync, run manually: dry run by default; --write appends + anchors; tenants from SHIYAN_SYNC_TENANTS
SHIYAN_STATE_COMPRESSION=1 SHIYAN_SYNC_TENANTS=<tenant-id>[,<tenant-id>] npx tsx scripts/sync-state-chains.ts --storage-file ~/.shiyan-storage-url --anchor-file ~/.shiyan-anchor-url [--write]
# After applying migration 006, verify the sync roles (READ ONLY; prints role name and PASS/FAIL only):
npx tsx scripts/verify-sync-roles.ts --storage-file ~/.shiyan-storage-sync-url --anchor-file ~/.shiyan-anchor-sync-url
```

## Neon Staging (Preview)

Two isolated Neon projects are used for Preview deployments:

- **shiyan-storage** — experiences and reference envelopes (`shiyan_app` role)
- **shiyan-anchors** — reference anchors (`shiyan_anchor_app` role)

### Required Preview environment variables

| Variable | Value |
|----------|-------|
| `SHIYAN_STORAGE_BACKEND` | `neon` |
| `SHIYAN_STORAGE_URL` | `postgresql://shiyan_app:<password>@ep-sweet-bread-bdzz2swe.c-8.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require` |
| `SHIYAN_ANCHOR_URL` | `postgresql://shiyan_anchor_app:<password>@ep-dark-dawn-be92d9ji.c-9.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require` |

App-role passwords and full connection strings are stored outside git.

### Migrations

Applied once via `psql` (storage) and the Neon SQL Editor (anchors):

- `db/migrations/001_shiyan_storage.sql`
- `db/migrations/001_shiyan_anchors.sql`
- `db/migrations/002_shiyan_recovery_records.sql` (anchors project; append-only `shiyan_anchor.recovery_records`)
- `db/migrations/003_shiyan_storage_legacy_envelopes.sql` (storage project; repairs a legacy envelopes table shape, no-op if already correct)

All are idempotent.

## Production (Vercel)

Production uses the same two-database layout as Preview, on separate Neon projects:

- **storage** holds `shiyan.experiences` and `shiyan.reference_envelopes`.
- **shiyan-anchors** holds `shiyan_anchor.reference_anchors` and `shiyan_anchor.recovery_records`, reached by the `shiyan_anchor` role (SELECT and INSERT only).

The anchor URL must point to a different database and a different role than the storage URL. Otherwise the reference routes fail closed with `503 REFERENCE_STORAGE_NOT_CONFIGURED`. Nothing falls back to the storage database or the filesystem.

### Required Production environment variables

| Variable | Value |
|----------|-------|
| `AETHEL_TENANT_KEYS` | tenant key map (secret) |
| `SHIYAN_STORAGE_BACKEND` | `neon` |
| `SHIYAN_STORAGE_URL` | `postgresql://<storage role>:<password>@<storage host>/neondb?sslmode=require` |
| `SHIYAN_ANCHOR_URL` | `postgresql://shiyan_anchor:<password>@<anchors host>/neondb?sslmode=require` |
| `AETHEL_GITHUB_TOKEN` | fine-grained read-only token (secret) |
| `AETHEL_GITHUB_REPOS` | `{"ecmccready/shiyan-dap":"prod-a"}` |

Vercel reads environment variables at build time, so redeploy after any change (for example with an empty commit). Set secret values from local files with the Vercel CLI rather than by pasting:

```bash
tr -d '\r\n' < ~/.shiyan-anchor-url | npx vercel env add SHIYAN_ANCHOR_URL production
```

Never commit connection strings, passwords, keys or tokens.

### Schema guard and diagnostics

After applying migrations, including `db/migrations/003_shiyan_storage_legacy_envelopes.sql` in the storage project's SQL Editor (a no-op if `shiyan.reference_envelopes` already has the expected shape; it never drops data), verify both databases with the read-only schema guard. It checks tables, columns, append-only triggers, and app-role privileges, and never prints connection strings:

```bash
cd ~/src/shiyan-dap
npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-schema.ts --storage-file ~/.shiyan-storage-url --anchor-file ~/.shiyan-anchor-url
```

`shiyan.state_segments` (migration 004, 4D state compression M4) is a staged table. The guard prints SKIP while it is absent and checks it fully once present. After applying 004, add `--require-state-segments` to make its absence a failure. Likewise `shiyan_anchor.state_chain_anchors` (migration 005, anchors project, M5): SKIP while absent; after applying 005, add `--require-state-anchors`.

Set `SHIYAN_STORAGE_DIAGNOSTICS=1` in Vercel only while diagnosing `REFERENCE_STORAGE_UNAVAILABLE`. The app then logs a single line with the operation name, Postgres error code, and error class; it never logs URLs or error message text. Leave the flag unset in normal operation.

### Acceptance

```bash
export STAGING_BASE_URL="https://<deployment>.vercel.app"
export STAGING_TENANT_A_KEY="$(cat ~/.shiyan-prod-a.key)"
export STAGING_TENANT_B_KEY="$(cat ~/.shiyan-prod-b.key)"
export STAGING_EXPECT_ANCHORS=1
export STAGING_REFERENCE_REPO=ecmccready/shiyan-dap
npx tsx --tsconfig ./tsconfig.json scripts/staging-acceptance.ts --run-file <genuine aethel.run/1 file>
unset STAGING_TENANT_A_KEY STAGING_TENANT_B_KEY
```

Each run needs a unique `run_id` (a reused one returns 409).
