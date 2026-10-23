import { NextRequest, NextResponse } from "next/server";
import { requireLevel4Write } from "@/lib/level4/write-auth";
import { Redis } from "@upstash/redis";
import type { ControllerRecord } from "@/lib/level4/controller";

function getRedis() {
  const url = process.env.UPSTASH_KV_REST_API_URL;
  const token = process.env.UPSTASH_KV_REST_API_TOKEN;
  if (!url || !token) return null;
  try {
    return new Redis({ url, token });
  } catch (error) {
    console.error("Level 4 persistence configuration is invalid:", error);
    return null;
  }
}

const key = (id: string) => `level4:run:${id}`;

function isRunId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value);
}

const STATES: ControllerRecord["state"][] = [
  "READY",
  "PLANNING",
  "EXECUTING",
  "VERIFYING",
  "CONTINUE",
  "COMPLETE",
  "BLOCKED",
];

function isControllerRecord(value: unknown): value is ControllerRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (
    typeof record.goal_id !== "string" ||
    !record.goal_id.trim() ||
    record.goal_id.length > 128 ||
    typeof record.state !== "string" ||
    !STATES.some((state) => state === record.state) ||
    !Number.isSafeInteger(record.iteration) ||
    (record.iteration as number) < 0 ||
    (record.last_e !== null &&
      (typeof record.last_e !== "number" || !Number.isFinite(record.last_e))) ||
    !Array.isArray(record.history) ||
    record.history.length > 500 ||
    (record.blocked_reason !== undefined &&
      (typeof record.blocked_reason !== "string" || record.blocked_reason.length > 1000)) ||
    (record.actions !== undefined &&
      (!Array.isArray(record.actions) ||
        record.actions.length > 500 ||
        !record.actions.every(
          (action) => typeof action === "string" && action.length <= 200
        ))) ||
    (record.e0 !== undefined &&
      record.e0 !== null &&
      (typeof record.e0 !== "number" || !Number.isFinite(record.e0)))
  ) {
    return false;
  }

  return record.history.every((entry) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) return false;
    const item = entry as Record<string, unknown>;
    return (
      typeof item.state === "string" &&
      STATES.some((state) => state === item.state) &&
      typeof item.at === "string" &&
      Number.isFinite(Date.parse(item.at)) &&
      typeof item.note === "string" &&
      item.note.length <= 1000
    );
  });
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!isRunId(id)) {
    return NextResponse.json({ error: "Valid id required" }, { status: 400 });
  }
  const redis = getRedis();
  if (!redis) {
    return NextResponse.json({ error: "Persistence is not configured" }, { status: 503 });
  }
  try {
    const rec = await redis.get<unknown>(key(id));
    if (rec !== null && !isControllerRecord(rec)) {
      console.error("Level 4 persistence returned an invalid run record");
      return NextResponse.json(
        { error: "Stored run record is invalid" },
        { status: 502 }
      );
    }
    return NextResponse.json({ rec: rec ?? null });
  } catch (error) {
    console.error("Level 4 run read failed:", error);
    return NextResponse.json({ error: "Unable to read run record" }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  const denied = requireLevel4Write(req);
  if (denied) return denied;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json(
      { error: "Request body must be a JSON object" },
      { status: 400 }
    );
  }
  const payload = body as Record<string, unknown>;
  if (!isRunId(payload.id) || !isControllerRecord(payload.rec)) {
    return NextResponse.json(
      { error: "Valid id and controller record are required" },
      { status: 400 }
    );
  }
  const redis = getRedis();
  if (!redis) {
    return NextResponse.json({ error: "Persistence is not configured" }, { status: 503 });
  }
  try {
    await redis.set(key(payload.id), payload.rec);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Level 4 run write failed:", error);
    return NextResponse.json({ error: "Unable to save run record" }, { status: 502 });
  }
}

export async function DELETE(req: NextRequest) {
  const denied = requireLevel4Write(req);
  if (denied) return denied;
  const id = req.nextUrl.searchParams.get("id");
  if (!isRunId(id)) {
    return NextResponse.json({ error: "Valid id required" }, { status: 400 });
  }
  const redis = getRedis();
  if (!redis) {
    return NextResponse.json({ error: "Persistence is not configured" }, { status: 503 });
  }
  try {
    await redis.del(key(id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Level 4 run delete failed:", error);
    return NextResponse.json({ error: "Unable to delete run record" }, { status: 502 });
  }
}