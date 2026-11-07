import { NextResponse } from "next/server";
import { parseTelemetryInput, runTelemetry } from "@/core/metamorphic-runtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const input = parseTelemetryInput(body);
  if (!input) return NextResponse.json({ error: "Expected { predicted: number, observed: number, step?, phi?, seed? }" }, { status: 400 });
  const result = runTelemetry(input);
  return NextResponse.json({
    emergentState: result.emergentState,
    converged: result.converged,
    frame: result.frame,
    seed: result.seed,
    review_flag: !result.converged ? "DRIFT_EXCEEDED" : null,
    note: !result.converged ? "High-entropy drift detected. Flag for human review." : null,
  });
}

export async function GET() {
  return Response.json({
    route: "/api/v1/telemetry",
    method: "POST",
    body: { predicted: "number", observed: "number", step: "number?", phi: "number?", seed: "number?" },
    description: "Accepts predicted and observed values. The metamorphic engine evaluates Φ under drift."
  });
}
