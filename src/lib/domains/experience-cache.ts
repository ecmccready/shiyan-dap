import type { ExperienceEntry } from "@/lib/level4/experience-client";

/**
 * Short-lived, read-only cache for GET /api/level4/experience, shared by every Domains dropdown on the page.
 * Concurrent callers share one request; a failed fetch is never cached (callers get []).
 */
const TTL_MS = 30_000;
let cached: { at: number; list: ExperienceEntry[] } | null = null;
let inflight: Promise<ExperienceEntry[]> | null = null;

export async function loadExperienceCached(now: () => number = Date.now): Promise<ExperienceEntry[]> {
  if (cached && now() - cached.at < TTL_MS) return cached.list;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch("/api/level4/experience");
      if (!res.ok) return [];
      const data = await res.json();
      const list: ExperienceEntry[] = Array.isArray(data) ? data : [];
      cached = { at: now(), list };
      return list;
    } catch {
      return [];
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** Test hook. */
export function clearExperienceCache() {
  cached = null;
  inflight = null;
}
