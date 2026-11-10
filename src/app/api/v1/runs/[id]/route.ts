import { NextResponse } from "next/server";
import { RUN_CONTRACT_VERSION, verifyStandardRunAsync } from "../../../../../core/run-contract";
import { configuredExperienceStore } from "../../../../../core/storage-provider";
import { authenticateTenant } from "../../../../../core/tenant-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = authenticateTenant(request);
  if (!auth.ok) return NextResponse.json({ contract_version: RUN_CONTRACT_VERSION, code: auth.code, error: auth.error }, { status: auth.status });
  const { id } = await params;
  const storage = configuredExperienceStore(auth.tenant);
  if (!storage.ok) return NextResponse.json({ contract_version: RUN_CONTRACT_VERSION, code: storage.code, error: storage.error }, { status: storage.status });
  const outcome = await verifyStandardRunAsync(auth.tenant, id, storage.store);
  return NextResponse.json(outcome.body, { status: outcome.status });
}
