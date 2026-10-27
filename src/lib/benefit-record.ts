"use client";

import { useMemo, useSyncExternalStore } from "react";

/**
 * Self-reported economic benefit, step 4 of the proof-to-pilot journey.
 * Stored only in this browser (localStorage), one record per run id. It is not verified, not written to the ledger and not sent to the server;
 * it is included in the exported evidence pack when present and labelled self-reported there.
 */
export interface BenefitRecord {
  run_id: string;
  amount: string;
  unit: string;
  note: string;
  recorded_at: string;
  self_reported: true;
}

const PREFIX = "aethel-economic-benefit:";
const EVENT = "aethel-benefit-changed";

export function readBenefitRaw(runId: string): string | null {
  try {
    return window.localStorage.getItem(PREFIX + runId);
  } catch {
    return null;
  }
}

export function parseBenefit(raw: string | null): BenefitRecord | null {
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as Partial<BenefitRecord>;
    if (j && typeof j.run_id === "string" && typeof j.amount === "string" && typeof j.recorded_at === "string") {
      return { run_id: j.run_id, amount: j.amount, unit: j.unit ?? "", note: j.note ?? "", recorded_at: j.recorded_at, self_reported: true };
    }
  } catch {}
  return null;
}

export function loadBenefit(runId: string): BenefitRecord | null {
  return parseBenefit(readBenefitRaw(runId));
}

/** Saves the record with the current time. Returns false when browser storage is unavailable. */
export function saveBenefit(runId: string, amount: string, unit: string, note: string): boolean {
  const rec: BenefitRecord = { run_id: runId, amount: amount.trim(), unit: unit.trim(), note: note.trim(), recorded_at: new Date().toISOString(), self_reported: true };
  try {
    window.localStorage.setItem(PREFIX + runId, JSON.stringify(rec));
    window.dispatchEvent(new Event(EVENT));
    return true;
  } catch {
    return false;
  }
}

export function clearBenefit(runId: string) {
  try {
    window.localStorage.removeItem(PREFIX + runId);
    window.dispatchEvent(new Event(EVENT));
  } catch {}
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** The stored record for a run id (null on the server, before hydration, with no run id, or when none is saved). */
export function useBenefit(runId: string | null | undefined): BenefitRecord | null {
  const raw = useSyncExternalStore(
    subscribe,
    () => (runId ? readBenefitRaw(runId) : null),
    () => null,
  );
  return useMemo(() => parseBenefit(raw), [raw]);
}
