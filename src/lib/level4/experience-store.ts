/** Server-side read-only access to the Upstash experience store (same key as /api/level4/experience). */
import { Redis } from "@upstash/redis";
import type { ExperienceEntry } from "./experience-client";

export async function readExperienceStore(): Promise<ExperienceEntry[] | null> {
  const url = process.env.UPSTASH_KV_REST_API_URL;
  const token = process.env.UPSTASH_KV_REST_API_TOKEN;
  if (!url || !token) return null;
  const list = (await new Redis({ url, token }).lrange<ExperienceEntry>("level4:experience", 0, -1)) ?? [];
  const seen = new Set<string>();
  return list.filter((x) => {
    const k = `${x.run_id}:${x.iteration}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
