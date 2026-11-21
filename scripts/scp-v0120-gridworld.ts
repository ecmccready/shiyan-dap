/** TEST ONLY. Seeded gridworld for v0.1.20, built on the v0.1.9 environment helpers.
 * Synthetic. Not a sensor, patient, provider or tenant feed. No Math.random: mulberry32 only.
 *
 * Channels match the v0.1.9 environment: c0 field, c1 neighbour-mean relation, c2 occupancy
 * used here as manhattan distance to cell 0 (not churned), c3 sensor in {0, 1}.
 * Each step after the first perturbs exactly max(1, round(churn × cells)) cells in c0 and c3,
 * then recomputes c1. The measured dirty fraction includes those relation updates.
 */
import { gridEncoder, type GridEnvironment, type StateSurface4D } from "../src/scp/subsystem";
import { mulberry32 } from "./scp-v012-fixtures";
import { ENV_CHANNELS, ENV_DT_MS, ENV_LABEL, ENV_T0, envRelations } from "./scp-v019-env-fixture";

export interface GridworldParams {
  nx: number;
  ny: number;
  nz: number;
  T: number;
  seed: number;
  episode: number;
  /** Fraction of cells perturbed per step. */
  churn: number;
}

export function churnCellCount(fraction: number, nCells: number): number {
  return Math.max(1, Math.round(fraction * nCells));
}

export function makeGridworld(p: GridworldParams): { surface: StateSurface4D; perturbed_per_step: number } {
  const shape = { nx: p.nx, ny: p.ny, nz: p.nz, channels: 4 };
  const n = p.nx * p.ny * p.nz;
  const k = churnCellCount(p.churn, n);
  const rng = mulberry32((Math.imul(p.seed, 1000003) + Math.imul(p.episode, 10007) + Math.round(p.churn * 10000)) >>> 0);
  const relations = envRelations(shape);
  const c0 = new Float64Array(n);
  const c2 = new Float64Array(n);
  const c3 = new Float64Array(n);
  for (let z = 0; z < p.nz; z++) for (let y = 0; y < p.ny; y++) for (let x = 0; x < p.nx; x++) {
    const i = (z * p.ny + y) * p.nx + x;
    c0[i] = Math.sin(Math.PI * (x + 0.5) / p.nx) * Math.sin(Math.PI * (y + 0.5) / p.ny);
    c2[i] = Math.abs(x) + Math.abs(y) + Math.abs(z);
    c3[i] = (x + y) % 5 === 0 ? 1 : 0;
  }
  const pick = (): number[] => {
    const idx = Array.from({ length: n }, (_, i) => i);
    for (let i = 0; i < k; i++) {
      const j = i + Math.floor(rng() * (n - i));
      const tmp = idx[i]; idx[i] = idx[j]; idx[j] = tmp;
    }
    return idx.slice(0, k);
  };
  const writeFrame = (): Float64Array => {
    const f = new Float64Array(n * 4);
    for (let i = 0; i < n; i++) {
      f[i * 4] = c0[i];
      f[i * 4 + 2] = c2[i];
      f[i * 4 + 3] = c3[i];
    }
    for (const r of relations) {
      let s = 0;
      for (let j = 0; j < r.sources.length; j++) s += r.weights[j] * f[r.sources[j]];
      f[r.target] = s;
    }
    return f;
  };
  const values: Float64Array[] = [];
  const times: number[] = [];
  for (let t = 0; t < p.T; t++) {
    if (t > 0) {
      for (const cell of pick()) {
        c0[cell] += rng() < 0.5 ? -1 : 1;
        c3[cell] = c3[cell] === 0 ? 1 : 0;
      }
    }
    values.push(writeFrame());
    times.push(ENV_T0 + t * ENV_DT_MS);
  }
  const env: GridEnvironment = {
    shape,
    channelNames: [...ENV_CHANNELS],
    times,
    values,
    relations,
    label: `${ENV_LABEL} v0.1.20 gridworld seed=${p.seed} episode=${p.episode} churn=${p.churn}.`,
  };
  return { surface: gridEncoder.encode(env), perturbed_per_step: k };
}
