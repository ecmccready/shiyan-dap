import { NextResponse } from "next/server";
import { tradeId, type TradeRecord } from "@/lib/trade";

const g = globalThis as unknown as { __shiyanTrades?: Map<string, TradeRecord> };

function store() {
  if (!g.__shiyanTrades) g.__shiyanTrades = new Map();
  return g.__shiyanTrades;
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    protocol: "slice_v11",
    names_b: false,
    level3: false,
    trades: Array.from(store().values()),
    rule: "accept → 1 · reject → 0 · timeout → Hold. Trade cannot write settlement.",
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (body.b || body.z || body.settled === true) {
    return NextResponse.json(
      { ok: false, error: "trade cannot specify B, z, or settlement" },
      { status: 409 }
    );
  }

  const row: TradeRecord = {
    trade_id: tradeId(),
    asset_id: String(body.asset_id || "trade_ref"),
    offer: String(body.offer || "OFFER"),
    state: "offered",
    observed: 0,
    ping_id: null,
    source: "p2p-trade",
    level3: false,
    settlement_written: false,
    created_at: new Date().toISOString(),
    closed_at: null,
  };
  store().set(row.trade_id, row);

  return NextResponse.json({
    ok: true,
    protocol: "slice_v11",
    trade: row,
    accept_url: "/api/trade/" + row.trade_id + "/accept",
    reject_url: "/api/trade/" + row.trade_id + "/reject",
  });
}