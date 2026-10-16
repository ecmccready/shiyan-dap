const KEY = "aethel-level4-starts";

export function recordStart() {
  if (typeof window === "undefined") return;
  try {
    const n = Number(window.localStorage.getItem(KEY) || "0");
    window.localStorage.setItem(KEY, String(n + 1));
  } catch {
    // non-fatal
  }
}

export function loadStarts(): number {
  if (typeof window === "undefined") return 0;
  try {
    return Number(window.localStorage.getItem(KEY) || "0");
  } catch {
    return 0;
  }
}

export function newRunId(): string {
  return `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}