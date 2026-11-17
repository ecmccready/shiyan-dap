# 4D State Compression Processor (4D-SCP): architecture

Status: **accepted v0.1 decisions (2026-11-17) plus isolated stubs and the fixture-only software-proof check** `scripts/check-scp-v01.ts`. No route, CLI, or Level 4 module imports `src/scp`. Nothing here is live on https://shiyan-dap.vercel.app. The check is a thin wrapper over the existing engine; it does not change production behaviour or claim hardware results. No read-only surface until v0.1 passes (decision 5).

Inventory date: 2026-11-17, repo `main`. Exact in-tree names and paths are in §1. The eight owner questions and their accepted answers are in §14 (history preserved).

## 1. Purpose and scope

**Purpose.** Define a 4D State Compression Processor that sits on top of the existing 4D state compression engine (`src/core/compression/**`, M1–M5) and measures whether a compact, reconstructable, hash-chained representation of agent/system state preserves what the rest of Aethel Node already verifies: predicted vs observed values, Φ, a replay verdict, and (when a later milestone asks for it) a task score in the style of the Reciprocal Optimization Engine.

**Inspiration, stated honestly.** The compression engine already records what we borrow from SIMA 2: a compact, scored experience bank that later learning can read (`docs/design/4d-state-compression.md` §1). SIMA 2 does not describe a “4D-SCP” or a hardware processor. Those names, the X/Y/Z/T vocabulary, and the three-layer physical path are ours. We do not train models here.

**Scope of this document and of `src/scp/` today.**

- In: architecture, TypeScript interfaces, a not-implemented reference that throws, a boundary check, a v0.1 fixture proof (`scripts/check-scp-v01.ts`) that calls the existing engine from the test script, and the accepted decisions in §14.
- Out: any compressor reimplementation inside `src/scp`; any import from `src/app/**` or `src/lib/level4/**`; any new production data; any change to `MetamorphicEngine`, `metamorphic-runtime.ts`, or the Level 4 plant; any hardware claim presented as a result; any read-only product surface (decision 5).

**v0.1 (first milestone) is a software proof** that measures compression ratio, fidelity, latency, retained task performance, and determinism/verifiability (see §7). Fixtures only in tests. Proposed pass thresholds are stated in §7 and in the check script.

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

**Default mapping for v0.1 (accepted 2026-11-17, decision 1):** `X = predicted`, `Y = observed`, `Z = phi`, `T = t`. This uses existing data, stays compatible with M1–M5, and treats X/Y/Z as **feature axes**, not literal metres. Literal spatial coordinates are deferred until a later encoder is defined.

**Other real vectors in the repo that are *not* used by the compression engine today** (not used as the v0.1 default):

- Level 4 demo sensor tensor `[completeness, contradiction, missing, independent_check]` — a 4-D feature vector, still not spatial; lives under Level 4, so `src/scp` must not import it.
- Global snapshot `(final_e, delta_e, phi, verified_at)` — a run summary, not a per-step frame.
- Medicare fixture rows — five administrative fields, **no coordinates**.

**Literal spatial embedding** (lat/lon/height, a plant layout, a 3D world pose) is out of scope for v0.1. No such fields were found in the Medicare fixture, the Global snapshot schema, or `StateVector`. If they appear later, they belong in an explicit new encoder, not in silent default values.

`ScpFrame` in `src/scp/types.ts` therefore names `x, y, z, t` as numbers plus optional `source` identity. Encoders document their mapping. There is no hidden fill-in of zeros for missing spatial axes.

## 5. Component architecture (interfaces)

Stubs: `src/scp/types.ts` (interfaces plus a pure `frameFromStateVector` mapping helper; type-only import of `StateVector` from the compression public surface), `src/scp/not-implemented.ts` (throws a clear error), `src/scp/index.ts` (re-exports). Imported by nothing in `src/app/**` or Level 4. Runtime engine calls stay in `scripts/check-scp-v01.ts` (and other tests), not in `src/scp`.

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

The v0.1 request named four operational metrics: compression ratio, fidelity, latency, retained task performance. The fifth property is **determinism / verifiability via the hash chain** (accepted 2026-11-17, decision 6), because that is already how this stack proves a sealed trajectory and because a “processor” proof without a stable hash is not checkable.

Proposed pass thresholds below are the criteria `scripts/check-scp-v01.ts` gates on, except latency (reported, with a generous hang bound only).

### 7.1 Compression ratio

Let `raw_bytes` be the UTF-8 byte length of `record_json` for the rows included in sealed windows (the bytes the engine already hashes as `content_sha256`). Let `compressed_bytes` be the UTF-8 byte length of `canonical(segment)` (the same text `segment_sha256` hashes), summed over sealed segments. Pending points are reported separately and are not counted as compressed. The v0.1 check uses this definition exclusively.

`compression_ratio = raw_bytes / compressed_bytes`  (dimensionless; greater than 1 means shrinkage).

Also report `bytes_per_point = compressed_bytes / sealed_point_count`. **Pass threshold (lossless):** fidelity exact (see §7.2) and the ratio is reported. There is no hard ratio ceiling in v0.1; a ratio below 1.0 is printed, not failed, so a small or incompressible fixture cannot flake the proof. The number is still part of the `ScpMeasurement` record.

### 7.2 Fidelity / reconstruction error

- Lossless: `verifyReconstruction` must pass; every reconstructed `predicted`, `observed`, `phi`, `t`, `step`, `verdict` is bit-identical (or, for floats, the same IEEE-754 value the engine already uses).
- Bounded: for each axis `a ∈ {predicted, observed, phi}`, `max |a − a'| ≤ eps_a`, as the engine already records in `max_abs_err`.
- Optional tensor-scope-style check (pattern only): `d = sqrt(Σ_i (out_i − ref_i)²)` on a declared vector, pass iff `d ≤ ε`. This is the same idea as Frobenius distance on a 1-D flattening; SCP tests may implement it locally.

**Pass thresholds:** lossless fixtures 100% bit-exact; bounded fixtures 100% within the declared eps (`max_abs_err[a] ≤ eps[a]` for `predicted`, `observed`, `phi`; `t`, `step`, and verdict stay exact). The v0.1 bounded fixture uses `eps = { predicted: 0.001, observed: 0.001, phi: 0.0001 }`.

### 7.3 Latency (p50 / p95)

Measured only in the test or CLI harness (clocks are not allowed inside `src/core/compression/**` or `src/scp/**`). For a fixed fixture of N points (N = 256, the default window size), run encode + compress + verify K times (K = 21, wall-clock ms), then:

`p50 = percentile(samples, 0.50)`, `p95 = percentile(samples, 0.95)` (nearest-rank: `ceil(p · K) − 1`, clamped).

**Pass threshold:** report p50 and p95. Do not hard-fail on an absolute performance budget. The check fails only if p95 ≥ 30_000 ms, a generous hang detector, not an SLA. A future tighter budget (for example p95 < 500 ms) needs an explicit later acceptance.

### 7.4 Retained task performance

The task the current stack already measures is error reduction and a verdict, not a SIMA-style 0–100 rubric.

**Accepted definition (decision 3, 2026-11-17):** retained task performance is **unchanged replay verdict / Φ class plus unchanged Global snapshot status**.

On a fixture, compare the original and reconstructed points:

- `agreement_verdict_phi = (number of points whose verdict and sign-of-Φ class are unchanged) / n`, where Φ class is `sign(phi)` (`−1` / `0` / `+1`)
- `agreement_snapshot = (number of runs whose `buildGlobalSnapshot` `status` is unchanged) / n_runs`

The fixture rule used to derive snapshot rows from a point (hand-written, not a production feed) is: `eligible = (verdict === "PASS" && phi > 0)`, `state = (verdict === "INCONCLUSIVE" ? "CONTINUE" : "COMPLETE")`, `e = |predicted − observed|`. The snapshot module is called from the test script only.

The headline `score` is `min(agreement_verdict_phi, agreement_snapshot)`. **Pass threshold:** score = 1.0 for both lossless and the v0.1 bounded fixture (Φ values are kept well above `eps.phi` so signs cannot flip; verdicts stay lossless in both modes).

This is the ROE *pattern* (a gated improvement on measured error). v0.1 must not call the Level 4 loop or write experience rows.

### 7.5 Determinism / verifiability (fifth property)

Same fixture, any row order, two runs: `head_sha256` equal, `verifyChain` ok, and (if anchors are used in the test) the comparison status is not `mismatch`. **Pass threshold:** 100% match on fixtures (`verifyChain` / `verifyTenantChain` / `verifyReconstruction` pass; shuffled input and a repeated run produce the same head). This reuses M1–M5 proof. v0.1 does not persist or anchor the fixture chain. Never write synthetic production data to the live databases.

## 8. Integration points (all additive, all later, Level 4 untouched)

Nothing in this commit wires 4D-SCP into the app. The following are the *only* integration points a later milestone may use, and each must stay additive and flag-gated.

| Point | File / route | How | When |
|---|---|---|---|
| Engine (reuse) | `src/core/compression/**` (public surface `index.ts`: `compressPoints`, `buildTenantChain`, `verifyTenantChain`, `reconstruct`, `planWindows`, types) | Runtime calls from tests/scripts only. `src/scp` may use type-only imports of the public surface (`index.ts` / `types.ts`) — never runtime imports, and never `store.ts` / `source.ts` / `anchor-store.ts` (decision 4) | v0.1 tests |
| Persist / anchor | `scripts/persist-tenant-segments.ts`, `scripts/anchor-state-chain.ts`, `scripts/sync-state-chains.ts` | Existing CLIs; SCP does not gain write SQL | optional, not v0.1 required |
| Customer proof (future, optional) | `src/app/api/v1/customer-proof/[id]/route.ts` | Same pattern as `state_compression`: additive field, off unless a flag is `"1"`, outside `content_sha256`, must not fail the export | not before v0.2, and only with owner approval |
| Global · misdiagnosis (test environment) | snapshot types; pages stay read-only | The v0.1 check imports `global-snapshot.ts` (pure, not Level 4) and builds hand-written `GlobalRow` values from the committed experience fixture. It does not encode the Medicare fixture (no `(predicted, observed, Φ)` mapping). Tests must not POST to live APIs or write production DB rows | v0.1 tests |
| Tensor scope / ROE | patterns only | Formulas in §7; no import of `src/lib/level4/**` from `src/scp` | v0.1 |
| Workbench page | none today | A future inspect page would be new and read-only | not v0.1 |
| Level 4 plant, MetamorphicEngine, `metamorphic-runtime.ts`, core run routes | — | **Do not modify. Do not import from `src/scp`.** | never in this programme without an explicit later decision |

Proposed flag for a future edge only: `SHIYAN_SCP=1`.

## 9. v0.1 proof test plan

Implemented as `scripts/check-scp-v01.ts`. Rules:

1. **Fixtures only** (decision 2). Hand-written points in the test file, plus hand-written Global snapshot rows derived from those points by the documented fixture rule. No live Neon, no production `shiyan.experiences`, no invented “realistic” prod-a rows, no Medicare encoder in v0.1.
2. **Exercise the real engine** on those fixtures (lossless and, separately, bounded). Assert `verifyChain` / `verifyTenantChain` / `verifyReconstruction`. Runtime calls stay in the script, not in `src/scp`.
3. **Fill `ScpMeasurement`** for ratio, fidelity, latency samples, retained agreement, and determinism (shuffled input order and a repeated run).
4. **Print** the measurement. Gate the proposed pass thresholds in §7 (bit-exact lossless, bounded error ≤ eps, retained score = 1.0, determinism). Latency is reported; fail only on the generous hang bound. Ratio is reported with no ceiling.
5. **Proof.** The test’s chain hashes are the proof for v0.1. Anchoring a fixture in a scratch or ephemeral store is optional and is not done in v0.1; it must not write to production. If a hash is published, it is the fixture chain head, clearly labelled as a test.
6. **Boundary.** `scripts/check-scp-boundary.ts` stays green: `src/scp` still imports no Level 4 / app routes, has no `process.env`, allows type-only public-surface imports only, and is imported only from tests/scripts.

## 10. Global · misdiagnosis as the initial test environment

How: treat the vertical as a *labelled source of fixtures and of a retained-performance definition*, not as a production feed.

- **Classification fixture.** Build an `aethel.global.snapshot.v1` from hand-written `GlobalRow` values (the same shape `buildGlobalSnapshot` already accepts). Reconstruct a parallel set of e / Δe / Φ from compressed `(predicted, observed, phi)` if those are encoded, and assert statuses that should be stable. The snapshot module is pure and is not Level 4.
- **Medicare fixture.** Not used in v0.1. The five administrative fields are not `(predicted, observed, Φ)` (decisions 1 and 2). A later encoder would be required before those rows could be compressed.
- **Recorded snapshots from a running node** are still out of scope (decision 2: committed fixtures only, never production). “Misdiagnosis rejected” keeps its existing classification meaning; v0.1 does not add a compression-specific redefinition.

Guardrail, copied from the existing vertical: a well-formed snapshot or a detected Medicare pattern is not a clinical diagnosis and not a finding of fraud.

## 11. Path to a hardware research proposition (three layers)

These are research layers, not a shipping chip plan. **Hardware claims are hypotheses** until a named evidence gate is actually met.

| Layer | What it is | Evidence gate (required before talking about the next layer) |
|---|---|---|
| **1. Software reference** (v0.1–v0.2) | This spec, the existing compression engine, fixture measurements, hash-chained proofs | Reproducible `ScpMeasurement` on committed fixtures; lossless fidelity and determinism pass; design reviewed; Level 4 still untouched |
| **2. Emulation** (v0.3) | A **cost/latency model first** (decision 7); a bit-accurate (FPGA-style) arithmetic model may follow later. Cost figures (area/LUT/memory/energy) are *estimates* and must be labelled as estimates | Documented cost/latency model with assumptions, compared against Layer 1 fixture measurements; a later bit-accurate model must agree with Layer 1 hashes or document a bounded divergence; no claim of a fabricated device |
| **3. Hardware research proposition** (v0.4) | A written proposition: what could be specialized (e.g. XOR-delta float coding, Merkle hashing, window seal), what remains in software, predicted cost/latency, and what would falsify the claim | Layer 2 evidence plus an explicit threat/assumption list. Still not a product, not a medical device, not a measured silicon result unless a later, separate programme produces one |

Honesty: this repo has no FPGA sources, no HDL, and no lab measurements. Crossing from Layer 1 to 2 is a new body of work. Crossing from 2 to 3 is a paper-grade claim, not an implementation milestone in this codebase.

## 12. Milestones

| Version | Intent | Exit |
|---|---|---|
| **v0.1** (this path’s first implementation milestone) | Software proof on fixtures: ratio, fidelity, latency (reported), retained agreement, determinism. The test script is the thin wrapper over the existing engine; `src/scp` stubs stay unwired from app/Level 4. | `check-scp-v01` + boundary green against the proposed pass thresholds in §7 |
| **v0.2** | Optional read-only surface, only after v0.1 passes (decision 5). Still no Level 4 edits. Which surface (export field, inspect page, both, or neither) is decided later. | Additive, off by default, existing export bytes unchanged when the flag is off |
| **v0.3** | Layer 2 cost/latency model first, bit-accurate model later, against Layer 1 measurements | Documented model; later bit-accurate work agrees with Layer 1 hashes or explains bounded diffs |
| **v0.4** | Hardware research proposition (writing and evidence, not a tape-out) | Proposition reviewed; claims labelled as hypotheses |

## 13. Risks

- **Axis confusion.** Treating X/Y/Z as spatial when the only real data is `(predicted, observed, Φ)` would invent coordinates. v0.1 uses the accepted mapping in §4 (decision 1).
- **Duplicate engine.** A second compressor would diverge hashes and break proof. Wrappers must call M1–M5.
- **Level 4 coupling.** Importing tensor/ROE/plant modules from `src/scp` would violate the isolation constraint. Pattern reuse only.
- **Production data.** Using live tenant rows or fabricating “prod-like” runs would violate the no-synthetic-production-data rule. Fixtures only, until the owner says otherwise.
- **Latency gates.** Timing in CI is noisy. v0.1 reports p50/p95 and fails only on the generous hang bound in §7.3.
- **Over-claiming hardware.** Layer 3 language can outrun evidence. Keep hypotheses labelled.
- **Scope creep into routes.** Wiring a page before v0.1 measurements exist would mix product surface with an unproven wrapper.

## 14. Decisions (accepted 2026-11-17)

The owner accepted the recommended defaults for the eight questions below. This section is the record of those answers. The original wording is kept under “History” so the questions are not silently rewritten.

1. **Axes.** v0.1 maps `X = predicted`, `Y = observed`, `Z = Φ`, `T = t`. Literal spatial coordinates are deferred until a later encoder is defined.
2. **Fixtures.** v0.1 uses committed fixtures only, never production `shiyan.experiences` or live Medicare/CMS data. The software proof uses a hand-written experience fixture and Global snapshot rows derived from it. The Medicare fixture is not encoded in v0.1 (those rows are not `(predicted, observed, Φ)`).
3. **Retained task performance.** The score is unchanged replay verdict / Φ class **plus** unchanged Global snapshot status, as defined in §7.4.
4. **Imports.** `src/scp` may use type-only imports from the compression engine’s public surface (`src/core/compression/index.ts` and `types.ts`). Runtime engine calls stay in scripts and tests. Writers (`store.ts`, `source.ts`, `anchor-store.ts`) must not be imported from `src/scp`, even as types. Enforced by `scripts/check-scp-boundary.ts`.
5. **Surface.** No read-only product surface until v0.1 passes. A later v0.2 choice (export field, inspect page, both, or neither) still needs a separate approval.
6. **Fifth property.** Determinism / verifiability via the existing hash chain, as in §7.5.
7. **Layer 2.** Cost/latency model first; a bit-accurate model may follow later (§11).
8. **External docs.** No external “Tensor Scope” or “Return on Evidence” document is in force. Follow the in-repo definitions: Tensor Scope is `src/lib/level4/tensor.ts`; ROE is the Reciprocal Optimization Engine (`src/lib/level4/roe.ts`).

### History — questions as asked (before 2026-11-17)

1. Should v0.1 map X/Y/Z/T onto the existing `(predicted, observed, Φ, t)` axes, or do you want literal spatial coordinates from a source that is not in the repo today?
2. As the initial test environment, may v0.1 use only committed fixtures (hand-written Global snapshot rows and/or `fixtures/medicare/sample-rows.json`), and never production `shiyan.experiences` or live Medicare/CMS data?
3. For “retained task performance”, is the intended score (a) unchanged replay verdict / Φ class, (b) unchanged Global snapshot status, (c) an ROE-style `I_t` on reconstructed `Δe`, or (d) something else you will define?
4. May later SCP implementation files import the public surface of `src/core/compression` (including type-only imports), or must `src/scp` stay import-free with all engine calls only in `scripts/` / tests?
5. If a read-only surface is wanted after v0.1, should it be an additive field on `GET /api/v1/customer-proof/{id}`, a workbench inspect page, both, or neither until you say so?
6. Confirm that the fifth measurable property is determinism / verifiability via the existing hash chain (the v0.1 request listed four operational metrics; this spec added the fifth for the reason in §7).
7. For Layer 2, do you want a bit-accurate (FPGA-style) arithmetic model, a cost/latency model only, or both?
8. Is there an external document called “Tensor Scope” or “Return on Evidence” we should follow? In this repository, Tensor Scope is `src/lib/level4/tensor.ts` and ROE is the Reciprocal Optimization Engine (`src/lib/level4/roe.ts`).
