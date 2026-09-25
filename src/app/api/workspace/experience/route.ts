import { NextResponse } from "next/server";
import { snapshot, tick } from "@/lib/loop";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(snapshot());
}

export async function POST() {
  return NextResponse.json(tick());
}