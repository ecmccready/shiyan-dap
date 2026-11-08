import { NextResponse } from "next/server";
import { readReference } from "@/core/github-reference";
import { authenticateTenant } from "@/core/tenant-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = authenticateTenant(request);
  if (!auth.ok) return NextResponse.json({ code: auth.code, error: auth.error }, { status: auth.status });
  const { id } = await params;
  const ref = readReference(auth.tenant, id);
  if (!ref) return NextResponse.json({ code: "NOT_FOUND", error: "No reference with this id" }, { status: 404 });
  return NextResponse.json({ reference_id: id, snapshot_sha256: ref.snapshot_sha256, snapshot: ref.snapshot });
}
