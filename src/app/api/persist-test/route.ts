import { NextResponse } from "next/server";
import { awsEnabled } from "@/lib/persist";

export async function GET() {
  return NextResponse.json({
    success: true,
    backend: awsEnabled() ? "s3" : "local",
  });
}