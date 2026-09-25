import { NextRequest, NextResponse } from "next/server";
import { init, run, snapshot, step } from "@/lib/proof-loop";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(snapshot());
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (body.reset) return NextResponse.json(init());
  if (body.run) return NextResponse.json(run(Number(body.n ?? 12)));
  return NextResponse.json(step());
}