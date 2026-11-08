import { NextResponse } from "next/server";
import { parseTelemetryInput, runTelemetry } from "@/core/metamorphic-runtime";
import { publishProof } from "@/core/proof-publisher";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const input = parseTelemetryInput(body);
  if (!input) return NextResponse.json({ error: "Expected { predicted: number, observed: number, step?, phi?, seed? }" }, { status: 400 });
  const result = runTelemetry(input);
  const response: Record<string, unknown> = {
    emergentState: result.emergentState,
    converged: result.converged,
    frame: result.frame,
    seed: result.seed,
    proof: result.proof,
    review_flag: !result.converged ? "DRIFT_EXCEEDED" : null,
    note: !result.converged ? "High-entropy drift detected. Flag for human review." : null,
  };
  if ((body as Record<string, unknown>).auto_proof === true) {
    try {
      const proof = publishProof(response);
      response.experience_id = proof.experience_id;
      response.hash = proof.hash;
    } catch (error) {
      response.proof_error = error instanceof Error ? error.message : String(error);
    }
  }
  return NextResponse.json(response);
}

export async function GET() {
  return Response.json({
    route: "/api/v1/telemetry",
    method: "POST",
    body: { predicted: "number", observed: "number", step: "number?", phi: "number?", seed: "number?" },
    description: "Accepts predicted and observed values. The metamorphic engine evaluates Φ under drift.",
    auto_proof: "Include auto_proof: true in the POST body to hash and store the result as an experience record. The response then includes experience_id and hash."
  });
}
