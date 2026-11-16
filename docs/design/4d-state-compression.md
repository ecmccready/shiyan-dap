# 4D State Compression Engine: design (draft, not implemented)

Status: M1 (pure core), M2 (read-only per-tenant reader, local CLI, off by default) and M3 (window sealing, opt-in bounded-loss, anchors context) implemented. M4–M5 are not implemented. No migration exists or has been applied, and no existing source file outside `src/core/compression/` and the compression scripts was changed. Designed on `main` at `2a09d82`.

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
- **Phase 4 (only if asked):** add migration `db/migrations/004_shiyan_state_segments.sql` on the storage project. It would create `shiyan.state_segments (tenant_id, seq, segment_json, segment_sha256, prev_segment_sha256, created_at)` with PK `(tenant_id, seq)`, UNIQUE `segment_sha256`, a CHECK that the sha matches the JSON, and the `state_segments_no_update_delete` and `state_segments_no_truncate` triggers using `shiyan.reject_mutation()`. `shiyan_app` would get SELECT and INSERT only. `scripts/check-schema.ts` would need a new expectation entry, which is a later and separate change.

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
The Level 4 plant is `src/lib/level4/*`, `src/components/Level4Shell.tsx`, `src/app/api/level4/*` and `docs/level4-*`. It, along with `MetamorphicEngine` (`src/core/metamorphic.ts`), `src/core/metamorphic-runtime.ts`, the existing tables, triggers and grants, `run-contract`, `reconcile`, `github-reference` and all existing routes, is **not modified or imported** by this subsystem. The change is additive only, so nothing breaks.

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
4. **M4, persistence (only if asked):** migration 004, schema-guard expectation, append-only writer.
5. **M5, consumer (only if asked):** a read-only tenant API route or ROE input. This is a separate decision.

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

## 13. Open questions
1. ~~Meaning of "4D"~~ **Resolved:** (predicted, observed, Φ) × time. The reference commit is context, not an axis.
2. ~~Lossless vs bounded-loss~~ **Resolved:** lossless for M1–M2. Bounded-loss is opt-in in M3, and eps per axis is to be chosen then.
3. ~~Which sources~~ **Resolved:** `third-party-workbench` only. Others are excluded and counted.
4. ~~Segment size and sealing~~ **Resolved (M3):** fixed 256-run windows plus a time cutoff (default 24 h, configurable), ordered by DB arrival; a late record goes into the next open window and never reopens a sealed one. See "M3 as built".
5. If persisted, should segments live in the storage DB (`shiyan`) or the independent anchors DB, given they are derived and not authoritative? (Default for now: no persistence.)
6. Who reads the segments first: ROE next-action, the customer proof export, or nobody yet (verification only)? (Default for now: no consumer.)

## Sources
[1] Google DeepMind, "SIMA 2: An agent that plays, reasons, and learns with you in virtual 3D worlds", https://deepmind.google/blog/sima-2-an-agent-that-plays-reasons-and-learns-with-you-in-virtual-3d-worlds/
[2] SIMA Team, "SIMA 2: A Generalist Embodied Agent for Virtual Worlds", arXiv:2512.04797, https://arxiv.org/html/2512.04797
[3] MIT Technology Review, "Google DeepMind is using Gemini to train agents inside Goat Simulator 3" (13 Nov 2025), https://www.technologyreview.com/2025/11/13/1127921/google-deepmind-is-using-gemini-to-train-agents-inside-goat-simulator-3/
