import { NextRequest, NextResponse } from "next/server";
import { buildAnchorPayload, NullAnchorAdapter } from "@/lib/level4/anchor";
import { readExperienceStore } from "@/lib/level4/experience-store";

/**
 * GET /api/level4/anchor?run_id=... — read-only, stateless, public.
 * Returns the prepared anchor payload and Merkle root for a run's tensor
 * commitments. Nothing is submitted on-chain (NullAnchorAdapter dry run).
 */
export async function GET(req: NextRequest) {
  const run_id = req.nextUrl.searchParams.get("run_id");
  if (!run_id) return NextResponse.json({ error: "run_id required" }, { status: 400 });
  const entries = (await readExperienceStore().catch(() => null)) ?? [];
  const built = buildAnchorPayload(entries, run_id);
  const dry = await new NullAnchorAdapter().submit();
  return NextResponse.json({ ...built, ...dry, directional: true });
}
