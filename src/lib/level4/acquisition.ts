const KEY = "aethel-level4-starts";
const RECENT_KEY = "aethel-level4-recent-runs";

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

export function recordRecentRun(id: string) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    const next = [id, ...list.filter((x) => x !== id)].slice(0, 8);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // non-fatal
  }
}

export function loadRecentRuns(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}