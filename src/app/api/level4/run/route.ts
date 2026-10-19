import { NextRequest, NextResponse } from "next/server";
import { requireLevel4Write } from "@/lib/level4/write-auth";
import { Redis } from "@upstash/redis";
import type { ControllerRecord } from "@/lib/level4/controller";

const redis = new Redis({
  url: process.env.UPSTASH_KV_REST_API_URL!,
  token: process.env.UPSTASH_KV_REST_API_TOKEN!,
});

const key = (id: string) => `level4:run:${id}`;

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const rec = await redis.get<ControllerRecord>(key(id));
  return NextResponse.json(rec ? { rec } : null);
}

export async function POST(req: NextRequest) {
  const denied = requireLevel4Write(req);
  if (denied) return denied;
  const body = await req.json();
  const { id, rec } = body as { id: string; rec: ControllerRecord };
  if (!id || !rec) return NextResponse.json({ error: "id and rec required" }, { status: 400 });
  await redis.set(key(id), rec);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const denied = requireLevel4Write(req);
  if (denied) return denied;
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await redis.del(key(id));
  return NextResponse.json({ ok: true });
}