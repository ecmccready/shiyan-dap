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
  if (!run_id || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(run_id)) {
    return NextResponse.json({ error: "Valid run_id required" }, { status: 400 });
  }
  let entries;
  try {
    entries = await readExperienceStore();
  } catch (error) {
    console.error("Level 4 anchor read failed:", error);
    return NextResponse.json(
      { error: "Unable to read experience records" },
      { status: 502 }
    );
  }
  if (entries === null) {
    return NextResponse.json(
      { error: "Experience store is not configured" },
      { status: 503 }
    );
  }
  try {
    const built = buildAnchorPayload(entries, run_id);
    const dry = await new NullAnchorAdapter().submit();
    return NextResponse.json({ ...built, ...dry, directional: true });
  } catch (error) {
    console.error("Level 4 anchor payload generation failed:", error);
    return NextResponse.json(
      { error: "Unable to build anchor payload" },
      { status: 502 }
    );
  }
}
