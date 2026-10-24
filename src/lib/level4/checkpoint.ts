import type { ControllerRecord } from "./controller";

const CHECKPOINT_KEY = "aethel-level4-checkpoint";

type SavedCheckpoint = { rec: ControllerRecord; saved_at: string };
type CheckpointStore = { records: Record<string, SavedCheckpoint> };

const RECOVERY_PROOF_KEY = "recovery-proof";

function readStore(): CheckpointStore {
  if (typeof window === "undefined") return { records: {} };
  try {
    const raw = window.localStorage.getItem(CHECKPOINT_KEY);
    if (!raw) return { records: {} };
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return { records: {} };
    if ("records" in parsed && parsed.records && typeof parsed.records === "object" && !Array.isArray(parsed.records)) {
      return { records: parsed.records as Record<string, SavedCheckpoint> };
    }
    if ("rec" in parsed && parsed.rec) {
      return { records: { [RECOVERY_PROOF_KEY]: parsed as SavedCheckpoint } };
    }
  } catch {
    return { records: {} };
  }
  return { records: {} };
}

export function saveCheckpoint(rec: ControllerRecord, runId?: string) {
  if (typeof window === "undefined") return;
  try {
    const store = readStore();
    store.records[runId ?? RECOVERY_PROOF_KEY] = { rec, saved_at: new Date().toISOString() };
    window.localStorage.setItem(CHECKPOINT_KEY, JSON.stringify(store));
  } catch {
    // quota or private mode — non-fatal
  }
}

export function loadCheckpoint(runId?: string): SavedCheckpoint | null {
  if (typeof window === "undefined") return null;
  return readStore().records[runId ?? RECOVERY_PROOF_KEY] ?? null;
}

export function clearCheckpoint(runId?: string) {
  if (typeof window === "undefined") return;
  const store = readStore();
  delete store.records[runId ?? RECOVERY_PROOF_KEY];
  if (Object.keys(store.records).length === 0) {
    window.localStorage.removeItem(CHECKPOINT_KEY);
  } else {
    window.localStorage.setItem(CHECKPOINT_KEY, JSON.stringify(store));
  }
}