import type { ControllerRecord } from "./controller";

export type VerifiedResult = {
  iteration: number;
  e: number | null;
  verified_at: string;
  eligible: boolean;
};

const VERIFIED_KEY = "aethel-level4-verified";

export function recordVerified(
  rec: ControllerRecord,
  e: number | null,
  eligible = true
): VerifiedResult {
  const entry: VerifiedResult = {
    iteration: rec.iteration,
    e,
    verified_at: new Date().toISOString(),
    eligible,
  };

  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(VERIFIED_KEY);
      const list: VerifiedResult[] = raw ? JSON.parse(raw) : [];
      list.push(entry);
      window.localStorage.setItem(VERIFIED_KEY, JSON.stringify(list.slice(-50)));
    } catch {
      // non-fatal
    }
  }

  return entry;
}

export function loadVerified(): VerifiedResult[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(VERIFIED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function clearVerified() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(VERIFIED_KEY);
}