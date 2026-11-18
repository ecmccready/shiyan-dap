/** TEST ONLY. Fixtures and decision tasks for the 4D-SCP v0.1.9 subsystem bench.
 *
 * 1. A seeded SYNTHETIC 4D environment (mulberry32, seed 20261118). Not production data, not a real
 *    sensor, patient, provider or tenant feed; it exists only to exercise S(x, y, z, t) with known
 *    structure. Generated in memory; nothing is written to any database.
 *      channels per cell: c0 field, c1 relation, c2 occupancy, c3 sensor
 *      c0 field     = Σ_m a_m(t) · φ_m(x, y, z) + N(0, σ²): three smooth spatial modes with slowly
 *                     drifting amplitudes (random walk) → low intrinsic dimensionality by design
 *      c1 relation  = mean of the in-plane 4-neighbours' c0 (a stable, declared relation), plus sparse
 *                     relation-break events (+/−0.5 for 3–8 frames)
 *      c2 occupancy = count of K objects in the cell; objects occasionally step to a neighbour
 *      c3 sensor    = 0.1 · c0 + N(0, σ²) plus sparse anomaly spikes (+1.0 for 1–3 frames)
 *    events=false switches off breaks, anomalies and object moves (same seed) for the
 *    intrinsic-dimensionality comparison.
 * 2. The existing v0.1 / B256 / B4096 / Medicare 6-row frame fixtures mapped with the accepted v0.1
 *    mapping (x = predicted, y = observed, z = Φ). Medicare is the committed synthetic file, not padded.
 * 3. Deterministic decision tasks used to measure retained "intelligence" (agent decisions).
 */
import type { PackedPoint } from "../src/scp/pack";
import {
  elementIndex, encodeFramesAsSurface, gridEncoder,
  type DecisionTask4D, type GridEnvironment, type GridShape, type Relation4D, type StateSurface4D,
} from "../src/scp/subsystem";
import { BOUNDED_EPS, N, fixturePoint, fixtureEligible, phiClass, type FixturePoint } from "./scp-v01-fixture";
import { B256_N, B4096_N, gauss, medicareRows, mulberry32, noisyPoints } from "./scp-v012-fixtures";

export const ENV_SEED = 20261118;
export const ENV_T0 = Date.UTC(2026, 10, 18);
export const ENV_DT_MS = 100;
export const ENV_LABEL = "TEST-ONLY SYNTHETIC 4D environment (seeded mulberry32 20261118). Not production data; not a real sensor, patient, provider or tenant feed.";
export const ENV_CHANNELS = ["c0_field", "c1_relation", "c2_occupancy", "c3_sensor"] as const;
export const ENV_EPS = [0.01, 0.01, 0.01, 0.01] as const;
export const ENV_NOISE = 0.002;
export const ANOMALY_THRESHOLD = 0.5;
export const BREAK_THRESHOLD = 0.25;
export const FRAME_EPS = [BOUNDED_EPS.predicted, BOUNDED_EPS.observed, BOUNDED_EPS.phi] as const;
export const GAP_THRESHOLD = 0.1;

export interface EnvParams { nx: number; ny: number; nz: number; T: number; seed?: number; events?: boolean }
export interface EnvTruth { anomalies: number; breaks: number; moves: number }

function neighbors(shape: GridShape, x: number, y: number): [number, number][] {
  const out: [number, number][] = [];
  if (x > 0) out.push([x - 1, y]);
  if (x < shape.nx - 1) out.push([x + 1, y]);
  if (y > 0) out.push([x, y - 1]);
  if (y < shape.ny - 1) out.push([x, y + 1]);
  return out;
}

export function envRelations(shape: GridShape): Relation4D[] {
  const rel: Relation4D[] = [];
  for (let z = 0; z < shape.nz; z++) for (let y = 0; y < shape.ny; y++) for (let x = 0; x < shape.nx; x++) {
    const nb = neighbors(shape, x, y);
    if (nb.length === 0) continue;
    rel.push({
      target: elementIndex(shape, x, y, z, 1),
      sources: nb.map(([a, b]) => elementIndex(shape, a, b, z, 0)),
      weights: nb.map(() => 1 / nb.length),
      kind: "neighbor-mean(c0)→c1",
    });
  }
  return rel;
}

export function makeEnvironment(p: EnvParams): { surface: StateSurface4D; truth: EnvTruth } {
  const shape: GridShape = { nx: p.nx, ny: p.ny, nz: p.nz, channels: 4 };
  const events = p.events !== false;
  const rng = mulberry32(p.seed ?? ENV_SEED);
  const cells = p.nx * p.ny * p.nz;
  const modes = [0, 1, 2].map((m) => {
    const out = new Float64Array(cells);
    for (let z = 0; z < p.nz; z++) for (let y = 0; y < p.ny; y++) for (let x = 0; x < p.nx; x++) {
      const i = (z * p.ny + y) * p.nx + x;
      out[i] = m === 0 ? Math.sin(Math.PI * (x + 0.5) / p.nx) * Math.sin(Math.PI * (y + 0.5) / p.ny) * (1 - 0.3 * z)
        : m === 1 ? Math.cos(2 * Math.PI * x / p.nx) * (1 + 0.2 * z)
        : Math.sin(2 * Math.PI * (x + y) / (p.nx + p.ny));
    }
    return out;
  });
  const amp = [1.0, 0.5, 0.3];
  const K = Math.max(2, Math.floor(cells / 32));
  const objects = Array.from({ length: K }, () => Math.floor(rng() * cells));
  const breaks: { cell: number; until: number; off: number }[] = [];
  const anomalies: { cell: number; until: number }[] = [];
  const truth: EnvTruth = { anomalies: 0, breaks: 0, moves: 0 };
  const values: Float64Array[] = [];
  const times: number[] = [];
  const relations = envRelations(shape);
  for (let t = 0; t < p.T; t++) {
    if (t > 0) for (let m = 0; m < 3; m++) amp[m] += 0.01 * gauss(rng);
    if (events) {
      for (let k = 0; k < K; k++) {
        if (rng() < 0.05) {
          const c = objects[k], z = Math.floor(c / (p.nx * p.ny)), y = Math.floor((c % (p.nx * p.ny)) / p.nx), x = c % p.nx;
          const nb = neighbors(shape, x, y);
          if (nb.length) { const [a, b] = nb[Math.floor(rng() * nb.length)]; objects[k] = (z * p.ny + b) * p.nx + a; truth.moves++; }
        }
      }
      if (rng() < 0.03) { breaks.push({ cell: Math.floor(rng() * cells), until: t + 3 + Math.floor(rng() * 6), off: rng() < 0.5 ? -0.5 : 0.5 }); truth.breaks++; }
      if (rng() < 0.08) { anomalies.push({ cell: Math.floor(rng() * cells), until: t + 1 + Math.floor(rng() * 3) }); truth.anomalies++; }
    }
    const f = new Float64Array(cells * 4);
    for (let i = 0; i < cells; i++) {
      f[i * 4] = amp[0] * modes[0][i] + amp[1] * modes[1][i] + amp[2] * modes[2][i] + ENV_NOISE * gauss(rng);
    }
    for (const r of relations) { let s = 0; for (let j = 0; j < r.sources.length; j++) s += r.weights[j] * f[r.sources[j]]; f[r.target] = s; }
    for (const b of breaks) if (t < b.until) f[b.cell * 4 + 1] += b.off;
    for (const o of objects) f[o * 4 + 2] += 1;
    for (let i = 0; i < cells; i++) f[i * 4 + 3] = 0.1 * f[i * 4] + ENV_NOISE * gauss(rng);
    for (const a of anomalies) if (t < a.until) f[a.cell * 4 + 3] += 1.0;
    values.push(f);
    times.push(ENV_T0 + t * ENV_DT_MS);
  }
  const env: GridEnvironment = { shape, channelNames: [...ENV_CHANNELS], times, values, relations, label: ENV_LABEL };
  return { surface: gridEncoder.encode(env), truth };
}

// ---------- Decision tasks (environment) ----------
type Surf = Pick<StateSurface4D, "shape" | "meta">;
const cellsOf = (s: Surf) => s.shape.nx * s.shape.ny * s.shape.nz;

function neighborMean(f: Float64Array, s: Surf, cell: number): number {
  const { nx, ny } = s.shape;
  const z = Math.floor(cell / (nx * ny)), y = Math.floor((cell % (nx * ny)) / nx), x = cell % nx;
  const nb = neighbors({ ...s.shape }, x, y);
  let m = 0;
  for (const [a, b] of nb) m += f[elementIndex(s.shape, a, b, z, 0)];
  return nb.length ? m / nb.length : f[elementIndex(s.shape, x, y, z, 0)];
}

export const ENV_TASKS: DecisionTask4D[] = [
  {
    name: `anomaly(c3>${ANOMALY_THRESHOLD})`,
    decide: (f, _t, s) => Array.from({ length: cellsOf(s) }, (_, i) => (f[i * 4 + 3] > ANOMALY_THRESHOLD ? 1 : 0)),
    margins: (f, _t, s) => Array.from({ length: cellsOf(s) }, (_, i) => Math.abs(f[i * 4 + 3] - ANOMALY_THRESHOLD)),
    marginNeeded: ENV_EPS[3],
  },
  {
    name: `relation-break(|c1-mean4(c0)|>${BREAK_THRESHOLD})`,
    decide: (f, _t, s) => Array.from({ length: cellsOf(s) }, (_, i) => (Math.abs(f[i * 4 + 1] - neighborMean(f, s, i)) > BREAK_THRESHOLD ? 1 : 0)),
    margins: (f, _t, s) => Array.from({ length: cellsOf(s) }, (_, i) => Math.abs(Math.abs(f[i * 4 + 1] - neighborMean(f, s, i)) - BREAK_THRESHOLD)),
    marginNeeded: ENV_EPS[1] + ENV_EPS[0],
  },
  {
    name: "occupied(c2>0.5)",
    decide: (f, _t, s) => Array.from({ length: cellsOf(s) }, (_, i) => (f[i * 4 + 2] > 0.5 ? 1 : 0)),
    margins: (f, _t, s) => Array.from({ length: cellsOf(s) }, (_, i) => Math.abs(f[i * 4 + 2] - 0.5)),
    marginNeeded: ENV_EPS[2],
  },
  {
    name: "hotspot(argmax c0)",
    decide: (f, _t, s) => { let best = 0; for (let i = 1; i < cellsOf(s); i++) if (f[i * 4] > f[best * 4]) best = i; return [best]; },
    margins: (f, _t, s) => {
      let a = -Infinity, b = -Infinity;
      for (let i = 0; i < cellsOf(s); i++) { const v = f[i * 4]; if (v > a) { b = a; a = v; } else if (v > b) b = v; }
      return [a - b];
    },
    marginNeeded: 2 * ENV_EPS[0],
  },
];

// ---------- Frame fixtures (accepted v0.1 mapping) ----------
export function toPackedPoints(points: readonly FixturePoint[]): PackedPoint[] {
  return points.map((p) => ({ x: p.predicted, y: p.observed, z: p.phi, t: p.t, step: p.step, verdict: p.verdict }));
}

export function frameFixtures(): { name: string; points: PackedPoint[]; surface: StateSurface4D; surfaceRel: StateSurface4D }[] {
  const med = medicareRows();
  const sets: [string, PackedPoint[], string][] = [
    ["v0.1", toPackedPoints(Array.from({ length: N }, (_, i) => fixturePoint(i))), "TEST-ONLY hand-written v0.1 fixture"],
    ["A-medicare", toPackedPoints(med.points), "TEST-ONLY SYNTHETIC 6-row Medicare-shaped file (not CMS data; not padded)"],
    ["B256", toPackedPoints(noisyPoints(B256_N)), "TEST-ONLY seeded noisy fixture N=256"],
    ["B4096", toPackedPoints(noisyPoints(B4096_N)), "TEST-ONLY seeded noisy fixture N=4096"],
  ];
  return sets.map(([name, points, label]) => ({
    name, points,
    surface: encodeFramesAsSurface(points, label),
    surfaceRel: encodeFramesAsSurface(points, label, { relateObservedToPredicted: true }),
  }));
}

export const FRAME_TASKS: DecisionTask4D[] = [
  {
    name: "phi-class(sign z)",
    decide: (f) => [phiClass(f[2])],
    margins: (f) => [Math.abs(f[2])],
    marginNeeded: FRAME_EPS[2],
  },
  {
    name: "eligible(PASS and phi>0)",
    decide: (f, t, s) => [fixtureEligible(s.meta!.verdicts[t], f[2]) ? 1 : 0],
    margins: (f, t, s) => [s.meta!.verdicts[t] === "PASS" ? Math.abs(f[2]) : Infinity],
    marginNeeded: FRAME_EPS[2],
  },
  {
    name: `large-gap(|x-y|>${GAP_THRESHOLD})`,
    decide: (f) => [Math.abs(f[0] - f[1]) > GAP_THRESHOLD ? 1 : 0],
    margins: (f) => [Math.abs(Math.abs(f[0] - f[1]) - GAP_THRESHOLD)],
    marginNeeded: FRAME_EPS[0] + FRAME_EPS[1],
  },
];
