/**
 * Server-side reader for the Self() durable feed: reads the Upstash
 * experience list directly (same key and credentials as
 * /api/level4/experience). Returns null when the store is not configured or
 * on any error, so callers fall back to their existing proposer.
 */
import { Redis } from "@upstash/redis";
import type { ExperienceEntry } from "./experience-client";
import { planFromEntries, type DurablePlan } from "./durable-self";

const KEY = "level4:experience";

export async function loadDurablePlanServer(
  permitted: string[],
  excludeRunId?: string
): Promise<DurablePlan | null> {
  const url = process.env.UPSTASH_KV_REST_API_URL;
  const token = process.env.UPSTASH_KV_REST_API_TOKEN;
  if (!url || !token) return null;
  try {
    const list = (await new Redis({ url, token }).lrange<ExperienceEntry>(KEY, 0, -1)) ?? [];
    return planFromEntries(list, permitted, excludeRunId);
  } catch {
    return null;
  }
}
