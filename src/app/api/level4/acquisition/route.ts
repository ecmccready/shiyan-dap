import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";

const STARTS_KEY = "level4:acquisition:starts";
const RECENT_KEY = "level4:acquisition:recent";

export async function GET() {
  const starts = (await kv.get<number>(STARTS_KEY)) ?? 0;
  const recent = (await kv.get<string[]>(RECENT_KEY)) ?? [];
  return NextResponse.json({ starts, recent });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { id } = body as { id?: string };

  const starts = ((await kv.get<number>(STARTS_KEY)) ?? 0) + 1;
  await kv.set(STARTS_KEY, starts);

  if (id) {
    const recent = (await kv.get<string[]>(RECENT_KEY)) ?? [];
    const next = [id, ...recent.filter((x) => x !== id)].slice(0, 8);
    await kv.set(RECENT_KEY, next);
  }

  return NextResponse.json({ ok: true, starts });
}