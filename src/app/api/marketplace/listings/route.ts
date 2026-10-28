import { NextResponse } from "next/server";
import { readExperienceStore } from "@/lib/level4/experience-store";
import { buildIndex } from "@/lib/marketplace/listings";

/**
 * GET /api/marketplace/listings: read-only, public JSON index of verified sequences (Φ > 0) for peers and
 * models. Built from the same experience records the Adaptive Domains dropdown ranks, through the pure
 * buildIndex(). No auth, no writes, GET only. Reuse is `reuse_href` → /workbench/autonomous?reuse=<run_id>,
 * which still applies the run page's replay vet and falls back with a reason. Each listing also carries the
 * display-only peer_ready / peer_status / peer_handoff_path (relative); the index adds peer_ready_count and
 * peers_note (this node's own index only).
 */
export async function GET() {
  try {
    const list = await readExperienceStore();
    if (list === null) {
      return NextResponse.json({ error: "Experience store is not configured" }, { status: 503 });
    }
    return NextResponse.json(buildIndex(list), {
      headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" },
    });
  } catch {
    return NextResponse.json({ error: "Experience store is unavailable" }, { status: 502 });
  }
}
