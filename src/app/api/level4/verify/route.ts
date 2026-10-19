import { NextRequest, NextResponse } from "next/server";
import { verifyRun } from "@/lib/level4/verify-run";
import { readExperienceStore } from "@/lib/level4/experience-store";

/**
 * GET /api/level4/verify?run_id=... — public, read-only.
 * Independently recomputes a stored run (e per step, Φ, eligibility, tensor
 * commitments, anchor Merkle root) and returns PASS/FAIL/SKIP per check.
 */
export async function GET(req: NextRequest) {
  const run_id = req.nextUrl.searchParams.get("run_id");
  if (!run_id) return NextResponse.json({ error: "run_id required" }, { status: 400 });
  const entries = await readExperienceStore().catch(() => null);
  if (entries == null) return NextResponse.json({ run_id, verdict: "UNAVAILABLE", error: "experience store not configured", checks: [] });
  return NextResponse.json(verifyRun(entries, run_id));
}
