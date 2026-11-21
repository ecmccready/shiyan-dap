/** TEST ONLY. v0.1.20 proof path: engine → adapter → subsystem → agent.
 * Deterministic given the pre-registration. Wall-clock samples are optional and are not returned.
 * No production data, no PHI, no live API.
 */
import { buildTenantChain, reconstruct, verifyTenantChain } from "../src/core/compression";
import { canonical } from "../src/core/reconcile";
import { segmentMeta, surfaceFromEngineVectors } from "../src/scp/adapter/engine-adapter";
import { commitScpMeasurement, type ScpMeasurementV0120 } from "../src/scp/measurement";
import {
  benchStrategy, computeOps, runAgent, thresholdTask,
  type AgentMode, type DecisionTask4D, type OpCounts4D, type Scp4dConfig, type StateSurface4D, type StrategyId,
} from "../src/scp/subsystem";
import { BOUNDED, BOUNDED_EPS, FIXTURE_ROWS, LOSSLESS, TENANT, chainOpts, compressedBytes, rawBytes, reconstructAll } from "./scp-v01-fixture";
import { FRAME_EPS, FRAME_TASKS, frameFixtures } from "./scp-v019-env-fixture";
import { makeGridworld } from "./scp-v0120-gridworld";
import { judge, type BoundedFact, type E2Fact, type E3Fact, type HypothesisVerdict, type LevelTest } from "./scp-v0120-verdicts";

export interface V0120Prereg {
  seeds: number[];
  grid: { nx: number; ny: number; nz: number; T: number; episodes: number; eps: number[] };
  churn_levels: { id: string; fraction: number }[];
  h3_h4_churns: string[];
  arms: {
    e2: { id: string; strategy: StrategyId; agent: AgentMode; scp4d?: Scp4dConfig }[];
    h3_arm: string;
    h2_gate_arms: string[];
  };
  hypotheses: {
    H2: { retention_min: number };
    H3: { ratio_min: number; seeds_holding_min: number };
  };
}

export interface ProofReport {
  hypotheses: HypothesisVerdict[];
  h3_levels: LevelTest[];
  h5_flip: string | null;
  e1: unknown[];
  e2: E2Fact[];
  e3: E3Fact[];
  e4: unknown[];
  e5: unknown[];
  bounded: BoundedFact[];
  measurements: ScpMeasurementV0120[];
  agent_gap_max: number;
}

function bytesOf(enc: OpCounts4D, dec: OpCounts4D, agent: OpCounts4D): { moved: number; stream: number; state: number } {
  const state = enc.state_bytes_touched + dec.state_bytes_touched + agent.state_bytes_touched;
  const moved = enc.bytes_in + enc.bytes_out + dec.bytes_in + dec.bytes_out + agent.bytes_in + agent.bytes_out + state;
  return { moved, stream: enc.bytes_out, state };
}

function opsOf(enc: OpCounts4D, dec: OpCounts4D, agent: OpCounts4D): number {
  return computeOps(enc) + computeOps(dec) + computeOps(agent);
}

interface Timed { samplesMs: number[] }

function time<T>(timing: Timed | undefined, fn: () => T): T {
  if (!timing) return fn();
  const t0 = process.hrtime.bigint();
  const v = fn();
  timing.samplesMs.push(Number(process.hrtime.bigint() - t0) / 1e6);
  return v;
}

export function runProof(prereg: V0120Prereg, timing?: Timed): ProofReport {
  const eps = prereg.grid.eps;
  const gridTask = [thresholdTask(eps[3])];
  const bounded: BoundedFact[] = [];
  const e2: E2Fact[] = [];
  const e3: E3Fact[] = [];
  const e4: Record<string, unknown>[] = [];
  const e5: Record<string, unknown>[] = [];
  const e1: Record<string, unknown>[] = [];
  const measurements: ScpMeasurementV0120[] = [];
  let gapMax = 0;
  const surfaces = new Map<string, StateSurface4D>();
  const gw = (seed: number, episode: number, fraction: number): StateSurface4D => {
    const key = `${seed}|${episode}|${fraction}`;
    const hit = surfaces.get(key);
    if (hit) return hit;
    const made = makeGridworld({
      nx: prereg.grid.nx, ny: prereg.grid.ny, nz: prereg.grid.nz, T: prereg.grid.T,
      seed, episode, churn: fraction,
    });
    surfaces.set(key, made.surface);
    return made.surface;
  };

  const runGrid = (
    where: string, surface: StateSurface4D, armId: string, strategy: StrategyId, mode: AgentMode,
    cfg: Scp4dConfig | undefined, withAgent: boolean, tasks: readonly DecisionTask4D[], useEps: readonly number[],
  ) => {
    const options = { eps: useEps, scp4d: cfg };
    const f64 = stateBytes(surface, "full_f64", useEps);
    const fq = stateBytes(surface, "full_q", useEps);
    const bench = time(timing, () => benchStrategy(surface, strategy, options, tasks, { full_f64: f64, full_q: fq }));
    const safe = bench.row.decisions.reduce((s, d) => s + d.safe_disagree, 0);
    const agreement = bench.row.decisions.length ? Math.min(...bench.row.decisions.map((d) => d.agreement)) : 1;
    bounded.push({ where, arm: armId, bounded_claim: bench.row.bounded_claim, bound_ok: bench.row.fidelity.bound_ok, safe_disagree: safe });
    let agentOps = emptyAgent();
    let gap = 0;
    let cells = 0;
    let dirty = bench.row.dirty_fraction;
    let navFull = true;
    let navRecon = true;
    let stepsFull: number | null = null;
    let stepsRecon: number | null = null;
    let retention = agreement;
    if (withAgent) {
      const useRel = cfg?.relations === true;
      const full = runAgent(surface.frames, surface.shape, surface.relations, mode, useRel);
      const recon = runAgent(bench.reconstructed.frames, surface.shape, surface.relations, mode, useRel);
      if (full.meter.gap_compute !== 0 || recon.meter.gap_compute !== 0) {
        throw new Error(`agent meter gap ${full.meter.gap_compute}/${recon.meter.gap_compute} at ${where}/${armId}`);
      }
      gap = full.meter.gap_compute;
      gapMax = Math.max(gapMax, Math.abs(gap), Math.abs(recon.meter.gap_compute));
      agentOps = recon.meter.instrumented;
      cells = recon.cells_evaluated;
      dirty = recon.dirty_fraction;
      navFull = full.reached_goal;
      navRecon = recon.reached_goal;
      stepsFull = full.steps_to_goal;
      stepsRecon = recon.steps_to_goal;
      const nav = !navFull ? (navRecon ? 0 : 1) : (navRecon ? 1 : 0);
      retention = Math.min(nav, agreement);
    }
    const T = surface.frames.length;
    const trans = Math.max(1, T - 1);
    const b = bytesOf(bench.compressed.encode_ops, bench.reconstructed.decode_ops, agentOps);
    const ops = opsOf(bench.compressed.encode_ops, bench.reconstructed.decode_ops, agentOps);
    return {
      ops_per_transition: ops / trans,
      bytes_per_transition: b.moved / trans,
      stream_bytes: b.stream,
      state_bytes: b.state,
      bound_ok: bench.row.fidelity.bound_ok,
      bounded_claim: bench.row.bounded_claim,
      safe_disagree: safe,
      agreement,
      dirty_fraction: dirty,
      agent_gap: gap,
      cells_evaluated: cells,
      retention,
      nav_full: navFull,
      nav_recon: navRecon,
      steps_full: stepsFull,
      steps_recon: stepsRecon,
      events: bench.row.events,
      bytes: bench.row.bytes,
      ratio_vs_full_q: bench.row.ratio_vs_full_q,
      max_abs_err: bench.row.fidelity.max_abs_err,
    };
  };

  const byteCache = new Map<string, number>();
  function stateBytes(surface: StateSurface4D, strategy: "full_f64" | "full_q", useEps: readonly number[]): number {
    const key = `${surface.label}|${strategy}|${useEps.join(",")}`;
    const hit = byteCache.get(key);
    if (hit !== undefined) return hit;
    const n = benchStrategy(surface, strategy, { eps: useEps }, [], { full_f64: 1, full_q: 1 }).compressed.bytes.length;
    byteCache.set(key, n);
    return n;
  }

  // ----- E1 -----
  for (const loss of ["lossless", "bounded"] as const) {
    const opts = chainOpts(loss === "lossless" ? LOSSLESS : BOUNDED);
    const chain = buildTenantChain(TENANT, FIXTURE_ROWS, opts);
    const again = buildTenantChain(TENANT, FIXTURE_ROWS, opts);
    const checks = verifyTenantChain(TENANT, chain.segments, FIXTURE_ROWS, opts);
    const verifyOk = checks.chain.ok && checks.recompute.ok && checks.sources.ok && checks.reconstruction.ok;
    const vectors = reconstructAll(chain, reconstruct);
    const meta = segmentMeta(chain.segments);
    const surface = surfaceFromEngineVectors({
      vectors, head_sha256: chain.head_sha256, verify_ok: verifyOk, loss,
      label: `TEST-ONLY engine ${loss} fixture tenant ${TENANT}`,
    });
    const raw = rawBytes(chain, FIXTURE_ROWS);
    const comp = compressedBytes(chain, canonical);
    const strategies: StrategyId[] = ["full_f64", "full_q", "delta", "tensor_bound", "tensor_energy", "scp4d"];
    const rows = strategies.map((strategy) => {
      const m = runGrid(`E1/${loss}`, surface, strategy, strategy, "full_scan", undefined, false, FRAME_TASKS, FRAME_EPS);
      return {
        strategy, bound_ok: m.bound_ok, bounded_claim: m.bounded_claim, safe_disagree: m.safe_disagree,
        bytes: m.bytes, ratio_vs_full_q: m.ratio_vs_full_q, max_abs_err: m.max_abs_err, events: m.events,
      };
    });
    e1.push({
      loss, verify_ok: verifyOk, head_sha256: chain.head_sha256,
      head_repeat: again.head_sha256, deterministic: again.head_sha256 === chain.head_sha256,
      segments: meta, raw_bytes: raw, compressed_bytes: comp,
      compression_ratio: comp === 0 ? null : raw / comp, rows,
    });
    const fq = rows.find((r) => r.strategy === "full_q");
    measurements.push(commitScpMeasurement({
      e0: 0,
      e: fq && fq.bound_ok ? 0 : 1,
      delta_e: fq && fq.bound_ok ? 0 : -1,
      compression_ratio: comp === 0 ? undefined : raw / comp,
      raw_bytes: raw,
      compressed_bytes: comp,
      fidelity: { ok: Boolean(fq?.bound_ok), mode: loss, epsilon: loss === "bounded" ? BOUNDED_EPS.phi : undefined },
      retained_task_performance: { score: fq?.safe_disagree === 0 ? 1 : 0, n: vectors.length },
      determinism: { ok: again.head_sha256 === chain.head_sha256 && verifyOk, head_sha256: chain.head_sha256 },
      metric: comp === 0 ? 0 : raw / comp,
      bound: 0,
      pass: verifyOk && again.head_sha256 === chain.head_sha256 && rows.filter((r) => r.bounded_claim).every((r) => r.bound_ok),
    }));
  }

  // ----- E2 and the E3 medium episode-0 overlap -----
  for (const seed of prereg.seeds) {
    for (const level of prereg.churn_levels) {
      const surface = gw(seed, 0, level.fraction);
      for (const arm of prereg.arms.e2) {
        const m = runGrid(`E2/${level.id}`, surface, arm.id, arm.strategy, arm.agent, arm.scp4d, true, gridTask, eps);
        e2.push({
          seed, churn: level.id, arm: arm.id,
          ops_per_transition: m.ops_per_transition,
          bytes_per_transition: m.bytes_per_transition,
          stream_bytes: m.stream_bytes,
          state_bytes: m.state_bytes,
        });
        if (level.id === "medium") {
          e3.push({
            seed, episode: 0, arm: arm.id, retention: m.retention, safe_disagree: m.safe_disagree,
          });
        }
      }
    }
    for (let episode = 1; episode < prereg.grid.episodes; episode++) {
      const level = prereg.churn_levels.find((c) => c.id === "medium");
      if (!level) throw new RangeError("medium churn missing");
      const surface = gw(seed, episode, level.fraction);
      for (const arm of prereg.arms.e2) {
        const m = runGrid(`E3/${level.id}`, surface, arm.id, arm.strategy, arm.agent, arm.scp4d, true, gridTask, eps);
        e3.push({ seed, episode, arm: arm.id, retention: m.retention, safe_disagree: m.safe_disagree });
      }
    }
  }

  // ----- E4 -----
  const preds = ["zero", "last", "linear"] as const;
  const ranks = [0, 1, 2];
  for (const seed of prereg.seeds) {
    const level = prereg.churn_levels.find((c) => c.id === "medium");
    if (!level) throw new RangeError("medium churn missing");
    const surface = gw(seed, 0, level.fraction);
    for (const relations of [false, true]) for (const rank of ranks) for (const predictor of preds) {
      const id = `rel${relations ? 1 : 0}-r${rank}-${predictor}`;
      const m = runGrid("E4/medium", surface, id, "scp4d", "event_driven", { rank, relations, predictor }, true, gridTask, eps);
      e4.push({
        seed, id, relations, rank, predictor,
        ops_per_transition: m.ops_per_transition,
        stream_bytes: m.stream_bytes,
        state_bytes: m.state_bytes,
        bytes: m.bytes,
        events: m.events,
        bound_ok: m.bound_ok,
        dirty_fraction: m.dirty_fraction,
        safe_disagree: m.safe_disagree,
      });
    }
  }

  // ----- E5 single-cell control -----
  for (const fx of frameFixtures()) {
    const strategies: StrategyId[] = ["full_f64", "full_q", "delta", "tensor_bound", "tensor_energy", "scp4d"];
    const f64 = benchStrategy(fx.surface, "full_f64", { eps: [...FRAME_EPS] }, [], { full_f64: 1, full_q: 1 }).compressed.bytes.length;
    const fq = benchStrategy(fx.surface, "full_q", { eps: [...FRAME_EPS] }, [], { full_f64: 1, full_q: 1 }).compressed.bytes.length;
    for (const strategy of strategies) {
      const bench = time(timing, () => benchStrategy(fx.surface, strategy, { eps: [...FRAME_EPS] }, FRAME_TASKS, { full_f64: f64, full_q: fq }));
      const safe = bench.row.decisions.reduce((s, d) => s + d.safe_disagree, 0);
      bounded.push({
        where: `E5/${fx.name}`, arm: strategy, bounded_claim: bench.row.bounded_claim,
        bound_ok: bench.row.fidelity.bound_ok, safe_disagree: safe,
      });
      const trans = Math.max(1, fx.surface.frames.length - 1);
      const b = bytesOf(bench.compressed.encode_ops, bench.reconstructed.decode_ops, emptyAgent());
      e5.push({
        fixture: fx.name, strategy, bytes: bench.row.bytes, ratio_vs_full_q: bench.row.ratio_vs_full_q,
        bound_ok: bench.row.fidelity.bound_ok, bounded_claim: bench.row.bounded_claim, safe_disagree: safe,
        events: bench.row.events, dirty_fraction: bench.row.dirty_fraction,
        ops_per_transition: opsOf(bench.compressed.encode_ops, bench.reconstructed.decode_ops, emptyAgent()) / trans,
        stream_bytes: b.stream, state_bytes: b.state,
      });
    }
  }

  const judged = judge({
    churn_order: prereg.churn_levels.map((c) => c.id),
    h3_h4_churns: prereg.h3_h4_churns,
    h3_arm: prereg.arms.h3_arm,
    h2_arms: prereg.arms.h2_gate_arms,
    ratio_min: prereg.hypotheses.H3.ratio_min,
    seeds_holding_min: prereg.hypotheses.H3.seeds_holding_min,
    retention_min: prereg.hypotheses.H2.retention_min,
    bounded, e2, e3,
  });

  for (const h of judged.hypotheses) {
    const metric = h.id === "H3"
      ? Math.min(...judged.h3_levels.filter((l) => prereg.h3_h4_churns.includes(l.churn)).map((l) => l.ratio_median))
      : h.id === "H5" ? (judged.h5_flip === null ? 0 : prereg.churn_levels.findIndex((c) => c.id === judged.h5_flip) / prereg.churn_levels.length)
      : h.verdict === "PASS" ? 1 : 0;
    const bound = h.id === "H3" ? prereg.hypotheses.H3.ratio_min : h.id === "H2" ? prereg.hypotheses.H2.retention_min : 1;
    measurements.push(commitScpMeasurement({
      metric, bound, pass: h.verdict === "PASS",
      retained_task_performance: h.id === "H2" ? { score: metric, n: e3.length } : undefined,
      fidelity: h.id === "H1" ? { ok: h.verdict === "PASS", mode: "bounded" } : undefined,
    }));
  }

  return {
    hypotheses: judged.hypotheses,
    h3_levels: judged.h3_levels,
    h5_flip: judged.h5_flip,
    e1, e2, e3, e4, e5, bounded, measurements,
    agent_gap_max: gapMax,
  };
}

function emptyAgent(): OpCounts4D {
  return {
    fp_add: 0, fp_mul: 0, fp_div: 0, round: 0, int_ops: 0, compare: 0, sqrt: 0,
    bytes_out: 0, bytes_in: 0, state_bytes_touched: 0,
  };
}
