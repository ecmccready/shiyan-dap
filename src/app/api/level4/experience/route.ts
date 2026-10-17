import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

/**
 * Durable Level 4 experience store.
 *
 * GET  → ExperienceEntry[] (oldest first; consumers read the last item as "latest").
 * POST → append one verified result from /workbench/autonomous.
 *
 * Read by: /workbench/status, /workbench/result.
 * Written by: recordExperienceServer() in src/lib/level4/verified.ts.
 * Same Upstash credentials as /api/level4/run and /api/level4/acquisition.
 */

export type ExperienceEntry = {
  run_id: string;
  iteration: number;
  e: number | null;
  verified_at: string;
  eligible: boolean;
  /** Optional measurement context (added with the engine-backed step). */
  y?: string;
  e0?: number | null;
  delta_e?: number | null;
  cold_e?: number | null;
  phi?: number | null;
  state?: string;
};

const KEY = "level4:experience";
const MAX_ENTRIES = 200;
const SEEN_TTL_SECONDS = 60 * 60 * 24 * 30;
const seenKey = (run_id: string, iteration: number) =>
  `level4:experience:seen:${run_id}:${iteration}`;

/** Keep the first entry per (run_id, iteration); preserves order. */
function dedupe(list: ExperienceEntry[]): ExperienceEntry[] {
  const seen = new Set<string>();
  return list.filter((x) => {
    const k = `${x.run_id}:${x.iteration}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function client(): Redis | null {
  const url = process.env.UPSTASH_KV_REST_API_URL;
  const token = process.env.UPSTASH_KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

export async function GET() {
  const redis = client();
  if (!redis) return NextResponse.json([]);
  const list = (await redis.lrange<ExperienceEntry>(KEY, 0, -1)) ?? [];
  return NextResponse.json(dedupe(list));
}

export async function POST(req: NextRequest) {
  const redis = client();
  if (!redis) {
    return NextResponse.json({ error: "experience store not configured" }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const run_id = typeof body.run_id === "string" ? body.run_id.slice(0, 80) : "";
  const iteration = num(body.iteration);
  if (!run_id || iteration === null) {
    return NextResponse.json({ error: "run_id and iteration required" }, { status: 400 });
  }

  const entry: ExperienceEntry = {
    run_id,
    iteration,
    e: num(body.e),
    verified_at:
      typeof body.verified_at === "string" ? body.verified_at : new Date().toISOString(),
    eligible: body.eligible === true,
    y: typeof body.y === "string" ? body.y.slice(0, 40) : undefined,
    e0: num(body.e0),
    delta_e: num(body.delta_e),
    cold_e: num(body.cold_e),
    phi: num(body.phi),
    state: typeof body.state === "string" ? body.state.slice(0, 16) : undefined,
  };

  // Idempotent: one entry per (run_id, iteration). SET NX is atomic.
  const first = await redis.set(seenKey(run_id, iteration), 1, {
    nx: true,
    ex: SEEN_TTL_SECONDS,
  });
  if (first !== "OK") {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  await redis.rpush(KEY, entry);
  await redis.ltrim(KEY, -MAX_ENTRIES, -1);
  return NextResponse.json({ ok: true });
}
