import { NextResponse } from "next/server";
import { publishProofTo } from "../../../../core/proof-publisher";
import { configuredExperienceStore } from "../../../../core/storage-provider";
import { authenticateTenant } from "../../../../core/tenant-auth";

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
  const storage = configuredExperienceStore(auth.tenant);
  if (!storage.ok) return NextResponse.json({ code: storage.code, error: storage.error }, { status: storage.status });
  try {
    return NextResponse.json(await publishProofTo(auth.tenant, body, storage.store));
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
