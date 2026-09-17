import { NextResponse } from "next/server";
import { pingId, type PingRecord } from "@/lib/ping";

const g = globalThis as unknown as { __shiyanPings?: Map<string, PingRecord> };

function store() {
  if (!g.__shiyanPings) g.__shiyanPings = new Map();
  return g.__shiyanPings;
}

export async function GET() {
  const rows = Array.from(store().values());
  return NextResponse.json({
    ok: true,
    protocol: "slice_v10",
    names_b: false,
    level3: false,
    pings: rows,
    rule: "PING absent → observed 0. PING received → observed 1. Request cannot set B or z.",
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (body.b || body.z || body.outcome || body.settled === true) {
    return NextResponse.json(
      { ok: false, error: "ping cannot specify B, z, outcome, or settlement" },
      { status: 409 }
    );
  }

  const ping_id = pingId();
  const row: PingRecord = {
    ping_id,
    action_id: "WAIT_EXTERNAL",
    asset_id: String(body.asset_id || "ping_ref"),
    observed: 0,
    source: "external",
    created_at: new Date().toISOString(),
    received_at: null,
  };
  store().set(ping_id, row);

  return NextResponse.json({
    ok: true,
    protocol: "slice_v10",
    ping: row,
    receive_url: "/api/ping/" + ping_id,
    note: "Open receive_url from another device. That hit is the observation.",
    level3: false,
  });
}