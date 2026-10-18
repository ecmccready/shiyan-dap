/**
 * Uniform, domain-neutral ledger view of the Level 4 experience store.
 * Used by GET /api/level4/experience?format=ledger (public audit).
 * Pure formatting; does not read or write the store.
 */
import type { ExperienceEntry } from "./experience-client";
import { verifyStep } from "./measured";
import { UNSPECIFIED_DOMAIN, type SystemDomain, type SystemicStatus } from "./systemic";

export type LedgerEntry = {
  domain: SystemDomain;
  e0: number | null;
  e1: number | null;
  deltaE: number | null;
  phi: number | null;
  status: SystemicStatus;
  run_id: string;
  iteration: number;
};

const finite = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

/**
 * Classify a stored entry with verifyStep (Δe = e0 − e1, measured from the
 * run's starting error). Entries missing e0 or e cannot show a reduction and
 * are MISDIAGNOSIS_REJECTED with null Δe/Φ. Domain comes from the entry's
 * `system` field, else "unspecified" (never assumed).
 */
export function toLedgerEntry(entry: ExperienceEntry & { system?: string }): LedgerEntry {
  const domain =
    typeof entry.system === "string" && entry.system ? entry.system : UNSPECIFIED_DOMAIN;
  const e0 = finite(entry.e0);
  const e1 = finite(entry.e);
  const base = { domain, e0, e1, run_id: entry.run_id, iteration: entry.iteration };
  if (e0 == null || e1 == null) {
    return { ...base, deltaE: null, phi: null, status: "MISDIAGNOSIS_REJECTED" };
  }
  const v = verifyStep({ e0, e1, coldE: finite(entry.cold_e) });
  return { ...base, deltaE: v.deltaE, phi: v.phi, status: v.status };
}

const fx = (n: number | null) => (n == null ? "NA" : n.toFixed(3));

/** DOMAIN=<d> E0=<x> E1=<y> DELTA_E=<z> PHI=<p> STATUS=<s> RUN=<id> ITER=<n> */
export function formatLedgerLine(x: LedgerEntry): string {
  return [
    `DOMAIN=${x.domain}`,
    `E0=${fx(x.e0)}`,
    `E1=${fx(x.e1)}`,
    `DELTA_E=${fx(x.deltaE)}`,
    `PHI=${fx(x.phi)}`,
    `STATUS=${x.status}`,
    `RUN=${x.run_id}`,
    `ITER=${x.iteration}`,
  ].join(" ");
}

export function toLedger(list: (ExperienceEntry & { system?: string })[]): {
  entries: LedgerEntry[];
  ledger: string[];
} {
  const entries = list.map(toLedgerEntry);
  return { entries, ledger: entries.map(formatLedgerLine) };
}
