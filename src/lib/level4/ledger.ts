/**
 * Uniform, domain-neutral ledger view of the Level 4 experience store.
 * Used by GET /api/level4/experience?format=ledger (public audit).
 * Pure formatting; does not read or write the store.
 */
import type { ExperienceEntry } from "./experience-client";
import { verifyStep } from "./measured";
import { UNSPECIFIED_DOMAIN, type SystemDomain, type SystemicStatus } from "./systemic";
import { DEMO_TENSOR_EPSILON } from "./demo-tensor";

/** Ledger status: the Δe classification, overridden when a stored tensor check failed. */
export type LedgerStatus = SystemicStatus | "MISDIAGNOSIS_VIOLATION";

export type LedgerEntry = {
  domain: SystemDomain;
  e0: number | null;
  e1: number | null;
  deltaE: number | null;
  phi: number | null;
  status: LedgerStatus;
  run_id: string;
  iteration: number;
  /** Present only when the stored entry has tensor fields. */
  tensor_commitment?: string;
  tensor_distance?: number;
};

const finite = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

/**
 * Classify a stored entry with verifyStep (Δe = e0 − e1, measured from the
 * run's starting error). Entries missing e0 or e cannot show a reduction and
 * are MISDIAGNOSIS_REJECTED with null Δe/Φ. Domain comes from the entry's
 * `system` field, else "unspecified" (never assumed).
 */
export function toLedgerEntry(
  entry: ExperienceEntry & { system?: string; tensor_status?: unknown; tensor_epsilon?: unknown }
): LedgerEntry {
  const domain =
    typeof entry.system === "string" && entry.system ? entry.system : UNSPECIFIED_DOMAIN;
  const e0 = finite(entry.e0);
  const e1 = finite(entry.e);
  const base: Pick<LedgerEntry, "domain" | "e0" | "e1" | "run_id" | "iteration" | "tensor_commitment" | "tensor_distance"> =
    { domain, e0, e1, run_id: entry.run_id, iteration: entry.iteration };
  // Tensor fields are added only when stored, so entries without them are unchanged.
  if (typeof entry.tensor_commitment === "string") base.tensor_commitment = entry.tensor_commitment;
  const td = finite(entry.tensor_distance);
  if (td != null) base.tensor_distance = td;
  if (e0 == null || e1 == null) {
    return { ...base, deltaE: null, phi: null, status: "MISDIAGNOSIS_REJECTED" };
  }
  const v = verifyStep({ e0, e1, coldE: finite(entry.cold_e) });
  return { ...base, deltaE: v.deltaE, phi: v.phi, status: foldTensorStatus(v.status, entry, td) };
}

/**
 * The tensor check is an additional gate: a step whose stored tensor check
 * failed is MISDIAGNOSIS_VIOLATION regardless of Δe. Uses a stored
 * tensor_status / tensor_epsilon when present, else the demo ε (0.16).
 * Entries without tensor fields keep the Δe status unchanged.
 */
function foldTensorStatus(
  status: SystemicStatus,
  entry: { tensor_status?: unknown; tensor_epsilon?: unknown },
  distance: number | null
): LedgerStatus {
  if (entry.tensor_status === "MISDIAGNOSIS_VIOLATION") return "MISDIAGNOSIS_VIOLATION";
  if (entry.tensor_status === "TENSOR_VERIFIED") return status;
  if (distance == null) return status;
  const eps = finite(entry.tensor_epsilon) ?? DEMO_TENSOR_EPSILON;
  return distance > eps ? "MISDIAGNOSIS_VIOLATION" : status;
}

const fx = (n: number | null) => (n == null ? "NA" : n.toFixed(3));

/**
 * DOMAIN=<d> E0=<x> E1=<y> DELTA_E=<z> PHI=<p> STATUS=<s> RUN=<id> ITER=<n>
 * plus " TENSOR=<sha256:…|NA> T_DIST=<x|NA>" only when the entry has a tensor field.
 */
export function formatLedgerLine(x: LedgerEntry): string {
  const parts = [
    `DOMAIN=${x.domain}`,
    `E0=${fx(x.e0)}`,
    `E1=${fx(x.e1)}`,
    `DELTA_E=${fx(x.deltaE)}`,
    `PHI=${fx(x.phi)}`,
    `STATUS=${x.status}`,
    `RUN=${x.run_id}`,
    `ITER=${x.iteration}`,
  ];
  if (x.tensor_commitment !== undefined || x.tensor_distance !== undefined) {
    parts.push(`TENSOR=${x.tensor_commitment ?? "NA"}`, `T_DIST=${fx(x.tensor_distance ?? null)}`);
  }
  return parts.join(" ");
}

export function toLedger(list: (ExperienceEntry & { system?: string })[]): {
  entries: LedgerEntry[];
  ledger: string[];
} {
  const entries = list.map(toLedgerEntry);
  return { entries, ledger: entries.map(formatLedgerLine) };
}
