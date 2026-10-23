import { NextResponse } from "next/server";
import { clearInventory } from "@/lib/marketplace";

export async function POST() {
  await clearInventory();
  return NextResponse.json({ success: true, message: "Inventory cleared" });
}