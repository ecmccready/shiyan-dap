import { NextResponse } from "next/server";
import { publishProof } from "@/core/proof-publisher";
import { authenticateTenant } from "@/core/tenant-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = authenticateTenant(request);
  if (!auth.ok) return NextResponse.json({ code: auth.code, error: auth.error }, { status: auth.status });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (typeof body !== "object" || body === null || typeof (body as Record<string, unknown>).converged !== "boolean") {
    return NextResponse.json({ error: "Expected a metamorphic result with boolean converged" }, { status: 400 });
  }
  try {
    return NextResponse.json(publishProof(auth.tenant, body));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function GET() {
  return Response.json({
    route: "/api/v1/proof",
    method: "POST",
    body: "telemetry response object (converged, emergentState, review_flag, ...)",
    auth: "Authorization: Bearer <tenant API key> (required; stored in that tenant's store only)",
    description: "Hashes the telemetry result and stores it as an experience record. The proof is content-hashed and available for inspection."
  });
}
