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
  try {
    return new Redis({ url, token });
  } catch (error) {
    console.error("Acquisition store configuration is invalid:", error);
    return null;
  }
}

const noStore = { headers: { "Cache-Control": "no-store" } };

export async function GET() {
  const redis = client();
  if (!redis) {
    return NextResponse.json(
      { error: "Acquisition store is not configured" },
      { status: 503, ...noStore }
    );
  }
  try {
    const [startsValue, recentValue] = await Promise.all([
      redis.get<number | string>(STARTS_KEY),
      redis.get<string[]>(RECENT_KEY),
    ]);
    const starts = Number(startsValue ?? 0);
    if (
      !Number.isSafeInteger(starts) ||
      starts < 0 ||
      (recentValue !== null &&
        (!Array.isArray(recentValue) || !recentValue.every((id) => isRunId(id))))
    ) {
      console.error("Acquisition store returned invalid data");
      return NextResponse.json(
        { error: "Acquisition store returned invalid data" },
        { status: 502, ...noStore }
      );
    }
    return NextResponse.json(
      { starts, recent: recentValue ?? [] },
      noStore
    );
  } catch (error) {
    console.error("Acquisition read failed:", error);
    return NextResponse.json(
      { error: "Unable to read acquisition data" },
      { status: 502, ...noStore }
    );
  }
}

function isRunId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(value);
}

export async function POST(req: NextRequest) {
  const denied = requireLevel4Write(req);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON" },
      { status: 400, ...noStore }
    );
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json(
      { error: "Request body must be a JSON object" },
      { status: 400, ...noStore }
    );
  }
  const id = (body as Record<string, unknown>).id;
  if (!isRunId(id)) {
    return NextResponse.json(
      { error: "Valid id required" },
      { status: 400, ...noStore }
    );
  }

  const redis = client();
  if (!redis) {
    return NextResponse.json(
      { error: "Acquisition store is not configured" },
      { status: 503, ...noStore }
    );
  }

  try {
    const recentValue = await redis.get<unknown>(RECENT_KEY);
    if (
      recentValue !== null &&
      (!Array.isArray(recentValue) || !recentValue.every((runId) => isRunId(runId)))
    ) {
      console.error("Acquisition recent-run list is invalid");
      return NextResponse.json(
        { error: "Acquisition store returned invalid data" },
        { status: 502, ...noStore }
      );
    }
    const recent = (recentValue ?? []) as string[];
    const next = [id, ...recent.filter((runId) => runId !== id)].slice(0, 8);
    const starts = await redis.incr(STARTS_KEY);
    await redis.set(RECENT_KEY, next);

    return NextResponse.json({ ok: true, starts }, noStore);
  } catch (error) {
    console.error("Acquisition write failed:", error);
    return NextResponse.json(
      { error: "Unable to record acquisition" },
      { status: 502, ...noStore }
    );
  }
}
