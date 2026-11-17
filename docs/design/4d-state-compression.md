# 4D State Compression Engine: design (draft, not implemented)

Status: M1 to M5 are implemented:
- M1: pure core.
- M2: read-only per-tenant reader, a local CLI, off by default.
- M3: window sealing, opt-in bounded-loss, anchors context.
- M4: append-only persistence in `shiyan.state_segments`.
- M5: a read-only `state_compression` field in the customer proof export, plus anchoring of the chain head in the independent anchors project.
- Scheduled sync: `scripts/sync-state-chains.ts` plus a workflow staged at `ops/github/state-chain-sync.yml` (install it at `.github/workflows/`); inert until configured.

Migration `004_shiyan_state_segments.sql` is applied on prod (verified 2026-11-16). Migration `005_shiyan_state_chain_anchors.sql` (anchors project) exists but this work does **not apply** it; the owner does.

The export field is off by default. It appears only when `SHIYAN_STATE_COMPRESSION=1` is set on the deployment.

Outside `src/core/compression/` and the compression scripts, the only existing files changed are:
- the schema guard (`src/core/schema-guard.ts`, `scripts/check-schema.ts`);
- in M5, `src/app/api/v1/customer-proof/[id]/route.ts` (additive and flag-gated).

Designed on `main` at `2a09d82`.

## 1. Inspiration (SIMA 2), stated honestly
SIMA 2 is Google DeepMind's Gemini-based agent for 3D virtual worlds. It follows instructions given in language and images, reasons about goals, and converses with users [1][2]. Its self-improvement loop works like this: Gemini sets a task and estimates a reward for the agent's behaviour, and the result goes into a **bank of self-generated experience** that trains the next generation of the agent [1]. In the paper, Gemini rates each trajectory (video) from 0 to 100 against a rubric calibrated to human preferences, and a score of 50 or more counts as a success [2]. Failed tasks are retried with hints until the agent succeeds [3].

What we borrow is only the idea of a **compact, scored experience bank that later learning reads from**. SIMA 2 does not describe a "4D state compression engine". That name and everything below are ours. We do not train models here.

## 2. What "4D state" means in this codebase
Every verified run already carries the triple `SystemState { predictedValue, observedValue, phi }` plus a `step` (`src/core/metamorphic.ts`, `metamorphic-runtime.ts`). Standard runs store these as `metamorphic.transformation.inputs = {predicted, observed, phi, step}` inside `ExperienceRecord` (`run-contract.ts`). Stored runs also have a time axis: `proof_timestamp` (`shiyan.experiences`) and `provenance.timestamp`.

**4D state = (predicted, observed, Φ) × time, per tenant.** Each tenant has an append-only trajectory of points `(t, predicted, observed, phi)` plus that run's verdict. Δe = |predicted − observed| can be derived, so it is not stored.

## 3. Purpose
- Turn a tenant's experience history (the **Learn** end of Connect → Execute → Prove → Learn) into a small, deterministic, content-addressed trajectory summary that the ROE and next-action code could read without loading every full record.
- Every compressed segment can be checked against its sources: the original `content_sha256` values can be recomputed, and reconstruction can be verified.
- Read-only toward everything that already exists.

## 4. Inputs (existing records only)
| Source | Fields used | Phase |
|---|---|---|
| `shiyan.experiences` (storage DB) | `tenant_id`, `experience_id`, `content_sha256`, `proof_timestamp`, and from `record_json`: `metamorphic.transformation.inputs`, `metamorphic.seed`, `metamorphic.result`, `verification.replay_verdict`, `provenance.run_id` | 1 |
| `shiyan_anchor.recovery_records` (anchors DB) | `prior_predicted`, `synthesized_predicted`, `phi_lift`, `status`, `record_sha256` (as annotations on points) | 3 |
| `shiyan_anchor.reference_anchors` | `reference_id`, `commit_sha`, `snapshot_sha256` (context: which code state a segment covers) | 3 |
| `src/lib/run-store.ts` (Vercel KV `PersistedRun`: e, e_baseline, phi) | out of scope: KV is mutable and not append-only | — |

Records whose inputs can't be parsed, or that are not `provenance.source = "third-party-workbench"`, are **excluded and counted**, never guessed. The engine only reads real stored records. It never generates or backfills production data.

## 5. Compressed representation
A **segment** covers up to N points (default 256) of one tenant's trajectory, ordered by `(proof_timestamp, experience_id)`.

```
StateSegment v1 = {
  version: "aethel.state-segment/1", tenant_id, seq,              // seq = 0,1,2… per tenant
  t0, dt[],                                                        // ms: first timestamp + deltas
  predicted[], observed[], phi[], step[],                          // lossless float64 columns, delta-coded
  verdict[],                                                       // PASS/FAIL/INCONCLUSIVE codes
  source_ids_root,                                                 // Merkle root over (experience_id, content_sha256)
  excluded: { count, reasons },
  loss: { mode: "lossless" } | { mode: "bounded", eps: {predicted, observed, phi}, max_abs_err: {...} },
  prev_segment_sha256 | null
}
segment_sha256 = sha256(canonical(segment))
```
- **Canonical form** reuses `canonical()` / `sha256Canonical()` from `src/core/reconcile.ts`, imported and not modified, so hashes match recovery_records and the proof publisher.
- **Lossless is the default.** JSON numbers round-trip float64 exactly, so `reconstruct(segment)` yields exactly the original points. Verification refetches the sources, recomputes `source_ids_root` and the points, and compares them byte for byte.
- **Bounded-loss is opt-in (phase 3).** It quantizes each axis to a grid `eps`, so the error per value is at most eps/2. `max_abs_err` holds the measured maximum, and the verifier recomputes it from the sources and rejects the segment if it exceeds the stored value. Verdicts, ids and the time axis are never lossy.
- An honest expectation is that most of the size reduction comes from dropping the full record text (goal, action, the transformations JSON). Delta-coding the floats adds only a little.

## 6. Determinism and proof
- Pure core: no `Date.now`, no `Math.random`, no I/O. The same inputs always produce the same bytes and the same `segment_sha256`.
- **Per-tenant chain:** each segment's `prev_segment_sha256` points to the previous segment, like the `prev_record_sha256` chain in `recovery_records`. `verifyChain(tenant)` walks it from seq 0.
- The DB's `created_at` is excluded from the hash. Segments are built only from closed windows (full N, or an explicit seal), so re-running gives the same result.

## 7. Tenant boundary
The tenant comes only from server-side `authenticateTenant` and must match `TENANT_ID_PATTERN`. Every query filters by `tenant_id = $1`. The hash includes `tenant_id`, and segments never mix tenants. Cross-tenant reads return 404, the same as `verifiedOutcome` in `run-contract.ts`.

## 8. Storage
- **Phases 1–2: in memory only.** No table.
- **Phase 4 (built as M4):** migration `db/migrations/004_shiyan_state_segments.sql` on the storage project. See "M4 as built" for the final shape, which extends this sketch.

## 9. Module layout (new, isolated)
```
src/core/compression/
  types.ts        StateSegment, StatePoint, LossMode
  extract.ts      ExperienceRecord -> StatePoint | Excluded (pure)
  encode.ts       compress(points, opts) -> StateSegment; reconstruct(segment) (pure)
  verify.ts       verifySegment(segment, sources); verifyChain(segments) (pure)
  source.ts       read-only tenant SELECT over shiyan.experiences (own query; no change to NeonExperienceStore)
  index.ts        narrow interface: compressTenant(tenant, deps) / verifyTenant(tenant, deps)
```
Allowed imports: `experience-schema.ts` (types and validator), `reconcile.ts` (`canonical`), `tenant-auth.ts` (pattern), and `neon-db.ts` (pool, in `source.ts` only). These modules must **not** import `metamorphic.ts`, `metamorphic-runtime.ts`, `deterministic-proof.ts`, `self-engine.ts`, or anything under `src/lib/level4/`. Segments record the stored verdict as-is. Recomputing verdicts stays the job of `run-contract`.

**Feature flag:** `SHIYAN_STATE_COMPRESSION=1`, off by default, introduced in M2. M1 has no runtime wiring, so it needs no flag. Phases 1–3 add no route. When the flag is off, nothing is loaded or executed.

## 10. Explicitly untouched
The Level 4 plant is `src/lib/level4/*`, `src/components/Level4Shell.tsx`, `src/app/api/level4/*` and `docs/level4-*`. It, along with `MetamorphicEngine` (`src/core/metamorphic.ts`), `src/core/metamorphic-runtime.ts`, the existing tables, triggers and grants, `run-contract`, `reconcile`, `github-reference` and all existing routes except the customer proof export, is **not modified or imported** by this subsystem. The customer proof export route (M5) imports exactly one read-only module, `src/core/compression/export-reader.ts`, behind a flag that is off by default. The change is additive only, so nothing breaks.

## 11. Test plan (fixtures in tests only)
- Fixtures: hand-written `ExperienceRecord`s built inside `scripts/check-compression.ts` (the repo's check-script convention), never written to any database.
- Round trip: `reconstruct(compress(x))` deep-equals x (lossless). Property test over random float64 values, including -0, tiny, huge and repeated values.
- Determinism: compressing twice, and with shuffled input order, gives the same `segment_sha256`.
- Tamper: flipping any value, id, verdict or `prev` link makes `verifySegment` or `verifyChain` fail.
- Tenant isolation: a tenant-B record in tenant-A input is excluded, and verification across tenants fails.
- Bounded-loss: the measured `max_abs_err` is ≤ eps/2, and a verifier given a smaller stored error rejects the segment.
- Import-boundary check script: fails if `src/core/compression/**` imports a forbidden module.
- Existing suites must still pass, with the 2 pre-existing failures unchanged.

## 12. Milestones (smallest slice first)
1. **M1, pure core:** `types`, `extract`, `encode`, `verify` plus unit tests. Lossless only, no DB, no flag needed.
2. **M2, read-only source:** `source.ts` plus a local CLI script that compresses and verifies one tenant from a `--storage-file` URL and prints only hashes and counts. Behind the flag.
3. **M3, enrichment and bounded-loss:** recovery_records and reference_anchors annotations, plus opt-in eps quantization. **Done (2026-11-16)**, with window sealing (open question 4).
4. **M4, persistence:** migration 004, schema-guard expectation, append-only writer. **Done (2026-11-16)**.
5. **M5, consumer:** the tenant-authenticated customer proof export (decided 2026-11-16, see open question 6), plus anchoring of the chain head in the anchors project. **Done (2026-11-16)**.

## Decisions (2026-11-14)
1. **4D = (predicted, observed, Φ) × time, per tenant.** The reference commit is segment *context* (M3), not an axis.
2. **Lossless only for M1–M2.** Bounded-loss is deferred to M3 as an opt-in mode. Until then the `loss` field has exactly one shape: `{ mode: "lossless" }`.
3. **Only `provenance.source = "third-party-workbench"` records** are compressed. Every other record is excluded and counted (`not_third_party_workbench`).
4. Defaults until decided otherwise: N = 256 fixed; no persistence (no migration 004); no consumer (no route, no ROE input).
5. **No feature flag in M1.** `SHIYAN_STATE_COMPRESSION` is not read anywhere, because M1 has no runtime wiring: nothing imports `src/core/compression/` except its own tests. The flag is introduced with the first runtime entry point (M2's CLI/source).

### M1 as built (and where it refines sections 5 and 9)
- Files: `types.ts`, `extract.ts`, `encode.ts`, `verify.ts`, `index.ts`. No `source.ts` (that is M2).
- Input is a `SourceRow` that mirrors one `shiyan.experiences` row (`tenant_id, experience_id, record_json, content_sha256, proof_timestamp` as an ISO string). Extraction re-checks `sha256(record_json) = content_sha256`, `validateExperienceRecord`, the id and tenant match, the source, the four finite inputs and the verdict. Exclusion reasons: `invalid_row, tenant_mismatch, hash_mismatch, invalid_json, invalid_record, not_third_party_workbench, unparseable_inputs, invalid_verdict, invalid_timestamp, duplicate_id`.
- **Float coding:** each column (predicted, observed, phi, step) is XOR-delta coded over the IEEE-754 float64 bit patterns as lowercase hex. It is bit-exact for `-0`, subnormals and ±max, and a repeated value encodes as `"0"`. Plain JSON numbers would not work here, because `canonical()`/`JSON.stringify` writes `-0` as `0`, and arithmetic deltas of floats are not exact.
- Time is `t0` plus non-negative integer `dt` in epoch ms, taken from `proof_timestamp`. Verdicts are a `P/F/I` string.
- `source_ids_root` is a domain-separated binary Merkle root over `(experience_id, content_sha256)` in point order. An odd node is promoted, not duplicated.
- **Refinement:** `reconstruct()` returns the 4D state plus verdict (`StateVector[]`). Source identities are committed by `source_ids_root` only and are not stored per point, because ids and hashes would be larger than the state itself. `verifySegment(segment, sources)` re-extracts the sources, requires none to be excluded, and checks that they rebuild to the identical hash.
- **Refinement:** `excluded` lives on the tenant-level `TenantCompression` result, not inside each segment, because windows are defined over included points only. `pending` counts the points in the open (unsealed) window. `sealPartial: true` seals it explicitly.
- **Refinement:** `node:crypto` is an allowed import (sha256 for content hashes and the Merkle tree). `canonical`/`sha256Canonical` come from `reconcile.ts`, which is not modified.
- Caveat for M4: a record that arrives late, with an earlier `proof_timestamp` than already-sealed points, would change earlier windows. Persistence needs a rule for this, for example ordering by arrival or sealing by time cutoff.
- Tests: `scripts/check-compression.ts` (round trip, determinism with shuffled input, tamper on value/id/verdict/prev, tenant isolation, exclusion counting) and `scripts/check-compression-boundary.ts`. The boundary script checks direct and transitive imports and bans `Date.now`/`Math.random`/`process.env`/`fetch`, with a self-test that it rejects each forbidden pattern.

### M2 as built (2026-11-16)
- **`src/core/compression/source.ts`** (the only compression file allowed to import `neon-db.ts`; not re-exported from `index.ts`, so the pure core stays pure). `readTenantRows(client, tenant)` validates the tenant against `TENANT_ID_PATTERN`, then sends exactly `BEGIN READ ONLY`, one `SELECT tenant_id, experience_id, record_json, content_sha256, proof_timestamp FROM shiyan.experiences WHERE tenant_id = $1 ORDER BY proof_timestamp, experience_id`, and `COMMIT` (or `ROLLBACK` on error, then rethrow). Every statement goes through an exact-match allowlist of those four strings, so nothing else can be sent. It is its own query; `NeonExperienceStore` is not used or changed.
- `toSourceRow` converts a pg `Date` with `toISOString()`; a string passes through; an invalid Date or any other type becomes a non-string, which M1 then excludes as `invalid_row`. Rows the database returns for any other tenant are dropped and counted (`foreign_rows_dropped`) as defence in depth; M1 would also exclude them as `tenant_mismatch`.
- `openStorageClient(checked)` uses `poolFor("storage", …)` from `neon-db.ts` (TLS rules unchanged), and `close()` releases the client and ends the pool.
- **CLI `scripts/compress-tenant.ts`** (local only, not imported by any route). It refuses with exit 2 unless `SHIYAN_STATE_COMPRESSION=1`; with the flag off it reads no file and opens no connection. Flags: `--tenant <id>`, `--storage-file <path>` (a file holding the storage URL, the same convention as `scripts/check-schema.ts`), or the URL from `SHIYAN_STORAGE_URL`. The URL is validated by `checkDatabaseUrl`, and only its URL-free reason is ever printed.
- It compresses with `compressTenant`, then runs four checks: `chain` (`verifyChain`), `recompute` (`verifyTenant`), `sources` (each segment's `verifySegment` against exactly the rows it covers), and `lossless` (each segment's `reconstruct()` equals the extracted points, compared bit-exactly with `Object.is`). It prints only the tenant id, counts, exclusion counts per reason, each segment's seq/count/`segment_sha256`/`source_ids_root`, the chain root (`head_sha256`), byte totals, PASS/FAIL per check and a RESULT line. DB errors print only the error class and code. Exit codes: 0 PASS, 1 FAIL or error, 2 refused or usage.
- **Refinement (sealing):** because nothing is persisted, the CLI seals the final partial window in memory by default (`sealPartial: true`), so a tenant with fewer than 256 runs still gets verified. `--full-windows-only` reproduces M1's default (partial window reported as `pending`, not verified). This does not decide open question 4.
- **Refinement (flag):** the flag is read only by the CLI (`env.SHIYAN_STATE_COMPRESSION === "1"`). `src/core/compression/**` still never reads `process.env` (the boundary check bans it), so the flag cannot turn anything on inside the app.
- Tests: `scripts/check-compression-source.ts` (15 checks: Date-to-ISO, exact statement sequence on a recording mock client, tenant filtering, rollback on error, tenant refusal before any statement, allowlist, flag-off refusal with zero reads, usage errors, a 300-row two-segment PASS with exclusions, no payloads/ids/URL/role/host/password in output, order-independent chain root, `--full-windows-only`, error output with code only, non-TLS URL refused without echo, and the fixture URL file's mtime, hash and temp dir unchanged). The fixture file is created in a fresh temp dir and deleted afterwards. `scripts/check-compression-boundary.ts` additionally checks `source.ts` and the CLI: no write/DDL SQL keywords, no file-write APIs, the CLI imports only an allowlist (`node:fs/os/path/url`, compression, `neon-db`, `storage-diagnostics`, `tenant-auth`), never routes, `src/components/`, Level 4, the engine or any write module, and nothing reaches routes, Level 4 or the engine transitively. It has a self-test for each rule.
- Caveats: all rows of one tenant are loaded into memory in one SELECT (fine at current volume; paging would come with M4). The URL's role is `shiyan_app`, which has INSERT; the READ ONLY transaction plus the statement allowlist are what keep the reader read-only. `tenant-auth.ts` (for `TENANT_ID_PATTERN`) transitively loads the local experience-store modules, but nothing calls them. M2 was tested against a mock client, not a live Postgres.

### M3 as built (2026-11-16)
New pure files `window.ts`, `context.ts`, `chain.ts`; additive changes to `types.ts`, `encode.ts`, `verify.ts`, `index.ts`; `source.ts` gains the anchors reader. M1's `compressTenant`/`verifyTenant` are unchanged. M3's entry points are `buildTenantChain(tenant, rows, options)` and `verifyTenantChain(...)`.

**Lossless default is byte-identical.** `context` is an optional segment field that is absent unless an anchors source is given, and `loss` stays `{ mode: "lossless" }` by default, so a plain segment's canonical bytes and `segment_sha256` are exactly M1's. `scripts/check-compression-m3.ts` pins golden hashes computed with the M2 code (`fac78f1`) for the M1 and M2 fixtures and checks that both `compressTenant` and `buildTenantChain` still reproduce them.

**Sealing (resolves open question 4).**
- Arrival = the row's `created_at` (DB insert time, now also SELECTed; never hashed). If a row has none, arrival falls back to `proof_timestamp` (counted as `arrival_from_proof_timestamp`).
- Points are walked in `(arrival, t, experience_id)` order. A window opens at its first point's arrival and closes `full` at 256 points, or `cutoff` when the next point arrives at or after `opened_at + cutoff`. The last window closes by cutoff once `as_of` reaches `opened_at + cutoff`.
- A closed window counts as sealed only after a **grace** period: `as_of >= close time + grace`, where the close time is the last arrival (full) or `opened_at + cutoff` (cutoff). The default grace is 10 min. It covers inserts timestamped before a boundary but committed after it. Everything from the first non-final window onward is `pending`, so the sealed chain is always a prefix.
- Inside a window, points are encoded in M1 order `(t, experience_id)`.
- **Late record:** a record whose `t` is earlier than the newest `t` in an already-sealed window lands in the window open at its arrival (the next open window). Membership is decided by arrival, so a sealed window never reopens. The tests prove this, including a late record and a 27-step "as_of advances" prefix property.
- Defaults: size 256, cutoff 24 h, grace 10 min. All are configurable (`cutoffMs`, `graceMs`; CLI `--cutoff-hours`, `--grace-minutes`, `--full-windows-only` for no cutoff). `as_of` is always supplied by the caller (the CLI uses the current time or `--as-of`), and the core reads no clock.
- Sealing metadata (close reason, open/close times) is reported but **not** embedded in plain segments, to keep lossless hashes stable. With context, `context.as_of` records the seal time.

**Bounded-loss (opt-in).**
- `loss: { mode: "bounded", eps: {predicted, observed, phi}, max_abs_err: {…} }`. Each axis stores `q = round(v / eps)` (integer-valued float64, never -0) in the same XOR-delta column coding. Reconstruction is `q * eps`. t, step, verdicts and source ids stay exact.
- `max_abs_err` is measured at compression and covered by the hash. `verifyReconstruction` checks every value is within eps, that t/step/verdict are exact, and that the stored `max_abs_err` equals the recomputed maximum. Lossless is checked bit-exactly with `Object.is`.
- The quantization error is ≤ eps/2 plus float rounding. The verified bound is eps. If a value's magnitude makes eps unreachable (or `|v/eps| > 2^53`), compression refuses with an error rather than exceeding eps.
- `verifySegment` now rebuilds using the segment's own loss mode and context.

**Context (enrichment).**
- `SegmentContext { version: "aethel.state-context/1", as_of, recovery: { count, by_status, records_root }, reference: { status: "present", reference_id, commit_sha, snapshot_sha256, envelope_sha256 } | { status: "none" } }`.
- `as_of` is the window's seal time. Only anchor-DB rows created at or before it are used, so a sealed segment's context never changes later.
- Recovery records are linked to a segment when their `run_id` equals one of its runs' `provenance.run_id`. `records_root` is a domain-separated Merkle root over the sorted linked `record_sha256` values (null when none). The reference is the latest `reference_anchors` row created ≤ `as_of` (ties broken by `reference_id`), else an explicit `{ status: "none" }`.
- Invalid anchor-DB rows are skipped and counted, never repaired. Recovery rows without `run_id` are counted as unlinked.
- Context exists only when an anchors source is supplied, and then it is embedded in every segment and covered by `segment_sha256` and the chain. Without `--anchor-file`, segments carry no context, and the CLI says so explicitly.

**Anchors source.**
- Both tables live in the anchors DB (separate project, `~/.shiyan-anchor-url`). `readTenantAnchors` sends exactly `BEGIN READ ONLY`, `SELECT reference_id, commit_sha, snapshot_sha256, envelope_sha256, created_at FROM shiyan_anchor.reference_anchors WHERE tenant_id = $1 …`, `SELECT run_id, status, record_sha256, created_at FROM shiyan_anchor.recovery_records WHERE tenant_id = $1 ORDER BY id`, then `COMMIT` (or `ROLLBACK`). These SELECTs are added to the same exact-match allowlist.
- No numeric recovery fields (`prior_predicted`, `phi_lift`, …) are read.
- The CLI refuses an anchors URL that is not independent of storage (`independentDatabases`). The anchors URL is read only from `--anchor-file`, never from the environment.

**CLI.**
- Same gate (`SHIYAN_STATE_COMPRESSION=1`, else exit 2 with zero reads).
- New flags: `--anchor-file`, `--loss lossless|bounded`, `--eps p,o,phi`, `--cutoff-hours`, `--grace-minutes`, `--as-of`.
- Checks printed: `chain`, `recompute` (full rebuild incl. sealing and context), `sources`, `lossless` or `bounded`, `context`.
- Output adds sealing/window/late counts, the loss line, context counts, and per segment `closed_by`, `max_abs_err` (bounded), recovery count/root, and reference id/commit/snapshot hash. Still no payloads, URLs or secrets.
- **Difference from M2 output:** because windows now seal by arrival and cutoff, a tenant whose runs span more than 24 h gets more, smaller segments than M2's single in-memory partial window, so its chain root differs from M2's. A window with the same points still has the same hash.

**Tests.**
- `scripts/check-compression-m3.ts`, 25 checks: golden hashes, bounded bounds/tamper/eps validation, bit-exact lossless, sealing (full, cutoff, grace, configurable, late record, prefix stability, determinism), context (selection, linking, hash coverage, explicit none, anchors after seal ignored), the anchors reader (statements, rollback, tenant refusal), and the CLI (flag off, anchors, bounded example, usage errors, non-independent anchors URL, error output, pinned `--as-of`, no-write snapshot).
- `check-compression-boundary.ts` adds two rules: the pure core may not import `source.ts`, and the CLI may not import `reconcile` or the recovery recorder.
- `check-compression-source.ts` is updated for the new output lines.

**Caveats.**
- Arrival uses `created_at = now()` (transaction start). An insert whose transaction began more than the grace period before it committed could arrive "inside" an already-sealed window. That would only matter once segments are persisted (M4), and M4 should then append from the persisted head rather than recompute.
- Recovery records created after their segment sealed are not attached to it (by design, for immutability). The `recovery_records` write path (`reconcile()`) is not yet called from any route, so production may have few or none.
- All tested against mock clients; the parent/user runs against live data.

### M4 as built (2026-11-16)
**Migration `db/migrations/004_shiyan_state_segments.sql`** (storage project; plain SQL for the Neon SQL Editor; idempotent; not applied by this work).
- Table: `shiyan.state_segments(tenant_id, seq, segment_sha256, prev_segment_sha256, segment_json text, point_count, source_ids text[], window_opened_at, window_closed_at, closed_by, segment_size, cutoff_ms (NULL = none), grace_ms, loss_mode, eps_predicted, eps_observed, eps_phi, context_sha256, created_at default now())`.
- Keys and constraints:
  - PK `(tenant_id, seq)`, UNIQUE `segment_sha256`.
  - `segment_sha256 = sha256(segment_json)` (text, not jsonb, so the canonical bytes are kept exactly).
  - The JSON's tenant/seq/count/prev/loss mode must equal the columns, and `cardinality(source_ids) = point_count ≤ segment_size`.
  - seq 0 ⇔ no prev; the eps shape follows the loss mode; `context_sha256` is present ⇔ the segment has context.
- Triggers:
  - `state_segments_link_check` (BEFORE INSERT, ROW, tgtype 7): seq n > 0 requires the tenant's row n−1 with `segment_sha256 = prev_segment_sha256`. With the PK this makes each tenant's chain contiguous and linked in SQL.
  - `state_segments_no_update_delete` (27) and `state_segments_no_truncate` (34) use `shiyan.reject_mutation()`.
- Grants: REVOKE ALL FROM PUBLIC; `shiyan_app` gets SELECT and INSERT only.
- **No `chain_root` column:** each `segment_sha256` commits to its `prev_segment_sha256`, so the chain root is the `segment_sha256` at the tenant's highest seq. A separate column would duplicate it and could disagree.
- Applied twice to a scratch PostgreSQL 17 instance (PGlite, not committed). Verified: idempotent; triggers report tgtype 7/27/34; UPDATE, DELETE and TRUNCATE are rejected (42501); an unlinked insert is rejected (23503); `shiyan_app` has SELECT/INSERT and no UPDATE/DELETE.

**Schema guard.** The guard had no notion of staged migrations (a missing table was a FAIL), so making `state_segments` a plain expectation would have turned the live guard red until 004 is applied. I chose the safer option and added a narrow staged-table mechanism (`STAGED_STORAGE_COLUMNS/TRIGGERS`):
- While the table is absent, the guard prints `SKIP storage.state_segments: pending …004…` (not a failure).
- Once the table exists, its columns, the three triggers and the `shiyan_app` privileges are checked fully.
- `--require-state-segments` turns absence into a FAIL; use it after applying 004.
- Existing tables are unaffected.

**Writer `src/core/compression/store.ts`.** It is the only module allowed write SQL, and only `INSERT INTO shiyan.state_segments`. It is imported only by `scripts/persist-tenant-segments.ts` (and test-only check scripts); the boundary check enforces this. One transaction per run:
- **write:** `BEGIN` → `SELECT pg_advisory_xact_lock(hashtext('shiyan.state_segments'), hashtext($1))` (per-tenant serialization) → SELECT the tenant's experiences → SELECT the tenant's stored segments → verify → INSERT the new sealed segments → SELECT read-back (must equal stored + appended) → `COMMIT`. On any refusal or error it sends `ROLLBACK`.
- **dry-run / verify:** `BEGIN READ ONLY` → the two SELECTs → `COMMIT`.
- Each mode has its own exact-match allowlist; the read modes cannot send INSERT, BEGIN or the lock.
- **Extends from the stored head (fixes the M3 late-commit caveat):**
  - Stored rows are parsed strictly: the hash matches the JSON, the JSON is canonical, the columns equal the JSON, and the row belongs to this tenant.
  - The chain is verified: links, every stored segment rebuilt from exactly its stored `source_ids` rows with the identical hash, decode exact or within eps, `context_sha256` matches, and context is re-derived when anchors are given.
  - The requested sealing parameters, loss mode/eps and context presence must equal the stored chain's.
  - Any failure → **refused, nothing written, never overwritten**.
  - Points already covered by stored segments are fixed. Uncovered points (including late commits whose `created_at` falls inside an already-stored window) are windowed with `effective arrival = max(arrival, stored head's window_closed_at)`, so they go to the next open window. Only sealed windows are inserted, never pending ones. A rerun with nothing newly sealed inserts 0 rows and sends no INSERT.
  - With no stored chain, the first append equals the M3 `buildTenantChain` result.
- Concurrency: the advisory lock serializes appends per tenant. The PK plus the link trigger also reject a racing duplicate (23505/23503), and the CLI says "rerun".

**Pure core addition `extend.ts`:** `verifyStoredChain` and `extendTenantChain` (no I/O, no clock).

**CLI `scripts/persist-tenant-segments.ts`.**
- Gate: refuses (exit 2, no reads) unless `SHIYAN_STATE_COMPRESSION=1`. Without `--write` it is a **dry run** (READ ONLY; prints `would_append`). `--write` appends. `--verify-stored` (READ ONLY) checks the stored chain with its own stored parameters.
- The verify output also reports `from_scratch_prefix`: whether a from-scratch recomputation agrees. It says `no` when late commits were placed after the head, which is expected.
- Same sealing/loss/`--anchor-file` flags as `compress-tenant.ts`. Prints only hashes, ids and counts. A missing table prints a hint to apply 004.
- `compress-tenant.ts` stays strictly read-only and may not import the writer.

**Tests.**
- `scripts/check-compression-m4.ts` (18 checks, in-memory fake of the storage DB that accepts only the exact statements and emulates the PK, the sha CHECK and the link trigger):
  - migration text: triggers, grants, no destructive statements, idempotent, columns = guard expectation;
  - staged guard: SKIP / required FAIL / the real catalog shape;
  - statement allowlists;
  - dry run inserts nothing; write inserts only sealed segments; reruns are idempotent;
  - late commit never alters stored segments;
  - stored-prefix mismatch refuses (options, tampered row, missing source row);
  - tenant isolation; PK race rolls back; bounded and context chains persist and verify;
  - CLI gate, dry run, write/rerun/verify, refusal, the 42P01 hint, no leaks, no file writes.
- `check-compression-boundary.ts` adds:
  - write SQL only in `store.ts`, and only `INSERT INTO shiyan.state_segments`;
  - `store.ts` importable only by the persist CLI;
  - the persist CLI's import allowlist;
  - a repo-wide wiring scan: no `src/` module outside compression imports it, so no route.

**Caveats.**
- The writer runs as `shiyan_app` from `~/.shiyan-storage-url`, which now gains INSERT on `state_segments` via 004 (no UPDATE/DELETE; triggers block mutation even for the owner, except by dropping triggers).
- Parameters are fixed per tenant chain: changing cutoff/grace/loss/context later requires a new decision (a new chain or a version bump), because appends are refused on mismatch.
- `source_ids` (about 35 bytes per run) are stored so each segment can be re-verified from its exact sources.

### M5 as built (2026-11-16)
**Customer proof export (`GET /api/v1/customer-proof/{id}`).**
- **Flag off (the default):** unless `SHIYAN_STATE_COMPRESSION` is exactly `1` on the deployment, the handler builds the same four-key object as before (`report_version`, `record`, `content_sha256`, `server_verdict`). The body is byte-identical to before M5 and no state-chain query is sent.
- **Flag on:** one key, `state_compression`, is appended last. Everything else is unchanged:
  - `report_version` stays `aethel.customer-proof/1`.
  - Headers, status codes and error paths are unchanged.
  - The local inspection page ignores unknown keys, so it is untouched.
- **Hash/signature decision:** the export has no signature. Its only hash, `content_sha256`, covers `record` alone (it equals `experienceDigest(record)` and is what customers recompute). `state_compression` is deliberately **outside** it:
  - Putting it inside would change every existing digest and break verification of earlier downloads.
  - The field is independently verifiable instead: `chain_head` is a sha256 that chains back to seq 0, and it is witnessed in a separate database.
  - Additive, unsigned fields under a `/1` report version are backward compatible for every existing consumer.
- **Field shape (`format: "aethel.state-chain/1"`):**
  - `status`: one of
    - `present`;
    - `absent` (no stored segments for this tenant);
    - `unavailable` (not a Neon backend, missing table, permission error, timeout of 2.5 s per query, a row for another tenant, or any error);
    - `inconsistent` (the stored head columns do not form a contiguous, linked chain).
  - `chain_head`: the `segment_sha256` at the highest seq. Each segment hash commits to its prev, so this is the chain root.
  - `segment_count`, `last_seq`.
  - `sealed_through`: the head window's `window_closed_at`, ISO.
  - `points`: the sum of `point_count`.
  - `loss_mode`.
  - `context`: whether the head segment carries context.
  - `anchor`, with:
    - `status`: `anchored` (every anchor row names exactly the stored segment at its seq), `unanchored`, `mismatch` (any anchor row disagrees, names a seq beyond the stored head, or has a wrong count) or `unavailable` (anchors DB not configured, not independent, missing table or error);
    - `anchored_seq`, `anchored_head`, `anchored_at`, `anchor_count`;
    - `covers_head`: the latest anchor is the current head.
  - I used `anchored_seq`/`anchored_head` instead of an opaque `anchor_id`, because `(tenant_id, seq)` is the anchor's natural key. A separate id column could disagree with it.
- **Never fails the export:** every failure becomes a status. No error text, codes, URLs or payloads are returned.
- **Reader `src/core/compression/export-reader.ts`:**
  - It sends exactly two tenant-scoped SELECTs (exact-match allowlist), each with `[tenant]` from `authenticateTenant`:
    - `CHAIN_HEADS_SQL` on `shiyan.state_segments`: hash, link, count, time and loss/context columns only, never `segment_json` or `source_ids`;
    - `STATE_ANCHORS_SQL` on `shiyan_anchor.state_chain_anchors`.
  - It uses the app's existing pools (`poolFor`) and the app's own rules: `SHIYAN_STORAGE_BACKEND=neon`, and an anchors URL that reaches a different database with a different role.
  - It never imports a writer or `source.ts`.
  - It does not re-hash `segment_json`: migration 004's CHECK and link trigger guarantee hash and link integrity in SQL. Full re-verification is the CLI's job (`--verify-stored`, `--verify-anchor`).

**Independent witness: migration `db/migrations/005_shiyan_state_chain_anchors.sql` (anchors project).**
- Table: `shiyan_anchor.state_chain_anchors(tenant_id, seq, chain_head, segment_count, anchored_at default now())`.
  - PK `(tenant_id, seq)`.
  - CHECKs: tenant pattern, `seq >= 0`, `chain_head` is sha256 hex, and `segment_count = seq + 1`.
- Triggers: `state_chain_anchors_no_update_delete` (tgtype 27) and `state_chain_anchors_no_truncate` (34), both using 001's `shiyan_anchor.reject_mutation()`.
- Grants: REVOKE PUBLIC; SELECT and INSERT to `shiyan_anchor` and/or `shiyan_anchor_app` (whichever exist, as in 002). The storage role gets nothing there.
- Names follow the existing anchors project: schema `shiyan_anchor` and role `shiyan_anchor`/`shiyan_anchor_app`, not `shiyan.*`.
- Plain SQL, idempotent.

**Anchor writer and CLI.**
- **`src/core/compression/anchor-store.ts`:** the only module that may write anything there, and only `INSERT INTO shiyan_anchor.state_chain_anchors`.
  - write: `BEGIN`, a per-tenant advisory lock, SELECT anchors, compare, INSERT the head, read back, `COMMIT`.
  - dry-run/verify: `BEGIN READ ONLY`, SELECT, `COMMIT`.
  - Any disagreeing anchor (`mismatch`) or a foreign/malformed row means `ROLLBACK` and nothing written.
  - An already-anchored head inserts 0 (idempotent).
- **`scripts/anchor-state-chain.ts`:**
  - Off unless `SHIYAN_STATE_COMPRESSION=1`. Dry run by default; `--write` anchors; `--verify-anchor` is read-only and checks every anchor against the stored segment at its seq.
  - It needs both URLs and refuses if they reach the same database or role.
  - It first verifies the stored chain READ ONLY with the M4 verify-stored logic (context re-derived from the anchors DB). If that fails, nothing is anchored.
  - The two databases use separate connections, and storage is never written.
  - It prints only hashes, seqs and counts.

**Schema guard.**
- `anchors.state_chain_anchors` is a staged table: SKIP while absent, then fully checked (columns, triggers 27/34, SELECT+INSERT only for the connecting role).
- `--require-state-anchors` makes its absence a FAIL.

**Boundary.** `scripts/check-compression-boundary.ts` now enforces:
- exactly one app consumer: the customer-proof route, importing only `export-reader.ts`;
- the export reader's transitive imports never reach `store.ts`, `anchor-store.ts` or `source.ts`;
- `store.ts` may be imported only by the persist and anchor CLIs; `anchor-store.ts` only by the anchor CLI;
- each writer may name only its one INSERT target.

**Tests.** `scripts/check-compression-m5.ts` has 21 checks:
- migration 005 text and columns against the guard; the staged guard with real tgtypes;
- export allowlist; present/anchored/stale/unanchored/mismatch/absent/unavailable (missing table, permission, timeout, throw)/inconsistent; tenant isolation, including leaky databases;
- env resolution with fake pools in the app's pool cache;
- the real route: flag off byte-identical on the filesystem and (fake) Neon backends; flag on appended last with the existing bytes as a prefix; tenant-scoped; never failing;
- the anchor writer: dry run, write, idempotent rerun, growth, mismatch refusal, PK race, allowlist;
- the anchor CLI: gate, same-DB refusal, dry/write/rerun/verify, stored-chain failure, mismatch, missing tables, no leaks, no file writes.

A scratch PostgreSQL 17 run (PGlite, not committed) checked:
- 005 applied twice, with triggers 27/34;
- privileges for both anchor roles;
- the CLI dry/write/rerun/verify sequence, re-anchoring after growth, and refusal of a forged anchor;
- the export reader's present/anchored, stale and mismatch results;
- UPDATE, DELETE and TRUNCATE rejected (42501), and a bad `segment_count` rejected (23514).

**Caveats.**
- The export shows only what is stored and anchored. Run the persist and anchor CLIs to advance them; no automatic job exists.
- The export reader trusts the SQL constraints for segment-hash integrity. The CLIs re-verify everything.
- Anchoring is as independent as the two Neon projects and roles are. Anyone with owner access to both could rewrite both, so keep them administered separately.

### Scheduled sync (2026-11-16)
**Goal:** keep each tenant's stored chain and its anchor current without manual runs. Every existing guarantee stays: append-only, refuse rather than overwrite, tenant-scoped statements, exact allowlists, off by default, and no secrets in output.

**Pieces.**
- **`scripts/sync-state-chains.ts`:**
  - It calls `persistTenantSegments` (store.ts) and `anchorStateChainHead` (anchor-store.ts) directly, so the statement allowlists, per-tenant advisory locks, READ ONLY transactions and refusal rules are exactly the CLIs'.
  - Tenants come only from `SHIYAN_SYNC_TENANTS`: comma-separated, each checked with `TENANT_ID_PATTERN`, deduplicated, at most 50. An invalid entry is a usage error and nothing is read; the value is not echoed. Empty means `no tenants configured`, exit 0.
  - It requires `SHIYAN_STATE_COMPRESSION=1`. Without `--write`, the whole sync is READ ONLY.
  - It uses one connection per database for the run, and each step is its own transaction. The two URLs must reach different databases with different roles.
- **`.github/workflows/state-chain-sync.yml`:**
  - It is committed staged at `ops/github/state-chain-sync.yml`, because the automation token cannot write workflow files. The owner installs it with `git mv`. `check-state-chain-sync` checks whichever copy exists, and requires both to be identical if both exist.
  - Runs hourly (`17 * * * *`) and on `workflow_dispatch`, with a `write` boolean input (default false).
  - Scheduled runs write only if the repository variable `SHIYAN_SYNC_WRITE` is `true`. Otherwise they are dry runs.
  - `permissions: contents: read`; concurrency group `state-chain-sync` with no cancellation (runs never overlap or get cut mid-transaction); `timeout-minutes: 10`.
  - `actions/checkout@v4` with `persist-credentials: false`, `actions/setup-node@v4` (Node 22), then `npm ci --ignore-scripts`.
  - Secrets: `SHIYAN_STORAGE_URL` and `SHIYAN_ANCHOR_URL` are masked, written with `umask 077` to files in `$RUNNER_TEMP`, passed by path, and removed in an `always()` step.
  - If either secret or the `SHIYAN_SYNC_TENANTS` variable is missing, every step is skipped and the job succeeds, so the workflow is inert until configured.
  - No tracing, no env dumps.

**Per-tenant steps (fail closed).**
1. **Probe:** a READ ONLY verify of the stored chain (context re-derived from the anchors DB). It yields the chain's own options: sealing parameters, loss mode/eps and context presence. Then a **READ ONLY anchor pre-check**: if the witness already disagrees with storage, nothing is written for that tenant.
2. **Persist dry run** (READ ONLY). Refused means FAIL.
3. **Persist `--write`:** only with `--write`, and only if the dry run passed with `would_append > 0`.
4. **Verify-stored** (READ ONLY, includes the new rows).
5. **Anchor dry run** (READ ONLY). A mismatch or invalid row means FAIL.
6. **Anchor `--write`:** only if the head is not yet anchored.
7. **Verify-anchor** (READ ONLY). A mismatch is FAIL. After `--write`, the latest anchor must be the current head.

**Options are never hardcoded for an existing chain:** they are read from the stored chain itself. A tenant with nothing stored starts with prod-a's choices: lossless, 256-run windows, 24 h cutoff, 10 min grace, anchors context.

**Failure policy:** on any FAIL, REFUSED, mismatch or DB error, that tenant stops and its later steps are skipped. The other tenants still run, because their chains are independent and one tenant's problem should not freeze everyone else's witness. The process exits 1 if any tenant failed, so the workflow run is red and GitHub notifies. Connection or URL failures stop the whole run before anything is read.

**Idempotence:** a rerun with nothing newly sealed sends no INSERT and no write transaction (`appended=0 anchored=0`).

**Output:** one line per tenant plus `RESULT`. It contains only mode, counts, loss/context, anchor status, seqs and hashes. DB errors show `class=… code=…` only. No URLs, roles, hosts or payloads.

**Least privilege (migration 006).** The default secrets would be the app URLs:
- `shiyan_app`: INSERT on `experiences` and `reference_envelopes` as well as `state_segments`;
- the anchor app role: INSERT on `reference_anchors` and `recovery_records`.

Dedicated sync roles need only the grants confirmed by an audit (2026-11-17) of `scripts/sync-state-chains.ts` and the modules it calls (`source.ts`, `store.ts`, `anchor-store.ts`; not `export-reader.ts`):
- **storage `shiyan_sync`:** USAGE on schema `shiyan`; SELECT on `shiyan.experiences`; SELECT and INSERT on `shiyan.state_segments`.
- **anchors `shiyan_anchor_sync`:** USAGE on schema `shiyan_anchor`; SELECT on `reference_anchors` and `recovery_records` (context); SELECT and INSERT on `state_chain_anchors`.

No deviations from that list. `recovery_records` lives in the anchors project, not storage. Advisory locks and `hashtext` need no grants. Catalog reads need no grant. Neither `state_segments` nor `state_chain_anchors` uses serial/identity (seq is supplied by the writer), and the sync only SELECTs `recovery_records`, so `recovery_records_id_seq` is not granted. The 004 link trigger fires without EXECUTE on its function and only SELECTs `state_segments` (already granted).

Migrations (plain SQL, idempotent, no password, role is not created here):
- Storage: `db/migrations/006_shiyan_sync_role.sql`. Create a non-admin role `shiyan_sync` in the Neon Console of the storage project first (so Neon generates the password); the migration raises if the role is missing, is SUPERUSER/CREATEDB/CREATEROLE, or is a member of `shiyan_app` / `neon_superuser`. It then REVOKEs all table/sequence/function privileges on schema `shiyan` and GRANTs only the list above.
- Anchors: `db/migrations/006_shiyan_anchor_sync_role.sql`, same pattern for `shiyan_anchor_sync`, refusing membership in `shiyan_anchor` / `shiyan_anchor_app` / `neon_superuser`.

Apply each file as that project's owner in the Neon SQL Editor (or `psql "$SHIYAN_*_OWNER_URL" -v ON_ERROR_STOP=1 -f …`). Then verify, using URL files that must never be pasted into chat:

```
npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/verify-sync-roles.ts \
  --storage-file ~/.shiyan-storage-sync-url --anchor-file ~/.shiyan-anchor-sync-url
```

The verifier is READ ONLY, prints only the role name and PASS/FAIL per privilege, and exits non-zero on any FAIL. After it passes, point the Actions secrets `SHIYAN_STORAGE_URL` and `SHIYAN_ANCHOR_URL` at the sync-role URLs (`gh secret set NAME < file`). Offline check: `scripts/check-sync-roles.ts`.

Checked on scratch PostgreSQL 17 (PGlite) running as exactly these roles:
- dry run, write, rerun (0/0) and a later append + anchor for two tenants all passed;
- the export read back the result;
- UPDATE/DELETE, inserts into `experiences`/`recovery_records`, and reads of `reference_envelopes` were all denied (42501).

**Caveats.**
- GitHub-hosted runners reach Neon over the public internet. If Neon IP Allow is enabled, the runner IPs must be allowed; GitHub's ranges are broad.
- Scheduled workflows can be delayed by GitHub and are auto-disabled after 60 days without repository activity.
- A FAIL stops only that tenant; it never repairs anything. Investigate with `persist-tenant-segments.ts --verify-stored` and `anchor-state-chain.ts --verify-anchor`.

## 13. Open questions
1. ~~Meaning of "4D"~~ **Resolved:** (predicted, observed, Φ) × time. The reference commit is context, not an axis.
2. ~~Lossless vs bounded-loss~~ **Resolved:** lossless for M1–M2. Bounded-loss is opt-in in M3, and eps per axis is to be chosen then.
3. ~~Which sources~~ **Resolved:** `third-party-workbench` only. Others are excluded and counted.
4. ~~Segment size and sealing~~ **Resolved (M3):** fixed 256-run windows plus a time cutoff (default 24 h, configurable), ordered by DB arrival; a late record goes into the next open window and never reopens a sealed one. See "M3 as built".
5. ~~Where segments are stored~~ **Resolved (2026-11-16):** in the **storage** project, table `shiyan.state_segments`, next to `shiyan.experiences`. Rationale: segments are derived data, so they live with their source. That gives one tenant boundary, one role (`shiyan_app`: SELECT + INSERT) and one backup/restore unit, and the writer can read sources and append in a single transaction. The anchors project stays an **independent witness**. A later step (not M4) can anchor each tenant's chain head there, so tampering with storage would be detectable from a second database.
6. ~~First consumer~~ **Resolved (2026-11-16):** the **tenant-authenticated customer proof export**. It would gain a read-only, additive section with the tenant's persisted chain head (root), segment count and seal status. Rationale: a customer can verify a compact, hash-chained summary of their own runs, and that verifiability is the commercial moat. ROE inputs come later. This is M5; M4 wires no consumer and no route.

## Sources
[1] Google DeepMind, "SIMA 2: An agent that plays, reasons, and learns with you in virtual 3D worlds", https://deepmind.google/blog/sima-2-an-agent-that-plays-reasons-and-learns-with-you-in-virtual-3d-worlds/
[2] SIMA Team, "SIMA 2: A Generalist Embodied Agent for Virtual Worlds", arXiv:2512.04797, https://arxiv.org/html/2512.04797
[3] MIT Technology Review, "Google DeepMind is using Gemini to train agents inside Goat Simulator 3" (13 Nov 2025), https://www.technologyreview.com/2025/11/13/1127921/google-deepmind-is-using-gemini-to-train-agents-inside-goat-simulator-3/
