import { NextResponse } from "next/server";
import { connectReference, listReferences } from "@/core/github-reference";
import { authenticateTenant } from "@/core/tenant-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Body: { repo: "owner/name", ref?: "main" }. Only repos allowlisted to the caller's tenant are read. */
export async function POST(request: Request) {
  const auth = authenticateTenant(request);
  if (!auth.ok) return NextResponse.json({ code: auth.code, error: auth.error }, { status: auth.status });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ code: "INVALID_JSON", error: "Invalid JSON" }, { status: 400 }); }
  const outcome = await connectReference(auth.tenant, body);
  return NextResponse.json(outcome.body, { status: outcome.status });
}

export async function GET(request: Request) {
  const auth = authenticateTenant(request);
  if (!auth.ok) return NextResponse.json({ code: auth.code, error: auth.error }, { status: auth.status });
  return NextResponse.json({ references: listReferences(auth.tenant) });
}
