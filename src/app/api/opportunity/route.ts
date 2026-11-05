import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json();

  // In production this writes to the durable store.
  // For now we accept the record and return it with a server timestamp.
  const record = {
    ...body,
    id: `opp_${Date.now()}`,
    created_at: new Date().toISOString(),
    status: "recorded",
  };

  return NextResponse.json({ ok: true, record });
}