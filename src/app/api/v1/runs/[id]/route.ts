import { NextResponse } from "next/server";
import { verifyStandardRun } from "@/core/run-contract";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const outcome = verifyStandardRun(id);
  return NextResponse.json(outcome.body, { status: outcome.status });
}
