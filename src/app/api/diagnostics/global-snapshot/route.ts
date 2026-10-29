import { NextResponse } from "next/server";
import { readExperienceStore } from "@/lib/level4/experience-store";
import { buildGlobalSnapshot } from "@/lib/diagnostics/global-snapshot";

/**
 * GET /api/diagnostics/global-snapshot: read-only aethel.global.snapshot.v1 built from the same experience records as
 * /workbench/global (pure buildGlobalSnapshot, same classification). No auth, no writes, GET only (other methods are
 * not exported, so 405). 503 when the experience store is not configured, same as /api/marketplace/listings.
 * Status only: not attestation and not a clinical diagnosis.
 */
export async function GET() {
  try {
    const list = await readExperienceStore();
    if (list === null) {
      return NextResponse.json({ error: "Experience store is not configured" }, { status: 503 });
    }
    return NextResponse.json(buildGlobalSnapshot(list, new Date().toISOString()), {
      headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" },
    });
  } catch {
    return NextResponse.json({ error: "Experience store is unavailable" }, { status: 502 });
  }
}
