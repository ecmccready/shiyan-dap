import { NextResponse } from "next/server";
import { getMarketplaceInventory } from "@/lib/marketplace";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const domain = searchParams.get("domain") || undefined;

  const inventory = getMarketplaceInventory(domain || undefined);

  return NextResponse.json({
    success: true,
    count: inventory.length,
    inventory,
  });
}