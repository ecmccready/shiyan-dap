import { NextRequest, NextResponse } from "next/server";
import { requireLevel4Write } from "@/lib/level4/write-auth";
import { Redis } from "@upstash/redis";

// Always read the live counter (never a cached response).
export const dynamic = "force-dynamic";

const STARTS_KEY = "level4:acquisition:starts";
const RECENT_KEY = "level4:acquisition:recent";

function client(): Redis | null {
  const url = process.env.UPSTASH_KV_REST_API_URL;
  const token = process.env.UPSTASH_KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

const noStore = { headers: { "Cache-Control": "no-store" } };

export async function GET() {
  const redis = client();
  if (!redis) return NextResponse.json({ starts: 0, recent: [] }, noStore);
  const [starts, recent] = await Promise.all([
    redis.get<number | string>(STARTS_KEY),
    redis.get<string[]>(RECENT_KEY),
  ]);
  return NextResponse.json(
    { starts: Number(starts ?? 0) || 0, recent: Array.isArray(recent) ? recent : [] },
    noStore
  );
}

export async function POST(req: NextRequest) {
  const denied = requireLevel4Write(req);
  if (denied) return denied;
  const redis = client();
  if (!redis) {
    return NextResponse.json({ error: "acquisition store not configured" }, { status: 503 });
  }

  let id: string | undefined;
  try {
    const body = (await req.json()) as { id?: unknown };
    id = typeof body.id === "string" ? body.id.slice(0, 80) : undefined;
  } catch {
    id = undefined;
  }

  // Atomic increment: concurrent starts are never lost.
  const starts = await redis.incr(STARTS_KEY);

  if (id) {
    const recent = (await redis.get<string[]>(RECENT_KEY)) ?? [];
    const next = [id, ...(Array.isArray(recent) ? recent : []).filter((x) => x !== id)].slice(0, 8);
    await redis.set(RECENT_KEY, next);
  }

  return NextResponse.json({ ok: true, starts }, noStore);
}
