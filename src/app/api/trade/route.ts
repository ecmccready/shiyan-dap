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
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Request body must be valid JSON" },
      { status: 400 }
    );
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json(
      { ok: false, error: "Request body must be a JSON object" },
      { status: 400 }
    );
  }

  const payload = body as Record<string, unknown>;
  if ("b" in payload || "z" in payload || "settled" in payload) {
    return NextResponse.json(
      { ok: false, error: "trade cannot specify B, z, or settlement" },
      { status: 409 }
    );
  }
  const assetId = payload.asset_id ?? "trade_ref";
  const offer = payload.offer ?? "OFFER";
  if (
    typeof assetId !== "string" ||
    !assetId.trim() ||
    assetId.length > 128 ||
    typeof offer !== "string" ||
    !offer.trim() ||
    offer.length > 200
  ) {
    return NextResponse.json(
      { ok: false, error: "asset_id and offer must be non-empty strings" },
      { status: 400 }
    );
  }

  const row: TradeRecord = {
    trade_id: tradeId(),
    asset_id: assetId.trim(),
    offer: offer.trim(),
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