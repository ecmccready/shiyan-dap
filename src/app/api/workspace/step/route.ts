import { NextResponse } from "next/server";
import { snapshotSelf, step } from "@/lib/self";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(snapshotSelf());
}

export async function POST() {
  const out = step();
  return NextResponse.json({
    ok: true,
    settlement_written: false,
    claimed_global_convergence: false,
    ...out,
  });
}