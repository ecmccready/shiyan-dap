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
 * The v0.1 ratio vs record_json is kept for regression. Defensible baselines (binary, gzip)
 * and the compact quantized encoding live in scripts/check-scp-v011.ts.
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
import {
  buildTenantChain,
  reconstruct,
  verifyChain,
  verifyReconstruction,
  verifyTenantChain,
  type LossOption,
} from "../src/core/compression";
import { canonical } from "../src/core/reconcile";
import { buildGlobalSnapshot } from "../src/lib/diagnostics/global-snapshot";
import { frameFromStateVector, type ScpFrame, type ScpMeasurement } from "../src/scp";
import {
  BOUNDED, BOUNDED_EPS, FIXTURE_ROWS, GENERATED_AT, LATENCY_P95_HANG_MS, LATENCY_SAMPLES,
  LOSSLESS, MAPPING, N, SHUFFLE_SEED, TENANT, bitExact, chainOpts, compressedBytes,
  fixturePoint, maxAbsErr, percentile, rawBytes, retained, rowsFromPoints, sealedPoints,
  shuffle, reconstructAll as reconstructAllFrom,
} from "./scp-v01-fixture";

function reconstructAll(chain: Parameters<typeof reconstructAllFrom>[0]) {
  return reconstructAllFrom(chain, reconstruct);
}

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
  const comp = compressedBytes(chain, canonical);
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
