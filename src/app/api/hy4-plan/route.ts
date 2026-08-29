import { NextResponse } from "next/server";
import { getHy4Plan } from "@/lib/hy4-plan";

export async function GET() {
  return NextResponse.json({
    success: true,
    plan: getHy4Plan(),
  });
}