import { NextResponse } from "next/server";
import type { PingRecord } from "@/lib/ping";

const g = globalThis as unknown as { __shiyanPings?: Map<string, PingRecord> };

function store() {
  if (!g.__shiyanPings) g.__shiyanPings = new Map();
  return g.__shiyanPings;
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const existing = store().get(id);
  const row: PingRecord = existing || {
    ping_id: id,
    action_id: "WAIT_EXTERNAL",
    asset_id: "ping_ref",
    observed: 0,
    source: "external",
    created_at: new Date().toISOString(),
    received_at: null,
  };

  row.observed = 1;
  row.received_at = new Date().toISOString();
  row.source = "external";
  store().set(id, row);

  return NextResponse.json({
    ok: true,
    protocol: "slice_v10",
    ping_id: row.ping_id,
    action_id: row.action_id,
    timestamp: row.received_at,
    source: "external",
    observed: 1,
    names_b: false,
    level3: false,
    settlement_written: false,
    note: "Server set observed=1 because the request arrived. B and z are not in this body.",
  });
}

export async function POST() {
  return NextResponse.json(
    { ok: false, error: "receive is GET only. Do not post B, z, or outcome." },
    { status: 405 }
  );
}