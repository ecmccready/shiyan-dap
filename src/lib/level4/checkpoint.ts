import type { ControllerRecord } from "./controller";

const CHECKPOINT_KEY = "aethel-level4-checkpoint";

export function saveCheckpoint(rec: ControllerRecord) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      CHECKPOINT_KEY,
      JSON.stringify({
        rec,
        saved_at: new Date().toISOString(),
      })
    );
  } catch {
    // quota or private mode — non-fatal
  }
}

export function loadCheckpoint(): { rec: ControllerRecord; saved_at: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CHECKPOINT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearCheckpoint() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(CHECKPOINT_KEY);
}