import { NextRequest, NextResponse } from "next/server";
import { commercialStore, chainOf } from "@/lib/commercial";

export async function GET(req: NextRequest) {
  const offerId = req.nextUrl.searchParams.get("offerId");
  const rows = Array.from(commercialStore().values());
  const row = offerId ? commercialStore().get(offerId) : rows[0];
  return NextResponse.json({
    ok: true,
    protocol: "slice_v13",
    level3: false,
    settlement_written: false,
    row: row || null,
    chain: row ? chainOf(row) : [],
    rows,
    rule: "payment ≠ Shiyan state. webhook observes. computeB() names B later.",
  });
}