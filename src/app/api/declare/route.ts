import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

type DeclareBody = {
  objective: string;
  task: string;
  baseline: string;
  success: string;
};

const store = new Map<string, DeclareBody & { id: string; createdAt: string }>();

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as DeclareBody;
    if (!body.objective || !body.task || !body.baseline || !body.success) {
      return NextResponse.json({ error: "objective, task, baseline and success required" }, { status: 400 });
    }
    const id = randomUUID();
    const record = { id, ...body, createdAt: new Date().toISOString() };
    store.set(id, record);
    return NextResponse.json({ ok: true, id, record });
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const record = store.get(id);
  return NextResponse.json(record ? { found: true, record } : { found: false });
}