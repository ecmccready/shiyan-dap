import { NextRequest, NextResponse } from "next/server";
import { measure, nextAction, predictB, rows, writeRow } from "@/lib/b-loop";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    workspaceId: "WS-founder",
    product: "z from Self(). B is computed.",
    billed: false,
    price_usd_month: 10,
    calibration_usd: 1,
    independent_B: false,
    rows: rows(),
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const predicted = predictB({
    scale: Number(body.scale ?? 0.72),
    time: Number(body.time ?? 0.81),
    speed: Number(body.speed ?? 0.64),
    confidence: Number(body.confidence ?? 0.9),
  });
  const external = Boolean(body.external);
  const settled = false;
  const observed = external ? 1 : null;
  const error = measure(predicted.weight, observed);
  const action = nextAction({ external, settled, error });

  const row = writeRow({
    proposal: "B",
    workspaceId: "WS-founder",
    channelId: external ? "CH-b" : "CH-a",
    predicted,
    weight: predicted.weight,
    external_event: {
      price: external ? 1 : null,
      source: external ? "stripe" : "none",
      authoritative: external,
    },
    observed: { settled_in_shiyan: false },
    error,
    z: external
      ? "calibration pending webhook observed=1"
      : "provisional endogenous B",
    next_action: action,
    at: new Date().toISOString(),
  });

  return NextResponse.json({
    ok: true,
    settlement_written: false,
    row: row[0],
    rows: row,
  });
}