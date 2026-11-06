import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json();

  const disposition = {
    ...body,
    id: `disp_${Date.now()}`,
    recorded_at: new Date().toISOString(),
    status: "recorded",
  };

  return NextResponse.json({ ok: true, disposition });
}