import { NextResponse } from "next/server";
import { buildPeerRegistry } from "@/lib/marketplace/peers";

/**
 * GET /api/marketplace/peers: read-only, public JSON of the static peer registry (schema aethel.marketplace.peers.v1).
 * This node first (absolute URLs from the request origin), then clearly labelled placeholders with no endpoints.
 * No store access (works without Upstash), no writes, no auth, GET only (other methods are not exported, so 405),
 * and the server never fetches any peer endpoint. Nothing here is discovery, verification or cross-node trust.
 */
export async function GET(request: Request) {
  let origin: string | null = null;
  try { origin = new URL(request.url).origin; } catch { origin = null; }
  return NextResponse.json(buildPeerRegistry(origin), {
    headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" },
  });
}
