# 4D State Compression Processor (4D-SCP): architecture

Status: **spec plus isolated, unwired interface stubs** (`src/scp/`). No route, CLI, or Level 4 module imports this package. Nothing here is live on https://shiyan-dap.vercel.app. This document is the first commitable step toward 4D-SCP v0.1, a software proof. It does not implement compression, change existing behaviour, or claim hardware results.

Inventory date: 2026-11-17, repo `main`. Exact in-tree names and paths are in §1. Open questions for the owner are numbered in §14.

## 1. Purpose and scope

**Purpose.** Define a 4D State Compression Processor that sits on top of the existing 4D state compression engine (`src/core/compression/**`, M1–M5) and measures whether a compact, reconstructable, hash-chained representation of agent/system state preserves what the rest of Aethel Node already verifies: predicted vs observed values, Φ, a replay verdict, and (when a later milestone asks for it) a task score in the style of the Reciprocal Optimization Engine.

**Inspiration, stated honestly.** The compression engine already records what we borrow from SIMA 2: a compact, scored experience bank that later learning can read (`docs/design/4d-state-compression.md` §1). SIMA 2 does not describe a “4D-SCP” or a hardware processor. Those names, the X/Y/Z/T vocabulary, and the three-layer physical path are ours. We do not train models here.

**Scope of this document and of `src/scp/` today.**

- In: architecture, TypeScript interfaces, a not-implemented reference that throws, a boundary check, and a v0.1 proof test *plan*.
- Out: any implementation of encode/compress/decode; any import from `src/app/**` or `src/lib/level4/**`; any new production data; any change to `MetamorphicEngine`, `metamorphic-runtime.ts`, or the Level 4 plant; any hardware claim presented as a result.

**v0.1 (first milestone) is a software proof** that measures compression ratio, fidelity, latency, retained task performance, and determinism/verifiability (see §7 for why the fifth is listed). Fixtures only in tests. Thresholds are TBD-proposed, not commitments.

## 2. Inventory (read-only; what exists, what does not)

### 2.1 Global · misdiagnosis (exists; official label uses a middle dot)

This is a Know-group vertical, not a clinical product. “Misdiagnosis” in this codebase means a **wrong next action**: a run completed without reaching its goal threshold. It is not a diagnosis of a person.

| What | Path or URL |
|---|---|
| Domain label `Global · misdiagnosis` | `src/lib/domains/groups.ts`, README Surfaces table |
| Page | `/workbench/global` → `src/app/workbench/global/page.tsx` (live at https://shiyan-dap.vercel.app/workbench/global) |
| Snapshot builder (pure) | `src/lib/diagnostics/global-snapshot.ts` — schema `aethel.global.snapshot.v1` |
| Shape validator | `src/lib/diagnostics/global-snapshot-validate.ts` |
| Copyable GET | `/api/diagnostics/global-snapshot` → `src/app/api/diagnostics/global-snapshot/route.ts` |
| Local validator CLI | `scripts/validate-global-snapshot.ts` |
| Classification | `eligible === true` → `ELIGIBLE_EXPERIENCE`; `state === "COMPLETE"` and not eligible → `MISDIAGNOSIS_REJECTED`; else `IN_PROGRESS` |
| Snapshot fields per run | `run_id`, `status`, `final_e`, `delta_e`, `phi`, `verified_at` |
| First named vertical under it | **Medicare · Public Data Intelligence**, `/workbench/medicare` |

**Medicare data that actually exists.** `docs/medicare-case.md`, `src/lib/medicare/**`, synthetic fixture `fixtures/medicare/sample-rows.json` (no live CMS fetch, no real providers, no PHI). Each row is `{ provider_id, hcpcs_code, service_count, avg_submitted_charge, avg_medicare_payment }`. Anomaly class `payment_vs_charge.v1`. The page and libraries produce an evidence pack and a human-reviewed investigation report. There are **no geographic / spatial X,Y,Z fields** in this fixture.

**Not found.** No directory or doc titled exactly “Global Misdiagnosis vertical” as a separate package. No production Medicare or snapshot rows in this repo (the fixture is synthetic; Global snapshot is built from the node’s own recorded experience, not from a bundled dataset).

### 2.2 Tensor Scope (exists; that is the in-tree name)

There is no type or file named `TensorScope`, but the pattern is explicitly called **“Tensor scope”**.

| What | Path or URL |
|---|---|
| Core module | `src/lib/level4/tensor.ts` — header: “Tensor scope for Level 4 verification (additive).” |
| Check | `independentTensorCheck`, `combineEligibility` (tensor is an *additional* gate: no tensor ⇒ behaviour unchanged) |
| Commitment | `H(T) = sha256(serializeTensor(T))` → `"sha256:<64 hex>"`. Ledger stores the commitment and distance, never the raw tensor. |
| Distance | Frobenius `‖T_out − T_ref‖_F` or `1 − cos(T_out, T_ref)`; `d > ε` or a commitment mismatch → `MISDIAGNOSIS_VIOLATION` |
| Stateless API | `POST /api/level4/tensor-check` → `src/app/api/level4/tensor-check/route.ts` |
| Demo plant tensor | `src/lib/level4/demo-tensor.ts`, `docs/level4-tensor-demo.md` — `T = [completeness, contradiction, missing, independent_check]`, shape `[4]`, `ε = 0.16` |
| Seal / holographic bound | `src/lib/level4/seal.ts` (optional `ε_dyn = ε_base · √(N/4)`) |
| Wiring | experience POST and ledger (`src/app/api/level4/experience/route.ts`, `src/lib/level4/verified.ts`, `experience-client.ts`); MCP schema/handler |

**Not found.** No standalone “Tensor Scope” product or non-Level-4 implementation. 4D-SCP must **follow this pattern** (commitment, a declared metric, a bound, a pass/fail status) without importing `src/lib/level4/**` from `src/scp/` (Level 4 stays untouched; the boundary check enforces it).

### 2.3 Measurement / verification “ROE” pattern (exists as Reciprocal Optimization Engine)

In this repository **ROE means Reciprocal Optimization Engine**, not “Return on Evidence”. No in-tree use of the phrase “Return on Evidence” was found.

| What | Path or URL |
|---|---|
| First slice (read-only, informational) | `src/lib/level4/roe.ts` |
| Formula | `I_t = 1[G_t] · max(0, Δe_t)`, `G_t = safety ∧ budget ∧ idempotency ∧ tensor` (tensor applies only when the step carries a tensor) |
| Engine-backed `Measurement` | `src/lib/level4/measured.ts`: `{ e0, e, delta_e }` where `delta_e = e0 − e` (higher is better). `measureActions` replays actions on a fresh plant. |
| Eligibility / next action / lookback / adaptive ε | `src/lib/level4/roe-eligibility.ts`, `roe-next-action.ts`, `roe-lookback.ts`, `roe-adaptive.ts`; also `src/core/roe-next-action.ts` |
| Surface | `/workbench/autonomous?roe_drive=1` (https://shiyan-dap.vercel.app/workbench/autonomous?roe_drive=1) |
| UI note | `src/components/RoeLookbackNote.tsx`, `src/lib/roe-lookback-url.ts` |
| Domain entry | `src/lib/domains/groups.ts` — “ROE · Reciprocal Optimization Engine” |

Related verification that is *not* named ROE but is the rest of the measurement stack: `src/lib/level4/verified.ts`, `verify-run.ts`, the closed loop in `src/lib/closed-loop.ts`, and the compression engine’s `VerifyResult` (`src/core/compression/types.ts`).

**Not found.** A single type named “ROE measurement record” that already includes compression ratio or latency. 4D-SCP will define an additive `ScpMeasurement` that is *compatible* with `{ e0, e, delta_e }` rather than replacing it.

### 2.4 Existing 4D state compression engine (build on this; do not duplicate)

Already implemented and, for prod-a, live. Design: `docs/design/4d-state-compression.md`. Code: `src/core/compression/**`.

**What “4D state” already means here:** `(predicted, observed, Φ) × time`, per tenant (`StateVector` in `src/core/compression/types.ts`). Time is `proof_timestamp` (epoch ms). Arrival for windowing is `created_at` when present. Only `provenance.source = "third-party-workbench"` rows are compressed.

| Milestone | Role |
|---|---|
| M1 | Pure lossless encode/decode, Merkle `source_ids_root`, `segment_sha256 = sha256(canonical(segment))`, chained `prev_segment_sha256` |
| M2 | Read-only per-tenant reader (`source.ts`), local CLI, off unless `SHIYAN_STATE_COMPRESSION=1` |
| M3 | Window sealing (default 256 points or 24 h cutoff + 10 min grace), opt-in bounded-loss, optional anchors context |
| M4 | Append-only `shiyan.state_segments` (migration 004), writer `store.ts`, CLI `scripts/persist-tenant-segments.ts` |
| M5 | Independent chain-head anchors (`shiyan_anchor.state_chain_anchors`, migration 005), CLI `scripts/anchor-state-chain.ts`; read-only `state_compression` field on `GET /api/v1/customer-proof/{id}` when the flag is on |
| Sync | `scripts/sync-state-chains.ts` + hourly workflow; least-privilege roles in migration 006 |

**Reuse for 4D-SCP, not reimplementation:** lossless and bounded-loss modes; sealing windows; chain hashing and `verifyChain` / `verifyReconstruction`; independent anchoring as the proof that a sealed head is witnessed in a second database. 4D-SCP wraps and *measures* this engine. It must not fork encode/window/chain/store.

**Relevant live routes** (https://shiyan-dap.vercel.app): `/workbench/global`, `/workbench/medicare`, `/workbench/autonomous?roe_drive=1`, `/workbench/proof`, `/workbench/customer-proof`, `/architecture`, `/api/diagnostics/global-snapshot`, `/api/level4/tensor-check`, `/api/v1/customer-proof/{id}` (compression field only when the existing flag is set). None of these currently mention 4D-SCP.

## 3. Relationship to the existing compression engine

```
  existing records (experiences / fixtures)
            │
            ▼
   StateEncoder (4D-SCP)  ── maps a source row into ScpFrame{x,y,z,t}
            │
            ▼
   StateCompressor         ── MUST call src/core/compression (compress / extend / seal)
            │
            ▼
   TemporalState           ── the chained sealed segments + pending window
            │
            ├────────► StateDecoder / reconstructor ── verifyReconstruction
            ├────────► FidelityVerifier             ── bit-exact or within eps; optional tensor-style d
            ├────────► Measurement record           ── ratio, fidelity, latency, retained, hash
            └────────► existing persist + anchor CLIs (optional; same append-only rules)
```

- **Lossless** remains the default; a reconstructed point must match the source bits for `predicted`, `observed`, `phi`, `t`, `step`, and verdict.
- **Bounded-loss** remains opt-in, with caller-supplied `eps` and measured `max_abs_err`. `t`, identities and verdicts stay lossless.
- **Sealing** stays in `window.ts`: 256 or cutoff+grace; late records go to the next open window; sealed windows never reopen.
- **Proof** stays `segment_sha256` + chain + optional independent anchor. 4D-SCP must not invent a second hash scheme.
- **Flags.** Stubs read no env. A future CLI or route, if any, would use a new flag (proposed: `SHIYAN_SCP=1`) in that edge file only, the same way only the export route and CLIs read `SHIYAN_STATE_COMPRESSION`. `src/core/compression/**` and `src/scp/**` must keep `process.env` out.

## 4. 4D state model (X, Y, Z, T)

The owner’s vision is four axes: X/Y/Z “spatial-ish” feature axes plus T (time), in the spirit of an agent state that could later be laid out in a processor. The **already-shipped** engine uses a different, precise 4-tuple: `(predicted, observed, Φ, t)`.

v0.1 must not invent production coordinates. The only numeric state that is both real and already compressed is:

| Axis in `StateVector` | Source field | Already present? |
|---|---|---|
| predicted | `metamorphic.transformation.inputs.predicted` | yes |
| observed | `metamorphic.transformation.inputs.observed` | yes |
| phi | `metamorphic.transformation.inputs.phi` (and the stored Φ) | yes |
| t | `proof_timestamp` (ms) | yes |
| step, verdict | step index; `PASS` / `FAIL` / `INCONCLUSIVE` | yes, not a spatial axis |

**Default mapping for v0.1 (proposed, see Q1):** `X = predicted`, `Y = observed`, `Z = phi`, `T = t`. This uses existing data, stays compatible with M1–M5, and treats X/Y/Z as **feature axes**, not literal metres.

**Other real vectors in the repo that are *not* used by the compression engine today** (open whether they should be):

- Level 4 demo sensor tensor `[completeness, contradiction, missing, independent_check]` — a 4-D feature vector, still not spatial; lives under Level 4, so `src/scp` must not import it.
- Global snapshot `(final_e, delta_e, phi, verified_at)` — a run summary, not a per-step frame.
- Medicare fixture rows — five administrative fields, **no coordinates**.

**Open (not assumed):** a literal spatial embedding (lat/lon/height, a plant layout, a 3D world pose). No such fields were found in the Medicare fixture, the Global snapshot schema, or `StateVector`. If they appear later, they belong in an explicit new encoder, not in silent default values.

`ScpFrame` in `src/scp/types.ts` therefore names `x, y, z, t` as numbers plus optional `source` identity. Encoders document their mapping. There is no hidden fill-in of zeros for missing spatial axes.

## 5. Component architecture (interfaces)

Stubs: `src/scp/types.ts` (interfaces only), `src/scp/not-implemented.ts` (throws a clear error), `src/scp/index.ts` (re-exports). Imported by nothing in `src/app/**` or Level 4.

| Component | Interface | Responsibility in v0.1 |
|---|---|---|
| State encoder | `StateEncoder` | Map an allowed input (a `StateVector` / fixture point, not a live production row unless a later question allows it) into `ScpFrame[]`. |
| State compressor | `StateCompressor` | Delegate to the existing engine (`compressPoints` / `buildTenantChain` / `extendTenantChain`). Must not re-encode floats or invent a chain. |
| Temporal state | `TemporalState` | Hold the sealed prefix, the pending window, and the head hash. Mirrors `TenantCompression` / `WindowPlan` rather than replacing them. |
| State decoder / reconstructor | `StateDecoder` | Rebuild frames from sealed segments via existing `reconstruct` / `verifyReconstruction`. |
| Fidelity verifier | `FidelityVerifier` | Lossless: bit-exact. Bounded: per-axis `max_abs_err ≤ eps`. Optional tensor-scope-style `d ≤ ε` on a declared metric, implemented in SCP/tests without importing Level 4. |
| Scheduler | `StateScheduler` | Optional; reserved for window/seal/sync cadence. v0.1 may leave it throwing. Existing sync already lives in `scripts/sync-state-chains.ts`. |
| Measurement | `ScpMeasurement` | See §6. Compatible with `{ e0, e, delta_e }`. |

All methods of the not-implemented reference throw `4D-SCP: <name> is not implemented (spec stubs only)`.

## 6. Measurement record (compatible with the existing pattern)

`src/lib/level4/measured.ts` already defines `Measurement = { e0, e, delta_e }`. ROE then forms `I_t` from gated `Δe`. 4D-SCP does not replace those types (and does not import them, so Level 4 stays untouched). `ScpMeasurement` includes the same three fields as optional and adds the v0.1 metrics:

```
e0, e, delta_e                         // same meaning as measured.ts, when a task score is available
compression_ratio, raw_bytes, compressed_bytes
fidelity                               // ok, mode, optional max_abs_err / distance / epsilon
latency_ms                             // p50, p95, samples — recorded only in a test/CLI harness, never in src/scp core
retained_task_performance              // score in [0,1] or a documented unit; n
determinism                            // ok, head_sha256
```

A v0.1 test builds this record after a fixture run. It is not written to `shiyan.experiences` in v0.1.

## 7. Five measurable properties

The v0.1 request named four operational metrics: compression ratio, fidelity, latency, retained task performance. This spec adds a fifth, **determinism / verifiability via the hash chain**, because that is already how this stack proves a sealed trajectory and because a “processor” proof without a stable hash is not checkable. If the owner wants a different fifth property, that is open question 6.

Thresholds below are **TBD-proposed**, not pass criteria until the owner accepts them.

### 7.1 Compression ratio

Let `raw_bytes` be the UTF-8 byte length of the canonical source used for the window (the existing `canonical()` of the points or the `record_json` bytes the engine already hashes — the test must pick one and keep it). Let `compressed_bytes` be the UTF-8 byte length of `canonical(segment)` (the same text `segment_sha256` hashes), summed over sealed segments. Pending points are reported separately and are not counted as compressed.

`compression_ratio = raw_bytes / compressed_bytes`  (dimensionless; greater than 1 means shrinkage).

Also report `bytes_per_point = compressed_bytes / sealed_point_count`. TBD-proposed for v0.1 lossless fixtures: ratio ≥ 1.0 (do not expand) and a recorded bytes-per-point, no ceiling yet.

### 7.2 Fidelity / reconstruction error

- Lossless: `verifyReconstruction` must pass; every reconstructed `predicted`, `observed`, `phi`, `t`, `step`, `verdict` is bit-identical (or, for floats, the same IEEE-754 value the engine already uses).
- Bounded: for each axis `a ∈ {predicted, observed, phi}`, `max |a − a'| ≤ eps_a`, as the engine already records in `max_abs_err`.
- Optional tensor-scope-style check (pattern only): `d = sqrt(Σ_i (out_i − ref_i)²)` on a declared vector, pass iff `d ≤ ε`. This is the same idea as Frobenius distance on a 1-D flattening; SCP tests may implement it locally.

TBD-proposed: lossless fixtures 100% bit-exact; bounded fixtures 100% within the declared eps.

### 7.3 Latency (p50 / p95)

Measured only in the test or CLI harness (clocks are not allowed inside `src/core/compression/**` or `src/scp/**`). For a fixed fixture of N points (proposed N = 256, the default window size), run encode + compress + verify K times (proposed K = 21, wall-clock ms), then:

`p50 = percentile(samples, 0.50)`, `p95 = percentile(samples, 0.95)`.

TBD-proposed: record the numbers first; a starting budget of p95 < 500 ms for N = 256 on the CI machine, subject to revision. Do not fail v0.1 CI on latency until the owner accepts a budget (the first runs should print, not gate).

### 7.4 Retained task performance

The task the current stack already measures is error reduction and a verdict, not a SIMA-style 0–100 rubric.

**Proposed default (see Q3):** on a fixture, compare the original and reconstructed points.

- `agreement = (number of points whose verdict and sign-of-Φ class are unchanged) / n`
- when `e0`, `e` are present on the fixture, also `delta_e_rel = 1 − min(1, |Δe − Δe'| / max(|Δe|, ε_stab))`

Report both; the headline score is `agreement` for v0.1. For a Global · misdiagnosis fixture, `agreement` may instead be “snapshot `status` unchanged after reconstruction.” TBD-proposed: lossless agreement = 1.0; bounded agreement TBD after the first numbers.

This is the ROE *pattern* (a gated improvement on measured error). v0.1 must not call the Level 4 loop or write experience rows.

### 7.5 Determinism / verifiability (fifth property)

Same fixture, any row order, two runs: `head_sha256` equal, `verifyChain` ok, and (if anchors are used in the test) the comparison status is not `mismatch`. TBD-proposed: 100% match on fixtures. This reuses M1–M5 proof, including the option to persist and independently anchor a fixture chain in tests only — never with synthetic production data in the live databases.

## 8. Integration points (all additive, all later, Level 4 untouched)

Nothing in this commit wires 4D-SCP into the app. The following are the *only* integration points a later milestone may use, and each must stay additive and flag-gated.

| Point | File / route | How | When |
|---|---|---|---|
| Engine (reuse) | `src/core/compression/**` (public surface `index.ts`: `compressPoints`, `buildTenantChain`, `verifyTenantChain`, `reconstruct`, `planWindows`, types) | SCP compressor/decoder call these from tests/scripts, or later from `src/scp` via type-only or narrow imports of the public surface — never `store.ts` / `source.ts` / `anchor-store.ts` from `src/scp` | v0.1 tests |
| Persist / anchor | `scripts/persist-tenant-segments.ts`, `scripts/anchor-state-chain.ts`, `scripts/sync-state-chains.ts` | Existing CLIs; SCP does not gain write SQL | optional, not v0.1 required |
| Customer proof (future, optional) | `src/app/api/v1/customer-proof/[id]/route.ts` | Same pattern as `state_compression`: additive field, off unless a flag is `"1"`, outside `content_sha256`, must not fail the export | not before v0.2, and only with owner approval |
| Global · misdiagnosis (test environment) | snapshot types + Medicare fixture; pages stay read-only | Tests may import `global-snapshot.ts` (pure, not Level 4) and the Medicare fixture. They must not POST to live APIs or write production DB rows | v0.1 tests |
| Tensor scope / ROE | patterns only | Formulas in §7; no import of `src/lib/level4/**` from `src/scp` | v0.1 |
| Workbench page | none today | A future inspect page would be new and read-only | not v0.1 |
| Level 4 plant, MetamorphicEngine, `metamorphic-runtime.ts`, core run routes | — | **Do not modify. Do not import from `src/scp`.** | never in this programme without an explicit later decision |

Proposed flag for a future edge only: `SHIYAN_SCP=1`.

## 9. v0.1 proof test plan

A later commit, not this one, should add `scripts/check-scp-v01.ts` (or equivalent). Rules:

1. **Fixtures only.** Hand-written points in the test file, and optionally the committed synthetic Medicare fixture / a synthetic Global snapshot. No live Neon, no production `shiyan.experiences`, no invented “realistic” prod-a rows.
2. **Exercise the real engine** on those fixtures (lossless and, separately, bounded). Assert `verifyChain` / `verifyReconstruction`.
3. **Fill `ScpMeasurement`** for ratio, fidelity, latency samples, retained agreement, and determinism (shuffled input order).
4. **Print** the measurement. Gate only the hard invariants (bit-exact lossless, determinism, verify pass). Latency and ratio ceilings stay TBD-proposed until accepted.
5. **Proof.** The test’s chain hashes are the proof for v0.1. Anchoring a fixture in a scratch or ephemeral store is optional; it must not write to production. If a hash is published, it is the fixture chain head, clearly labelled as a test.
6. **Boundary.** `scripts/check-scp-boundary.ts` stays green: `src/scp` still imports no Level 4 / app routes, has no `process.env`, and is imported only from tests/scripts.

## 10. Global · misdiagnosis as the initial test environment

How: treat the vertical as a *labelled source of fixtures and of a retained-performance definition*, not as a production feed.

- **Classification fixture.** Build an `aethel.global.snapshot.v1` from hand-written `GlobalRow` values (the same shape `buildGlobalSnapshot` already accepts). Reconstruct a parallel set of e / Δe / Φ from compressed `(predicted, observed, phi)` if those are encoded, and assert statuses that should be stable. The snapshot module is pure and is not Level 4.
- **Medicare fixture.** Use `fixtures/medicare/sample-rows.json` only if an encoder is defined for those five fields (that mapping is **open**: they are not `(predicted, observed, Φ)`). Until Q2/Q1 are answered, Medicare is a candidate source, not a silent default.
- **What is open:** whether any *recorded* Global snapshot from a running node may be checked in (still not production DB writes); whether Medicare rows should be encoded at all in v0.1; whether “misdiagnosis rejected” has a compression-specific meaning beyond the existing classification.

Guardrail, copied from the existing vertical: a well-formed snapshot or a detected Medicare pattern is not a clinical diagnosis and not a finding of fraud.

## 11. Path to a hardware research proposition (three layers)

These are research layers, not a shipping chip plan. **Hardware claims are hypotheses** until a named evidence gate is actually met.

| Layer | What it is | Evidence gate (required before talking about the next layer) |
|---|---|---|
| **1. Software reference** (v0.1–v0.2) | This spec, the existing compression engine, fixture measurements, hash-chained proofs | Reproducible `ScpMeasurement` on committed fixtures; lossless fidelity and determinism pass; design reviewed; Level 4 still untouched |
| **2. Emulation** (v0.3) | A bit-accurate or operator-accurate model of the encode/compress/verify data path (FPGA-style or a cycle/cost model in software), plus a cost model (area/LUT/memory/energy *estimates*, labelled as estimates) | Bit-exact agreement with Layer 1 hashes on the same fixtures *or* a documented, bounded divergence; published cost model with assumptions; no claim of a fabricated device |
| **3. Hardware research proposition** (v0.4) | A written proposition: what could be specialized (e.g. XOR-delta float coding, Merkle hashing, window seal), what remains in software, predicted cost/latency, and what would falsify the claim | Layer 2 evidence plus an explicit threat/assumption list. Still not a product, not a medical device, not a measured silicon result unless a later, separate programme produces one |

Honesty: this repo has no FPGA sources, no HDL, and no lab measurements. Crossing from Layer 1 to 2 is a new body of work. Crossing from 2 to 3 is a paper-grade claim, not an implementation milestone in this codebase.

## 12. Milestones

| Version | Intent | Exit |
|---|---|---|
| **v0.1** (this path’s first implementation milestone) | Software proof on fixtures: ratio, fidelity, latency (reported), retained agreement, determinism. Stubs become a thin wrapper over the existing engine, still unwired from app/Level 4. | `check-scp-v01` + boundary green; thresholds accepted or still explicitly TBD |
| **v0.2** | Optional read-only surface (flag-gated export field and/or inspect page). Still no Level 4 edits. | Additive, off by default, existing export bytes unchanged when the flag is off |
| **v0.3** | Layer 2 emulation + cost model against Layer 1 hashes | Documented model; fixture hash agreement or bounded, explained diffs |
| **v0.4** | Hardware research proposition (writing and evidence, not a tape-out) | Proposition reviewed; claims labelled as hypotheses |

## 13. Risks

- **Axis confusion.** Treating X/Y/Z as spatial when the only real data is `(predicted, observed, Φ)` would invent coordinates. v0.1 uses an explicit mapping (Q1).
- **Duplicate engine.** A second compressor would diverge hashes and break proof. Wrappers must call M1–M5.
- **Level 4 coupling.** Importing tensor/ROE/plant modules from `src/scp` would violate the isolation constraint. Pattern reuse only.
- **Production data.** Using live tenant rows or fabricating “prod-like” runs would violate the no-synthetic-production-data rule. Fixtures only, until the owner says otherwise.
- **Latency gates.** Timing in CI is noisy. Do not fail the build on p95 until a budget is accepted.
- **Over-claiming hardware.** Layer 3 language can outrun evidence. Keep hypotheses labelled.
- **Scope creep into routes.** Wiring a page before v0.1 measurements exist would mix product surface with an unproven wrapper.

## 14. Open questions for the owner

1. Should v0.1 map X/Y/Z/T onto the existing `(predicted, observed, Φ, t)` axes, or do you want literal spatial coordinates from a source that is not in the repo today?
2. As the initial test environment, may v0.1 use only committed fixtures (hand-written Global snapshot rows and/or `fixtures/medicare/sample-rows.json`), and never production `shiyan.experiences` or live Medicare/CMS data?
3. For “retained task performance”, is the intended score (a) unchanged replay verdict / Φ class, (b) unchanged Global snapshot status, (c) an ROE-style `I_t` on reconstructed `Δe`, or (d) something else you will define?
4. May later SCP implementation files import the public surface of `src/core/compression` (including type-only imports), or must `src/scp` stay import-free with all engine calls only in `scripts/` / tests?
5. If a read-only surface is wanted after v0.1, should it be an additive field on `GET /api/v1/customer-proof/{id}`, a workbench inspect page, both, or neither until you say so?
6. Confirm that the fifth measurable property is determinism / verifiability via the existing hash chain (the v0.1 request listed four operational metrics; this spec added the fifth for the reason in §7).
7. For Layer 2, do you want a bit-accurate (FPGA-style) arithmetic model, a cost/latency model only, or both?
8. Is there an external document called “Tensor Scope” or “Return on Evidence” we should follow? In this repository, Tensor Scope is `src/lib/level4/tensor.ts` and ROE is the Reciprocal Optimization Engine (`src/lib/level4/roe.ts`).
