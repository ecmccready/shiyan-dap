import { NextResponse } from "next/server";
import { FOUNDER, SLEEP, nextState, type TradeEvent } from "@/lib/ledger";

const EVENTS: TradeEvent[] = ["LIST", "INITIATE_TRADE", "EXECUTE_SETTLEMENT", "ABORT"];

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
  const id = payload.id;
  const event = payload.event;
  if (
    typeof id !== "string" ||
    !id.trim() ||
    typeof event !== "string" ||
    (payload.settled !== undefined && typeof payload.settled !== "boolean")
  ) {
    return NextResponse.json(
      { ok: false, error: "Valid id, event, and settled values are required" },
      { status: 400 }
    );
  }
  const settled = payload.settled === true;

  if (!EVENTS.some((candidate) => candidate === event)) {
    return NextResponse.json({ ok: false, error: "unknown event" }, { status: 400 });
  }

  const asset = [FOUNDER, SLEEP].find((row) => row.id === id);
  if (!asset) {
    return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  }
  const selectedEvent = event as TradeEvent;

  if (selectedEvent === "EXECUTE_SETTLEMENT" && !settled) {
    return NextResponse.json(
      {
        ok: false,
        error: "settlement=1 only when Stripe reports settled",
        from: asset.state,
      },
      { status: 409 }
    );
  }

  const to = nextState(asset.state, selectedEvent);

  return NextResponse.json({
    ok: true,
    protocol: "slice_v6",
    id,
    event: selectedEvent,
    from: asset.state,
    to,
    note: "Client ledger applies the event. Server does not pretend the browser state changed.",
  });
}