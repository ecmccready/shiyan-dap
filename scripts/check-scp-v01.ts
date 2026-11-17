/** TEST ONLY. 4D-SCP v0.1 software proof. Fixture-only thin wrapper over the existing
 * compression engine. No network, no production data, no writes, no process.env in src/scp.
 *
 * Measures the five properties in docs/design/4d-scp-architecture.md §7:
 *   1. compression ratio      — reported (raw_bytes = UTF-8 record_json of included rows;
 *                               compressed_bytes = UTF-8 canonical(segment) of sealed segments)
 *   2. fidelity               — lossless: bit-exact; bounded: max_abs_err <= eps
 *   3. latency p50/p95        — reported; hard-fail only on the generous hang bound
 *   4. retained task performance — unchanged replay verdict / Φ-sign class AND unchanged
 *                               Global snapshot status (decision 3, owner 2026-11-17)
 *   5. determinism            — identical head_sha256 across repeated / shuffled runs;
 *                               verifyChain / verifyTenantChain / verifyReconstruction pass
 *
 * Proposed pass thresholds (also stated in the spec):
 *   lossless: fidelity exact; ratio reported (no ratio ceiling); retained score = 1.0;
 *             determinism ok.
 *   bounded:  max_abs_err[a] <= eps[a] for predicted/observed/phi; t, step, verdict exact;
 *             retained score = 1.0 on this fixture (phi kept far from 0); determinism ok.
 *   latency:  N=256, K=21 samples; p50/p95 printed; fail only if p95 >= LATENCY_P95_HANG_MS
 *             (hang detector, not a performance SLA).
 *
 * Mapping (accepted): X=predicted, Y=observed, Z=phi, T=t.
 * Run: npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-scp-v01.ts
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  buildTenantChain,
  reconstruct,
  verifyChain,
  verifyReconstruction,
  verifyTenantChain,
  type AxisEps,
  type LossOption,
  type SourceRow,
  type StatePoint,
  type StateVector,
  type StateVerdict,
  type TenantChain,
} from "../src/core/compression";
import { canonical } from "../src/core/reconcile";
import { buildGlobalSnapshot, type GlobalRow, type GlobalStatus } from "../src/lib/diagnostics/global-snapshot";
import { frameFromStateVector, type ScpFrame, type ScpMeasurement } from "../src/scp";

// ---------- Proposed pass thresholds (keep in sync with the spec §7 / §12) ----------
const TENANT = "scp-v01-fixture";
const T0 = Date.UTC(2026, 5, 1);
const N = 256;
const LATENCY_SAMPLES = 21;
/** Generous hang bound only. Absolute p50/p95 are reported, not used as an SLA. */
const LATENCY_P95_HANG_MS = 30_000;
const BOUNDED_EPS: AxisEps = { predicted: 0.001, observed: 0.001, phi: 0.0001 };
const MAPPING = "x=predicted,y=observed,z=phi,t=t";
const GENERATED_AT = "2026-11-17T00:00:00.000Z";
const SHUFFLE_SEED = 20261117;
const LOSSLESS: LossOption = { mode: "lossless" };
const BOUNDED: LossOption = { mode: "bounded", eps: BOUNDED_EPS };
const CHAIN_OPTS = { asOfMs: T0 + 86_400_000, segmentSize: N, cutoffMs: Infinity, graceMs: 0 };

// ---------- Fixture (hand-written generator; committed test data only) ----------
function sha(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

function fid(i: number): string {
  return `scp${i.toString(16).padStart(8, "0")}`;
}

/** Variety of verdicts and Φ signs, with |phi| kept well above eps.phi so signs cannot flip. */
function fixturePoint(i: number): { predicted: number; observed: number; phi: number; step: number; t: number; verdict: StateVerdict } {
  const rem = i % 7;
  const verdict: StateVerdict = rem === 0 ? "FAIL" : rem === 1 ? "INCONCLUSIVE" : "PASS";
  const phi = (i % 5 === 0 ? -0.4 : 0.5) + i / 10_000;
  return {
    predicted: 1 + i / 10,
    observed: 1 + i / 9,
    phi,
    step: i,
    t: T0 + i * 1000,
    verdict,
  };
}

function makeRow(i: number): SourceRow {
  const f = fixturePoint(i);
  const id = fid(i);
  const record = {
    experience_id: id, tenant_id: TENANT, repo: "workbench:fixture-bench", commit_sha: "1.0.0",
    goal: "FIXTURE-PAYLOAD-goal", baseline: `predicted=${f.predicted}`, action: "FIXTURE-PAYLOAD-action",
    predicted_outcome: String(f.predicted), observed_outcome: String(f.observed),
    delta_e: Math.abs(f.predicted - f.observed), metrics: { transformations: 8 },
    verification: { replay_verdict: "PASS", verifier_version: "deterministic-proof-v1" },
    metamorphic: {
      seed: 42,
      transformation: JSON.stringify({ inputs: { predicted: f.predicted, observed: f.observed, phi: f.phi, step: f.step }, transformations: [] }),
      expected_relation: "fixture relation",
      result: f.verdict,
      converged: true,
    },
    provenance: { source: "third-party-workbench", run_id: `run-${id}`, timestamp: new Date(f.t).toISOString() },
    reuse_eligibility: false, z_next_action: "FIXTURE-PAYLOAD-next", data_classification: "third-party-submission", revision: 1,
  };
  const record_json = JSON.stringify(record);
  return {
    tenant_id: TENANT,
    experience_id: id,
    record_json,
    content_sha256: sha(record_json),
    proof_timestamp: new Date(f.t).toISOString(),
  };
}

const FIXTURE_ROWS: SourceRow[] = Array.from({ length: N }, (_, i) => makeRow(i));

// ---------- Helpers ----------
function phiClass(phi: number): -1 | 0 | 1 {
  return phi > 0 ? 1 : phi < 0 ? -1 : 0;
}

/** Fixture rule for Global snapshot status (decision 3). Documented in the spec §7.4 / §10. */
function fixtureEligible(verdict: StateVerdict, phi: number): boolean {
  return verdict === "PASS" && phi > 0;
}
function fixtureState(verdict: StateVerdict): string {
  return verdict === "INCONCLUSIVE" ? "CONTINUE" : "COMPLETE";
}

function rowsFromPoints(
  points: readonly { predicted: number; observed: number; phi: number; t: number; verdict: StateVerdict }[],
  ids: readonly string[],
): GlobalRow[] {
  return points.map((p, i) => ({
    run_id: `run-${ids[i]}`,
    iteration: 1,
    e: Math.abs(p.predicted - p.observed),
    delta_e: Math.abs(p.predicted - p.observed),
    phi: p.phi,
    eligible: fixtureEligible(p.verdict, p.phi),
    state: fixtureState(p.verdict),
    verified_at: new Date(p.t).toISOString(),
  }));
}

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1_664_225, s) + 1_013_904_223) >>> 0;
    return s / 0x1_0000_0000;
  };
}

function shuffle<T>(arr: readonly T[], seed: number): T[] {
  const a = arr.slice();
  const rnd = lcg(seed);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

function percentile(samples: number[], p: number): number {
  const sorted = samples.slice().sort((a, b) => a - b);
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[i];
}

function utf8(s: string): number {
  return Buffer.byteLength(s, "utf8");
}

function chainOpts(loss: LossOption) {
  return { ...CHAIN_OPTS, loss };
}

function reconstructAll(chain: TenantChain): StateVector[] {
  const out: StateVector[] = [];
  for (const s of chain.segments) out.push(...reconstruct(s.segment));
  return out;
}

function maxAbsErr(original: readonly StatePoint[], got: readonly StateVector[]): { x: number; y: number; z: number } {
  const err = { x: 0, y: 0, z: 0 };
  for (let i = 0; i < original.length; i++) {
    err.x = Math.max(err.x, Math.abs(got[i].predicted - original[i].predicted));
    err.y = Math.max(err.y, Math.abs(got[i].observed - original[i].observed));
    err.z = Math.max(err.z, Math.abs(got[i].phi - original[i].phi));
  }
  return err;
}

function bitExact(original: readonly StatePoint[], got: readonly StateVector[]): boolean {
  if (original.length !== got.length) return false;
  return original.every((p, i) =>
    Object.is(p.predicted, got[i].predicted)
    && Object.is(p.observed, got[i].observed)
    && Object.is(p.phi, got[i].phi)
    && p.t === got[i].t
    && Object.is(p.step, got[i].step)
    && p.verdict === got[i].verdict);
}

function retained(original: readonly StatePoint[], got: readonly StateVector[]): {
  agreement_verdict_phi: number;
  agreement_snapshot: number;
  score: number;
  n: number;
  statuses: Record<GlobalStatus, number>;
} {
  assert.equal(original.length, got.length);
  let agreePhi = 0;
  for (let i = 0; i < original.length; i++) {
    if (original[i].verdict === got[i].verdict && phiClass(original[i].phi) === phiClass(got[i].phi)) agreePhi++;
  }
  const ids = original.map((p) => p.experience_id);
  const snap0 = buildGlobalSnapshot(rowsFromPoints(original, ids), GENERATED_AT);
  const snap1 = buildGlobalSnapshot(rowsFromPoints(got, ids), GENERATED_AT);
  const byId0 = new Map(snap0.runs.map((r) => [r.run_id, r.status]));
  let agreeSnap = 0;
  for (const r of snap1.runs) if (byId0.get(r.run_id) === r.status) agreeSnap++;
  const nSnap = snap0.runs.length;
  const agreement_verdict_phi = agreePhi / original.length;
  const agreement_snapshot = nSnap === 0 ? 1 : agreeSnap / nSnap;
  const statuses = {
    ELIGIBLE_EXPERIENCE: snap0.counts.eligible,
    MISDIAGNOSIS_REJECTED: snap0.counts.misdiagnosis_rejected,
    IN_PROGRESS: snap0.counts.in_progress,
  };
  return {
    agreement_verdict_phi,
    agreement_snapshot,
    score: Math.min(agreement_verdict_phi, agreement_snapshot),
    n: original.length,
    statuses,
  };
}

function rawBytes(chain: TenantChain, rows: readonly SourceRow[]): number {
  const ids = new Set(chain.windows.flatMap((w) => w.points.map((p) => p.experience_id)));
  let n = 0;
  for (const r of rows) if (ids.has(r.experience_id)) n += utf8(r.record_json);
  return n;
}

function compressedBytes(chain: TenantChain): number {
  return chain.segments.reduce((n, s) => n + utf8(canonical(s.segment)), 0);
}

function sealedPoints(chain: TenantChain): StatePoint[] {
  return chain.windows.flatMap((w) => w.points);
}

// ---------- Checks ----------
let passed = 0;
const failures: string[] = [];
function check(name: string, cond: boolean, detail?: string): void {
  if (cond) {
    passed++;
    console.log(`PASS ${name}${detail ? `: ${detail}` : ""}`);
  } else {
    failures.push(name);
    console.error(`FAIL ${name}${detail ? `: ${detail}` : ""}`);
  }
}

function measureMode(label: "lossless" | "bounded", loss: LossOption): ScpMeasurement {
  const opts = chainOpts(loss);
  const chain = buildTenantChain(TENANT, FIXTURE_ROWS, opts);
  const points = sealedPoints(chain);
  const got = reconstructAll(chain);
  const raw = rawBytes(chain, FIXTURE_ROWS);
  const comp = compressedBytes(chain);
  const ratio = comp === 0 ? Number.POSITIVE_INFINITY : raw / comp;
  const err = maxAbsErr(points, got);
  const keep = retained(points, got);
  const chainOk = verifyChain(chain.segments);
  const tenantOk = verifyTenantChain(TENANT, chain.segments, FIXTURE_ROWS, opts);
  const reconOk = chain.segments.every((s, i) => verifyReconstruction(s, chain.windows[i].points).ok);

  const shuffled = buildTenantChain(TENANT, shuffle(FIXTURE_ROWS, SHUFFLE_SEED), opts);
  const again = buildTenantChain(TENANT, FIXTURE_ROWS, opts);
  const determinismOk = chainOk.ok
    && shuffled.head_sha256 === chain.head_sha256
    && again.head_sha256 === chain.head_sha256
    && verifyChain(shuffled.segments).ok;

  const fidelityOk = label === "lossless"
    ? bitExact(points, got) && reconOk
    : reconOk
      && err.x <= BOUNDED_EPS.predicted
      && err.y <= BOUNDED_EPS.observed
      && err.z <= BOUNDED_EPS.phi
      && points.every((p, i) => p.t === got[i].t && Object.is(p.step, got[i].step) && p.verdict === got[i].verdict);

  const frames: ScpFrame[] = points.map(frameFromStateVector);
  const mappingOk = frames.every((f, i) => f.x === points[i].predicted && f.y === points[i].observed && f.z === points[i].phi && f.t === points[i].t);

  check(`${label} sealed one full window of ${N}`, chain.segments.length === 1 && chain.pending === 0 && points.length === N && chain.excluded.count === 0,
    `segments=${chain.segments.length} pending=${chain.pending} included=${points.length} excluded=${chain.excluded.count}`);
  check(`${label} verifyChain`, chainOk.ok, chainOk.ok ? `head=${chain.head_sha256}` : chainOk.errors.join("; "));
  check(`${label} verifyTenantChain`, tenantOk.chain.ok && tenantOk.recompute.ok && tenantOk.sources.ok && tenantOk.reconstruction.ok,
    `reconstruction=${tenantOk.reconstruction.ok}`);
  check(`${label} verifyReconstruction`, reconOk);
  check(`${label} mapping ${MAPPING}`, mappingOk);
  if (label === "lossless") {
    check("lossless fidelity exact", fidelityOk);
  } else {
    check("bounded max_abs_err <= eps", fidelityOk,
      `err x=${err.x} y=${err.y} z=${err.z} eps=${JSON.stringify(BOUNDED_EPS)}`);
  }
  check(`${label} ratio reported`, Number.isFinite(ratio) && ratio > 0,
    `ratio=${ratio} raw_bytes=${raw} compressed_bytes=${comp} bytes_per_point=${comp / points.length}`);
  check(`${label} retained verdict/Φ class`, keep.agreement_verdict_phi === 1,
    `agreement_verdict_phi=${keep.agreement_verdict_phi}`);
  check(`${label} retained Global snapshot status`, keep.agreement_snapshot === 1,
    `agreement_snapshot=${keep.agreement_snapshot} counts=${JSON.stringify(keep.statuses)}`);
  check(`${label} retained score = 1.0`, keep.score === 1, `score=${keep.score} n=${keep.n}`);
  check(`${label} determinism (repeat + shuffle + verifyChain)`, determinismOk,
    `head=${chain.head_sha256}`);

  const measurement: ScpMeasurement = {
    compression_ratio: ratio,
    raw_bytes: raw,
    compressed_bytes: comp,
    fidelity: {
      ok: fidelityOk,
      mode: label,
      max_abs_err: err,
    },
    retained_task_performance: { score: keep.score, n: keep.n, agreement: keep.score },
    determinism: { ok: determinismOk, head_sha256: chain.head_sha256 },
  };
  return measurement;
}

function measureLatency(loss: LossOption): { p50: number; p95: number; samples: number; times: number[] } {
  const opts = chainOpts(loss);
  const times: number[] = [];
  for (let k = 0; k < LATENCY_SAMPLES; k++) {
    const t0 = performance.now();
    const chain = buildTenantChain(TENANT, FIXTURE_ROWS, opts);
    const checks = verifyTenantChain(TENANT, chain.segments, FIXTURE_ROWS, opts);
    const dt = performance.now() - t0;
    if (!(checks.chain.ok && checks.reconstruction.ok)) {
      throw new Error("latency sample failed verify");
    }
    times.push(dt);
  }
  return { p50: percentile(times, 0.50), p95: percentile(times, 0.95), samples: times.length, times };
}

// Snapshot fixture must include all three statuses.
{
  const preview = buildGlobalSnapshot(rowsFromPoints(FIXTURE_ROWS.map((_, i) => fixturePoint(i)), FIXTURE_ROWS.map((r) => r.experience_id)), GENERATED_AT);
  check("fixture includes all three Global snapshot statuses",
    preview.counts.eligible > 0 && preview.counts.misdiagnosis_rejected > 0 && preview.counts.in_progress > 0,
    JSON.stringify(preview.counts));
}

const lossless = measureMode("lossless", LOSSLESS);
const bounded = measureMode("bounded", BOUNDED);

const latLossless = measureLatency(LOSSLESS);
const latBounded = measureLatency(BOUNDED);
lossless.latency_ms = { p50: latLossless.p50, p95: latLossless.p95, samples: latLossless.samples };
bounded.latency_ms = { p50: latBounded.p50, p95: latBounded.p95, samples: latBounded.samples };

check("lossless latency p95 under hang bound", latLossless.p95 < LATENCY_P95_HANG_MS,
  `p50=${latLossless.p50.toFixed(3)}ms p95=${latLossless.p95.toFixed(3)}ms K=${LATENCY_SAMPLES} bound=${LATENCY_P95_HANG_MS}ms`);
check("bounded latency p95 under hang bound", latBounded.p95 < LATENCY_P95_HANG_MS,
  `p50=${latBounded.p50.toFixed(3)}ms p95=${latBounded.p95.toFixed(3)}ms K=${LATENCY_SAMPLES} bound=${LATENCY_P95_HANG_MS}ms`);

console.log(`MEASURE lossless: ${JSON.stringify(lossless)}`);
console.log(`MEASURE bounded: ${JSON.stringify(bounded)}`);

if (failures.length) {
  console.error(`FAIL check-scp-v01 (${failures.length} failed, ${passed} passed): ${failures.join("; ")}`);
  process.exit(1);
}
console.log(`PASS check-scp-v01 (${passed} checks)`);
