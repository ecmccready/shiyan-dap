import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ok: true,
    z: "experience snapshot",
    claimed_global_convergence: false,
  });
}

export async function POST() {
  return NextResponse.json({
    ok: true,
    z: "experience tick",
    claimed_global_convergence: false,
  });
}