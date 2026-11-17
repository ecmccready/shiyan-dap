/** TEST ONLY. Shared v0.1 fixture and measurement helpers for 4D-SCP checks.
 * Hand-written committed fixtures; no network, no production data, no writes.
 * Used by scripts/check-scp-v01.ts, scripts/check-scp-v011.ts, and scripts/check-scp-v012.ts.
 */
import { createHash } from "node:crypto";
import {
  type LossOption,
  type SourceRow,
  type StatePoint,
  type StateVector,
  type StateVerdict,
  type TenantChain,
  type AxisEps,
} from "../src/core/compression";
import { buildGlobalSnapshot, type GlobalRow, type GlobalStatus } from "../src/lib/diagnostics/global-snapshot";

export const TENANT = "scp-v01-fixture";
export const T0 = Date.UTC(2026, 5, 1);
export const N = 256;
export const LATENCY_SAMPLES = 21;
/** Generous hang bound only. Absolute p50/p95 are reported, not used as an SLA. */
export const LATENCY_P95_HANG_MS = 30_000;
export const BOUNDED_EPS: AxisEps = { predicted: 0.001, observed: 0.001, phi: 0.0001 };
export const MAPPING = "x=predicted,y=observed,z=phi,t=t";
export const GENERATED_AT = "2026-11-17T00:00:00.000Z";
export const SHUFFLE_SEED = 20261117;
export const LOSSLESS: LossOption = { mode: "lossless" };
export const BOUNDED: LossOption = { mode: "bounded", eps: BOUNDED_EPS };
export const CHAIN_OPTS = { asOfMs: T0 + 86_400_000, segmentSize: N, cutoffMs: Infinity, graceMs: 0 };

/** v0.1 engine chain heads (regression: stored format must not change). */
export const V01_HEADS = {
  lossless: "36b67ee814ccf664c5fac0c80488e793ae59808f2712b6035d5a3e6883a1f6f5",
  bounded: "f286cf831a4bdcbc60a454335405ddd967671173fba75368b0d9d54f595d46bb",
} as const;

export function sha(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

export function shaBytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function fid(i: number): string {
  return `scp${i.toString(16).padStart(8, "0")}`;
}

/** Variety of verdicts and Φ signs, with |phi| kept well above eps.phi so signs cannot flip. */
export function fixturePoint(i: number): { predicted: number; observed: number; phi: number; step: number; t: number; verdict: StateVerdict } {
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

export type FixturePoint = { predicted: number; observed: number; phi: number; step: number; t: number; verdict: StateVerdict };

/** Build a SourceRow with the same experience-record shape the v0.1 fixture uses. */
export function makeSourceRow(tenant: string, id: string, f: FixturePoint): SourceRow {
  const record = {
    experience_id: id, tenant_id: tenant, repo: "workbench:fixture-bench", commit_sha: "1.0.0",
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
    tenant_id: tenant,
    experience_id: id,
    record_json,
    content_sha256: sha(record_json),
    proof_timestamp: new Date(f.t).toISOString(),
  };
}

export function makeRow(i: number): SourceRow {
  return makeSourceRow(TENANT, fid(i), fixturePoint(i));
}

export const FIXTURE_ROWS: SourceRow[] = Array.from({ length: N }, (_, i) => makeRow(i));

export function phiClass(phi: number): -1 | 0 | 1 {
  return phi > 0 ? 1 : phi < 0 ? -1 : 0;
}

/** Fixture rule for Global snapshot status (decision 3). Documented in the spec §7.4 / §10. */
export function fixtureEligible(verdict: StateVerdict, phi: number): boolean {
  return verdict === "PASS" && phi > 0;
}
export function fixtureState(verdict: StateVerdict): string {
  return verdict === "INCONCLUSIVE" ? "CONTINUE" : "COMPLETE";
}

export function rowsFromPoints(
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

export function shuffle<T>(arr: readonly T[], seed: number): T[] {
  const a = arr.slice();
  const rnd = lcg(seed);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

export function percentile(samples: number[], p: number): number {
  const sorted = samples.slice().sort((a, b) => a - b);
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[i];
}

export function utf8(s: string): number {
  return Buffer.byteLength(s, "utf8");
}

export function chainOpts(loss: LossOption) {
  return { ...CHAIN_OPTS, loss };
}

export function reconstructAll(chain: TenantChain, reconstruct: (segment: TenantChain["segments"][number]["segment"]) => StateVector[]): StateVector[] {
  const out: StateVector[] = [];
  for (const s of chain.segments) out.push(...reconstruct(s.segment));
  return out;
}

export function maxAbsErr(original: readonly StatePoint[], got: readonly StateVector[]): { x: number; y: number; z: number } {
  const err = { x: 0, y: 0, z: 0 };
  for (let i = 0; i < original.length; i++) {
    err.x = Math.max(err.x, Math.abs(got[i].predicted - original[i].predicted));
    err.y = Math.max(err.y, Math.abs(got[i].observed - original[i].observed));
    err.z = Math.max(err.z, Math.abs(got[i].phi - original[i].phi));
  }
  return err;
}

export function bitExact(original: readonly StatePoint[], got: readonly StateVector[]): boolean {
  if (original.length !== got.length) return false;
  return original.every((p, i) =>
    Object.is(p.predicted, got[i].predicted)
    && Object.is(p.observed, got[i].observed)
    && Object.is(p.phi, got[i].phi)
    && p.t === got[i].t
    && Object.is(p.step, got[i].step)
    && p.verdict === got[i].verdict);
}

export function retained(original: readonly StatePoint[], got: readonly StateVector[]): {
  agreement_verdict_phi: number;
  agreement_snapshot: number;
  score: number;
  n: number;
  statuses: Record<GlobalStatus, number>;
} {
  if (original.length !== got.length) {
    return { agreement_verdict_phi: 0, agreement_snapshot: 0, score: 0, n: original.length, statuses: { ELIGIBLE_EXPERIENCE: 0, MISDIAGNOSIS_REJECTED: 0, IN_PROGRESS: 0 } };
  }
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

export function rawBytes(chain: TenantChain, rows: readonly SourceRow[]): number {
  const ids = new Set(chain.windows.flatMap((w) => w.points.map((p) => p.experience_id)));
  let n = 0;
  for (const r of rows) if (ids.has(r.experience_id)) n += utf8(r.record_json);
  return n;
}

export function rawJsonBytes(rows: readonly SourceRow[]): number {
  return rows.reduce((n, r) => n + utf8(r.record_json), 0);
}

export function compressedBytes(chain: TenantChain, canonical: (segment: unknown) => string): number {
  return chain.segments.reduce((n, s) => n + utf8(canonical(s.segment)), 0);
}

export function sealedPoints(chain: TenantChain): StatePoint[] {
  return chain.windows.flatMap((w) => w.points);
}

export function retainedFromPacked(
  original: readonly StatePoint[],
  got: readonly { x: number; y: number; z: number; t: number; step: number; verdict: StateVerdict }[],
): ReturnType<typeof retained> {
  const asVectors: StateVector[] = got.map((p) => ({
    predicted: p.x, observed: p.y, phi: p.z, t: p.t, step: p.step, verdict: p.verdict,
  }));
  return retained(original, asVectors);
}
