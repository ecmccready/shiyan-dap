/** TEST ONLY. v0.1.2 stress fixtures for 4D-SCP size measurement.
 * No network, no production data, no writes. Not a Medicare or CMS encoder.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SourceRow, StateVerdict } from "../src/core/compression";
import { T0, type FixturePoint, makeSourceRow } from "./scp-v01-fixture";

/** mulberry32 seed for Fixture B. B256 is the prefix of B4096 with this same seed. */
export const NOISE_SEED = 20261117;
export const PHI_ABS_MIN = 0.05;
export const B256_N = 256;
export const B4096_N = 4096;

export const MEDICARE_MAPPING = {
  label: "TEST-ONLY, SYNTHETIC. Not a production encoder, not CMS data, not a clinical or fraud finding.",
  predicted: "avg_submitted_charge",
  observed: "avg_medicare_payment",
  phi: "(observed - predicted) / max(|predicted|, 1)",
  t: "Date.parse(retrieved_at) + i * 1000, i = row index in the committed file",
  step: "i",
  verdict: "empty hcpcs_code → INCONCLUSIVE; observed < 0 or observed > predicted → FAIL; else PASS",
} as const;

export type MedicareFile = {
  synthetic: boolean;
  note: string;
  retrieved_at: string;
  rows: Array<{
    provider_id: string;
    hcpcs_code: string;
    service_count: number;
    avg_submitted_charge: number;
    avg_medicare_payment: number;
  }>;
};

export function loadMedicareFixture(root = join(import.meta.dirname, "..")): MedicareFile {
  const raw = JSON.parse(readFileSync(join(root, "fixtures/medicare/sample-rows.json"), "utf8")) as MedicareFile;
  if (raw.synthetic !== true) throw new Error("medicare fixture must be labelled synthetic");
  if (!Array.isArray(raw.rows) || raw.rows.length === 0) throw new Error("medicare fixture has no rows");
  if (typeof raw.retrieved_at !== "string" || !Number.isSafeInteger(Date.parse(raw.retrieved_at))) {
    throw new Error("medicare fixture retrieved_at is missing");
  }
  return raw;
}

/** Map one committed Medicare fixture row. Test-only; does not invent rows. */
export function mapMedicareRow(row: MedicareFile["rows"][number], i: number, retrievedAtMs: number): FixturePoint {
  const predicted = row.avg_submitted_charge;
  const observed = row.avg_medicare_payment;
  if (!Number.isFinite(predicted) || !Number.isFinite(observed)) throw new RangeError(`medicare row ${i}: non-finite charge or payment`);
  const phi = (observed - predicted) / Math.max(Math.abs(predicted), 1);
  const hcpcs = typeof row.hcpcs_code === "string" ? row.hcpcs_code : "";
  let verdict: StateVerdict;
  if (hcpcs.trim() === "") verdict = "INCONCLUSIVE";
  else if (observed < 0 || observed > predicted) verdict = "FAIL";
  else verdict = "PASS";
  return { predicted, observed, phi, step: i, t: retrievedAtMs + i * 1000, verdict };
}

export function medicareRows(): { file: MedicareFile; points: FixturePoint[]; rows: SourceRow[]; padded: false; n: number } {
  const file = loadMedicareFixture();
  const t0 = Date.parse(file.retrieved_at);
  const points = file.rows.map((row, i) => mapMedicareRow(row, i, t0));
  const rows = points.map((p, i) => makeSourceRow("scp-v012-medicare", file.rows[i].provider_id, p));
  return { file, points, rows, padded: false, n: points.length };
}

/**
 * Documented PRNG: mulberry32 (32-bit, returns [0, 1)).
 * https://gist.github.com/tommyettinger/46a874533244883189143505d203312c
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box–Muller gaussian; retries if a uniform draw is 0 so log is defined. */
export function gauss(rng: () => number): number {
  let u = 0;
  while (u === 0) u = rng();
  let v = 0;
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * Fixture B: seeded random walk + gaussian noise + occasional jumps/outliers + irregular dt.
 *
 * Start: predicted=1, observed=1, phi=0.5, t=T0, step=i.
 * For i>0:
 *   predicted += 0.01 * N(0,1); every 37th step, add a ±0.5 jump (sign from PRNG)
 *   observed = predicted + 0.05 * N(0,1); every 53rd step, add a ±2.0 outlier
 *   phi += 0.002 * N(0,1); if |phi| < 0.05, push to sign(phi)*0.05 so quantization cannot flip the class
 *   t += 1000 ms; with probability 0.02, add an extra 3_600_000 ms
 * Verdict: u<0.15 FAIL, u<0.25 INCONCLUSIVE, else PASS (one uniform after the walk).
 *
 * B256 is the first 256 points of B4096 at the same seed (prefix property).
 */
export function noisyPoints(n: number, seed = NOISE_SEED, t0 = T0): FixturePoint[] {
  if (!Number.isSafeInteger(n) || n < 1) throw new RangeError("n must be a positive integer");
  const rng = mulberry32(seed);
  const out: FixturePoint[] = [];
  let predicted = 1;
  let observed = 1;
  let phi = 0.5;
  let t = t0;
  for (let i = 0; i < n; i++) {
    if (i > 0) {
      const jump = i % 37 === 0 ? (rng() < 0.5 ? -0.5 : 0.5) : 0;
      predicted = predicted + 0.01 * gauss(rng) + jump;
      const outlier = i % 53 === 0 ? (rng() < 0.5 ? -2 : 2) : 0;
      observed = predicted + 0.05 * gauss(rng) + outlier;
      phi = phi + 0.002 * gauss(rng);
      if (Math.abs(phi) < PHI_ABS_MIN) phi = (phi < 0 ? -1 : 1) * PHI_ABS_MIN;
      t += 1000;
      if (rng() < 0.02) t += 3_600_000;
      if (!Number.isFinite(predicted) || !Number.isFinite(observed) || !Number.isFinite(phi) || !Number.isSafeInteger(t)) {
        throw new RangeError(`noisy point ${i} left the finite/safe-integer range`);
      }
    }
    const u = rng();
    const verdict: StateVerdict = u < 0.15 ? "FAIL" : u < 0.25 ? "INCONCLUSIVE" : "PASS";
    out.push({ predicted, observed, phi, step: i, t, verdict });
  }
  return out;
}

export function noisyRows(n: number, tenant: string, idPrefix: string, seed = NOISE_SEED): { points: FixturePoint[]; rows: SourceRow[] } {
  const points = noisyPoints(n, seed);
  const width = Math.max(8, n.toString(16).length);
  const rows = points.map((p, i) => makeSourceRow(tenant, `${idPrefix}${i.toString(16).padStart(width, "0")}`, p));
  return { points, rows };
}
