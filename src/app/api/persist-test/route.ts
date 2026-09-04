import { NextResponse } from "next/server";
import { persistPut, awsEnabled } from "@/lib/persist";

export async function GET() {
  const result = await persistPut("playlist.json", {
    probe: true,
    at: new Date().toISOString(),
  });
  return NextResponse.json({
    awsEnabled: awsEnabled(),
    result,
    bucket: process.env.AWS_S3_BUCKET || null,
    region: process.env.AWS_REGION || null,
    hasKey: Boolean(process.env.AWS_ACCESS_KEY_ID),
  });
}