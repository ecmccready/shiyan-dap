# 4D State Compression Processor (4D-SCP): architecture

Status: **v0.1 fixture proof plus v0.1.1–v0.1.8 size, software-cost, Layer 2 analytical hardware-cost model, divider-free variants, a bit-accurate integer-only golden model, (v0.1.9) the isolated subsystem with a four-strategy proof bench, (v0.1.10) the integer scp4d golden model, and (v0.1.11) a simulated RTL decoder for the temporal-only path in `hw/scp4d/`** (`scripts/check-scp-v01.ts` … `scripts/check-scp-v0111-rtl.ts`; all at once: `scripts/check-scp-all.ts`; v0.1.9 is §16, v0.1.10 §17, v0.1.11 §18). No route, CLI, or Level 4 module imports `src/scp`. Nothing here is live on https://shiyan-dap.vercel.app. The stored chain format, `src/scp/pack.ts`, and v0.1 hashes are unchanged. No read-only surface (decision 5 / v0.2 still needs a separate approval). Area and energy figures in §11.2–§11.5 are parameterized estimates, not measured silicon or an FPGA result.

Inventory date: 2026-11-17, repo `main`. Exact in-tree names and paths are in §1. The eight owner questions and their accepted answers are in §14 (history preserved).

## 1. Purpose and scope

**Purpose.** Define a 4D State Compression Processor that sits on top of the existing 4D state compression engine (`src/core/compression/**`, M1–M5) and measures whether a compact, reconstructable, hash-chained representation of agent/system state preserves what the rest of Aethel Node already verifies: predicted vs observed values, Φ, a replay verdict, and (when a later milestone asks for it) a task score in the style of the Reciprocal Optimization Engine.

**Inspiration, stated honestly.** The compression engine already records what we borrow from SIMA 2: a compact, scored experience bank that later learning can read (`docs/design/4d-state-compression.md` §1). SIMA 2 does not describe a “4D-SCP” or a hardware processor. Those names, the X/Y/Z/T vocabulary, and the three-layer physical path are ours. We do not train models here.

**Scope of this document and of `src/scp/` today.**

- In: architecture, TypeScript interfaces, a not-implemented reference that throws, a boundary check, a v0.1 fixture proof (`scripts/check-scp-v01.ts`), v0.1.1–v0.1.8 size, software-cost, analytical hardware-cost, divider-free variant, and integer-only golden-model work (`scripts/check-scp-v011.ts` through `scripts/check-scp-v018.ts`, plus `scripts/scp-v014-ops.ts`, `scripts/scp-v015-cost-model.ts`, `scripts/scp-v016-recip.ts`, `scripts/scp-v017-exact-recip.ts`, and `scripts/scp-v018-integer-model.ts`), golden vectors at `fixtures/scp/golden-vectors.json` (tests only), pure measured packing helpers in `src/scp/pack.ts` (not the stored format; unchanged in v0.1.6–v0.1.8), and the accepted decisions in §14.
- Out: any replacement of the stored chain encoder; any import from `src/app/**` or `src/lib/level4/**`; any new production data; any change to `MetamorphicEngine`, `metamorphic-runtime.ts`, or the Level 4 plant; any hardware claim presented as a result; any read-only product surface (decision 5).

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

The v0.1 ratio versus `record_json` is dominated by JSON envelope overhead (the experience record, not the 4D state). v0.1.1 reports additional baselines and an honest headline in §7.6 / §15. The stored `canonical(segment)` definition above is unchanged, and so are the v0.1 chain hashes.

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

### 7.6 Defensible size baselines (v0.1.1)

`scripts/check-scp-v011.ts` keeps the v0.1 engine format and hashes and reports every encoding against four baselines, using the same ratio convention (`baseline_bytes / encoding_bytes`, greater than 1 means smaller than that baseline):

| Id | Baseline | Definition |
|---|---|---|
| (a) | raw JSON | UTF-8 `record_json` of included fixture rows (same as v0.1 `raw_bytes`) |
| (b) | compact binary | Fixed-width packing of the same 4D points: float64 `x,y,z` + int64 `t` + int32 `step` + a verdict byte (`src/scp/pack.ts`, magic `SCPB`) |
| (c) | gzip(JSON) | `zlib.gzipSync` of the concatenated `record_json` bytes, level 9, MTIME=0, OS=0xff (deterministic) |
| (d) | gzip(SCP canonical) | The same gzip of `canonical(segment)` for the stored engine form |

The **honest headline** is the encoding versus the **best general-purpose baseline**, `min((b), (c))` — not versus raw JSON. gzip of an encoding itself (including gzip of (b) and gzip of the quantized variant) is reported as an extra, not as the named headline baseline.

A **measured quantized compact encoding** (magic `SCPQ` in `src/scp/pack.ts`) is also reported: `q = round(v / eps)`, `v' = q * eps`, then zigzag-delta varints for `t`, `step`, and the three quantized axes, plus a verdict byte. It is a measurement variant only. It must not be written to `shiyan.state_segments`, and it must not change `segment_sha256` or engine behaviour.

**Pass thresholds (v0.1.1):** v0.1 engine heads unchanged; lossless engine fidelity exact; bounded engine and quantized variant `max_abs_err ≤ eps`; retained score = 1.0; binary baseline bit-exact; quantized and baseline hashes identical across repeated runs and shuffled rows in canonical point order. Ratios are reported, not gated on beating a baseline.

**Results on the committed 256-point v0.1 fixture** (bytes are exact; ratios to 4 decimals). Engine chain heads are the v0.1 values: lossless `36b67ee814ccf664c5fac0c80488e793ae59808f2712b6035d5a3e6883a1f6f5`, bounded `f286cf831a4bdcbc60a454335405ddd967671173fba75368b0d9d54f595d46bb`. Quantized sha256 `07a3d04147714747a4823e6e934dc6144740eb2f6243e7113106aed06369d6bc`. Binary sha256 `26be17586ff79c3568e96a05ab858b6f9816922cacdf986c5f1f06ec853fea15`.

| Item | Bytes |
|---|---:|
| (a) raw JSON | 227075 |
| (b) compact binary | 9481 |
| (c) gzip(JSON), level 9 | 10063 |
| (d) gzip(SCP lossless canonical) | 2651 |
| (d) gzip(SCP bounded canonical) | 1746 |
| gzip(quantized) (extra) | 115 |
| gzip(binary) (extra) | 4589 |
| Best general-purpose baseline, min((b),(c)) | **9481 (compact binary)** |

| Encoding | Bytes | vs raw JSON | vs binary | vs gzip-JSON | vs gzip(SCP canonical) | Fidelity | Retained |
|---|---:|---:|---:|---:|---:|---|---:|
| Engine lossless canonical (stored) | 17676 | 12.8465 | 0.5364 | 0.5693 | 0.1500 | exact | 1.0 |
| Engine bounded canonical (stored) | 17873 | 12.7049 | 0.5305 | 0.5630 | 0.0977 | max_abs_err ≤ eps | 1.0 |
| Quantized compact (measured, not stored) | 2551 | 89.0141 | 3.7166 | 3.9447 | 0.6844 | max_abs_err ≤ eps | 1.0 |

Latency (harness only, N=256, K=21, hang bound 30_000 ms; one run on the check machine, not an SLA): engine lossless p50 11.202 ms / p95 14.533 ms; engine bounded p50 10.909 ms / p95 11.984 ms; quantized encode+decode p50 0.421 ms / p95 0.732 ms. Re-runs will move these clock numbers slightly.

Bounded max_abs_err on this fixture (engine and quantized agree): `x = 3.552713678800501e-15`, `y = 0.00044444444444557973`, `z = 1.1102230246251565e-16`, with `eps = { predicted: 0.001, observed: 0.001, phi: 0.0001 }`.


### 7.7 Stress measurement (v0.1.2)

`scripts/check-scp-v012.ts` re-runs the v0.1.1 encodings and baselines on four fixtures, without changing the stored chain format or the v0.1 heads. gzip(binary) is a first-class general-purpose baseline (in v0.1.1 it was an extra). The best general-purpose baseline is `min(compact binary, gzip(JSON), gzip(binary))`.

**Fixtures.**

| Id | Source | N | Notes |
|---|---|---:|---|
| v0.1 | Hand-written `scp-v01-fixture` | 256 | Same regular fixture as v0.1 / v0.1.1; engine heads frozen |
| A | `fixtures/medicare/sample-rows.json` | 6 | SYNTHETIC, test-only mapping below. Too few to stress size; **not padded** |
| B256 | Seeded PRNG | 256 | mulberry32 seed `20261117`, Box–Muller gaussian, random walk + jumps |
| B4096 | Same generator and seed | 4096 | B256 is the prefix of this series |

**Fixture A mapping** (TEST-ONLY, SYNTHETIC; not a production encoder, not CMS data, not a clinical or fraud finding): `predicted = avg_submitted_charge`, `observed = avg_medicare_payment`, `phi = (observed − predicted) / max(|predicted|, 1)`, `t = Date.parse(retrieved_at) + i × 1000`, `step = i`, verdict = empty `hcpcs_code` → `INCONCLUSIVE`; `observed < 0` or `observed > predicted` → `FAIL`; else `PASS`.

**Fixture B algorithm.** Start `predicted=1`, `observed=1`, `phi=0.5`, `t=T0`. For `i>0`: `predicted += 0.01 N(0,1)` and a ±0.5 jump every 37th step; `observed = predicted + 0.05 N(0,1)` and a ±2.0 outlier every 53rd step; `phi += 0.002 N(0,1)`, then if `|phi| < 0.05` push to `sign(phi)×0.05` so quantization cannot flip the Φ class; `t += 1000` ms, plus an extra 3_600_000 ms with probability 0.02. Verdict from one uniform: `u<0.15` FAIL, `u<0.25` INCONCLUSIVE, else PASS.

**Pass thresholds (v0.1.2):** fidelity (lossless bit-exact; bounded and quantized `max_abs_err ≤ eps`; binary bit-exact), retained score = 1.0, determinism (repeat + shuffled rows in canonical order), v0.1 engine heads unchanged, latency p95 under the 30_000 ms hang bound. Ratios are reported, not asserted. If quantized is larger than compact binary on a fixture, that is printed honestly and is not a failure.

**Results** (bytes exact; ratios to 4 decimals). One run of the check harness; latency will move slightly on re-runs.

Baselines (bytes):

| Fixture | N | raw JSON | compact binary | gzip(JSON) | gzip(binary) | gzip(SCP lossless) | gzip(SCP bounded) | gzip(quantized) | Best GP |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| v0.1 | 256 | 227075 | 9481 | 10063 | 4589 | 2651 | 1746 | 115 | gzip(binary) 4589 |
| A-medicare | 6 | 5074 | 231 | 770 | 159 | 375 | 420 | 126 | gzip(binary) 159 |
| B256 | 256 | 243638 | 9481 | 18164 | 7417 | 6433 | 2087 | 991 | gzip(binary) 7417 |
| B4096 | 4096 | 3911822 | 151561 | 278510 | 118686 | 98490 | 26877 | 13511 | gzip(binary) 118686 |

Encodings (ratio = baseline / encoding; >1 means smaller than that baseline):

| Fixture | Encoding | Bytes | vs raw JSON | vs binary | vs gzip-JSON | vs gzip-binary | vs gzip(SCP canonical) | Fidelity | Retained |
|---|---|---:|---:|---:|---:|---:|---:|---|---:|
| v0.1 | stored lossless | 17676 | 12.8465 | 0.5364 | 0.5693 | 0.2596 | 0.1500 | exact | 1.0 |
| v0.1 | stored bounded | 17873 | 12.7049 | 0.5305 | 0.5630 | 0.2568 | 0.0977 | ≤ eps | 1.0 |
| v0.1 | quantized compact | 2551 | 89.0141 | 3.7166 | 3.9447 | 1.7989 | 0.6844 | ≤ eps | 1.0 |
| A-medicare | stored lossless | 745 | 6.8107 | 0.3101 | 1.0336 | 0.2134 | 0.5034 | exact | 1.0 |
| A-medicare | stored bounded | 895 | 5.6693 | 0.2581 | 0.8603 | 0.1777 | 0.4693 | ≤ eps | 1.0 |
| A-medicare | quantized compact | 117 | 43.3675 | 1.9744 | 6.5812 | 1.3590 | 3.5897 | ≤ eps | 1.0 |
| B256 | stored lossless | 17564 | 13.8714 | 0.5398 | 1.0342 | 0.4223 | 0.3663 | exact | 1.0 |
| B256 | stored bounded | 17562 | 13.8730 | 0.5399 | 1.0343 | 0.4223 | 0.1188 | ≤ eps | 1.0 |
| B256 | quantized compact | 1970 | 123.6741 | 4.8127 | 9.2203 | 3.7650 | 1.0594 | ≤ eps | 1.0 |
| B4096 | stored lossless | 275293 | 14.2097 | 0.5505 | 1.0117 | 0.4311 | 0.3578 | exact | 1.0 |
| B4096 | stored bounded | 275201 | 14.2144 | 0.5507 | 1.0120 | 0.4313 | 0.0977 | ≤ eps | 1.0 |
| B4096 | quantized compact | 30729 | 127.3007 | 4.9322 | 9.0634 | 3.8623 | 0.8746 | ≤ eps | 1.0 |

Latency (K=21, hang bound 30_000 ms; one later run of the same check, not an SLA): v0.1 engine p95 ≈ 15–20 ms; A p95 < 1 ms; B256 engine p95 ≈ 18 ms; B4096 engine p95 ≈ 210 ms; quantized encode+decode p95 ≈ 1 ms (v0.1 / B256), ≈ 9 ms (B4096).

On fixture A, gzip(quantized) is 126 B against a 117 B payload (gzip expanded a tiny buffer). That is expected and is not a ratio gate.


### 7.8 Fair lossy baselines (v0.1.3)

v0.1.2 compared the *lossy* quantized compact encoding to *lossless* baselines, so part of the reported gain was simply allowing `eps` error. `scripts/check-scp-v013.ts` adds same-eps baselines and splits the gain. The stored chain format and v0.1 hashes are unchanged.

| Id | Baseline | Definition |
|---|---|---|
| (a) int codes (`SCQI`) | The same `q = round(v / eps)` as the compact encoding, packed as fixed-width little-endian int32 (or int64 if a code does not fit int32). No delta, no varint. `t` / step / verdict stay lossless. |
| (a) rounded float64 (`SCQF`) | The same `v' = q * eps`, stored as float64 (plus `t` / step / verdict). Shows that quantization alone does not shrink a float64 packing. |
| (b) gzip of (a) | `zlib.gzipSync` level 9, MTIME=0, OS=0xff, of `SCQI` and of `SCQF` |
| (c) brotli of (a) and of compact | `zlib.brotliCompressSync`, quality 11, mode generic, lgwin 22, of `SCQI`, `SCQF`, and the quantized compact encoding |
| (d) gzip of compact | same gzip as (b), of the quantized compact bytes |

**Gain split.** Quantization gain = lossless compact binary (`SCPB`) / lossy fixed-width packing. Structure gain = that same lossy packing / quantized compact (delta + varint of the same `q`s), also reported versus gzip and brotli of the int codes.

**Pass thresholds:** every lossy encoding (int, float64, compact) has `max_abs_err ≤ eps`, exact `t` / step / verdict, retained score = 1.0, and deterministic bytes; v0.1 engine heads unchanged; latency p95 under the hang bound. Ratios are reported, not asserted.

**Results** (bytes exact; ratios to 4 decimals). All four fixtures used int32 codes (`width = 4`). `eps = { predicted: 0.001, observed: 0.001, phi: 0.0001 }`.

Sizes (bytes):

| Fixture | N | lossless binary | lossy int32 | lossy float64 | quantized compact | gzip(int) | gzip(float) | gzip(compact) | brotli(int) | brotli(float) | brotli(compact) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| v0.1 | 256 | 9481 | 6434 | 9505 | 2551 | 3564 | 4671 | 115 | 2492 | 3916 | 122 |
| A-medicare | 6 | 231 | 184 | 255 | 117 | 172 | 182 | 126 | 176 | 192 | 121 |
| B256 | 256 | 9481 | 6434 | 9505 | 1970 | 3213 | 4688 | 991 | 2167 | 4240 | 914 |
| B4096 | 4096 | 151561 | 102434 | 151585 | 30729 | 49739 | 61749 | 13511 | 31684 | 51254 | 11817 |

Quantized compact versus each fair baseline (`baseline / compact`; >1 means compact is smaller), and the gain split:

| Fixture | vs lossy int | vs lossy float64 | vs gzip(int) | vs gzip(float) | vs gzip(compact) | vs brotli(int) | vs brotli(float) | vs brotli(compact) | quantization (int / float) | structure vs int / gzip(int) / brotli(int) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|---|
| v0.1 | 2.5221 | 3.7260 | 1.3971 | 1.8310 | 0.0451 | **0.9769** | 1.5351 | 0.0478 | 1.4736 / 0.9975 | 2.5221 / 1.3971 / **0.9769** |
| A-medicare | 1.5726 | 2.1795 | 1.4701 | 1.5556 | 1.0769 | 1.5043 | 1.6410 | 1.0342 | 1.2554 / 0.9059 | 1.5726 / 1.4701 / 1.5043 |
| B256 | 3.2660 | 4.8249 | 1.6310 | 2.3797 | 0.5030 | 1.1000 | 2.1523 | 0.4640 | 1.4736 / 0.9975 | 3.2660 / 1.6310 / 1.1000 |
| B4096 | 3.3335 | 4.9330 | 1.6186 | 2.0095 | 0.4397 | 1.0311 | 1.6679 | 0.3846 | 1.4796 / 0.9998 | 3.3335 / 1.6186 / 1.0311 |

On the regular v0.1 fixture the compact encoding **loses** to brotli of the same int32 codes (2551 B vs 2492 B). gzip of the compact form is still much smaller on the large fixtures (leftover regularity); on the 6-row Medicare mapping, gzip expanded the 117 B compact payload to 126 B.


### 7.9 Cost, latency, and working set (v0.1.4)

v0.1.3 showed the compact encoding roughly ties brotli on size versus the same rounded int codes. `scripts/check-scp-v014.ts` tests the follow-on hypothesis — equal size at much lower compute and memory — on fixtures v0.1, B256, and B4096 (the 6-row Medicare mapping is skipped as too small for throughput). The stored chain format and v0.1 hashes are unchanged.

**Codecs, same eps, same rounded int codes (SCQI payload):** quantized compact (`encodeQuantized` / `decodeQuantized` in `src/scp/pack.ts`, including quantization); gzip levels 9 and 6 of SCQI; brotli qualities 11 and 5 of SCQI (generic mode, lgwin 22). Compact encode includes quantization from floats; gzip/brotli encode a pre-built SCQI buffer.

**Method.** Warmup 8 + K=31 timed iterations. If a single call is under 2 ms, the check batches calls so each sample is at least ~2 ms, then divides by the batch size. p50/p95 are reported, not asserted (hang bound only). Throughput MB/s uses decimal megabytes (1e6) of the shared SCQI payload. Memory figures are approximate `process.memoryUsage` heap/RSS/external deltas (median of 5 samples), labelled approximate; they can be negative if GC runs mid-sample. This run did not have `global.gc` exposed.

**Op counts.** A test-only instrumented copy (`scripts/scp-v014-ops.ts`) counts explicit adds, subs, shifts, muls, divs, bitwise ops, rounds, branches (every evaluated condition, not only taken), and bytes written/read. Engine internals, DataView, and allocations are not counted. The instrumented encoder must emit byte-identical output to `encodeQuantized`. Counts are deterministic and amortized over n (header included).

**Working set (the hardware-relevant figure).** The compact codec is five independent zigzag-delta varint streams and needs only the previous value per stream: 5 × 8 = 40 bytes of registers (64 bytes on decode including three float64 eps values). Gzip's deflate window is 32 KiB; brotli lgwin 22 is 4 MiB. Node zlib also uses hasher/scratch beyond the advertised window (not measured). The current JS Writer materializes O(n) arrays and a growing `number[]` output buffer; that is an implementation artifact, not a lower bound on a streaming implementation, and it shows up in the large approximate heap deltas for compact below.

**Pass thresholds:** round-trip, `max_abs_err ≤ eps`, exact `t` / step / verdict, retained 1.0, deterministic encoded bytes and op counts, instrumented bytes match `pack.ts`, v0.1 engine heads unchanged, latency p95 under the hang bound. Throughput, memory, and ratios are reported, not asserted. Single-machine Node timings, not a lab or silicon result.

**Environment for the table below:** Node v24.22.1, linux x64, CPU model `Intel(R) Xeon(R) Processor`, 8 CPUs. Single-machine, no `global.gc`. The table records a dedicated `check-scp-v014` run. A second run on the same machine (after the full check suite) moved B4096 encode speedup vs gzip-l9 from 2.16× to 1.71× and vs brotli-q11 from 69.43× to 54.85×, and decode slowdown vs gzip-l9 from 7.01× to 5.56×; the qualitative result (faster encode, slower JS decode, 40 B vs 32 KiB / 4 MiB) was unchanged.

Sizes (bytes) and encode/decode p50. `enc/dec MB/s` are decimal MB of the SCQI payload. Heap deltas are approximate bytes (p50 of 5 samples).

| Fixture | Codec | N | bytes | encode p50 ms | encode points/s | encode MB/s | decode p50 ms | decode points/s | decode MB/s | approx encode heap Δ | approx decode heap Δ | working set |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| v0.1 | compact | 256 | 2551 | 0.1614 | 1,585,868 | 39.857 | 0.2468 | 1,037,283 | 26.070 | 237,192 | 470,056 | 40 B |
| v0.1 | gzip-l9 | 256 | 3564 | 0.2317 | 1,104,824 | 27.767 | 0.0455 | 5,628,987 | 141.472 | 3,432 | 2,256 | 32 KiB |
| v0.1 | gzip-l6 | 256 | 3560 | 0.2060 | 1,242,515 | 31.228 | 0.0450 | 5,684,755 | 142.874 | 3,336 | 2,160 | 32 KiB |
| v0.1 | brotli-q11 | 256 | 2492 | 6.3582 | 40,263 | 1.012 | 0.0558 | 4,585,075 | 115.236 | 3,352 | 2,272 | 4 MiB |
| v0.1 | brotli-q5 | 256 | 2605 | 0.1846 | 1,386,487 | 34.846 | 0.0301 | 8,497,536 | 213.567 | 3,208 | 2,176 | 4 MiB |
| B256 | compact | 256 | 1970 | 0.1112 | 2,302,036 | 57.857 | 0.1581 | 1,618,848 | 40.686 | 222,264 | 346,528 | 40 B |
| B256 | gzip-l9 | 256 | 3213 | 0.1737 | 1,474,037 | 37.047 | 0.0307 | 8,340,040 | 209.609 | 3,192 | 2,032 | 32 KiB |
| B256 | gzip-l6 | 256 | 3204 | 0.2079 | 1,231,109 | 30.941 | 0.0286 | 8,957,841 | 225.136 | 3,192 | 2,032 | 32 KiB |
| B256 | brotli-q11 | 256 | 2167 | 6.7843 | 37,734 | 0.948 | 0.0364 | 7,035,329 | 176.818 | 3,128 | 2,048 | 4 MiB |
| B256 | brotli-q5 | 256 | 2359 | 0.1980 | 1,292,894 | 32.494 | 0.0305 | 8,406,685 | 211.284 | 3,096 | 2,048 | 4 MiB |
| B4096 | compact | 4096 | 30729 | 2.2563 | 1,815,388 | 45.400 | 2.9600 | 1,383,765 | 34.606 | 3,748,456 | 5,454,288 | 40 B |
| B4096 | gzip-l9 | 4096 | 49739 | 4.8631 | 842,257 | 21.063 | 0.4222 | 9,701,991 | 242.630 | 4,736 | 4,680 | 32 KiB |
| B4096 | gzip-l6 | 4096 | 49703 | 3.6016 | 1,137,276 | 28.441 | 0.4063 | 10,081,320 | 252.117 | 4,736 | 4,680 | 32 KiB |
| B4096 | brotli-q11 | 4096 | 31684 | 156.6589 | 26,146 | 0.654 | 0.4536 | 9,030,724 | 225.843 | 3,968 | 4,600 | 4 MiB |
| B4096 | brotli-q5 | 4096 | 36846 | 3.3021 | 1,240,409 | 31.021 | 0.5633 | 7,271,226 | 181.841 | 4,352 | 4,696 | 4 MiB |

**Compact codec deterministic op counts** (totals and per-point, header amortized):

| Fixture | N | encode total | encode / point | decode total | decode / point | encode breakdown (add, sub, shift, mul, div, bit, round, branch, bytes written) | decode breakdown (add, sub, shift, mul, bit, branch, bytes read) |
|---|---:|---:|---:|---:|---:|---|---|
| v0.1 | 256 | 25565 | 99.86 | 29418 | 114.91 | 2075, 3422, 2257, 768, 768, 1952, 768, 13555, 2551 | 6615, 1332, 3528, 774, 5778, 11391, 2551 |
| B256 | 256 | 23306 | 91.04 | 25416 | 99.28 | 2075, 4068, 1676, 768, 768, 790, 768, 12393, 1970 | 5776, 1655, 2947, 774, 4616, 9648, 1970 |
| B4096 | 4096 | 370311 | 90.41 | 404938 | 98.86 | 32795, 65198, 26595, 12288, 12288, 12228, 12288, 196631, 30729 | 91939, 26460, 47066, 12294, 73654, 153525, 30729 |

On B4096 the compact encoder is 2.16× faster than gzip level 9 and 69.43× faster than brotli quality 11, and slightly faster than gzip level 6 / brotli quality 5 (3.602 / 3.302 ms). The compact *decoder in this JavaScript implementation* is **slower** than native gzip/brotli decompress (7.01× / 6.53× on B4096). Approximate JS heap deltas for compact are large because of the `number[]` Writer, larger than zlib's measured deltas; the 40-byte register figure is the algorithmic contrast, not the observed heap.


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
- **Medicare fixture.** Not used as a default encoder in v0.1. The five administrative fields are not `(predicted, observed, Φ)` (decisions 1 and 2). v0.1.2 derives 4D points from the committed 6-row *synthetic* file with an explicit test-only mapping (§7.7). That mapping is not a production or CMS encoder, and the file is not padded with invented Medicare rows.
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

### 11.1 Software cost measurements feeding Layer 2 (v0.1.4)

v0.1.4 is **not** a Layer 2 emulation and not an area/LUT/energy estimate. It is a Layer 1 software measurement that a later cost/latency model can compare against. Figures below are Node/JavaScript timings on one machine (see §7.9 for the table, method, and environment). They are not a fabricated-device result.

What the measurements support, as inputs to a later model:

- **Working set.** A streaming implementation of the compact codec needs 40 bytes of previous-value registers (64 bytes on decode including eps), versus a 32 KiB gzip window and a 4 MiB brotli window (lgwin 22). That contrast is the hardware-relevant figure.
- **Operation count.** The compact codec's instrumented encode/decode cost is deterministic and O(n): about 90 encode ops/point and 99 decode ops/point on B4096 (adds, subs, shifts, muls, divs, bitwise ops, rounds, and branches; see §7.9). Gzip and brotli have no comparable integer op count in this check.
- **Encode time, in this JS/Node implementation, on B4096.** Compact p50 2.256 ms is 2.16× faster than gzip level 9 and 69.43× faster than brotli quality 11, and slightly ahead of gzip level 6 and brotli quality 5.
- **Decode time, in this JS/Node implementation, on B4096.** Compact p50 2.960 ms is **slower** than native gzip (0.422 ms, 7.01×) and brotli q11 (0.454 ms, 6.53×) decompress. A tighter native or hardware decoder could differ; this implementation does not win decode throughput.
- **Measured JS heap.** Approximate `process.memoryUsage` deltas for compact are *larger* than zlib's (B4096 encode ~3.7 MiB vs ~5 KiB) because the current Writer uses a growing `number[]`. Do not treat those deltas as the algorithmic working set.

v0.1.5 uses the 40-byte state and the per-point op counts as Layer 1 inputs to an analytical cost model (§11.2). It must label area/LUT/energy figures as estimates and must not present v0.1.4 software timings or v0.1.5 table values as a silicon result.

### 11.2 Analytical hardware cost model (v0.1.5)

v0.1.5 is the first Layer 2 artefact: a **transparent, parameterized analytical cost model** (`scripts/scp-v015-cost-model.ts`, checked by `scripts/check-scp-v015.ts`). It is **not** a bit-accurate RTL model, not an FPGA synthesis, not a place-and-route, and not a measured chip. Every area and energy number is an *estimate*. Op counts and working-set sizes are the v0.1.4 Layer 1 inputs (re-checked live against the instrumented codec). The stored chain format and `src/scp/pack.ts` are unchanged.

**Method.** Compact encode/decode energy is the v0.1.4 instrumented op mix (add, sub, shift, mul, div, bit, round, branch, bytes) priced at per-op energies, plus assumed register-file accesses, amortized per point. Compact area is a *shared* (not unrolled) datapath — integer adder, FP add, FP mul, and (encode only) a divider — plus flip-flop area for the 40 B / 64 B streaming state. Gzip and brotli are modelled as **memory-dominated**: window SRAM (32 KiB or 4 MiB) plus an assumed hasher-size range, times a range of window/hash accesses per input or output byte. Access high-caps for gzip come from zlib `deflate.c` `max_chain` (a cap, not a measured average). Brotli access counts are assumed. The 4 MiB high-energy corner may be priced as off-chip DRAM (a sensitivity lever).

**Units.** State in bytes; energy in pJ/point; area in µm² (and a doubly estimated gate-equivalent using an assumed 0.5 µm²/GE). Relative figures are `other / compact` ranges using adverse and favourable corners (`other_low / compact_high` through `other_high / compact_low`). A “robust win” means compact high < other low (ranges do not overlap).

**Assumptions** (full list with sources is flattened by the model; every constant is `cited-literature`, `assumption`, `derived-from-v014`, or `specified` — never “measured” silicon):

| Id | Default | Kind | Source |
|---|---|---|---|
| Process node | 45 nm | cited-literature | Horowitz, “Computing's Energy Problem (and what we can do about it)”, ISSCC 2014 plenary |
| 32-bit int add / mul | 0.1 / 3.1 pJ; 137 / 3495 µm² | cited-literature | Horowitz 45 nm table; areas as tabulated by Gholami et al. / MIT EEMS |
| 32-bit FP add / mul | 0.9 / 3.7 pJ; 4184 / 7700 µm² | cited-literature | same |
| SRAM 64-bit access, 8 KB / 32 KB / 1 MB | 10 / 20 / 100 pJ | cited-literature | Horowitz plenary cache table (gzip's 32 KiB window matches the 32 KB row) |
| DRAM 64-bit access | 1.3–2.6 nJ | cited-literature | Horowitz plenary; used only as the 4 MiB *high* corner when `four_mb_high_uses_dram` |
| Shift, bitwise, branch energy | 0.1 pJ each | assumption | No Horowitz row; priced as a 32-bit add |
| Divider energy | 3.1–14.8 pJ | assumption | No Horowitz divider row; low ≈ int mul, high ≈ 4× FP mul |
| Round energy | 0.1–0.9 pJ | assumption | Integer-style vs FP-add-style |
| Register-file 32-bit access | 0.03–0.5 pJ | assumption | Cheaper than 8 KB SRAM; not a Horowitz RF row |
| SRAM area | 0.25–1.0 µm²/bit | assumption | Order of a 45 nm 6T cell, up to macro overhead. Not a foundry PDK number |
| Flip-flop area | 4–16 µm²/bit | assumption | Not measured |
| Divider area | 2–4× FP32 mul | assumption | No Horowitz divider area |
| gzip hasher | 0–64 KiB | assumption | Window-only low; ~15-bit deflate hash high |
| gzip L6 / L9 encode accesses per input byte | 4–128 / 8–4096 | assumption | High caps are zlib `max_chain`, not measured averages |
| gzip/brotli decode accesses per output byte | 1–4 | assumption | Window copy, not match search |
| brotli q5 / q11 encode accesses per input byte | 8–64 / 16–1024 | assumption | No cited average |
| brotli hasher | 0–4 MiB | assumption | Up to one extra window at high quality |
| 4 MiB on-chip energy | log-linear extrapolation of the 32 KB–1 MB points | assumption | Not in the Horowitz table |
| Compact datapath | 1 shared adder, FP add, FP mul; 1 divider on encode, 0 on decode | assumption | Not unrolled over n |

**Results on B4096** (area is fixture-independent under a shared datapath; v0.1 / B256 energy is within a few percent of B4096). All figures are estimates.

| Codec | State | Working set (low–high) | Ops or accesses / point | Area µm² (est.) | Rel. area vs compact-enc | Energy pJ/point (est.) | Rel. energy vs compact same side |
|---|---:|---|---|---|---|---|---|
| compact-encode | 40 B | 40 B | 90.41 ops (mix below) | 28,838–48,078 | 1 | 27.72–77.84 | 1 |
| compact-decode | 64 B | 64 B | 98.86 ops | 14,206–20,350 | 0.30–0.71 | 19.57–32.19 | 1 |
| gzip-l6-encode | 32 KiB | 32–96 KiB | 100–3,201 acc | 70,536–826,432 | 1.47–28.7 | 250–8,003 | 3.21–289 |
| gzip-l6-decode | 32 KiB | 32–96 KiB | 25–100 acc | 70,536–826,432 | 1.47–28.7 | 62.5–250 | 1.94–12.8 |
| gzip-l9-encode | 32 KiB | 32–96 KiB | 200–102,434 acc | 70,536–826,432 | 1.47–28.7 | 500–256,085 | 6.43–9,240 |
| gzip-l9-decode | 32 KiB | 32–96 KiB | 25–100 acc | 70,536–826,432 | 1.47–28.7 | 62.5–250 | 1.94–12.8 |
| brotli-q5-encode | 4 MiB | 4–8 MiB | 200–1,601 acc | 8.40–67.19 mm² | 175–2,330 | 3,301–520,173 | 42.4–18,768 |
| brotli-q5-decode | 4 MiB | 4–8 MiB | 25–100 acc | 8.40–67.19 mm² | 175–2,330 | 413–32,511 | 12.8–1,662 |
| brotli-q11-encode | 4 MiB | 4–8 MiB | 400–25,609 acc | 8.40–67.19 mm² | 175–2,330 | 6,602–8,322,763 | 84.8–300,288 |
| brotli-q11-decode | 4 MiB | 4–8 MiB | 25–100 acc | 8.40–67.19 mm² | 175–2,330 | 413–32,511 | 12.8–1,662 |

B4096 compact encode op mix / point (header amortized, from v0.1.4 instrumentation): add 8.01, sub 15.92, shift 6.49, mul 3, div 3, bit 2.99, round 3, branch 48.01, bytes written 7.50. Decode: add 22.45, sub 6.46, shift 11.49, mul 3.00, bit 17.98, branch 37.48, bytes read 7.50. These op counts are measured in software; the pJ and µm² attached to them are not.

**Sensitivity (what flips a robust win, B4096, compact high < other low):**

- **gzip encode energy** stays robust unless match-search drops to ~1 access per input byte (default low is 8; zlib `max_chain` is the high cap, not the average). Inflating compact divider energy flips only at ~156 pJ/div (default high 14.8 pJ).
- **gzip decode energy** is only barely robust (1.94× at the adverse corner) and flips below ~0.5 accesses per output byte (default low is 1).
- **gzip area** is modest (1.47× at the adverse corner: compact high 48,078 µm² vs gzip window-only, cell-density, low logic 70,536 µm²) and flips if SRAM is assumed ≲ 0.16 µm²/bit (default low 0.25) or the compact divider is modelled at ≳ 7× an FP mul (default high 4×). Counting a gzip hash table would widen the gap in compact's favour; omitting the divider (iterate a multiplier) would too.
- **brotli area and encode energy** do not flip on the explored grid (even 0.25 accesses/byte on-chip still leaves a robust encode-energy win). Brotli *decode* energy flips only at an extreme 0.05 accesses/byte.

**What a real silicon or FPGA proof would need next** (none of this exists in the repo today):

1. RTL / HDL of the compact encode and decode datapath, with bit-accurate (or documented, bounded-divergence) agreement against `encodeQuantized` / `decodeQuantized` on the committed fixtures, including the hash of the emitted bytes.
2. Synthesis and, preferably, place-and-route at a *named* process node or FPGA family, reporting LUT/FF/BRAM or µm², clock, and tool-estimated power — not Horowitz-table arithmetic.
3. A hardware gzip/brotli baseline, or an explicit statement that a software zlib is *not* the comparison. Window SRAM must use compiler or BRAM numbers from that flow, including whether 4 MiB is on-chip.
4. Measured energy on the FPGA or ASIC (board-level or post-silicon), with the same fixtures, labelled as measurements.
5. An explicit list of what would falsify the hardware claim (area above the gzip window, decode energy above inflate, incorrect fixture bytes).
6. Still not a product, not a medical device, and not a tape-out milestone in this codebase. That package would be the evidence gate from Layer 2 toward a Layer 3 research proposition (§11).

This model may be compared against those later measurements; until they exist, treat every µm² and pJ figure above as an assumption-driven estimate.


### 11.3 Divider-free reciprocal quantization (v0.1.6)

v0.1.5's compact encode area was dominated by an assumed floating-point divider (the `v / eps` in `Math.round(v / eps)`), and the gzip area advantage flipped if that divider was modelled at ≳ 7× an FP mul. v0.1.6 asks whether the divider can leave the *datapath* by replacing per-point division with a precomputed reciprocal, a multiply, and a residual correction.

**Variant (test-only).** `scripts/scp-v016-recip.ts`, checked by `scripts/check-scp-v016.ts`. For each axis, once: `inv = 1/eps`, `half = 0.5*eps` (setup; three divisions per encode, not per point). Per point: `q = Math.round(v * inv)`, then `rem = v - q*eps` and adjust `q` by ±1 while `rem` is outside `[-half, half)`. `src/scp/pack.ts` is **not** changed.

**Equivalence.**

- On all four committed fixtures (v0.1, A-medicare 6-row, B256, B4096) the variant is **byte-identical** to `encodeQuantized` in `pack.ts` (same SHA-256 of the SCPQ bytes; v0.1 quantized sha `07a3d04147714747a4823e6e934dc6144740eb2f6243e7113106aed06369d6bc` unchanged).
- It is **not** byte-identical for every legal input. Float64 `v/eps` already rounds before `Math.round`, and a multiply-by-reciprocal path (with or without residual correction) disagrees at halfway cases. The check reproduces these counterexamples and a deterministic edge/random scan (`tested = 1,494,828`, `recip_mismatches = 22,944`, `naive_mismatches = 19,206`). `pack.ts` therefore stays the stored reference.

Documented counterexamples (all satisfy `err ≤ eps` and `|q| ≤ 2^53`):

| v | eps | pack.ts `Math.round(v/eps)` | mul+round (naive) | mul+round+residual (variant) |
|---|---:|---:|---:|---:|
| `-0.0045000000000000005` | 0.001 (fixture predicted/observed eps) | −4 | −5 | −5 |
| `0.0000014999999999999998` | 0.000001 | 2 | 1 | 1 |
| `0.0045` | 0.001 | 5 | 5 | 4 |

The third row shows that residual correction can also diverge from *both* pack.ts and naive mul-by-reciprocal when `0.5*eps` is inexact. A multiply-only datapath cannot always recover `Math.round(v / eps)`, so claiming a silent swap of the stored encoder would be dishonest.

**Revised cost model** (same v0.1.5 Horowitz-45nm assumptions, but `n_fp_divs_encode = 0` and the variant's measured encode op mix, `div/point = 0`; decode is unchanged). Setup's three divisions are negligible if amortized (~0.01 pJ/point on B4096) and are not a datapath unit. All figures are estimates.

B4096 (area is fixture-independent under a shared datapath):

| Codec | State | Ops / pt (variant) | Area µm² (est.) | Rel. area vs compact-enc | Energy pJ/pt (est.) | Rel. energy vs compact same side |
|---|---:|---:|---|---|---|---|
| compact-encode (v0.1.6 variant) | 40 B | 103.90 (div = 0) | 13,438–17,278 | 1 | 29.07–45.89 | 1 |
| compact-decode | 64 B | 98.86 | 14,206–20,350 | 0.82–1.51 | 19.57–32.19 | 1 |
| gzip-l6-encode | 32 KiB | — | 70,536–826,432 | 4.08–61.5 | 250–8,003 | 5.45–275 |
| gzip-l9-encode | 32 KiB | — | 70,536–826,432 | 4.08–61.5 | 500–256,085 | 10.90–8,811 |
| gzip-l9-decode | 32 KiB | — | 70,536–826,432 | 4.08–61.5 | 62.5–250 | 1.94–12.8 |
| brotli-q11-encode | 4 MiB | — | 8.40–67.19 mm² | 486–5,000 | 6,602–8,322,763 | 144–286,346 |
| brotli-q11-decode | 4 MiB | — | 8.40–67.19 mm² | 486–5,000 | 413–32,511 | 12.8–1,662 |

Encode ops/point rose from 90.41 to 103.90 because residual correction adds multiplies and compares; encode energy high *fell* (45.89 vs 77.84 pJ) because the expensive divider energy is gone. Area high fell from 48,078 to 17,278 µm² (no divider unit). The gzip area adverse-corner ratio improved from 1.47× to 4.08×.

**Sensitivity, what remains.**

- The v0.1.5 gzip area flip (divider ≳ 7× an FP mul) is **eliminated** (`fp_div_factor_high` does not flip; there is no divider to inflate). Inflating divider *energy* also no longer flips (`div_high`, no per-point divs). The gzip-l9 *encode* energy flip at ~1 access/input-byte is also gone (compact high is now 45.89 pJ, below the 1-access low corner).
- Remaining flips: gzip **decode** energy still flips below ~0.5 accesses/output-byte; gzip **area** still flips if SRAM is assumed ≲ 0.046 µm²/bit (more extreme than the old 0.16, and well below the 0.25 assumed cell floor); brotli decode energy still flips only at an extreme 0.05 accesses/byte.

This variant is a hardware-oriented experiment, not a stored-format change, not a silicon result, and not a proof that a chip would match `pack.ts` on every input. A later RTL path that wanted byte-identity with `pack.ts` would have to emulate `Math.round(v / eps)` (i.e. keep a correctly rounded divider, or document bounded divergence on the halfway class above). v0.1.7 is that exact-emulation experiment, still test-only.

### 11.4 Rounding-exact divider-free quantization (v0.1.7)

v0.1.6 removed the divider from the datapath but could not match `Math.round(v / eps)` for every legal input: float64 `v/eps` already rounds (ties to even) before `Math.round` (half toward +∞), and an inexact residual against `0.5*eps` disagrees at halfway cases (22,944 mismatches in 1,494,828 tests; three named counterexamples in §11.3). v0.1.7 asks whether a reciprocal estimate plus an *exact* IEEE-aware boundary check can recover pack.ts's `q` bit-for-bit, still with per-point `div = 0`.

**Variant (test-only).** `scripts/scp-v017-exact-recip.ts`, checked by `scripts/check-scp-v017.ts`. For each axis, once: `inv = 1/eps` (setup; three divisions per encode, not per point). Per point: `q = Math.round(v * inv)` as an estimate, then accept `q` iff `n - 0.5 ≤ RN(v/eps) < n + 0.5` (this is exactly `Math.round` of the already-rounded quotient), otherwise step `q` by ±1. The bound test compares `2*v` against `(nextDown(L) + L) * eps` with exact BigInt rationals and applies the ties-to-even rule on the midpoint — a multiply-compare, not a divider. A second, independent path (`Math.round` of a soft-float correctly rounded `v/eps`) is used as a cross-check in the scan. `src/scp/pack.ts` is **not** changed.

**Equivalence.**

- On all four committed fixtures the variant is **byte-identical** to `encodeQuantized` in `pack.ts` (same SHA-256 of the SCPQ bytes; v0.1 quantized sha `07a3d04147714747a4823e6e934dc6144740eb2f6243e7113106aed06369d6bc` unchanged).
- The three v0.1.6 counterexamples now match pack.ts (`v = -0.0045000000000000005`, `eps = 0.001` → `q = -4`; `v = 0.0000014999999999999998`, `eps = 0.000001` → `q = 2`; `v = 0.0045`, `eps = 0.001` → `q = 5`).
- Rerun of the v0.1.6 scan set: `tested = 1,494,828`, `prior residual mismatches = 22,944`, `exact mismatches = 0` (all 22,944 now match). The 13,304 inputs the residual variant threw on are all pack.ts-legal and also match (full legal grid `tested = 1,508,132`, `exact mismatches = 0`). A focused edge battery (`tested = 2,907`, including neighbourhoods of `2^52` / `2^53`, subnormals, and signed zero) and a larger random scan (`tested = 2,000,000`, seed 20261118) also recorded zero mismatches.
- A finite scan is **not** exhaustion of every float64 pair. The algorithm is designed to implement `Math.round(RN(v/eps))` exactly via the IEEE-aware compare; the scans are evidence, not a formal proof over the whole domain.

**What would justify swapping `pack.ts` later (owner decision).** The variant is a drop-in *implementation* candidate: observable SCPQ bytes would stay the same, so stored hashes would not move. Reasons to wait: a finite scan is not a domain-wide proof; the owner may want a formal argument or a bit-accurate RTL check before replacing the reference encoder; this remains a measurement helper, not the stored chain format. Until that decision, `pack.ts` stays the stored reference and the variant stays test-only.

**Revised cost model** (same v0.1.5 Horowitz-45nm assumptions, `n_fp_divs_encode = 0`, the variant's measured encode op mix with `div/point = 0`; decode is unchanged). Each exact bound check is counted as one 54×53 integer product-compare (one `mul`, same shared multiplier unit as v0.1.5; assumed datapath, not a measured gate count). Setup's three divisions are negligible if amortized and are not a datapath unit. All figures are estimates.

B4096 (area is fixture-independent under a shared datapath):

| Codec | State | Ops / pt (variant) | Area µm² (est.) | Rel. area vs compact-enc | Energy pJ/pt (est.) | Rel. energy vs compact same side |
|---|---:|---:|---|---|---|---|
| compact-encode (v0.1.7 variant) | 40 B | 144.41 (div = 0) | 13,438–17,278 | 1 | 51.12–71.54 | 1 |
| compact-decode | 64 B | 98.86 | 14,206–20,350 | 0.82–1.51 | 19.57–32.19 | 1 |
| gzip-l6-encode | 32 KiB | — | 70,536–826,432 | 4.08–61.5 | 250–8,003 | 3.50–157 |
| gzip-l9-encode | 32 KiB | — | 70,536–826,432 | 4.08–61.5 | 500–256,085 | 6.99–5,010 |
| gzip-l9-decode | 32 KiB | — | 70,536–826,432 | 4.08–61.5 | 62.5–250 | 1.94–12.8 |
| brotli-q11-encode | 4 MiB | — | 8.40–67.19 mm² | 486–5,000 | 6,602–8,322,763 | 92.3–162,821 |
| brotli-q11-decode | 4 MiB | — | 8.40–67.19 mm² | 486–5,000 | 413–32,511 | 12.8–1,662 |

Encode ops/point rose from v0.1.6's 103.90 to 144.41 because two exact bound checks cost more than the inexact residual. Encode energy high *rose* versus v0.1.6 (71.54 vs 45.89 pJ) for the same reason, but remains below the original divider-path high (77.84 pJ). Area is unchanged from v0.1.6 (13,438–17,278 µm²; no divider unit).

**Sensitivity, what remains.**

- The v0.1.5 gzip area flip (divider ≳ 7× an FP mul) remains **eliminated**, as does the divider-energy flip (`div_high`).
- The gzip-l9 *encode* energy flip at ~1 access/input-byte, which v0.1.6 had eliminated, **returns** (compact high is now 71.54 pJ, above that 1-access low corner). This is the cost of exactness versus the inexact residual.
- Remaining flips: gzip.l9_accesses_low→1; gzip.decode_accesses_low→0.5; area_um2.sram_per_bit_low→0.046; brotli.decode_accesses_low→0.05.

This variant is a hardware-oriented experiment, not a stored-format change, and not a silicon result.

### 11.5 Integer-only golden model (v0.1.8)

v0.1.7 proved a rounding-exact *software* path, but it still used JavaScript floating-point in the runtime (`v * inv`, `Math.round`). v0.1.8 is a **bit-accurate, integer-only reference model** of the compact encoder and decoder, suitable as the golden model an FPGA/RTL implementation would be verified against.

**Front-end (documented, not the runtime datapath).** A finite float64 is converted to an exact IEEE-754 record by bit extraction: 1-bit sign, 11-bit exponent, 53-bit significand (including the hidden 1), plus the raw 64-bit pattern. `t`, `step`, and `verdict` are already integers. This is the only place payload floats are accepted.

**Runtime.** Only BigInt / fixed-width integer arithmetic. Per point, the official `q` is integer correctly-rounded division `RN(v/eps)` of the 53-bit significands, followed by integer `Math.round` (half toward +∞). That is pack.ts, in integers. The SCPQ bitstream (magic, version, `n`, little-endian eps bit patterns, i64 `t0`, zigzag-delta varints, verdict bytes) is written and read with only integer operations. Decode reconstructs `v' = q * eps` as an exact rational; a documented back-end (correctly-rounded float64) exists only so software tests can compare with pack.ts's `Number` outputs.

**Register widths** (legal domain, and no overflow on the four fixtures):

| Field | Width | Role |
|---|---:|---|
| IEEE sign / exp / frac (mant) | 1 / 11 / 52 (53) | Front-end record and stored eps bits |
| `q` | 55-bit signed | `\|q\| ≤ 2^53` inclusive |
| `t` | 64-bit storage (legal values are 54-bit safe integers) | i64 stream |
| `step` | 32-bit signed | i32 stream |
| verdict | 2 bits (stored as u8) | PASS/FAIL/INCONCLUSIVE |
| `n` | 32-bit | header count |
| varint accumulator | 64-bit | pack.ts cap (`shift ≤ 63`) |
| product-compare / reconstruct | 108 / 107 bits | residual and `q·eps` mantissas |

Fixture census (all four fixtures, no overflow): `max \|q\| = 210,000` (19-bit signed), `max \|t\| = 1,793,232,005,000` (42-bit signed), `max \|Δt\| = 3,601,000`, `max \|step\| = 4,095`, `max \|Δstep\| = 1`, `max varint = 7,202,000`, product 107 bits, reconstruct 70 bits.

**Equivalence.** Byte-identical to `pack.ts` on all four fixtures (v0.1 quantized sha `07a3d04147714747a4823e6e934dc6144740eb2f6243e7113106aed06369d6bc` unchanged). Decode round-trips exactly and matches pack.ts after the back-end RN. Zero `q` mismatches on the v0.1.7 scan sets: v0.1.6 full legal grid `tested = 1,508,132`, focused edge battery `tested = 3,229`, larger random scan `tested = 2,000,000` (seed 20261118). A finite scan is not exhaustion of every float64 pair. `src/scp/pack.ts` is **not** changed; swapping it remains an owner decision.

**Golden vectors.** `fixtures/scp/golden-vectors.json` (tests only; not production data): seven small input/output pairs (v0.1 first 8 points, the three v0.1.6 counterexamples, zero, a negative halfway case, and a unit-step record), plus the v0.1 full-payload SHA-256. Each vector stores IEEE bit patterns, integer `q`, and SCPQ `bytes_hex`.

**What an FPGA proof would do next with those vectors.** (1) Drive a testbench from the JSON and require bit-identical SCPQ bytes and `q`. (2) Replay the scan sets, or a subset exported in the same format, against the RTL. (3) Formally or co-simulate the integer RN-div + round against this model. (4) Optionally implement the v0.1.7 mul-and-correct datapath and prove it matches the same golden vectors (that path has no divider). (5) Synthesize at a real node and compare LUT/FF/DSP / measured energy to the §11.5 estimates. None of that is done here, and doing it would still not be a tape-out or a product.

**Revised cost model** (v0.1.5 Horowitz-45nm assumptions, *no FP units*: `n_fp_adders = n_fp_muls = n_fp_divs_* = 0`). The integer golden model's official quantize uses a 53-bit integer divider, so this estimate includes `n_int_divs = 1` at an assumed 3× 32-bit integer-mul area, plus `n_int_muls = 1` at 3×, and a 128-bit adder (4× a 32-bit add). Integer mul energy is 3.1 pJ at both corners; integer-div energy is assumed 3.1–12.4 pJ. An RTL that matches the golden vectors with mul-and-correct could instead use the smaller v0.1.7-style no-divider area. All figures are estimates.

B4096 encode op mix (integer model, per point): add 13.00, sub 10.92, shift 12.50, mul 6, **div 3** (one integer RN-div per axis), bit 5.99, round 3, branch 44.49, total 98.90, bytes_written 7.50.

| Codec | State | Ops / pt | Area µm² (est.) | Rel. area vs compact-enc | Energy pJ/pt (est.) | Rel. energy vs compact same side |
|---|---:|---:|---|---|---|---|
| compact-encode (v0.1.8 integer) | 40 B | 98.90 (int div = 3) | 22,798–26,638 | 1 | 37.57–76.29 | 1 |
| compact-decode | 64 B | 68.47 | 23,566–29,710 | 0.89–1.30 | 16.52–27.35 | 1 |
| gzip-l6-encode | 32 KiB | — | 70,536–826,432 | 2.65–36.3 | 250–8,003 | 3.28–213 |
| gzip-l9-encode | 32 KiB | — | 70,536–826,432 | 2.65–36.3 | 500–256,085 | 6.56–6,817 |
| gzip-l9-decode | 32 KiB | — | 70,536–826,432 | 2.65–36.3 | 62.5–250 | 2.29–15.1 |
| brotli-q11-encode | 4 MiB | — | 8.40–67.19 mm² | 315–2,947 | 6,602–8,322,763 | 86.5–221,555 |
| brotli-q11-decode | 4 MiB | — | 8.40–67.19 mm² | 315–2,947 | 413–32,511 | 15.1–1,968 |

Area is higher than the v0.1.7 divider-free estimate (13,438–17,278 µm²) because this golden model includes an integer divider unit. The FP-divider area flip remains eliminated (`n_fp_divs_encode = 0`). Remaining flips: gzip.l9_accesses_low→1; gzip.decode_accesses_low→0.25; energy_pj.div_high→156 (integer RN-div energy, not an FP unit); area_um2.sram_per_bit_low→0.08; brotli.decode_accesses_low→0.05.

This is a golden software model, not a stored-format change, not measured silicon, and not an FPGA result.


## 12. Milestones

| Version | Intent | Exit |
|---|---|---|
| **v0.1** (this path’s first implementation milestone) | Software proof on fixtures: ratio, fidelity, latency (reported), retained agreement, determinism. The test script is the thin wrapper over the existing engine; `src/scp` stubs stay unwired from app/Level 4. | `check-scp-v01` + boundary green against the proposed pass thresholds in §7 |
| **v0.1.1** | Defensible size measurement: baselines (raw JSON, compact binary, gzip-JSON, gzip-SCP canonical), honest headline versus the best general-purpose baseline, and a measured quantized compact encoding that does not change the stored chain | `check-scp-v011` + `check-scp-v01` + boundary green; v0.1 hashes unchanged; results and claims in §7.6 / §15 |
| **v0.1.2** | Stress the v0.1.1 quantized-vs-binary claim on less regular data (6-row synthetic Medicare mapping, not padded; seeded noisy N=256 and N=4096) | `check-scp-v012` + prior SCP checks green; v0.1 hashes unchanged; per-fixture table and revised headline in §7.7 / §15 |
| **v0.1.3** | Fair same-eps lossy baselines (fixed-width int codes and rounded float64, plus gzip/brotli) and a split of quantization gain vs encoding-structure gain | `check-scp-v013` + prior SCP checks green; v0.1 hashes unchanged; fair-baseline table and revised headline in §7.8 / §15 |
| **v0.1.4** | Software cost/latency/memory of the compact codec vs gzip (L9, L6) and brotli (q11, q5) on the same rounded int codes, plus a deterministic op count and the algorithmic working-set comparison | `check-scp-v014` + prior SCP checks green; v0.1 hashes unchanged; cost table and revised headline in §7.9 / §11 / §15 |
| **v0.1.5** | Layer 2 analytical hardware cost model: parameterized area/energy estimates from v0.1.4 op counts and working sets, with ranges, cited/assumed constants, and sensitivity | `check-scp-v015` + prior SCP checks green; v0.1 hashes and `pack.ts` unchanged; estimate table and headline in §11.2 / §15; not a silicon/FPGA result |
| **v0.1.6** | Test-only divider-free reciprocal quantize (mul + residual correction); byte-identity on fixtures; counterexamples documented; pack.ts unchanged; cost model re-run with div=0 | `check-scp-v016` + prior SCP checks green; fixture bytes match pack.ts; known counterexamples reproduced; revised estimate table and remaining flips in §11.3 / §15 |
| **v0.1.7** | Test-only rounding-exact divider-free quantize (mul + IEEE-aware bound correction); zero mismatches on the v0.1.6 scan and a larger random scan; pack.ts unchanged pending owner decision; cost model re-run with div=0 | `check-scp-v017` + prior SCP checks green; fixture bytes match pack.ts; all 22,944 prior residual mismatches now match; revised estimate table and remaining flips in §11.4 / §15 |
| **v0.1.8** | Bit-accurate integer-only golden model of the compact encoder/decoder, documented widths, golden vectors, cost model with no FP units | `check-scp-v018` + prior SCP checks green; fixture bytes and scan q match pack.ts; widths and golden file in §11.5 / `fixtures/scp/golden-vectors.json`; pack.ts unchanged |
| **v0.1.9** | Isolated subsystem in `src/scp/subsystem/` (state_encoder, state_compressor, temporal_state, state_reconstructor, state_predictor, compression_bench) and the four-strategy bench (full state, delta, tensor, combined 4D-SCP) on the v0.1/Medicare/B256/B4096 fixtures plus a seeded synthetic 4D environment; deterministic report | `check-scp-v019-bench` + prior SCP checks green (`check-scp-all`); pack.ts and v0.1 hashes unchanged; §16 |
| **v0.1.10** | Integer-only, hash-free golden model of the combined scp4d path (fixed-point relations and int16 low-rank factors, shift-only event quantizer), integer full_q/delta under the same accounting, event-driven decoder, compute-energy verdict, FPGA reference vectors | `check-scp-v0110` + prior SCP checks green (`check-scp-all`); v0.1.9 report and streams unchanged; `fixtures/scp/golden-vectors-scp4d.json` regenerated byte-identically; §17 |
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
- **Inflated ratio vs JSON.** Quoting only `record_json / canonical(segment)` (12.85x on this fixture) overstates 4D-state compression. The headline is versus the best general-purpose baseline (§7.6, §7.7, §15).

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

## 15. Honest claims (v0.1.1–v0.1.8; v0.1.9 claims and caveats are in §16.8–§16.10)

What **can** be claimed, on these committed fixtures only:

- Stored lossless reconstruction is bit-exact; stored bounded, the measured quantized compact encoding, and the v0.1.3 fair lossy baselines (fixed-width int codes and rounded float64) stay within the declared eps, with retained score 1.0 and deterministic hashes. v0.1 engine heads are unchanged. `src/scp/pack.ts` is unchanged in v0.1.6–v0.1.8.
- At the same eps, writing already-rounded values back as float64 does **not** shrink the lossless binary packing (0.9975× on v0.1; 0.9059× on the 6-row Medicare mapping, where the extra eps header dominates). Switching to fixed-width int32 codes is a modest **quantization** gain of about 1.47× (1.2554× on n=6).
- The compact delta/varint encoding's remaining **structure** gain versus those uncompressed int32 codes is 2.5221× (v0.1), 1.5726× (Medicare n=6), 3.2660× (noisy N=256), and 3.3335× (noisy N=4096). Versus gzip of the same int codes it is 1.3971×, 1.4701×, 1.6310×, and 1.6186×.
- In this single-machine Node/JS run, compact encode on B4096 is faster than gzip level 9 (2.16×) and much faster than brotli quality 11 (69.43×), at essentially the same size as brotli q11 (30729 B vs 31684 B). The algorithmic streaming state is 40 bytes versus a 32 KiB gzip window and a 4 MiB brotli window.
- A test-only divider-free residual variant (v0.1.6: precomputed `1/eps`, multiply, residual correction) is **byte-identical** to `pack.ts` on all four fixtures, but not for every legal input (§11.3). A test-only *rounding-exact* divider-free variant (v0.1.7: same reciprocal estimate, plus an exact IEEE-aware bound check) is **byte-identical** on those fixtures and matched pack.ts `q` on every tested legal input in the v0.1.6 scan (1,494,828 points, all 22,944 prior residual mismatches), the full pack.ts-legal v0.1.6 grid (1,508,132), a focused edge battery (2,907), and a 2,000,000-point random scan, with zero mismatches. Under the v0.1.5 Horowitz-45nm-style *assumptions* with the divider unit removed, its **estimated** B4096 encode energy is 51.1–71.5 pJ/point versus gzip-l9 500–256,085 pJ (6.99–5,010×) and its **estimated** area is 13,438–17,278 µm² versus gzip 70,536–826,432 µm² (4.08–61.5×). The old gzip area flip (divider ≳ 7× an FP mul) remains eliminated. `pack.ts` is still unchanged; swapping it for this implementation is an owner decision.
- A test-only **integer-only golden model** (v0.1.8) of the compact encoder and decoder is **byte-identical** to `pack.ts` on the same fixtures, decode round-trips exactly, and matched pack.ts `q` with zero mismatches on the v0.1.6 legal grid (1,508,132), a focused edge battery (3,229), and a 2,000,000-point random scan. Documented widths cover the legal domain and the fixture census; golden vectors are at `fixtures/scp/golden-vectors.json`. Under the v0.1.5 assumptions with *no FP units* (but with an integer divider for RN(v/eps)), estimated B4096 encode energy is 37.6–76.3 pJ/point versus gzip-l9 500–256,085 pJ (6.56–6,817×) and estimated area is 22,798–26,638 µm² versus gzip 70,536–826,432 µm² (2.65–36.3×). An RTL that matches the golden vectors with the v0.1.7 mul-and-correct datapath could use the smaller no-divider area. `pack.ts` is unchanged.

What **cannot** be claimed:

- That the 3.72× quantized-vs-lossless-binary figure is a fair compression ratio, or that most of it comes from a clever encoding. Much of it is “float64 → int32 codes plus allowing eps,” and almost none of it is from storing rounded values as float64.
- That the compact encoding beats a general-purpose compressor of the **same quantized integers**. On the regular v0.1 fixture it **loses** to brotli quality 11 of the int32 codes (2551 B vs 2492 B, 0.9769×). On noisy N=256 / N=4096 it is only 1.1000× / 1.0311× ahead of that brotli baseline.
- That compact is faster or leaner on every axis in the v0.1.4 JS/Node timings. Decode was slower than native gzip/brotli. JS heap deltas are not the algorithmic working set. Those timings are not lab numbers, not an SLA, and not a silicon result.
- That the v0.1.5–v0.1.8 tables are a measured chip, an FPGA result, or (for v0.1.5–v0.1.7) a bit-accurate *hardware* model. v0.1.8 is a bit-accurate *software* golden model, not synthesized RTL. Remaining v0.1.8 flips: gzip-l9 encode energy at ~1 access/input-byte; gzip decode energy below ~0.25 accesses/output-byte; integer-div energy if `div_high` is assumed ≳ 156 pJ; gzip area if SRAM is assumed ≲ 0.08 µm²/bit; brotli decode energy at an extreme 0.05 accesses/byte. All pJ and µm² constants are assumptions.
- That the v0.1.6 residual variant can replace `pack.ts` for all legal inputs. It cannot. Example: `v = -0.0045000000000000005`, `eps = 0.001` yields pack.ts `q = -4` and residual `q = -5`. That scan found 22,944 such mismatches in 1,494,828 in-range tests. The v0.1.7 exact variant matches pack.ts on those cases, but a finite scan is not a proof over every float64 pair, and `pack.ts` has not been swapped.
- Production datasets, a Medicare/CMS encoder, hardware results, or a product surface (still decision 5 / v0.2).

**Headline (one sentence).** A bit-accurate integer-only golden model of the compact codec (IEEE front-end, integer correctly-rounded division RN(v/eps) plus integer Math.round, integer zigzag-delta varint, no payload floating point at runtime) is byte-identical to pack.ts on all four fixtures (v0.1 quantized sha 07a3d04147714747a4823e6e934dc6144740eb2f6243e7113106aed06369d6bc unchanged), decode round-trips exactly, and matches pack.ts q with zero mismatches on the v0.1.7 scan sets (v0.1.6 legal grid 1,508,132, focused edges 3,229, random 2,000,000). Documented register widths cover the legal domain and the fixture census; golden vectors are in fixtures/scp/golden-vectors.json. pack.ts is unchanged pending an owner decision. Under the v0.1.5 45 nm assumptions with no FP units, estimated B4096 encode energy is 37.6–76.3 pJ/point versus gzip-l9 500.2–256085.0 pJ (6.56–6817.1×) and brotli-q11 6602.2–8322762.5 pJ, and estimated area is 22798–26638 µm² versus gzip 70536–826432 µm² (2.65–36.3×) and brotli 8.40–67.19 mm² (315–2947×); remaining flips are gzip.l9_accesses_low→1; gzip.decode_accesses_low→0.25; energy_pj.div_high→156; area_um2.sram_per_bit_low→0.08; brotli.decode_accesses_low→0.05. These area and energy figures are estimates, not measured silicon or an FPGA result. A finite scan is not a proof over every float64 pair.

## 16. Aethel Node 4D-SCP architecture (v0.1.9): isolated subsystem, physical layers, four-strategy proof bench

Status: software simulation only, fixtures only, unwired. Check: `scripts/check-scp-v019-bench.ts` (71 checks). Deterministic results: `fixtures/scp/v019-bench-report.json`. `pack.ts`, the stored chain, the v0.1 heads and the quantized sha `07a3d041…69d6bc` are unchanged and re-asserted by the check. Energy figures are model estimates, not silicon or FPGA measurements.

### 16.1 Why "v0.1.9" and not "v0.2"

The owner's first milestone is "4D-SCP v0.1 — Four-Dimensional State Compression Proof". This is still that proof, now with the four-strategy comparison and the named interfaces, so it continues the v0.1.x numbering. v0.2 stays reserved for the separately approved read-only surface (decision 5). Nothing here changes that decision.

### 16.2 State model S(x, y, z, t)

| Axis | In the subsystem | Notes |
|---|---|---|
| Spatial | grid cell (x, y, z) of `GridShape` | Defined for the first time here, for a **test-only synthetic** environment. Decision 1 still governs real data: no production spatial encoder exists, and the v0.1 frames keep x = predicted, y = observed, z = Φ. |
| State | `channels` per cell | Environment: c0 field, c1 relation, c2 occupancy, c3 sensor. v0.1 frames: 1×1×1 grid with 3 channels. |
| Relational | `Relation4D` (target ≈ bias + Σ w·source, same frame) | Schema, agreed out of band like a codebook; not stored in the stream. One level only (a source cannot be a target). |
| Time | frame index + integer epoch-ms `times` | Delta-varint coded; step/verdict side data round-trips losslessly. |

### 16.3 Subsystem interfaces (one entry module: `src/scp/subsystem/index.ts`, also re-exported as `subsystem` from `src/scp/index.ts`)

| Owner's name | File | What it does |
|---|---|---|
| state_encoder | `state-encoder.ts` | `gridEncoder` (environment → surface, validates shape/finite/relations); `encodeFramesAsSurface` (accepted v0.1 mapping); `encodeScpFrames` (existing `ScpFrame` type; invents no meta) |
| state_compressor | `state-compressor.ts`, `format.ts` | `full_f64`, `full_q`, `delta`, `tensor_bound`, `tensor_energy`, `scp4d` into one `S4DS` stream format. scp4d searches rank {0,1,2,4,8} × relations × predictor {zero,last,linear} and keeps the smallest; frames are written dense or sparse, whichever is smaller |
| temporal_state | `temporal-state.ts` | Append-only, event-driven surface. Closed loop: encoder and decoder predict from the same reconstructed history, so \|v − v′\| ≤ eps always. SHA-256-chained updates; out-of-order apply refused |
| state_reconstructor | `state-reconstructor.ts` | Decodes any stream from bytes plus the relation schema; `fidelity()` reports per-channel max abs error, RMSE, fraction within eps, bound_ok |
| state_predictor | `state-predictor.ts` | zero (base only), last value, linear extrapolation |
| compression_bench | `compression-bench.ts` | decision agreement with margin guarantees, dirty fraction, energy estimate from a caller-supplied table |

Reuse, not rewrite: the quantizer is the `pack.ts` rule (q = round(v/eps), −0 normalised, error checked); on the four frame fixtures the subsystem's `delta` values are asserted identical to `pack.ts decodeQuantized`, and the v0.1.8 integer golden model is asserted byte-identical to `pack.ts` on v0.1 and Medicare. The energy table is the v0.1.5 `defaultAssumptions()`.

Boundary: the subsystem imports only `./*`, `../pack`, `../types` and `node:crypto`; no clocks, randomness, env, Level 4, app or engine runtime (checked by both `check-scp-boundary` and `check-scp-v019-bench`). Nothing outside `scripts/` imports it.

### 16.4 Integration points (Workspace / Aethel Node / Workbench) — all future, additive, flag-gated, owner-approved

| Component | Existing place in the repo | How 4D-SCP would attach | Status |
|---|---|---|---|
| Workspace | `/workspace` (redirects to `/`), `/workspace/channel` | Where a tenant declares its environment schema (grid, channels, eps per channel, relations) for `gridEncoder` | not wired |
| Aethel Node | `src/product/saas.ts` (Aethel Node SaaS, MCP server `scripts/mcp-stdio.ts`), `src/core/compression/**` M1–M5, `scripts/sync-state-chains.ts`, anchors | Node-side service: one `TemporalStateSurface` per tenant stream; its update head could be anchored with the existing anchor flow; the customer-proof export could gain a `scp` field behind `SHIYAN_SCP=1` (same pattern as `state_compression`) | not wired; needs decision 5 |
| Workbench | `/workbench/global` (Global · misdiagnosis), `/workbench/medicare` | Read-only inspect page over `fixtures/scp/v019-bench-report.json`; the vertical's decisions (Φ class, eligibility, Medicare DQ rules in `src/lib/medicare/dq.ts`) become `DecisionTask4D`s run on reconstructed state | not wired; v0.2 |

Global · misdiagnosis stays the first test environment: the bench already runs its fixture decision rule (`fixtureEligible`, `phiClass`) and the 6-row synthetic Medicare file (not padded) as decision tasks.

### 16.5 Three-layer physical architecture (hypothesis; not the §11 evidence stages)

§11 uses "Layer 1/2/3" for **evidence stages** (software → emulation → proposition), and §11.2's "Layer 2 cost model" is that stage. The owner's physical chip layers are a different axis, so they are named **L1-Memory, L2-Compute, L3-Intelligence** here.

| Physical layer | Holds / does | Part of S(x, y, z, t) it carries | Software counterpart today |
|---|---|---|---|
| **L1-Memory** | Compressed state, near the compute: low-rank base (mean, B factors), held residuals H per element, current reconstructed frame, relation schema, append-only event log + hash head | The stable part (relations, low-rank spatial structure) and the latest state; never the full T×D history | `format.ts` blocks, `TemporalStateSurface` registers; working sets in the report (e.g. env T64 scp4d decode ≈ 32.8 KB vs tensor ≈ 1.1 MB batch encode) |
| **L2-Compute** | Per-element datapath: base MAC (rank-k or relation), predictor, subtract, deadband compare, quantize/dequantize, zigzag-varint codec | The change: residuals and events | `TemporalStateSurface.append/apply`, `writeFrameEvents`; the compact codec's integer golden model (v0.1.8) is the template for an integer-only version |
| **L3-Intelligence** | Agent-directed processing: picks eps per channel, the region of interest and the encoder config; consumes only events and dirty elements; runs decisions | The decision-relevant view | `DecisionTask4D`, the scp4d config search, `dirtyFraction` |

The 4D representation is distributed: structure (relations, low-rank modes) lives in L1 once; time is carried by events that L2 detects; L3 sees decisions computed from the reconstructed surface or directly from events.

### 16.6 Differentiation — what is demonstrated vs hypothesis

| Element | Demonstrated in software (v0.1.9) | Still a hypothesis |
|---|---|---|
| 4D state representation | S(x, y, z, t) surface with spatial, state, relational and time axes, round-trip from bytes | That real tenant data has this structure |
| Temporal + relational compression | Ablation, env T64: temporal only 54,851 B → + relations 29,885 B (1.84×). At T=256 a rank-2 low-rank base adds another 1.20× (119,567 → 99,808 B) | Gains on non-synthetic data |
| Event-driven computation | 11.2 % of element-frames are events at T64 (delta has 38.0 % nonzero) | Hardware energy saving from computing only on events |
| Adaptive reconstruction | Per-stream config search (rank/relations/predictor), dense/sparse frames, per-channel eps | Run-time adaptation by an agent |
| Agent-directed processing | Decision tasks with margin guarantees decide what "decision-relevant" means | An agent choosing eps/ROI on line |

Versus "just stacking three processor layers": the claim is about what moves between layers (events and residuals, not frames), not about the stacking.

### 16.7 Measurement → Outcome → Optimization

- **Measurement**: `BenchRow` (bytes, ratios, fidelity, events, dirty fraction, op counts, working sets, energy estimate) per strategy per fixture; compatible with the §6 `ScpMeasurement` fields.
- **Outcome**: decision agreement on the fixture's decision tasks, split into margin-safe slots (must be 100 % for bounded strategies; asserted) and near-boundary slots (reported).
- **Optimization**: the encoder search minimises bytes subject to eps; the next step is to minimise estimated energy subject to "no margin-safe decision flips", with eps per channel set from the decision margins.

### 16.8 Results (deterministic; full table in the JSON report and on stdout)

Bounded = meets \|v − v′\| ≤ eps on every element-frame. Ratios are vs `full_q` (same eps, every element every frame). Agreement is per task.

| Fixture (T × D) | full_f64 | full_q | delta | tensor_bound | tensor_energy (99.9 %) | scp4d |
|---|---|---|---|---|---|---|
| v0.1 (256 × 3) | 7,215 B | 2,982 B (1.00×) | 2,556 B (1.17×) | 3,169 B (0.94×, rank 2) | same as bound | **2,067 B (1.44×)** |
| A-medicare (6 × 3) | 215 B | **119 B** | 122 B | 205 B | 169 B, not bounded | 124 B (0.96×) |
| B256 (256 × 3) | 7,223 B | 2,615 B | 1,975 B (1.32×) | 4,213 B | 3,177 B, not bounded | **1,968 B (1.33×)** |
| B4096 (4096 × 3) | 114,927 B | 41,094 B | 30,734 B (1.34×) | 65,837 B | 49,441 B, not bounded | **30,616 B (1.34×)** |
| env 16×16×2, T64 (64 × 2048) | 1,048,759 B | 149,596 B | 131,643 B (1.14×) | 346,041 B (rank 39) | 312,249 B, not bounded | **29,885 B (5.01×)** |
| env 16×16×2, T256 (256 × 2048) | 4,194,871 B | 569,532 B | 525,567 B (1.08×) | 1,168,953 B (rank 125) | 956,985 B, not bounded | **99,808 B (5.71×, rank 2)** |

Decisions on the environment (anomaly, relation-break, occupancy, hotspot argmax): every strategy, scp4d included, keeps 100 % on the three threshold tasks. Hotspot argmax drops for every lossy strategy (T64: full_q/delta 93.8 %, tensor 98.4 %, scp4d 92.2 %) because the field is smooth and the top two cells are always within 2·eps (0 margin-safe frames). Frame fixtures: Φ class and eligibility are 100 % everywhere; the |x − y| > 0.1 gap task loses a few near-boundary rows (at most 0.4 %) for some strategies, never a margin-safe one.

Fairness probe (scp4d uses its whole eps as a deadband; full_q/delta round to eps/2): with scp4d run at eps/2 (the same worst-case error), it is still 2.49× (T64) and 2.65× (T256) smaller than delta on the environment and 1.26× on v0.1, but 0.95× (loses) on B4096.

Scaling: scp4d vs full_q 5.13× / 5.01× / 4.62× at 128 / 512 / 2048 cells (T64) and 4.39× / 4.57× / 5.01× / 5.05× / 5.71× at T = 16 / 32 / 64 / 128 / 256 (512 cells). The low-rank base is chosen only at T=256, once its factor cost is amortised.

Intrinsic dimensionality (centred energy, env T64): all channels with events k90 = 7, k99 = 24, k99.9 = 35; same seed with events off k90 = 2, k99 = 3; field channel alone k99 = 3. Low intrinsic dimensionality is real for the smooth part, and the sparse events are what raise it. Pure low-rank (tensor_energy) therefore compresses the stable part but is **not** eps-bounded: it smears the sparse events (relation channel max error 0.19 at T64). Combining a small base with event coding keeps the events exact to eps.

### 16.9 The five properties (verdicts)

| Property | Verdict | Evidence |
|---|---|---|
| State fidelity | **PASS** | full_q, delta and scp4d bounded on all 6 bench fixtures (scp4d also on the 6 scaling fixtures); tensor_bound bounded where its search succeeded; full_f64 bit-exact |
| Compression scaling | **PASS (measured range, not a law)** | 4.39–5.71× vs full_q over 128–2048 cells and T 16–256 |
| Temporal compression | **PASS on the environment; tie on single-cell streams** | 4.40× smaller than delta at T64; frame fixtures within ±25 % of delta (Medicare loses to full_q: 6 rows) |
| Computational efficiency | **MIXED (model estimate)** | Fewer bytes and fewer downstream updates at T64 (dirty 27.2 % vs full_q 38.6 %, tensor 77.4 %). But per element-frame decode is ≈ 45.8 pJ vs delta ≈ 34.1 and full_q ≈ 4.0 (estimates), the rank-2 base at T256 makes 80.9 % of elements dirty, and software scp4d decode was ~13× slower than delta on B4096 in one run (latency on stdout, not asserted) |
| Intelligence preservation | **PASS for threshold decisions** | No bounded strategy flips a margin-safe decision on any fixture; argmax over a smooth field is not preserved by any lossy strategy |

Critical success criterion ("reduce computational cost without degrading the agent's ability"): demonstrated for **bytes moved** and **downstream updates** on the synthetic environment with no margin-safe decision loss. **Not** demonstrated for per-element compute energy, which the model estimates is higher than delta/full_q. An integer-only, hash-free datapath (16.11) is needed before that can be argued.

### 16.10 Honest caveats

- The environment is synthetic and built to have structure (smooth modes, a declared neighbour relation, sparse events). The 5× result shows the mechanism, not real-world performance.
- On single-cell streams (v0.1, B256, B4096) there is no spatial structure to exploit; scp4d ties delta, and on 6 Medicare rows it loses to full_q.
- scp4d's encoder tries 18–30 configurations; its encode op counts and latency are for the chosen configuration only.
- Op counts are analytic formulas, not instrumented. Energy uses the v0.1.5 45 nm table with labelled assumptions. Latency is JS on one machine, reported only.
- `tensor_bound` keeps factors in float32 and its encode is batch (needs the whole T × D window). scp4d with rank > 0 is also batch at encode; with rank 0 it streams.
- The software temporal surface hashes every frame (SHA-256), which dominates its decode latency; a hardware design would hash per window.

### 16.11 Path: software simulation → golden vectors → FPGA/RTL

| Step | Deliverable | Evidence gate |
|---|---|---|
| 1. Software simulation (this) | Subsystem + bench + report | Deterministic report pinned; bounded strategies never flip a margin-safe decision |
| 2. Integer-only scp4d golden model (**done in v0.1.10, §17**) | Fixed-point predictor, relation MAC, deadband compare, quantize and codec, like the v0.1.8 compact codec; byte-identical to the float path or a documented bounded divergence | New format S4DI (documented divergence: sizes within 0–4.2% of v0.1.9); round-trip exact and eps-bounded on every fixture; widths with census + analytic bound |
| 3. Golden vectors (**done in v0.1.10, §17.7**) | `fixtures/scp/` input/output pairs for L2-Compute (per element: base, H, v → event, q) and for full streams | Re-generated by `check-scp-v0110` and compared byte for byte |
| 4. Cycle-approximate L1/L2 model (temporal-only path: **cycle-accurate RTL simulation in v0.1.11, §18**) | Memory traffic per frame (L1 reads/writes), events per cycle, dirty-set size | Agrees with the analytic op counts within a stated tolerance |
| 5. RTL on FPGA (L2 datapath + L1 SRAM) (v0.1.11: temporal-only RTL bit-exact in simulation + synthesis estimates, §18; no board yet) | Event detector + codec + MAC, verified against the golden vectors | Bit-exact on all vectors; measured LUT/FF/BRAM and power on a named board |
| 6. Hardware research proposition | §11 stage 3 | Claims only from step 5 measurements, labelled hypotheses otherwise |

This repo still has no HDL, no FPGA sources and no lab measurements. (As of v0.1.9. v0.1.11 adds simulated RTL under `hw/scp4d/`, §18. There are still no board or lab measurements.)

### 16.12 Open decisions for the owner

1. Swap the v0.1.7/v0.1.8 exact divider-free quantizer into `pack.ts` (still open; not done here).
2. Approve a real-data encoder for Medicare / Global · misdiagnosis (decision 1/2 still apply; nothing here encodes production data).
3. v0.2 read-only surface: Workbench inspect page over the report, an export field, both, or neither (decision 5).
4. ~~Whether step 2 (integer-only scp4d golden model) is the next milestone.~~ Done as v0.1.10 (§17); its own open decisions are in §17.10.

## 17. v0.1.10: integer-only, hash-free scp4d golden model and the compute-energy test

Test-only, like v0.1.8. Model: `scripts/scp-v0110-int-scp4d.ts`. Check: `scripts/check-scp-v0110.ts` (101 checks). Report: `fixtures/scp/v0110-int-report.json`. Reference vectors: `fixtures/scp/golden-vectors-scp4d.json`. Nothing in `src/` changed: `pack.ts`, the stored v0.1 heads (quantized sha `07a3d041…69d6bc`), the v0.1.9 subsystem, its streams and its report are byte-identical, and nothing outside `scripts/` imports the model. Energy and area figures are **model estimates** from the v0.1.5 45 nm table, not measurements. Every fixture is a labelled test fixture; the environment is synthetic.

### 17.1 Datapath contract

| Stage | What runs | Arithmetic |
|---|---|---|
| Ingest (shared by full_q, delta and scp4d-int) | v0.1.8 integer RN quantizer: x = round(v / g), g = eps / 2^G (scp4d-int) or eps (full_q, delta); bit-exact with `Math.round(v/eps)` | integer only; 16 ops per value incl. 1 integer RN-divide (10.6–24.3 pJ/value, estimate) |
| Setup (host, once per stream) | relation weights W = round(w · g_src/g_tgt · 2^16), bias likewise; low-rank fit (float SVD on the integer codes) quantized to int16 A_q, B_q with a common shift F; mean codes | may use floats; not per element |
| Hot path (encode and decode) | base (relation accumulator or Σ A_q·B_q), hold predictor (zero / last / linear), deadband compare, event quantizer q = (r + 2^(G−1)) >> G, c = pred + (q << G), codec | add/sub, shift, compare, integer multiply; no float, no division other than power-of-two shifts, no hashing (checked statically on the marked datapath region and dynamically: every intermediate must be a safe integer) |
| Audit (optional, off-datapath) | SHA-256 chain over (frame, t, positions, q) in the check script | never inside encode/decode |

**Error bound (proof, per element-frame).** |v − x·g| ≤ g/2, and the decoded code c satisfies |x − c| ≤ 2^G − 1 (hold) or ≤ 2^(G−1) (event), so |v − c·g| ≤ eps·(1 − 2^−(G+1)) < eps. The bound does not depend on the base or the predictor, so relation-weight precision and factor bits only change size and energy, never fidelity. Checked on every element-frame of every fixture (max |err|/eps 0.998 at G = 8).

**Format.** S4DI v1, a new format next to v0.1.9's S4DS (each decoder rejects the other's streams). Both stay valid. The v0.1.9 report and every v0.1.9 scp4d stream are unchanged (sha prefixes re-checked). Layout: header as in `golden-vectors-scp4d.json` `stream_format`; frames are adaptive sparse/dense, or all-dense without per-frame heads when D ≤ 8 (a static rule, so the encoder streams one frame at a time).

**Integer full_q and delta** produce S4DS streams byte-identical to the v0.1.9 subsystem's, so the three are compared under one op/energy accounting.

### 17.2 Register widths (census ≤ analytic bound ≤ declared width)

| Register | Declared | Max census bits (bench / golden vectors) | Note |
|---|---|---|---|
| code (x, c, pred, r, h1, h2, base) | 32 | 23 / 27 (medicare-6 vector at G = 8) | per-stream analytic bound ≤ 25 bits on the bench |
| q (event residual, eps units) | 32 | 14 / 19 | |
| relation weight W | 18 | 18 | |
| W·Δc product / relation accumulator | 48 / 48 | 35 / 38 (bench) | |
| low-rank factor A_q, B_q | 16 | 16 | int16 |
| A_q·B_q product / Σ_j accumulator | 32 / 40 | 31 / 32 | rank ≤ 8 |
| payload varint (zigzag) | 53 | 15 / 20 | |
| header varint (epoch-ms times, steps) | 54 | 43 | guarded by the safe-integer check |

The analytic bound is computed from max |x|, G and the stream's own setup values (Σ|W|, |bias|, |A_q|·|B_q|, |mean|), so it is a proof for that stream, not only an observation.

### 17.3 Results (bytes, error, decisions)

| Fixture | full_q | delta | v0.1.9 scp4d (float) | **scp4d-int, byte-optimal** | scp4d-int event path +relations | scp4d-int event path temporal-only |
|---|---|---|---|---|---|---|
| v0.1 (256×3) | 2,982 | 2,556 | 2,067 | **2,153** (rank 0, relations, linear, G 4) | 2,305 | 2,561 |
| Medicare (6×3) | 119 | 122 | 124 | **124** (zero predictor) | 127 | 127 |
| B256 | 2,615 | 1,975 | 1,968 | **1,968** | 1,968 | 1,980 |
| B4096 | 41,094 | 30,734 | 30,616 | **30,616** | 30,616 | 30,739 |
| env 16×16×2, T 64 | 149,596 | 131,643 | 29,885 | **29,948** | 29,948 | 54,985 |
| env 16×16×2, T 256 | 569,532 | 525,567 | 99,808 | **100,391** (rank 2) | 119,757 | 224,843 |

- Not byte-identical to v0.1.9 (new format, integer codes on a 2^−G finer grid, integer base). Sizes are equal on Medicare, B256 and B4096, +0.2% / +0.6% on the environment and +4.2% on v0.1.
- All scp4d-int streams meet eps on every element-frame and never flip a margin-safe decision. Environment threshold tasks (anomaly, relation-break, occupancy) stay at 100% like v0.1.9.
- Decision differences vs v0.1.9 are only in slots below the margin guarantee: B256 large-gap 255/256 (v0.1.9 256/256), B4096 large-gap 0.99805 (v0.1.9 0.99927; full_q and delta score 0.99829), env T 256 hotspot 0.777 (v0.1.9 0.773).
- G sweep (bytes vs grid): env T 64 shrinks 41,226 → 29,948 B from G = 1 to 8, because the deadband approaches the full eps.

### 17.4 Compute and energy (per element-frame; model estimates, low corner of each range)

Two decode contracts are reported, because they change the answer:
- **stream-out**: the decoder emits every decoded value each frame and keeps only algorithmic state.
- **resident surface**: the decoder keeps the current state S_t in memory for downstream compute. full_q must write every value; delta's previous-value memory already is S_t; scp4d-int uses its **event-driven decoder** (rank 0, last-value hold), whose work is proportional to events + relation fan-out + dirty targets, not to D.

| env 16×16×2, T 64 | bytes | dec ops/ef | dec pJ/ef stream-out | dec pJ/ef resident | enc pJ/ef incl. ingest | dec area µm² (estimate) |
|---|---|---|---|---|---|---|
| full_q (integer) | 149,596 | 5.42 | 0.60 | 5.60 | 11.2 | 1,161–4,233 |
| delta (integer) | 131,643 | 7.01 | 7.71 | 7.71 | 18.3 | 17,682–69,906 |
| v0.1.9 scp4d (float, committed) | 29,885 | 3.55 | 45.8 | — | 47.2 | 82,966–282,838 |
| scp4d-int byte-optimal (+relations) | 29,948 | 4.38 / 3.75 event-driven | 21.9 | 21.9 | 46.7 | 36,052–131,668 |
| **scp4d-int temporal-only event path** | 54,985 | 2.52 | — | **2.38** | 29.7 | 17,956–70,180 |

At T = 256 the picture is the same (temporal-only 2.41 resident vs delta 7.71 and full_q 5.58); the byte-optimal rank-2 stream costs 80.8 pJ/ef to decode. On the four single-cell frame fixtures (D = 3) almost every element changes every frame, so no scp4d-int path beats full_q or delta on energy (e.g. B4096 resident: temporal-only 10.97, delta 11.19, full_q 6.40).

Formulas (checked to equal the instrumented counts on every fixture): per element-frame the dense decoder spends base (relation: 1 add + 1 shift + 8 B; rank r: r mul + r+2 add + 1 shift + 4+2r B), hold (4 B read; linear +4 B and 2 ops), 1 compare, per event 1 add + 1 shift, per source with Δc ≠ 0 fan-out × (1 mul + 1 add + 16 B), plus 3 ops per varint byte and 2 per zigzag. The event-driven decoder spends per event 1 shift + 1 add + 8 B, per fan-out update 1 mul + 1 add + 16 B + a dirty-mark (2 ops, 1 B), and per dirty target 3 adds/shifts + 1 bit op + 19 B. Full formulas are `formulaScp4d`, `formulaEventDriven` and `formulaBaseline` in the check.

### 17.5 Verdict on the compute-energy claim: **MIXED**

- **Integer arithmetic helps:** byte-optimal scp4d-int decode is cheaper than the v0.1.9 float estimate on every fixture (0.10–0.97×; env T 64 21.9 vs 45.8 pJ/ef).
- **Holds — resident surface, environment, temporal-only event path:** 2.38 pJ/ef vs delta 7.71 and full_q 5.60, with a stream 2.72× smaller than full_q and 2.39× smaller than delta, eps-bounded, no margin-safe decision flipped.
- **Fails — the byte-optimal path with relations:** relations cut the stream another 1.84× but cost ~9× the decode energy (21.9 pJ/ef): each source event becomes four accumulator read-modify-writes plus a multiply. In this memory-priced model, relations are a bandwidth feature, not an energy feature.
- **Fails — stream-out decode:** when every value must be emitted each frame, full_q (no state) is cheapest everywhere.
- **Fails — encode:** temporal-only encode 29.7 pJ/ef vs delta 18.3 and full_q 11.2 (incl. the shared 10.6 pJ ingest). The encoder must read the hold state for every element of every input frame, and the one-frame event buffer (8·D B) used to pick the frame layout raises its working set.
- **Fails — single-cell frame streams** (v0.1, Medicare, B256, B4096).
- **System view (labelled scenario):** if stream bytes are priced as DRAM-class traffic (1.3–2.6 nJ per 64 bit), the relations path becomes the cheapest on the environment (≈59 vs 71 temporal-only, 171 delta, 191 full_q pJ/ef at T 64), because bytes then dominate.

So: the claim "reduce compute without degrading the agent" holds on-chip only for the decode side of the temporal event path on structured data; where the stream crosses a memory/link boundary, the fully compressed (relations) path wins. It does not hold for encode or for unstructured single-cell streams under this model.

### 17.6 Low-rank decision

Keep low-rank **out of the hardware datapath**; keep it as a host-side option. In fixed point (int16 factors, common shift) it stays within eps (the bound is base-independent) and it is the byte-optimal choice at T 256 (100,391 vs 119,757 B, −16%), but it changes ~80% of elements every frame (dirty 0.80 vs 0.28), needs a float SVD over the whole window on the host, and costs 3.6× the decode energy of the rank-0 path (80.8 vs 22.3 pJ/ef). The recommended hardware path is relations + events at rank 0, with relations switchable off when the stream stays on-chip.

### 17.7 FPGA reference vectors (`fixtures/scp/golden-vectors-scp4d.json`)

Five vectors, each with shape, eps bits, G, config, processing order, fixed-point relations, low-rank factors (where used), times/meta, input f64 bits, input integer codes, expected stream bytes (hex + sha256), expected decoded codes, expected events per frame, register maxima (abs and bits), analytic-bound bits, op counts and the off-datapath audit head:

| id | config | stream bytes | exercises |
|---|---|---|---|
| v0.1-first-16 | rank 0, relations, linear, G 8 | 185 | all-dense layout, linear hold, relation y ← x |
| medicare-6 | rank 0, zero predictor, G 8 | 124 | no-hold path, meta (step, verdict) |
| env-4x4x1-T8-relations-last | rank 0, relations, last, G 8 | 252 | adaptive sparse/dense frames, relation fan-out |
| env-4x4x1-T8-rank2-linear | rank 2, relations, linear, G 8 | 594 | int16 low-rank MAC + relation MAC |
| edge-handwritten-G2 | rank 0, relations (with bias), linear, G 2 | 68 | negatives, large jumps, near-deadband holds, bias |

`check-scp-v0110` regenerates the file and compares it byte for byte, then decodes every committed `expected_bytes_hex` back to `expected_decoded_codes`.

### 17.8 Honest caveats

- Energy and area are estimates from the v0.1.5 table; SRAM is priced per byte by working-set size with the same rule for every strategy; integer multiplies are priced as 32-bit (pessimistic for 16×16). Area counts adders, multipliers, SRAM bits and 32 B of flip-flops only; no control, no routing.
- The low-rank fit and relation-weight conversion are host-side floating point (setup, not per element). The ingest quantizer still contains an integer RN-divide (the v0.1.7/v0.1.8 divider-free variant is the open `pack.ts` decision).
- The resident-surface contract charges full_q 4 B of writes per element-frame; a different downstream contract changes the comparison, which is why both contracts are shown.
- The environment is synthetic and built to have structure. Results are not real-world gains.
- Latency is reported only (instrumented JS model: env T 64 decode ~10 ms vs delta ~6 ms); it says nothing about hardware speed.
- Search tries G ∈ {4, 8} × rank {0, 1, 2, 4, 8} × relations × predictor; encode costs are for the chosen configuration only.

### 17.9 Next steps on the §16.11 path

Step 4 (cycle-approximate L1/L2 model) can now use the event-driven decoder's memory traffic directly. Before RTL: (a) a streaming encoder without the per-frame event buffer, (b) relation evaluation on demand (only when a target is read) to test whether relations can become energy-neutral, (c) the divider-free ingest.

### 17.10 Open decisions for the owner

1. Which path is the hardware default: temporal-only (lowest on-chip energy) or relations (fewest bytes), or both behind a mode bit.
2. Whether to pursue (a)–(c) in §17.9 before a cycle-approximate model.
3. The earlier decisions in §16.12 (divider-free quantizer in `pack.ts`, real-data Medicare encoder, v0.2 read-only surface) are unchanged.

## 18. v0.1.11: RTL decoder for the temporal-only event path, verified in simulation

**What it is.** A synthesizable Verilog-2005 streaming decoder, `hw/scp4d/rtl/scp4d_tdec.v`, for S4DI v1 streams made with rank 0 and relations off (the "event-driven temporal-only" path behind the v0.1.10 2.38 pJ/ef estimate, §17.4–§17.5). It handles all three hold predictors: zero, last (event-driven: only event elements touch state) and linear (every element is updated every frame). It outputs the integer codes c[t][e]. A self-checking testbench, `hw/scp4d/tb/scp4d_tb.v`, compares every element of every frame bit-exact with the v0.1.10 model and counts clock cycles in Icarus Verilog. The `hw/` directory holds no TS/JS. The Next.js app, `tsc` and `next build` never see it, and nothing outside `scripts/` imports the v0.1.11 scripts. Check: `scripts/check-scp-v0111-rtl.ts`; report: `fixtures/scp/v0111-rtl-report.json`; new vectors: `fixtures/scp/golden-vectors-scp4d-temporal.json`.

### 18.1 Scope

| v0.1.10 vector | Config | RTL v0.1.11 |
|---|---|---|
| medicare-6 | rank 0, relations off, zero | **decoded bit-exact** |
| v0.1-first-16 | relations on, linear | rejected at the header: `unsupported`, code 9 (relations) |
| env-4x4x1-T8-relations-last | relations on, last | rejected: `unsupported`, code 9 |
| env-4x4x1-T8-rank2-linear | rank 2, relations on, linear | rejected: `unsupported`, code 8 (rank) |
| edge-handwritten-G2 | relations on, linear | rejected: `unsupported`, code 9 |

Relations (an accumulator RMW plus a 17×32 multiply per source event, the fan-out tables and the processing-order table) and the low-rank base are **out of scope for v0.1.11**. They are rejected, never mis-decoded. `fixtures/scp/golden-vectors-scp4d.json` is unchanged (sha `7e8b8165…`). Four new temporal-only vectors were **generated by the v0.1.10 model** (`encodeIntScp4d` → `decodeIntScp4d`), not hand-edited: v0.1-first-16 (last), env-4x4x1-T8 (last), env-4x4x1-T8 (linear) and the edge values at G = 2 (last). The two v0.1.10 environment streams (env-16x16x2 T64/T256, temporal-only) are regenerated deterministically. Their sha256 prefixes (`812c3fcc…`, `575fe164…`), byte counts and event-driven decode ops/ef (2.52344, 2.56948) are checked against `fixtures/scp/v0110-int-report.json`.

### 18.2 Microarchitecture

- **Front end:** at most 1 stream byte per cycle (`in_valid`/`in_ready`). The fixed header fields, the eps bytes (skipped), G, the times/steps varints (skipped, with the model reader's 8-byte / 2^53 limit enforced) and the verdict bytes (checked < 3) feed a header FSM. Rank, relations, predictor, FW = 16 and the layout byte follow. One 16 × 12-bit multiplier forms D = nx·ny·nz·C, header only.
- **Payload:** a shared 35-bit varint unit with zigzag decode. q is limited to signed 32 bits. Frame heads use 2n | dense. Sparse frames are (index/gap, q) pairs. The event-driven last-value path walks only event indices. Zero and linear sweep the non-event elements of sparse frames, 1 token per cycle with no byte.
- **Element pipeline:** token → A (sync-read H1/H2) → B (predict, `c = pred + q·2^G`, write, emit). Adjacent tokens to the same element are forwarded. State memories are 2 × 2^ADDR_W × 32 bit (ADDR_W = 11, D ≤ 2048). They are cleared in D background cycles that overlap the rest of the header; the first payload byte waits for the clear to finish.
- **Errors (`err`, `err_code`):** bad magic/version/predictor/FW, a long varint, q wider than 32 bits, sparse q = 0, an index ≥ D, a dense count ≠ n, or a 32-bit code overflow. `unsupported` covers rank > 0, relations, T = 0, D = 0 or > 2^ADDR_W, and G > 16.
- **Outputs:** an `(elem, code, event)` token per updated element plus `eof` per frame. There is no output back-pressure in v0.1.11.
- **Lint:** `verilator --lint-only -Wall` is clean, with one documented BLKSEQ waiver for combinational temporaries.

### 18.3 Measured cycles (Icarus Verilog, full-rate input)

The cycles are **measured** by simulating this RTL, and they are cycle-accurate for this design. They are counted from the first cycle after reset to `done`, inclusive. Every vector is bit-exact on all frames and elements, matches the per-frame event counts, consumes every byte, and is also bit-exact with pseudo-random input bubbles.

| Vector | Pred | Bytes | T×D (element-frames) | Events | Bit-exact | Cycles | Cycles/ef | Cycles/byte | Clear stall / sweep |
|---|---|---|---|---|---|---|---|---|---|
| medicare-6 (v0.1.10 vectors) | zero | 124 | 6×3 = 18 | 18 | yes | 128 | 7.11 | 1.032 | 0 / 0 |
| v0.1-first-16-temporal-last | last | 209 | 16×3 = 48 | 48 | yes | 213 | 4.44 | 1.019 | 0 / 0 |
| env-4x4x1-T8-temporal-last | last | 307 | 8×64 = 512 | 119 | yes | 316 | 0.617 | 1.029 | 5 / 0 |
| env-4x4x1-T8-temporal-linear | linear | 430 | 8×64 = 512 | 178 | yes | 759 | 1.48 | 1.765 | 5 / 320 |
| edge-handwritten-G2-temporal-last | last | 70 | 7×2 = 14 | 11 | yes | 74 | 5.29 | 1.057 | 0 / 0 |
| env-16x16x2-T64-temporal-last | last | 54,985 | 64×2048 = 131,072 | 27,590 | yes | 56,866 | **0.434** | 1.034 | 1,877 / 0 |
| env-16x16x2-T256-temporal-last | last | 224,843 | 256×2048 = 524,288 | 111,964 | yes | 226,340 | **0.432** | 1.007 | 1,493 / 0 |

**Closed form.** `cycles = bytes + max(0, D − header_tail_bytes) + sweep_tokens + 4` matches every measurement exactly, so the committed results can be re-checked without a simulator. Here sweep_tokens counts only the zero/linear sparse-frame tokens, and the 4 is the pipeline drain to `done`.

Five corrupted streams derived from env-4x4x1-T8-temporal-last are flagged with the expected codes: bad magic, bad version, rank := 1 (unsupported), relations := 1 (unsupported) and predictor := 3.

**Observed register maxima (bits):** code ≤ 27 (Medicare) and ≤ 17 on the environment, q ≤ 19, payload varint ≤ 19. All are within the declared widths (code 32, q 32) and the RTL's 35-bit varint.

### 18.4 Synthesis (ESTIMATES, not hardware measurements)

These numbers come from Yosys 0.71+50 and nextpnr-ice40 0.11.1 (oss-cad-suite 2026-11-18) for ADDR_W = 11. No board was programmed and no power was measured.

- **Generic gates:** 5,877 cells including 2 `$mem_v2` memories, about 518 flip-flops, and a longest topological path of 108 cells.
- **iCE40:** 1,985 SB_LUT4, 444 SB_CARRY, 661 flip-flops and 32 SB_RAM40_4K.
  - Place-and-route on an **iCE40-HX8K (ct256)**, seed 1: 2,524/7,680 logic cells, 32/32 BRAM (H1 + H2 at 2048 × 32 fill the device), 117 IOs (debug header outputs included). The timing estimate is **fmax ≈ 39.0 MHz**.
- **Xilinx 7-series (synth only):** about 1,084 LUTs, 518 flip-flops, 85 CARRY4, 4 RAMB36E1 and 1 DSP48E1 (the header D multiply).

### 18.5 Cycle-derived throughput vs the v0.1.10 op-count model

On env-16x16x2-T64:

- **v0.1.10 model:** 2.52 scalar ops per element-frame (event-driven decoder, header included, no parallelism assumed).
- **RTL:** 0.434 cycles per element-frame. That is 0.418 for the payload, plus 188 header bytes, a 1,877-cycle clear stall and 4 drain cycles. Each cycle does about 5.8 model-ops' worth of work (byte parse, zigzag, shift, add and compare in parallel).
- **What limits it:** the stream bytes. Last-value decode takes 1 cycle per byte, so throughput is set by compression (bytes per element-frame), not by events or D.
- **Throughput estimate:** at the estimated 39 MHz, that is about 90 M element-frames per second, or 39 MB/s of stream. This is an estimate from the measured cycles × the place-and-route fmax.

The linear predictor costs 1.48 cycles/ef on the small environment, because sparse frames must sweep every non-event element. This matches §17.5: only the last-value hold is event-driven.

### 18.6 What this does and does not prove

- **Proves:** the temporal-only S4DI v1 decode path (all three predictors) fits a small, synthesizable integer datapath. It decodes bit-exact against the v0.1.10 golden model on 7 streams (up to 524,288 element-frames). Its cycle cost is measured, has a closed form, and is 1 cycle per stream byte for the event-driven path. Out-of-scope streams are rejected safely.
- **Does not prove:** anything about energy. **No energy was measured.** The 2.38 pJ/ef figure is still a 45 nm op-count model estimate, and no per-cycle power figure is claimed. The synthesis and place-and-route numbers are tool estimates for one device, not a running FPGA. Relations and low-rank are not in hardware. The encoder and the ingest quantizer are not in hardware. Fixtures are synthetic or hand-written; there is no production data.

### 18.7 Running it (including WSL)

```bash
sudo apt install iverilog          # simulator (Ubuntu/WSL); optional: yosys verilator nextpnr-ice40
npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-scp-v0111-rtl.ts --require-sim
```

Without `iverilog`, the script prints `SKIP sim` and still runs its 33 counted checks against the committed results. It does the same with `--no-sim`. `--synth` reruns Yosys/nextpnr. `--write` refreshes the vectors file and report, and needs the simulator. Distro packages may be older than the versions in §18.4. Cycle counts depend only on the RTL, not the simulator version. Synthesis numbers can differ between Yosys/nextpnr versions.

### 18.8 Next steps on the §16.11 path

1. Relations in RTL (accumulator RMW + one multiplier, fan-out table), to put the relations energy question (§17.5) on measured cycles.
2. A multi-byte-per-cycle front end. The decoder is byte-bound, so 2–4 bytes per cycle is the throughput lever.
3. Program a board (iCE40-HX8K or a 7-series) and measure power, which would give the first energy number that is not a model.
4. The open decisions in §17.10 / §16.12 are unchanged.

## 19. v0.1.12: RTL relations decoder, and are relations worth it in hardware?

**What it is.** A second synthesizable Verilog-2005 decoder, `hw/scp4d/rtl/scp4d_rdec.v`, for the event-driven path with declared relations: S4DI v1 streams made with rank 0 and the last-value hold, with relations on or off. It implements the v0.1.10 model's `decodeFramesEventDriven` (§17.5) in hardware, and its output is the integer codes c[t][e], bit-exact with the model. `scp4d_tdec.v` (v0.1.11), its testbench, synthesis script, vectors and report are unchanged and pinned by sha256. A self-checking testbench, `hw/scp4d/tb/scp4d_rdec_tb.v`, loads the relation program, streams the vector, compares every element of every frame and counts cycles in Icarus Verilog. Check: `scripts/check-scp-v0112-rtl.ts` (27 counted checks, pinned in `check-scp-all`); report: `fixtures/scp/v0112-rtl-report.json`; new vectors: `fixtures/scp/golden-vectors-scp4d-relations.json`, generated by the v0.1.10 model, not hand-edited.

### 19.1 Scope

- **Decoded:** rank 0, last-value hold, relations on (a relation program must be loaded) or off. With relations off it decodes exactly like `scp4d_tdec` in last-value mode, at one extra cycle per stream (one more pipeline stage to drain).
- **Rejected at the header with `unsupported = 1`:** rank > 0 (code 8), and the zero or linear predictor (code 19). Zero and linear temporal-only streams stay on `scp4d_tdec`. Relations with zero or linear predictors are not in RTL yet.
- **Errors:** a relations stream with no program, or a program built for another D (code 20); accumulator or code overflow beyond the declared widths (code 18); and the v0.1.11 stream errors (magic, predictor > 2, q = 0 in a sparse event, …).
- **Program constraints**, enforced by the generator: D ≤ 2048, at most 1024 relations, 2048 fan-out entries, 15 fan-out entries per source, unique targets, and no target that is also a source.

| v0.1.10 vector | Config | v0.1.12 `scp4d_rdec` |
|---|---|---|
| env-4x4x1-T8-relations-last | rank 0, relations, last | **decoded bit-exact** |
| v0.1-first-16, edge-handwritten-G2 | relations, linear | rejected: unsupported, code 19 |
| medicare-6 | temporal-only, zero | rejected: unsupported, code 19 (decoded by `scp4d_tdec`) |
| env-4x4x1-T8-rank2-linear | rank 2 | rejected: unsupported, code 8 |

### 19.2 Relation program and microarchitecture

The relation schema is out of band, as in the model. A host runs the model's fixed-point setup (`fixRelations`, the `makePlan` order) and loads a program through a `cfg_*` port while reset is high. `scripts/scp-v0112-rtl-vectors.ts` `rtlProgram` builds it. The program has four parts:
- **ORD[i]:** maps processing position i to {is_target, element, relation index or fan-out start, fan-out count}.
- **FAN[j]:** fan-out entries {target element, relation index, 18-bit weight W}.
- **ACC[ti]:** 48-bit accumulators, loaded with the Q16 bias.
- **D and nT.**

Pipeline: the front end parses the header and varints and prefetches ORD, FAN and the dirty LIST from sync-read memories. Then come three stages: M (the 18×32 multiply W·q), A (memory read, then << G) and B (execute, write, emit). Back-to-back read-after-write to the same address is forwarded.

Per frame:
- A non-target event updates H1[e] += q·2^G and emits the element. If the element is a source, the byte parser stalls one cycle per fan-out entry, each doing ACC[ti] += W·q·2^G and marking ti dirty.
- A target event adds q·2^G to the target's hold residual and marks it dirty with its event flag.
- At frame end the decoder waits 4 settle cycles, then emits ((ACC + 2^15) >>> 16) + H1[tg] for each dirty target. In frame 0 it emits every target.

Every result is range-checked against the declared widths: code 32, q 32, rel_product 48 and rel_acc 48.

**Cycle model.** It matches the simulator exactly on every in-scope vector:

cycles = bytes + max(0, D − header_tail_bytes) + fan_out + [relations] (4·T + nT + Σ_{t≥1} dirty_targets(t)) + 5

### 19.3 Measured (Icarus Verilog, full-rate input; bit-exact on every row, also with random input gaps)

| Vector | Kind | Bytes | T×D | Cycles | Cycles/value | Cycles/byte |
|---|---|---|---|---|---|---|
| env-4x4x1-T8-relations-last (v0.1.10 file) | relations | 252 | 8×64 | 544 | 1.06 | 2.16 |
| v0.1-first-16-relations-last | relations | 193 | 16×3 | 294 | 6.13 | 1.52 |
| medicare-6-relations-last | relations | 127 | 6×3 | 168 | 9.33 | 1.32 |
| B256-relations-last | relations | 1,968 | 256×3 | 3,494 | 4.55 | 1.78 |
| edge-handwritten-G2-relations-last (bias ≠ 0) | relations | 66 | 7×2 | 111 | 7.93 | 1.68 |
| env-8x8x1-T16-relations-last | relations | 1,241 | 16×256 | 3,957 | 0.966 | 3.19 |
| **env-16x16x2-T64-relations-last** | relations | **29,948** | 64×2048 | **104,547** | **0.798** | 3.49 |
| **env-16x16x2-T256-relations-last** | relations | **119,757** | 256×2048 | **419,192** | **0.800** | 3.50 |
| env-16x16x2-T64-temporal-last | temporal | 54,985 | 64×2048 | 56,867 | 0.434 | 1.03 |
| env-16x16x2-T256-temporal-last | temporal | 224,843 | 256×2048 | 226,341 | 0.432 | 1.01 |

The three small temporal-only last-value vectors from v0.1.11 also decode bit-exact, each at the `scp4d_tdec` cycle count + 1. Fourteen out-of-scope or corrupted streams and programs are rejected with the expected code.

**Where the relations cycles go (env T64):**

| Component | Cycles | Share |
|---|---|---|
| Stream bytes | 29,948 | 28.6% |
| Fan-out accumulator updates (13,446 source events) | 50,352 | 48.2% |
| Dirty-target flush (frame 0: 512) | 22,109 | 21.1% |
| Frame settle (4 × 64) | 256 | 0.2% |
| Memory-clear stall | 1,877 | 1.8% |
| Drain | 5 | <0.1% |

### 19.4 Synthesis and place-and-route (tool ESTIMATES, one seed; no board)

| | `scp4d_tdec` (v0.1.11) | `scp4d_rdec` (v0.1.12) |
|---|---|---|
| ECP5 LFE5U-45F, full parameters: fmax | 46.8 MHz | 54.5 MHz |
| ECP5: LUT4 / FF / EBR (DP16KD) / MULT18 | 2,050 / 661 / 8 / 1 | 2,969 / 1,094 / 18 / 3 |
| iCE40-HX8K, full parameters (D ≤ 2048) | 2,524 LC, 32/32 BRAM, 39.0 MHz | **does not fit**: needs 69 of 32 BRAM (5,308 LC) |
| iCE40-HX8K at ADDR_W = 9 (D ≤ 512), both fit | 2,348 LC, 8 BRAM, 42.2 MHz | 5,019 LC, 18 BRAM, 41.2 MHz |
| Xilinx 7-series (yosys synth only) | ~1,084 LUT, 518 FF, 4 RAMB36, 1 DSP | ~1,848 LUT + 16 RAM64M, 790 FF, 3 RAMB36 + 11 RAMB18, 3 DSP |

The rdec fmax is not lower than tdec's because its multiply and shift each sit in their own stage. Its extra cost is area: the program memories (ORD, FAN, ACC, LIST, DST) and the multiplier.

### 19.5 Verdict: it depends on where the stream lives

- **Inside the decoder, relations are not worth it.** On env T64 they cut the stream 1.84× (54,985 → 29,948 B), but they cost 1.84× the measured cycles (0.434 → 0.798 cycles per element-frame) and about 1.45× the ECP5 LUTs, 2.25× the block RAM and 3× the multipliers. At each design's ECP5 fmax estimate, temporal-only decodes about 108 M element-frames/s against 68 M for relations. T256 is the same: 1.88× fewer bytes for 1.85× the cycles.
- **Across a slow link, relations win.** Decode time is max(bytes / link, cycles / fmax). Using measured cycles and ECP5 fmax estimates, the relations decoder finishes first when the stream arrives at less than **~28.7 MB/s** on T64 (~29.2 MB/s on T256).
- **Energy is a labelled estimate.** Using the v0.1.10 model's extra decode energy (21.90 − 2.38 = 19.5 pJ per element-frame) against 0.191 B saved per element-frame, relations pay off when moving a stream byte costs more than **~102 pJ/B**. DRAM-class traffic (162.5–325 pJ/B in the model table) clears that bar. On-chip SRAM (1.25–2.5 pJ/B) does not. In decoder-cycle terms, a stream byte has to cost more than ~1.9 decoder cycles' energy. That cycle energy is not measured.
- **Projection (not measured).** Banking the accumulators so a source event's whole fan-out (≤ 4 entries) updates in one cycle would cut env T64 to about 67,641 cycles (0.516 per element-frame). That's still above temporal-only, because the dirty-target flush remains.

### 19.6 What this does and does not prove

- **Proves:** the relations path of the integer golden model is implementable in synthesizable RTL. It is bit-exact on 8 relations streams, including both environment streams behind the v0.1.10 estimates, a non-zero bias, and random input gaps. It also has an exact, closed-form cycle cost, and it's the first measured cycles-vs-bytes trade-off for relations.
- **Does not prove:** energy or power, since nothing was measured. It also doesn't prove timing on a board, since the fmax and area figures are tool estimates for one seed. Nor does it cover relations with the zero or linear predictor, low-rank in hardware, or the encoder. All data is synthetic or hand-written test data. The "link-bound" and "pJ/B" break-evens are labelled scenarios.

### 19.7 Running it (including WSL)

```bash
sudo apt install iverilog
npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-scp-v0112-rtl.ts --require-sim
npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-scp-v0112-rtl.ts --synth   # needs yosys, nextpnr-ice40, nextpnr-ecp5 (oss-cad-suite)
```

Without a simulator it prints `SKIP sim` and runs the same 27 counted checks against the committed report.

### 19.8 Next steps on the §16.11 path

1. A banked or parallel fan-out and a fan-out FIFO that overlaps accumulator updates with byte parsing. That's the main cycle lever for relations (48% of the cycles).
2. Smaller program memories, so the relations decoder fits the iCE40-HX8K at D = 2048. Options are packing ORD and FAN, or deriving the order from a target bitmap.
3. Relations with the linear predictor, which the v0.1.10 byte-optimal search picks on some fixtures.
4. A board and a power measurement, the first non-model energy number.

## 20. v0.1.13: a front end that reads W = 1, 2 or 4 bytes per cycle

**What it is.** A W-byte-per-cycle input front end, `hw/scp4d/rtl/scp4d_fe_w.v`, and two decoders built on it. `hw/scp4d/rtl/scp4d_tdec_w.v` is the temporal-only path (zero / last / linear). `hw/scp4d/rtl/scp4d_rdec_w.v` is the relations path (rank 0, last-value hold). Both were measured at W = 1, 2 and 4 in Icarus Verilog against the v0.1.10 model's vectors. `scp4d_tdec.v`, `scp4d_rdec.v`, their testbenches, synthesis scripts, vectors and reports (v0.1.11 / v0.1.12) are unchanged and sha256-pinned. Check: `scripts/check-scp-v0113-rtl.ts` (27 counted checks, pinned in `check-scp-all`, same count with or without a simulator). Report: `fixtures/scp/v0113-rtl-report.json`. Cycle model: `scripts/scp-v0113-rtl-model.ts`. No new vectors: every input is an existing v0.1.10 / v0.1.11 / v0.1.12 vector or a corrupted copy of one.

### 20.1 Microarchitecture

- **Front end (`scp4d_fe_w`).** W-byte valid/ready beats (`in_nbytes` ≤ W) go into a 2W-byte queue. Header bytes are delivered one per cycle. After the layout byte, a tokenizer cuts up to W bytes per cycle into LEB128 varint tokens and carries partial varints across beats (more than 5 bytes → error 13). It also pre-decodes zigzag q, q ≠ 0 and the 32-bit range, and pushes the result to a (2W + K)-token queue. `in_ready` and the push enable depend only on registered counts.
- **`scp4d_tdec_w`.** The state memory is split into P = W banks (element e → bank e mod P). Each cycle an issue chain takes up to W steps, each a sparse event (one token pair) or one element of a dense or sweep run. The chain stops early when tokens run out, at a bank conflict, at frame end or at W steps. Each bank keeps `scp4d_tdec`'s A/B pipeline with forwarding. Memory clear takes ⌈D/P⌉ cycles.
- **`scp4d_rdec_w`.** `scp4d_rdec`'s datapath is byte-identical (program and state memories, multiply, execute, write ports, fan-out / settle / flush / pipeline tail; the check compares the source regions). The byte parser is replaced by a token parser that, for W ≥ 2, retires head + first index and q + next gap in one cycle. That's one event per cycle. A second event per cycle would need a second ORD read and more H1 / ACC ports, so W = 4 only widens the tokenizer.
- **Cycle model.** It matches the simulator exactly for every in-scope vector at every W. It is a register-transfer model (`tdecWCycleModel`, `rdecWCycleModel`): cycles = the last frame's end cycle + 4 drain (tdec_w) or + 5 (rdec_w). The cycles split exactly into header + memory-clear wait + payload issue cycles (tdec_w: ⌈steps/W⌉ plus bank-conflict and token-starvation cycles per frame) or + parse + fan-out + settle + flush (rdec_w) + drain; the report records each class per run and the check verifies the sum.

### 20.2 Measured cycles (Icarus Verilog, full-rate input; bit-exact on every row at every W, also with random input gaps)

Temporal-only, `scp4d_tdec_w`. The baseline is `scp4d_tdec`, v0.1.11:

| Vector | Bytes | T×D | v0.1.11 | W = 1 | W = 2 | W = 4 | W4 vs W1 |
|---|---|---|---|---|---|---|---|
| medicare-6 (zero) | 124 | 6×3 | 128 | 130 | 106 | 94 | 1.38× |
| v0.1-first-16-temporal-last | 209 | 16×3 | 213 | 215 | 169 | 146 | 1.47× |
| env-4x4x1-T8-temporal-last | 307 | 8×64 | 316 | 314 | 199 | 145 | 2.17× |
| env-4x4x1-T8-temporal-linear | 430 | 8×64 | 759 | 746 | 414 | 250 | 2.98× |
| edge-handwritten-G2-temporal-last | 70 | 7×2 | 74 | 76 | 65 | 61 | 1.25× |
| **env-16x16x2-T64-temporal-last** | 54,985 | 64×2048 | 56,866 | **56,865** | **28,444** | **15,494** | **3.67×** |
| **env-16x16x2-T256-temporal-last** | 224,843 | 256×2048 | 226,340 | **226,339** | **113,181** | **61,705** | **3.67×** |

On env T64 that's 0.434 → 0.217 → 0.118 cycles per element-frame. At W = 4, 2,548 of the 14,960 payload cycles end on a bank conflict (17%). Header (189) and clear (341–1,877) are fixed costs, and they dominate the small vectors.

Relations path, `scp4d_rdec_w`. The baseline is `scp4d_rdec`, v0.1.12:

| Vector | Kind | Bytes | v0.1.12 | W = 1 | W = 2 | W = 4 | W2 vs W1 |
|---|---|---|---|---|---|---|---|
| env-4x4x1-T8-relations-last | relations | 252 | 544 | 531 | 486 | 486 | 1.09× |
| v0.1-first-16-relations-last | relations | 193 | 294 | 268 | 267 | 267 | 1.00× |
| medicare-6-relations-last | relations | 127 | 168 | 141 | 138 | 137 | 1.02× |
| B256-relations-last | relations | 1,968 | 3,494 | 3,381 | 3,380 | 3,380 | 1.00× |
| edge-handwritten-G2-relations-last | relations | 66 | 111 | 109 | 109 | 109 | 1.00× |
| env-8x8x1-T16-relations-last | relations | 1,241 | 3,957 | 3,933 | 3,379 | 3,379 | 1.16× |
| **env-16x16x2-T64-relations-last** | relations | 29,948 | 104,547 | **104,226** | **89,538** | **89,538** | **1.16×** |
| **env-16x16x2-T256-relations-last** | relations | 119,757 | 419,192 | **418,354** | **359,304** | **359,304** | **1.16×** |
| env-16x16x2-T64-temporal-last | temporal | 54,985 | 56,867 | 56,866 | 30,349 | 30,295 | 1.87× |
| env-16x16x2-T256-temporal-last | temporal | 224,843 | 226,341 | 226,340 | 115,086 | 114,861 | 1.97× |

The three small temporal-only last-value vectors also decode bit-exact (216/172/171, 315/229/228 and 77/69/69 cycles). W = 1 is never more than 4 cycles above the single-byte baselines and is often below them, because the token parser drops the per-byte state. Corrupted or out-of-scope streams are rejected with the expected code at every W: 13 on tdec_w, 17 on rdec_w. These include new token-path negatives: q = 0 (15), first index ≥ D and a gap past D (16, also in the merged head + index and q + gap cycles), and a 6-byte varint (13).

**Amdahl on relations (env T64, W = 2):** header 189 + clear 1,877 + parse 14,750 (14,686 paired) = stream side. Fan-out 50,352 + settle 256 + flush 22,109 = core, **81% of cycles**. With an infinitely wide input the limit is 1.43× over W = 1. **Projection (not built, optimistic):** splitting fan-out and flush across 2 / 4 conflict-free ACC/LIST banks behind the W = 2 front end would give ~53,308 / ~35,193 cycles (0.41 / 0.27 cycles per element-frame).

### 20.3 Synthesis and place-and-route (tool ESTIMATES, one seed, --freq 12; no board)

Every configuration, baselines included, sits in the same thin wrapper, `hw/scp4d/synth/scp4d_pnr_wrap.v`. Outputs are registered and XOR-folded to 16 pins, and the relation program loads through a 1-bit shift register. The wrapper is needed because W = 4 has more ports than the package has pins. Baseline numbers therefore differ slightly from §18.4 / §19.4.

| ECP5 LFE5U-45F, full params | LUT4 | FF | EBR | MULT18 | fmax (est.) |
|---|---|---|---|---|---|
| `scp4d_tdec` (v0.1.11) | 1,980 | 783 | 8 | 1 | 46.5 MHz |
| `scp4d_tdec_w` W = 1 | 2,549 | 1,088 | 8 | 1 | 52.4 MHz |
| `scp4d_tdec_w` W = 2 | 5,573 | 1,702 | 8 | 1 | 41.2 MHz |
| `scp4d_tdec_w` W = 4 | 13,920 | 2,948 | 8 | 1 | 22.0 MHz |
| `scp4d_rdec` (v0.1.12) | 3,160 | 1,283 | 18 | 3 | 54.8 MHz |
| `scp4d_rdec_w` W = 1 | 3,630 | 1,488 | 18 | 3 | 54.8 MHz |
| `scp4d_rdec_w` W = 2 | 4,642 | 1,622 | 18 | 3 | 50.2 MHz |
| `scp4d_rdec_w` W = 4 | 6,233 | 1,810 | 18 | 3 | 52.7 MHz |

iCE40-HX8K at ADDR_W = 9 (D ≤ 512):
- tdec: 2,487 LC, 38.4 MHz
- tdec_w W1: 3,131 LC, 45.1 MHz
- tdec_w W2: 6,123 LC, 30.4 MHz
- tdec_w W4: **does not fit** (out of logic cells)
- rdec: 5,262 LC, 39.5 MHz
- rdec_w W1: 5,622 LC, 40.5 MHz
- rdec_w W2: 6,818 LC, 37.3 MHz
- rdec_w W4: **does not fit**

Xilinx 7-series LUT counts (yosys only) are in the report. Differences of a few MHz between seeds are noise; for example rdec_w W = 4 coming out above W = 2.

### 20.4 Throughput (measured cycles × estimated ECP5 fmax)

| env T64 | W = 1 | W = 2 | W = 4 | baseline |
|---|---|---|---|---|
| temporal-only, M element-frames/s (stream MB/s) | 121 (50.6) | **190 (79.6)** | 186 (78.1) | 107 (45.0) |
| relations, M element-frames/s (stream MB/s) | 68.9 (15.8) | 73.5 (16.8) | 77.1 (17.6) | 68.6 (15.7) |

T256 is within 1%.

### 20.5 Verdict

- **Temporal-only: wider input pays off, up to W = 2.** It takes 2.00× fewer cycles at W = 2 and 3.67× at W = 4. In time (with ECP5 estimates) that's ~1.77× over v0.1.11 at W = 2. W = 4 is no faster than W = 2 in time, because its 4-step issue chain roughly halves fmax, and it costs 2.5× the LUTs. **W = 2 is the sweet spot.**
- **Relations: barely.** It takes 1.16× fewer cycles at W = 2 and nothing more at W = 4. The stream was already only ~19% of the cycles once tokens replace bytes.
- **New bottleneck.** On the temporal path it's the combinational issue chain (token select → step decode → index add → bank check, repeated W times, then the queue pop), which sets fmax, plus bank conflicts at W = 4. On the relations path it's the one-accumulator-update-per-cycle fan-out and the dirty-target flush.
- **Relations vs temporal-only: same answer, stronger.** Inside the decoder, relations are now ~2.6× slower in time at W = 2 (1.75× at W = 1). They finish first only when the link is slower than ~30.8 MB/s on T64 (W = 2; ~28.7 MB/s in v0.1.12). Temporal-only stays the hardware default. Relations only become competitive with banked fan-out and flush (§20.2 projection).
- **Energy:** not measured.

### 20.6 What this does and does not prove

- **Proves:** a W-byte front end can feed both RTL decoders bit-exact at W = 1, 2, 4, on every existing temporal and relations vector, with random input gaps and corrupted streams. The cycle cost is exact and modelled. The measured cycle gains and the move of the bottleneck from the stream to the decoder core are shown in both paths.
- **Does not prove:** timing on a board (fmax and area are one-seed tool estimates), energy or power, relations with zero / linear predictors, low-rank in RTL, or the encoder. All data is synthetic or hand-written.

### 20.7 Running it (including WSL)

```bash
sudo apt install iverilog
npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-scp-v0113-rtl.ts --require-sim
npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-scp-v0113-rtl.ts --synth --write   # ~4 min; needs yosys, nextpnr-ecp5, nextpnr-ice40 (oss-cad-suite)
```

Without a simulator it prints `SKIP sim` and runs the same 27 counted checks against the committed report.

### 20.8 Next steps on the §16.11 path

1. A banked fan-out and flush for `scp4d_rdec_w` (2–4 ACC/LIST banks), the only lever left for relations.
2. Pipeline the `scp4d_tdec_w` issue chain (precompute the bank pattern per token, or split it into two stages), so W = 4 keeps W = 2's fmax.
3. Fold the header and memory clear into the wide path (one fixed ~190 + D/W cycle cost per stream).
4. A board and a power measurement.
