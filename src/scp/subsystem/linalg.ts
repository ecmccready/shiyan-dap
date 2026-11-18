/**
 * Plain-TS linear algebra for the tensor (low-rank) stage: cyclic Jacobi eigen-decomposition of a
 * symmetric Gram matrix and a truncated SVD of a T×D matrix via that Gram. Pure, deterministic
 * (only + − × ÷ and Math.sqrt, which IEEE-754 rounds exactly).
 */

export interface EigenResult {
  /** Descending eigenvalues (clamped at 0). */
  values: Float64Array;
  /** vectors[i * n + j] = component i of eigenvector j. */
  vectors: Float64Array;
  sweeps: number;
  rotations: number;
}

export function symmetricEigen(input: Float64Array, n: number, maxSweeps = 80): EigenResult {
  const a = Float64Array.from(input);
  const v = new Float64Array(n * n);
  for (let i = 0; i < n; i++) v[i * n + i] = 1;
  let sweeps = 0, rotations = 0;
  let norm = 0;
  for (let i = 0; i < n * n; i++) norm += a[i] * a[i];
  const tol = norm * 1e-30;
  for (; sweeps < maxSweeps; sweeps++) {
    let off = 0;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += a[p * n + q] * a[p * n + q];
    if (off <= tol) break;
    for (let p = 0; p < n - 1; p++) {
      for (let q = p + 1; q < n; q++) {
        const apq = a[p * n + q];
        if (apq === 0) continue;
        const app = a[p * n + p], aqq = a[q * n + q];
        const theta = (aqq - app) / (2 * apq);
        const t = (theta >= 0 ? 1 : -1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1), s = t * c;
        rotations++;
        for (let k = 0; k < n; k++) {
          const akp = a[k * n + p], akq = a[k * n + q];
          a[k * n + p] = c * akp - s * akq;
          a[k * n + q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = a[p * n + k], aqk = a[q * n + k];
          a[p * n + k] = c * apk - s * aqk;
          a[q * n + k] = s * apk + c * aqk;
        }
        for (let k = 0; k < n; k++) {
          const vkp = v[k * n + p], vkq = v[k * n + q];
          v[k * n + p] = c * vkp - s * vkq;
          v[k * n + q] = s * vkp + c * vkq;
        }
      }
    }
  }
  const order = Array.from({ length: n }, (_, i) => i).sort((i, j) => a[j * n + j] - a[i * n + i] || i - j);
  const values = new Float64Array(n), vectors = new Float64Array(n * n);
  order.forEach((src, dst) => {
    values[dst] = Math.max(0, a[src * n + src]);
    for (let i = 0; i < n; i++) vectors[i * n + dst] = v[i * n + src];
  });
  return { values, vectors, sweeps, rotations };
}

export interface LowRankFactors {
  T: number;
  D: number;
  /** Column means (length D). */
  mean: Float64Array;
  /** Available rank (number of factor columns computed). */
  rank: number;
  /** A[t * rank + j] (T × rank) and B[e * rank + j] (D × rank); X ≈ mean + A·Bᵀ. */
  A: Float64Array;
  B: Float64Array;
  /** Descending squared singular values of the centered matrix (energy per component). */
  energy: Float64Array;
  /** Analytic op counts for the fit. */
  ops: { fp_add: number; fp_mul: number; fp_div: number; sqrt: number };
}

/** Truncated SVD of the T×D matrix with rows `frames`, via the smaller Gram matrix. */
export function lowRankFit(frames: readonly Float64Array[], maxRank: number): LowRankFactors {
  const T = frames.length, D = frames[0].length;
  const mean = new Float64Array(D);
  for (const f of frames) for (let e = 0; e < D; e++) mean[e] += f[e];
  for (let e = 0; e < D; e++) mean[e] /= T;
  const C = frames.map((f) => { const r = new Float64Array(D); for (let e = 0; e < D; e++) r[e] = f[e] - mean[e]; return r; });
  const useRows = T <= D;
  const n = useRows ? T : D;
  const G = new Float64Array(n * n);
  if (useRows) {
    for (let i = 0; i < T; i++) for (let j = i; j < T; j++) {
      let s = 0; const ci = C[i], cj = C[j];
      for (let e = 0; e < D; e++) s += ci[e] * cj[e];
      G[i * n + j] = s; G[j * n + i] = s;
    }
  } else {
    for (const r of C) for (let i = 0; i < D; i++) { const ri = r[i]; if (ri === 0) continue; for (let j = i; j < D; j++) G[i * n + j] += ri * r[j]; }
    for (let i = 0; i < D; i++) for (let j = 0; j < i; j++) G[i * n + j] = G[j * n + i];
  }
  const eig = symmetricEigen(G, n);
  const positive = Array.from(eig.values).filter((x) => x > 1e-24 * (eig.values[0] || 1)).length;
  const rank = Math.max(0, Math.min(maxRank, positive));
  const A = new Float64Array(T * rank), B = new Float64Array(D * rank);
  for (let j = 0; j < rank; j++) {
    if (useRows) {
      // u_j = eigvec (T); B[:,j] = Cᵀ u_j ; A[:,j] = u_j
      for (let t = 0; t < T; t++) A[t * rank + j] = eig.vectors[t * n + j];
      for (let e = 0; e < D; e++) { let s = 0; for (let t = 0; t < T; t++) s += C[t][e] * eig.vectors[t * n + j]; B[e * rank + j] = s; }
    } else {
      for (let e = 0; e < D; e++) B[e * rank + j] = eig.vectors[e * n + j];
      for (let t = 0; t < T; t++) { let s = 0; for (let e = 0; e < D; e++) s += C[t][e] * eig.vectors[e * n + j]; A[t * rank + j] = s; }
    }
  }
  const gram = useRows ? (T * (T + 1) / 2) * D : (D * (D + 1) / 2) * T;
  const rot = eig.rotations * 6 * n;
  return {
    T, D, mean, rank, A, B, energy: eig.values,
    ops: { fp_add: T * D * 2 + gram + rot / 2 + T * D * rank, fp_mul: gram + rot + T * D * rank, fp_div: D + eig.rotations * 2, sqrt: eig.rotations * 2 },
  };
}

/** Intrinsic-dimensionality probe from the energy spectrum. */
export function energyProfile(energy: Float64Array): { total: number; k90: number; k99: number; k999: number; participation_ratio: number; top: number[] } {
  let total = 0, sq = 0;
  for (const x of energy) { total += x; sq += x * x; }
  const kFor = (frac: number) => {
    if (total === 0) return 0;
    let acc = 0;
    for (let k = 0; k < energy.length; k++) { acc += energy[k]; if (acc >= frac * total) return k + 1; }
    return energy.length;
  };
  const top: number[] = [];
  let acc = 0;
  for (let k = 0; k < Math.min(8, energy.length); k++) { acc += energy[k]; top.push(total === 0 ? 1 : acc / total); }
  return { total, k90: kFor(0.9), k99: kFor(0.99), k999: kFor(0.999), participation_ratio: sq === 0 ? 0 : (total * total) / sq, top };
}
