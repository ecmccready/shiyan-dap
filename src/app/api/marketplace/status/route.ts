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

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      id?: unknown;
      status?: unknown;
    };
    const { id, status } = body;

    if (
      typeof id !== "string" ||
      typeof status !== "string" ||
      !STATUSES.includes(status as MarketplaceCluster["status"])
    ) {
      return NextResponse.json(
        { success: false, error: "id and a valid status are required" },
        { status: 400 }
      );
    }

    const cluster = updateClusterStatus(id, status as MarketplaceCluster["status"]);

    return NextResponse.json({
      success: true,
      cluster,
      layer: cluster?.layer ?? null,
      payment: cluster?.payment ?? null,
    });
  } catch (error) {
    console.error("Marketplace status update failed:", error);
    return NextResponse.json(
      { success: false, error: "Status update failed" },
      { status: 500 }
    );
  }
}