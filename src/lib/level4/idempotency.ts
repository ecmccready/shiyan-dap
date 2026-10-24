const SEEN_KEY = "aethel-level4-seen-actions";

type Seen = Record<string, string>; // action key → timestamp

function loadSeen(): Seen {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveSeen(seen: Seen) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
  } catch {
    // non-fatal
  }
}

/** Returns true if this exact action+context was already applied. */
export function alreadyApplied(actionKey: string): boolean {
  const seen = loadSeen();
  return Boolean(seen[actionKey]);
}

/** Mark an action as applied so a retry is a no-op. */
export function markApplied(actionKey: string) {
  const seen = loadSeen();
  seen[actionKey] = new Date().toISOString();
  saveSeen(seen);
}

export function clearSeen(runId: string) {
  if (typeof window === "undefined") return;
  const seen = loadSeen();
  for (const actionKey of Object.keys(seen)) {
    if (actionKey.startsWith(`${runId}:`)) delete seen[actionKey];
  }
  saveSeen(seen);
}