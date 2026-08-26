import { NextResponse } from "next/server";
import { getPersistencePlan } from "@/lib/persistence";

export async function GET() {
  return NextResponse.json({
    success: true,
    plan: getPersistencePlan(),
  });
}