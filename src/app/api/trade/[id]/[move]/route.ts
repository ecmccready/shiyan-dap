import { NextResponse } from "next/server";
import type { TradeRecord, TradeState } from "@/lib/trade";

const g = globalThis as unknown as { __shiyanTrades?: Map<string, TradeRecord> };

function store() {
  if (!g.__shiyanTrades) g.__shiyanTrades = new Map();
  return g.__shiyanTrades;
}

function closeOf(move: string): { state: TradeState; observed: 0 | 1 } | null {
  if (move === "accept") return { state: "accepted", observed: 1 };
  if (move === "reject") return { state: "rejected", observed: 0 };
  if (move === "timeout") return { state: "timeout", observed: 0 };
  return null;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string; move: string }> }
) {
  const { id, move } = await ctx.params;
  const closed = closeOf(move);
  if (!closed) {
    return NextResponse.json({ ok: false, error: "accept | reject | timeout" }, { status: 400 });
  }

  const existing = store().get(id);
  const row: TradeRecord = existing || {
    trade_id: id,
    asset_id: "trade_ref",
    offer: "OFFER",
    state: "offered",
    observed: 0,
    ping_id: null,
    source: "p2p-trade",
    level3: false,
    settlement_written: false,
    created_at: new Date().toISOString(),
    closed_at: null,
  };

  row.state = closed.state;
  row.observed = closed.observed;
  row.closed_at = new Date().toISOString();
  store().set(id, row);

  return NextResponse.json({
    ok: true,
    protocol: "slice_v11",
    trade_id: row.trade_id,
    state: row.state,
    observed: row.observed,
    source: "external",
    names_b: false,
    level3: false,
    settlement_written: false,
    note: "Binary close. computeB names next B after Learn reads the row.",
  });
}

export async function POST() {
  return NextResponse.json(
    { ok: false, error: "close is GET. Do not post B, z, or outcome." },
    { status: 405 }
  );
}