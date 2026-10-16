import { NextRequest, NextResponse } from "next/server";
import type { ControllerRecord } from "@/lib/level4/controller";

// In-memory store for the slice. Replace with DB / KV later.
const store = new Map<string, { rec: ControllerRecord; updated_at: string }>();

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const found = store.get(id);
  return NextResponse.json(found ?? null);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { id, rec } = body as { id: string; rec: ControllerRecord };
  if (!id || !rec) return NextResponse.json({ error: "id and rec required" }, { status: 400 });
  store.set(id, { rec, updated_at: new Date().toISOString() });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  store.delete(id);
  return NextResponse.json({ ok: true });
}