import { NextResponse } from "next/server";
import { FOUNDER, SLEEP, nextState, type TradeEvent } from "@/lib/ledger";

const EVENTS: TradeEvent[] = ["LIST", "INITIATE_TRADE", "EXECUTE_SETTLEMENT", "ABORT"];

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const id = String(body.id || "");
  const event = body.event as TradeEvent;
  const settled = body.settled === true;

  if (!EVENTS.includes(event)) {
    return NextResponse.json({ ok: false, error: "unknown event" }, { status: 400 });
  }

  const asset = [FOUNDER, SLEEP].find((row) => row.id === id);
  if (!asset) {
    return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  }

  if (event === "EXECUTE_SETTLEMENT" && !settled) {
    return NextResponse.json(
      {
        ok: false,
        error: "settlement=1 only when Stripe reports settled",
        from: asset.state,
      },
      { status: 409 }
    );
  }

  const to = nextState(asset.state, event);

  return NextResponse.json({
    ok: true,
    protocol: "slice_v6",
    id,
    event,
    from: asset.state,
    to,
    note: "Client ledger applies the event. Server does not pretend the browser state changed.",
  });
}