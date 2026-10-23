import { NextResponse } from "next/server";
import {
  updateClusterStatus,
  type MarketplaceCluster,
} from "@/lib/marketplace";

const STATUSES: MarketplaceCluster["status"][] = [
  "available",
  "reserved",
  "settled",
];

function isStatus(value: string): value is MarketplaceCluster["status"] {
  return STATUSES.some((status) => status === value);
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Request body must be valid JSON" },
      { status: 400 }
    );
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json(
      { success: false, error: "Request body must be a JSON object" },
      { status: 400 }
    );
  }

  const payload = body as Record<string, unknown>;
  const { id, status } = payload;
  if (typeof id !== "string" || !id.trim() || typeof status !== "string" || !isStatus(status)) {
    return NextResponse.json(
      { success: false, error: "id and a valid status are required" },
      { status: 400 }
    );
  }

  try {
    const cluster = updateClusterStatus(id, status);
    if (!cluster) {
      return NextResponse.json(
        { success: false, error: "Marketplace cluster not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({
      success: true,
      cluster,
      layer: cluster.layer ?? null,
      payment: cluster.payment ?? null,
    });
  } catch (error) {
    console.error("Marketplace status update failed:", error);
    return NextResponse.json(
      { success: false, error: "Status update failed" },
      { status: 500 }
    );
  }
}