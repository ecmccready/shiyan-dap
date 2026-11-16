/** TEST ONLY. Offline check for M3 of the 4D state compression engine: window sealing (fixed size + time
 * cutoff, late records), opt-in bounded-loss, per-segment anchors context, the anchors read-only source, and
 * the CLI with --anchor-file. Hand-written fixtures built here; recording mock pg clients; no database.
 * The only files touched are fixture URL files in a fresh temp dir, deleted at the end.
 * Run: npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-compression-m3.ts
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DEFAULT_CUTOFF_MS, buildTenantChain, compressPoints, compressTenant, extractPoints, planWindows, arrivalsFrom,
  reconstruct, recoveryRoot, verifyChain, verifyReconstruction, verifySealed, verifySegment, verifyTenantChain,
  type AnchorSource, type SealedSegment, type SourceRow,
} from "../src/core/compression";
import {
  READ_ONLY_BEGIN, TENANT_RECOVERY_RECORDS_SQL, TENANT_REFERENCE_ANCHORS_SQL, TENANT_ROWS_SQL, isAllowedReadOnlySql,
  readTenantAnchors, toSourceRow, type ReadOnlyClient,
} from "../src/core/compression/source";
import { FLAG, runCompressTenant, type CompressTenantDeps } from "./compress-tenant";

// ---------- Fixtures (tests only): byte-identical to the M1 and M2 check fixtures ----------
const sha = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");
type Fx = { tenant?: string; id: string; predicted: number; observed: number; phi?: number; step?: number;
  verdict?: string; source?: string; ts?: string; recordTenant?: string };
function m1Row(f: Fx): SourceRow {
  const tenant = f.tenant ?? "tenant-a";
  const inputs = { predicted: f.predicted, observed: f.observed, phi: f.phi ?? 1, step: f.step ?? 0 };
  const record = {
    experience_id: f.id, tenant_id: f.recordTenant ?? tenant, repo: "workbench:fixture-bench", commit_sha: "1.0.0",
    goal: "fixture goal", baseline: `predicted=${f.predicted}`, action: "fixture action",
    predicted_outcome: String(f.predicted), observed_outcome: String(f.observed),
    delta_e: Math.abs(f.predicted - f.observed), metrics: { transformations: 8 },
    verification: { replay_verdict: "PASS", verifier_version: "deterministic-proof-v1" },
    metamorphic: { seed: 42, transformation: JSON.stringify({ inputs, transformations: [] }),
      expected_relation: "fixture relation", result: f.verdict ?? "PASS", converged: true },
    provenance: { source: f.source ?? "third-party-workbench", run_id: `run-${f.id}`, timestamp: f.ts ?? "2026-01-01T00:00:00.000Z" },
    reuse_eligibility: false, z_next_action: "fixture next action", data_classification: "third-party-submission", revision: 1,
  };
  const record_json = JSON.stringify(record);
  return { tenant_id: tenant, experience_id: f.id, record_json, content_sha256: sha(record_json), proof_timestamp: f.ts ?? "2026-01-01T00:00:00.000Z" };
}
const m1ts = (i: number) => new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString();
const fid = (i: number) => `wb-${i.toString(16).padStart(32, "0")}`;
/** Identical to rowsA in scripts/check-compression.ts (M1). */
const m1Rows: SourceRow[] = Array.from({ length: 10 }, (_, i) => m1Row({
  id: fid(i), predicted: 1 + i / 10, observed: 1 + i / 9, phi: 1 - i / 100, step: i,
  verdict: ["PASS", "FAIL", "INCONCLUSIVE"][i % 3], ts: m1ts(i),
}));
/** Identical to tenantRows in scripts/check-compression-source.ts (M2), converted with toSourceRow. */
function m2PgRow(i: number, tenant = "fixture-tenant", tsMs?: number): Record<string, unknown> {
  const f = { id: fid(i), predicted: i === 7 ? -0 : 1 + i / 10, observed: 1 + i / 9, phi: 1 - i / 1000, step: i,
    ts: new Date(tsMs ?? Date.UTC(2026, 0, 1, 0, 0, 0, i * 250)) };
  const record = {
    experience_id: f.id, tenant_id: tenant, repo: "workbench:fixture-bench", commit_sha: "1.0.0",
    goal: "FIXTURE-PAYLOAD-goal", baseline: `predicted=${f.predicted}`, action: "FIXTURE-PAYLOAD-action",
    predicted_outcome: String(f.predicted), observed_outcome: String(f.observed),
    delta_e: Math.abs(f.predicted - f.observed), metrics: { transformations: 8 },
    verification: { replay_verdict: "PASS", verifier_version: "deterministic-proof-v1" },
    metamorphic: { seed: 42, transformation: JSON.stringify({ inputs: { predicted: f.predicted, observed: f.observed, phi: f.phi, step: f.step }, transformations: [] }),
      expected_relation: "fixture relation", result: ["PASS", "FAIL", "INCONCLUSIVE"][f.step % 3], converged: true },
    provenance: { source: "third-party-workbench", run_id: `run-${f.id}`, timestamp: f.ts.toISOString() },
    reuse_eligibility: false, z_next_action: "FIXTURE-PAYLOAD-next", data_classification: "third-party-submission", revision: 1,
  };
  const record_json = JSON.stringify(record);
  return { tenant_id: tenant, experience_id: f.id, record_json, content_sha256: sha(record_json), proof_timestamp: f.ts };
}
const m2Rows: SourceRow[] = Array.from({ length: 300 }, (_, i) => toSourceRow(m2PgRow(i)));

// Golden hashes computed with the M2 code (fac78f1) before any M3 change, for the fixtures above.
const GOLDEN = {
  m1_size4: [
    "ec52d7b8290c10aecdcff008b75db281e79936a4fdf6f37764d8f8b24a7eccad",
    "6b5212b3179fd4bf41201cf55b37e2a2182356fabb9eff36cd62e31b92354acb",
  ],
  m1_size4_partial_last: "c080d5e18d4074554202d4e966701601bde4bc8adb4c35a4aab61013dae658c4",
  m2_partial: [
    "86af8e3b20667775faaf1fd25018de62a14801e323ee17809c31467c63a7920a",
    "56a7a044b894517e3cb0feb999dd9a5a9946d935da6daf53e89c8fd4d6b2e525",
  ],
};

const TENANT = "fixture-tenant";
const H = 3_600_000;
const MIN = 60_000;
const T0 = Date.UTC(2026, 5, 1, 0, 0, 0);
const FAR = Date.UTC(2026, 10, 16, 0, 0, 0);
/** A row with proof_timestamp tMs and DB arrival (created_at) arrMs. */
const rowAt = (i: number, tMs: number, arrMs?: number): SourceRow =>
  toSourceRow({ ...m2PgRow(i, TENANT, tMs), ...(arrMs === undefined ? {} : { created_at: new Date(arrMs) }) });
const hashes = (segs: readonly SealedSegment[]) => segs.map((s) => s.segment_sha256);

let checks = 0;
const check = async (name: string, fn: () => void | Promise<void>) => { await fn(); checks += 1; console.log(`PASS ${name}`); };

async function main(): Promise<void> {
  // ---------- 1. Lossless default is byte-identical to M1/M2 ----------
  await check("M1 compressTenant hashes are unchanged (golden from fac78f1)", () => {
    assert.deepEqual(hashes(compressTenant("tenant-a", m1Rows, { segmentSize: 4 }).segments), GOLDEN.m1_size4);
    const p = compressTenant("tenant-a", m1Rows, { segmentSize: 4, sealPartial: true });
    assert.deepEqual(hashes(p.segments), [...GOLDEN.m1_size4, GOLDEN.m1_size4_partial_last]);
  });
  await check("M2 fixture (300 rows, partial sealed) hashes are unchanged", () => {
    assert.deepEqual(hashes(compressTenant(TENANT, m2Rows, { sealPartial: true }).segments), GOLDEN.m2_partial);
  });
  await check("explicit lossless option and the M3 chain builder reproduce the same golden hashes", () => {
    const { points } = extractPoints("tenant-a", m1Rows);
    const s0 = compressPoints("tenant-a", 0, points.slice(0, 4), null, { loss: { mode: "lossless" } });
    assert.equal(s0.segment_sha256, GOLDEN.m1_size4[0]);
    assert.ok(!("context" in s0.segment), "no context key unless requested");
    // M2 rows have no created_at, so arrival = proof_timestamp: 256 full + 44 sealed by cutoff = M2's windows.
    const c = buildTenantChain(TENANT, m2Rows, { asOfMs: FAR });
    assert.deepEqual(hashes(c.segments), GOLDEN.m2_partial);
    assert.deepEqual(c.windows.map((w) => w.closed_by), ["full", "cutoff"]);
    assert.equal(c.arrival_fallback, 300);
    const m1 = buildTenantChain("tenant-a", m1Rows, { segmentSize: 4, cutoffMs: Infinity, asOfMs: FAR });
    assert.deepEqual(hashes(m1.segments), GOLDEN.m1_size4);
    assert.equal(m1.pending, 2);
  });

  // ---------- 2. Bounded-loss (opt-in) ----------
  const eps = { predicted: 1e-3, observed: 1e-2, phi: 1e-4 };
  const { points: m2Points } = extractPoints(TENANT, m2Rows);
  await check("bounded: every reconstructed value is within eps; t, step, verdict exact; eps and max_abs_err recorded", () => {
    const seg = compressPoints(TENANT, 0, m2Points.slice(0, 256), null, { loss: { mode: "bounded", eps } });
    assert.equal(seg.segment.loss.mode, "bounded");
    if (seg.segment.loss.mode !== "bounded") return;
    assert.deepEqual(seg.segment.loss.eps, eps);
    const back = reconstruct(seg.segment);
    let maxP = 0;
    back.forEach((g, k) => {
      const w = m2Points[k];
      assert.equal(g.t, w.t); assert.equal(g.step, w.step); assert.equal(g.verdict, w.verdict);
      for (const a of ["predicted", "observed", "phi"] as const) assert.ok(Math.abs(g[a] - w[a]) <= eps[a] / 2 + 1e-12, `${a} at ${k}`);
      maxP = Math.max(maxP, Math.abs(g.predicted - w.predicted));
    });
    assert.ok(Object.is(seg.segment.loss.max_abs_err.predicted, maxP));
    assert.ok(seg.segment.loss.max_abs_err.observed <= eps.observed / 2 + 1e-12);
    assert.ok(verifyReconstruction(seg, m2Points.slice(0, 256)).ok);
    assert.ok(verifySealed(seg).ok);
    assert.ok(verifySegment(seg, m2Rows.filter((r) => m2Points.slice(0, 256).some((p) => p.experience_id === r.experience_id))).ok);
    const lossless = compressPoints(TENANT, 0, m2Points.slice(0, 256), null);
    assert.notEqual(seg.segment_sha256, lossless.segment_sha256);
    const other = compressPoints(TENANT, 0, m2Points.slice(0, 256), null, { loss: { mode: "bounded", eps: { ...eps, phi: 2e-4 } } });
    assert.notEqual(seg.segment_sha256, other.segment_sha256, "eps is covered by the hash");
  });
  await check("bounded: tampered max_abs_err, eps or a quantized value is rejected", () => {
    const seg = compressPoints(TENANT, 0, m2Points.slice(0, 20), null, { loss: { mode: "bounded", eps } });
    if (seg.segment.loss.mode !== "bounded") throw new Error("expected bounded");
    const bumped: SealedSegment = { ...seg, segment: { ...seg.segment, loss: { ...seg.segment.loss, max_abs_err: { ...seg.segment.loss.max_abs_err, phi: 0 } } } };
    assert.ok(!verifySealed(bumped).ok, "hash covers max_abs_err");
    assert.ok(!verifyReconstruction(bumped, m2Points.slice(0, 20)).ok, "measured error must equal stored");
    const resealed = (s: typeof seg.segment) => ({ segment: s, segment_sha256: compressPoints(TENANT, 0, m2Points.slice(0, 20), null).segment_sha256 });
    const wideEps = { ...seg.segment, loss: { ...seg.segment.loss, eps: { ...eps, predicted: 1 } } };
    assert.ok(!verifyReconstruction(resealed(wideEps), m2Points.slice(0, 20)).ok, "values decode differently under another eps");
    const cols = [...seg.segment.predicted]; cols[3] = (BigInt(`0x${cols[3]}`) ^ BigInt(1)).toString(16);
    assert.ok(!verifySealed({ ...seg, segment: { ...seg.segment, predicted: cols } }).ok);
  });
  await check("bounded: invalid eps and eps too small for a value's magnitude are refused, not silently exceeded", () => {
    for (const bad of [0, -1, Number.NaN, Infinity]) {
      assert.throws(() => compressPoints(TENANT, 0, m2Points.slice(0, 3), null, { loss: { mode: "bounded", eps: { ...eps, observed: bad } } }), /eps/);
    }
    const big = [{ ...m2Points[0], predicted: 1e20 }];
    assert.throws(() => compressPoints(TENANT, 0, big, null, { loss: { mode: "bounded", eps: { ...eps, predicted: 1e-6 } } }), /eps|range/);
  });
  await check("lossless verifyReconstruction is bit-exact (a 1-ulp change fails)", () => {
    const seg = compressPoints(TENANT, 0, m2Points.slice(0, 10), null);
    assert.ok(verifyReconstruction(seg, m2Points.slice(0, 10)).ok);
    const nudged = m2Points.slice(0, 10).map((p, k) => (k === 4 ? { ...p, phi: p.phi + Number.EPSILON } : p));
    assert.ok(!verifyReconstruction(seg, nudged).ok);
  });
  await check("bounded chain verifies end to end (chain, recompute, sources, reconstruction)", () => {
    const opts = { asOfMs: FAR, loss: { mode: "bounded" as const, eps } };
    const c = buildTenantChain(TENANT, m2Rows, opts);
    const v = verifyTenantChain(TENANT, c.segments, m2Rows, opts);
    for (const [k, r] of Object.entries(v)) assert.ok(r.ok, `${k}: ${r.errors.join("; ")}`);
    const lossless = verifyTenantChain(TENANT, c.segments, m2Rows, { asOfMs: FAR });
    assert.ok(!lossless.recompute.ok, "a bounded chain does not pass as lossless");
  });

  // ---------- 3. Window sealing ----------
  await check("sealing: full at 256, cutoff after 24 h, open window pending until cutoff + grace", () => {
    const rows = [
      ...Array.from({ length: 256 }, (_, i) => rowAt(i, T0 + i * 1000, T0 + i * 1000)),
      ...Array.from({ length: 5 }, (_, i) => rowAt(300 + i, T0 + H + i * MIN, T0 + H + i * MIN)),
    ];
    const opened = T0 + H;
    const at = (asOfMs: number) => buildTenantChain(TENANT, rows, { asOfMs });
    assert.equal(at(T0 + 255_000 + 9 * MIN).segments.length, 0, "full window still inside grace");
    assert.equal(at(T0 + 255_000 + 10 * MIN).segments.length, 1, "full window final after grace");
    const before = at(opened + DEFAULT_CUTOFF_MS - 1);
    assert.equal(before.segments.length, 1); assert.equal(before.pending, 5);
    const inGrace = at(opened + DEFAULT_CUTOFF_MS + 5 * MIN);
    assert.equal(inGrace.segments.length, 1, "cutoff passed but grace not over");
    const after = at(opened + DEFAULT_CUTOFF_MS + 10 * MIN);
    assert.equal(after.segments.length, 2); assert.equal(after.pending, 0);
    assert.deepEqual(after.windows.map((w) => w.closed_by), ["full", "cutoff"]);
    assert.equal(after.windows[1].closed_at, opened + DEFAULT_CUTOFF_MS);
    assert.deepEqual(hashes(after.segments).slice(0, 1), hashes(before.segments), "sealed prefix unchanged as time passes");
  });
  await check("sealing: a later arrival past the cutoff closes the window and opens the next one", () => {
    const rows = [rowAt(1, T0, T0), rowAt(2, T0 + 2 * H, T0 + 2 * H), rowAt(3, T0 + 30 * H, T0 + 30 * H), rowAt(4, T0 + 31 * H, T0 + 31 * H)];
    const c = buildTenantChain(TENANT, rows, { asOfMs: FAR });
    assert.deepEqual(c.windows.map((w) => w.points.length), [2, 2]);
    const short = buildTenantChain(TENANT, rows, { asOfMs: FAR, cutoffMs: H });
    assert.deepEqual(short.windows.map((w) => w.points.length), [1, 1, 1, 1], "cutoff is configurable");
    const none = buildTenantChain(TENANT, rows, { asOfMs: FAR, cutoffMs: Infinity });
    assert.equal(none.segments.length, 0); assert.equal(none.pending, 4);
  });
  await check("late record goes into the next open window and never reopens a sealed window", () => {
    // Window 1: four runs arriving on day 1, sealed after its 24 h cutoff + grace.
    const w1 = [0, 1, 2, 3].map((i) => rowAt(i, T0 + i * MIN, T0 + i * MIN));
    const t1 = T0 + DEFAULT_CUTOFF_MS + 11 * MIN;
    const first = buildTenantChain(TENANT, w1, { asOfMs: t1 });
    assert.equal(first.segments.length, 1);
    // Later: a run whose proof_timestamp is earlier than window 1's runs arrives on day 2, plus a normal one.
    const late = rowAt(50, T0 - H, T0 + 26 * H);
    const normal = rowAt(51, T0 + 26 * H + MIN, T0 + 26 * H + MIN);
    const second = buildTenantChain(TENANT, [normal, late, ...w1], { asOfMs: T0 + 26 * H + DEFAULT_CUTOFF_MS + 11 * MIN });
    assert.equal(second.segments[0].segment_sha256, first.segments[0].segment_sha256, "sealed window 1 is unchanged");
    assert.equal(second.segments.length, 2);
    assert.deepEqual(second.windows[1].points.map((p) => p.experience_id), [late, normal].map((r) => r.experience_id), "late record leads window 2 in (t, id) order");
    assert.equal(second.late, 1);
    const v = verifyTenantChain(TENANT, second.segments, [late, normal, ...w1], { asOfMs: T0 + 26 * H + DEFAULT_CUTOFF_MS + 11 * MIN });
    for (const [k, r] of Object.entries(v)) assert.ok(r.ok, `${k}: ${r.errors.join("; ")}`);
    // Contrast: ordering by proof_timestamp alone would have put the late run into window 1.
    const naive = compressTenant(TENANT, [late, normal, ...w1], { segmentSize: 4 });
    assert.notEqual(naive.segments[0].segment_sha256, first.segments[0].segment_sha256);
  });
  await check("sealing is deterministic: shuffled rows and repeated runs give identical chains", () => {
    const rows = Array.from({ length: 40 }, (_, i) => rowAt(i, T0 + ((i * 7919) % 40) * MIN, T0 + i * 3 * H));
    const a = buildTenantChain(TENANT, rows, { asOfMs: FAR, segmentSize: 8 });
    const b = buildTenantChain(TENANT, [...rows].reverse(), { asOfMs: FAR, segmentSize: 8 });
    assert.deepEqual(hashes(a.segments), hashes(b.segments));
    assert.ok(a.late > 0, "fixture has late records");
    // Prefix property over time: each later as_of extends, never rewrites, the sealed chain.
    let prev: string[] = [];
    for (let k = 0; k <= 130; k += 5) {
      const asOf = T0 + k * H;
      const visible = rows.filter((r) => Date.parse(r.created_at as string) <= asOf);
      const now = hashes(buildTenantChain(TENANT, visible, { asOfMs: asOf, segmentSize: 8 }).segments);
      assert.deepEqual(now.slice(0, prev.length), prev, `prefix rewritten at k=${k}`);
      prev = now;
    }
  });
  await check("sealing options are validated; arrival falls back to proof_timestamp only without created_at", () => {
    assert.throws(() => buildTenantChain(TENANT, m2Rows, { asOfMs: Number.NaN }), /asOfMs/);
    assert.throws(() => buildTenantChain(TENANT, m2Rows, { asOfMs: FAR, cutoffMs: 0 }), /cutoffMs/);
    assert.throws(() => buildTenantChain(TENANT, m2Rows, { asOfMs: FAR, graceMs: -1 }), /graceMs/);
    const arr = arrivalsFrom([rowAt(1, T0, T0 + H), rowAt(2, T0)]);
    assert.equal(arr.get(fid(1)), T0 + H); assert.equal(arr.has(fid(2)), false);
    const plan = planWindows(extractPoints(TENANT, [rowAt(1, T0, T0 + H), rowAt(2, T0)]).points, arr, { asOfMs: FAR });
    assert.equal(plan.arrival_fallback, 1);
  });

  // ---------- 4. Context ----------
  const ref = (n: number, atMs: number) => ({ reference_id: `ref-${n.toString(16).padStart(32, "0")}`, commit_sha: n.toString(16).padStart(40, "a"),
    snapshot_sha256: sha(`snap${n}`), envelope_sha256: sha(`env${n}`), created_at: new Date(atMs).toISOString() });
  const rec = (run: string | null, status: string, n: number, atMs: number) => ({ run_id: run, status, record_sha256: sha(`rec${n}`), created_at: new Date(atMs).toISOString() });
  const ctxRows = [0, 1, 2, 3].map((i) => rowAt(i, T0 + i * MIN, T0 + i * MIN));
  const sealAt = T0 + DEFAULT_CUTOFF_MS;
  const anchors: AnchorSource = {
    references: [ref(1, T0 - H), ref(2, T0 + H), ref(3, sealAt + 1)],
    recoveries: [
      rec(`run-${fid(1)}`, "PROMOTED", 1, T0 + 2 * H), rec(`run-${fid(2)}`, "REJECTED", 2, T0 + 3 * H),
      rec(`run-${fid(2)}`, "PROMOTED", 3, sealAt + 5), rec("run-elsewhere", "PROMOTED", 4, T0), rec(null, "DRIFT_EXCEEDED", 5, T0),
      { run_id: "x", status: "BOGUS", record_sha256: "nope", created_at: "never" },
    ],
  };
  const ctxOpts = { asOfMs: FAR, anchors };
  await check("context: latest anchor at or before seal, recovery records linked by run_id and created before seal", () => {
    const c = buildTenantChain(TENANT, ctxRows, ctxOpts);
    assert.equal(c.segments.length, 1);
    const ctx = c.segments[0].segment.context!;
    assert.equal(ctx.as_of, sealAt);
    assert.deepEqual(ctx.reference, { status: "present", ...(({ created_at: _c, ...r }) => r)(ref(2, T0 + H)) });
    assert.equal(ctx.recovery.count, 2);
    assert.deepEqual(ctx.recovery.by_status, { PROMOTED: 1, REJECTED: 1 });
    assert.equal(ctx.recovery.records_root, recoveryRoot([sha("rec1"), sha("rec2")].sort()));
    assert.deepEqual(c.anchors, { references: 3, recoveries: 4, invalid_references: 0, invalid_recoveries: 1, unlinked_recoveries: 1 });
    assert.deepEqual(Object.keys(ctx).sort(), ["as_of", "recovery", "reference", "version"]);
    assert.deepEqual(Object.keys(ctx.recovery).sort(), ["by_status", "count", "records_root"]);
    const v = verifyTenantChain(TENANT, c.segments, ctxRows, ctxOpts);
    for (const [k, r] of Object.entries(v)) assert.ok(r.ok, `${k}: ${r.errors.join("; ")}`);
  });
  await check("context is covered by the segment hash and the chain; it changes the hash only when requested", () => {
    const withCtx = buildTenantChain(TENANT, ctxRows, ctxOpts).segments[0];
    const without = buildTenantChain(TENANT, ctxRows, { asOfMs: FAR }).segments[0];
    assert.notEqual(withCtx.segment_sha256, without.segment_sha256);
    const forged: SealedSegment = { ...withCtx, segment: { ...withCtx.segment, context: { ...withCtx.segment.context!, recovery: { ...withCtx.segment.context!.recovery, count: 9 } } } };
    assert.ok(!verifySealed(forged).ok);
    assert.ok(!verifyChain([forged]).ok);
    const shuffled = { references: [...anchors.references].reverse(), recoveries: [...anchors.recoveries].reverse() };
    assert.equal(buildTenantChain(TENANT, ctxRows, { asOfMs: FAR, anchors: shuffled }).segments[0].segment_sha256, withCtx.segment_sha256, "anchor row order does not matter");
    const v = verifyTenantChain(TENANT, [without], ctxRows, ctxOpts);
    assert.ok(!v.context.ok && !v.recompute.ok, "missing context is detected when anchors were given");
  });
  await check("missing anchor context is recorded explicitly (reference none, zero recovery), never invented", () => {
    const c = buildTenantChain(TENANT, ctxRows, { asOfMs: FAR, anchors: { references: [], recoveries: [] } });
    const ctx = c.segments[0].segment.context!;
    assert.deepEqual(ctx.reference, { status: "none" });
    assert.deepEqual(ctx.recovery, { count: 0, by_status: {}, records_root: null });
    const onlyLater = buildTenantChain(TENANT, ctxRows, { asOfMs: FAR, anchors: { references: [ref(9, sealAt + 1)], recoveries: [] } });
    assert.deepEqual(onlyLater.segments[0].segment.context!.reference, { status: "none" }, "an anchor created after sealing is not used");
  });

  // ---------- 5. Anchors read-only source ----------
  const mock = (answers: Record<string, unknown[]>, failOn?: string) => {
    const log: { sql: string; params?: unknown[] }[] = [];
    const client: ReadOnlyClient = {
      async query(sql: string, params?: unknown[]) {
        log.push({ sql, params });
        if (failOn && sql === failOn) throw Object.assign(new Error("boom postgres://leak:LEAKED-SECRET@h/d"), { code: "57014" });
        return { rows: answers[sql] ?? [] };
      },
    };
    return { client, log };
  };
  const pgAnchors = {
    [TENANT_REFERENCE_ANCHORS_SQL]: anchors.references.map((r) => ({ ...r, created_at: new Date(r.created_at) })),
    [TENANT_RECOVERY_RECORDS_SQL]: anchors.recoveries.map((r) => ({ ...r, created_at: Number.isNaN(Date.parse(r.created_at)) ? r.created_at : new Date(r.created_at) })),
  };
  await check("readTenantAnchors: BEGIN READ ONLY, two tenant-scoped SELECTs, COMMIT; Dates become ISO", async () => {
    const { client, log } = mock(pgAnchors);
    const out = await readTenantAnchors(client, TENANT);
    assert.deepEqual(log.map((q) => q.sql), [READ_ONLY_BEGIN, TENANT_REFERENCE_ANCHORS_SQL, TENANT_RECOVERY_RECORDS_SQL, "COMMIT"]);
    assert.deepEqual(log[1].params, [TENANT]); assert.deepEqual(log[2].params, [TENANT]);
    assert.equal(out.references[0].created_at, anchors.references[0].created_at);
    assert.equal(buildTenantChain(TENANT, ctxRows, { asOfMs: FAR, anchors: out }).segments[0].segment_sha256,
      buildTenantChain(TENANT, ctxRows, ctxOpts).segments[0].segment_sha256);
    for (const q of [TENANT_REFERENCE_ANCHORS_SQL, TENANT_RECOVERY_RECORDS_SQL, TENANT_ROWS_SQL]) {
      assert.ok(isAllowedReadOnlySql(q)); assert.match(q, /^SELECT [a-z_, 0-9]+ FROM shiyan(_anchor)?\.[a-z_]+ WHERE tenant_id = \$1 ORDER BY [a-z_, ]+$/);
    }
    assert.ok(!/prior_predicted|synthesized|phi_lift|anchor_delta/.test(TENANT_RECOVERY_RECORDS_SQL), "no numeric recovery payload is read");
    assert.match(TENANT_ROWS_SQL, /created_at/);
  });
  await check("readTenantAnchors: error rolls back and rethrows; invalid tenant sends nothing", async () => {
    const { client, log } = mock(pgAnchors, TENANT_RECOVERY_RECORDS_SQL);
    await assert.rejects(readTenantAnchors(client, TENANT), /boom/);
    assert.deepEqual(log.map((q) => q.sql), [READ_ONLY_BEGIN, TENANT_REFERENCE_ANCHORS_SQL, TENANT_RECOVERY_RECORDS_SQL, "ROLLBACK"]);
    const quiet = mock(pgAnchors);
    await assert.rejects(readTenantAnchors(quiet.client, "Bad!"), /TENANT_ID_PATTERN/);
    assert.equal(quiet.log.length, 0);
  });

  // ---------- 6. CLI with --anchor-file, bounded loss, pinned --as-of ----------
  const dir = mkdtempSync(join(tmpdir(), "shiyan-m3-"));
  try {
    const storageFile = join(dir, "storage-url");
    const anchorFile = join(dir, "anchor-url");
    const sameFile = join(dir, "same-url");
    const PW = "fixture-pw-must-not-print";
    writeFileSync(storageFile, `postgres://fixture_role:${PW}@localhost:5432/fixture_db?sslmode=disable\n`);
    writeFileSync(anchorFile, `postgres://fixture_anchor:${PW}@127.0.0.1:5432/fixture_anchor_db?sslmode=disable\n`);
    writeFileSync(sameFile, `postgres://fixture_role:${PW}@localhost:5432/fixture_db?sslmode=disable\n`);
    const snap = () => readdirSync(dir).sort().map((n) => `${n}:${statSync(join(dir, n)).mtimeMs}:${sha(readFileSync(join(dir, n), "utf8"))}`).join("|");
    const before = snap();
    const pgRows = ctxRows.map((r) => ({ ...r, proof_timestamp: new Date(r.proof_timestamp), created_at: new Date(r.created_at as string) }));
    const deps = (failAnchors?: string) => {
      const storage = mock({ [TENANT_ROWS_SQL]: pgRows });
      const anchorsDb = mock(pgAnchors, failAnchors);
      const calls: string[] = [];
      const d: CompressTenantDeps = {
        readTextFile: (p) => readFileSync(p, "utf8"),
        connect: async (_c, purpose) => { calls.push(purpose); return { client: purpose === "anchors" ? anchorsDb.client : storage.client, close: async () => undefined }; },
        home: () => dir,
        now: () => FAR,
      };
      return { d, storage, anchorsDb, calls };
    };
    const ON = { [FLAG]: "1" };
    const base = ["--tenant", TENANT, "--storage-file", storageFile];
    const leaks = (t: string) => [PW, "fixture_role", "fixture_anchor", "localhost", "127.0.0.1", "postgres://", "FIXTURE-PAYLOAD", "wb-", "run-",
      "LEAKED-SECRET", "boom", "third-party-workbench"].filter((x) => t.includes(x));

    await check("CLI off by default still refuses with M3 flags and reads nothing", async () => {
      const { d, calls } = deps();
      const out = await runCompressTenant([...base, "--anchor-file", anchorFile, "--loss", "bounded", "--eps", "0.1,0.1,0.1"], {}, d);
      assert.equal(out.exitCode, 2); assert.deepEqual(calls, []);
    });
    let lossless = "";
    await check("CLI with --anchor-file: context per segment, both DBs read-only, PASS, no leaks", async () => {
      const { d, storage, anchorsDb, calls } = deps();
      const out = await runCompressTenant([...base, "--anchor-file", anchorFile], ON, d);
      lossless = out.lines.join("\n");
      assert.equal(out.exitCode, 0, lossless);
      assert.deepEqual(calls, ["storage", "anchors"]);
      assert.deepEqual(storage.log.map((q) => q.sql), [READ_ONLY_BEGIN, TENANT_ROWS_SQL, "COMMIT"]);
      assert.deepEqual(anchorsDb.log.map((q) => q.sql), [READ_ONLY_BEGIN, TENANT_REFERENCE_ANCHORS_SQL, TENANT_RECOVERY_RECORDS_SQL, "COMMIT"]);
      assert.match(lossless, /^context: anchors=read reference_anchors=3 recovery_records_linkable=4 recovery_unlinked=1 invalid_reference_rows=0 invalid_recovery_rows=1$/m);
      assert.match(lossless, /^segment 0: count=4 closed_by=cutoff sha256=[0-9a-f]{64} source_ids_root=[0-9a-f]{64} recovery=2\(PROMOTED=1,REJECTED=1\) recovery_root=[0-9a-f]{64} reference=ref-0{31}2 commit=[0-9a-f]{40} snapshot_sha256=[0-9a-f]{64}$/m);
      for (const c of ["chain", "recompute", "sources", "lossless", "context"]) assert.match(lossless, new RegExp(`^PASS ${c}$`, "m"));
      assert.match(lossless, /^RESULT: PASS$/m);
      assert.match(lossless, /^sealing: size=256 cutoff_hours=24 grace_minutes=10 as_of=2026-11-16T00:00:00.000Z$/m);
      assert.deepEqual(leaks(lossless), []);
      assert.ok(lossless.split("\n").every((l) => /^[A-Za-z0-9_ :=(),.\-]*$/.test(l)));
    });
    await check("CLI bounded example: PASS bounded, eps and max_abs_err printed, different chain root", async () => {
      const { d } = deps();
      const out = await runCompressTenant([...base, "--anchor-file", anchorFile, "--loss", "bounded", "--eps", "0.001,0.01,0.0001"], ON, d);
      const text = out.lines.join("\n");
      assert.equal(out.exitCode, 0, text);
      assert.match(text, /^loss: bounded eps_predicted=0.001 eps_observed=0.01 eps_phi=0.0001$/m);
      assert.match(text, /^segment 0: .* max_abs_err=[0-9.e-]+,[0-9.e-]+,[0-9.e-]+ recovery=/m);
      assert.match(text, /^PASS bounded$/m);
      const root = (t: string) => t.match(/^chain_root: (\S+)$/m)?.[1];
      assert.notEqual(root(text), root(lossless));
      assert.deepEqual(leaks(text), []);
    });
    await check("CLI usage: bad --loss/--eps/--cutoff-hours/--as-of exit 2 before any read", async () => {
      for (const extra of [["--loss", "lossy"], ["--loss", "bounded"], ["--loss", "bounded", "--eps", "0,1,1"], ["--eps", "1,1,1"],
        ["--cutoff-hours", "0"], ["--cutoff-hours", "2", "--full-windows-only"], ["--as-of", "yesterday"], ["--grace-minutes", "-1"], ["--anchor-file"]]) {
        const { d, calls } = deps();
        const out = await runCompressTenant([...base, ...extra], ON, d);
        assert.equal(out.exitCode, 2, extra.join(" ")); assert.deepEqual(calls, []);
      }
    });
    await check("CLI: anchors URL on the same database as storage is refused; anchors read errors print code only", async () => {
      const same = deps();
      const out = await runCompressTenant([...base, "--anchor-file", sameFile], ON, same.d);
      assert.equal(out.exitCode, 1); assert.match(out.lines[0], /^FAIL anchors\.url: must point at a different database/); assert.deepEqual(same.calls, []);
      const broken = deps(TENANT_RECOVERY_RECORDS_SQL);
      const out2 = await runCompressTenant([...base, "--anchor-file", anchorFile], ON, broken.d);
      assert.equal(out2.exitCode, 1); assert.match(out2.lines.join("\n"), /^FAIL anchors\.read: class=\S+ code=57014$/);
      assert.deepEqual(leaks(out2.lines.join("\n")), []);
      assert.equal(broken.anchorsDb.log.at(-1)?.sql, "ROLLBACK");
    });
    await check("CLI with a pinned --as-of is reproducible; a cutoff window not yet past grace stays pending", async () => {
      const a = (await runCompressTenant([...base, "--as-of", "2026-11-16T00:00:00Z"], ON, deps().d)).lines.join("\n");
      const b = (await runCompressTenant([...base, "--as-of", "2026-11-16T00:00:00Z"], ON, deps().d)).lines.join("\n");
      assert.equal(a, b);
      const early = (await runCompressTenant([...base, "--as-of", new Date(T0 + 2 * H).toISOString()], ON, deps().d)).lines.join("\n");
      assert.match(early, /^segments: 0 {2}pending: 4$/m);
      assert.match(early, /^RESULT: PASS$/m);
    });
    await check("no-write guarantee: fixture URL files' mtime and hash and the temp dir are unchanged", () => {
      assert.equal(snap(), before);
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  console.log(`PASS check-compression-m3 (${checks} checks)`);
}

main().catch((error) => { console.error(error); process.exit(1); });
