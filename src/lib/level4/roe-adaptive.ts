import { Redis } from "@upstash/redis";
import { DEMO_TENSOR_EPSILON } from "./demo-tensor";
import { tensorGate } from "./roe";

/**
 * ROE slice 2 (opt-in): base ε for the normalized/RMS tensor check.
 *
 * Precedence: explicit baseEpsilon (alias eps_base) > adaptive > request epsilon (default).
 *
 * Adaptive rule ("last_verified_tensor_distance"): read the experience store (read-only),
 * keep entries with eligible === true, a finite tensor_distance ≥ 0 and a tensor gate that
 * did not fail; take the most recent one's tensor_distance and cap it at
 * DEMO_TENSOR_EPSILON, so it can only tighten the base, never loosen it.
 * No usable entry, or the store unconfigured/unreachable → DEMO_TENSOR_EPSILON ("fallback").
 *
 * Writes nothing. Not used by the default, fixed or holographic paths, verify, eligibility,
 * next-action or the autonomous loop.
 */

export const ADAPTIVE_RULE = "last_verified_tensor_distance, capped at DEMO_TENSOR_EPSILON";
const KEY = "level4:experience";

export type EpsSource = "explicit" | "adaptive" | "default" | "fallback";
export type AdaptiveInfo = { rule: string; samples: number; base: number };
export type AdaptiveBase = { base: number; source: "adaptive" | "fallback"; adaptive: AdaptiveInfo };

type Entry = { run_id?: unknown; iteration?: unknown; eligible?: unknown; tensor_distance?: unknown; tensor_status?: unknown; tensor_epsilon?: unknown; tensor_commitment?: unknown };

/** Pure rule over entries (oldest first). */
export function adaptiveBaseFrom(entries: Entry[]): AdaptiveBase {
  const seen = new Set<string>();
  const usable = entries.filter((x) => {
    const k = `${x.run_id}:${x.iteration}`;
    if (seen.has(k)) return false;
    seen.add(k);
    const d = x.tensor_distance;
    return x.eligible === true && typeof d === "number" && Number.isFinite(d) && d >= 0 && tensorGate(x) !== false;
  });
  if (usable.length === 0) {
    return { base: DEMO_TENSOR_EPSILON, source: "fallback", adaptive: { rule: ADAPTIVE_RULE, samples: 0, base: DEMO_TENSOR_EPSILON } };
  }
  const base = Math.min(DEMO_TENSOR_EPSILON, usable[usable.length - 1].tensor_distance as number);
  return { base, source: "adaptive", adaptive: { rule: ADAPTIVE_RULE, samples: usable.length, base } };
}

/** Reads the experience store (read-only). Optional runId narrows to one run. */
export async function adaptiveEpsBase(runId?: string | null): Promise<AdaptiveBase> {
  try {
    const url = process.env.UPSTASH_KV_REST_API_URL;
    const token = process.env.UPSTASH_KV_REST_API_TOKEN;
    if (!url || !token) return adaptiveBaseFrom([]);
    const all = ((await new Redis({ url, token }).lrange<Entry>(KEY, 0, -1)) ?? []) as Entry[];
    return adaptiveBaseFrom(runId ? all.filter((x) => x.run_id === runId) : all);
  } catch {
    return adaptiveBaseFrom([]);
  }
}

export const validEps = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;

export function wantsAdaptive(v: unknown): boolean {
  return v === true || v === "true" || v === "1";
}
