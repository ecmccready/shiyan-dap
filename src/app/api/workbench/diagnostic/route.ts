import { NextResponse } from "next/server";
import { demoUnresolved } from "@/lib/diagnostic-state";

export const runtime = "nodejs";

export async function GET() {
  const state = demoUnresolved();
  return NextResponse.json({
    ok: true,
    product: "diagnostic evidence state",
    not: "a diagnosis",
    claimed_error_elimination: false,
    device_claim: false,
    state,
  });
}