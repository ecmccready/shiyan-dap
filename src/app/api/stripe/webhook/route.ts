import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import type { PingRecord } from "@/lib/ping";
import { measure, nextAction, predictB } from "@/lib/b-loop";
import { appendRow } from "@/lib/ledger-store";

export const runtime = "nodejs";

const g = globalThis as unknown as {
  __shiyanPings?: Map<string, PingRecord>;
};

function pings() {
  if (!g.__shiyanPings) g.__shiyanPings = new Map();
  return g.__shiyanPings;
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "/api/stripe/webhook",
    method: "POST only for Stripe events",
    settlement_written: false,
  });
}

export async function POST(req: NextRequest) {
  const key = process.env.STRIPE_SECRET_KEY;
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!key) {
    return NextResponse.json({ error: "STRIPE_SECRET_KEY missing" }, { status: 500 });
  }
  if (!secret) {
    return NextResponse.json({ error: "STRIPE_WEBHOOK_SECRET missing" }, { status: 500 });
  }

  const raw = await req.text();
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing stripe-signature" }, { status: 400 });
  }

  const stripe = new Stripe(key);
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, signature, secret);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "invalid signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({
      ok: true,
      ignored: event.type,
      settlement_written: false,
    });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const pingId =
    session.metadata?.pingId ||
    "PING-" + Date.now().toString(36) + "-stripe";
  const now = new Date().toISOString();
  const existing = pings().get(pingId);

  pings().set(pingId, {
    ping_id: pingId,
    action_id: "WAIT_EXTERNAL",
    asset_id: session.metadata?.assetId || existing?.asset_id || "stripe_event",
    observed: 1,
    source: "external",
    created_at: existing?.created_at || now,
    received_at: now,
  });

  const predicted = predictB({
    scale: 0.72,
    time: 0.81,
    speed: 0.64,
    confidence: 0.9,
  });
  const error = measure(predicted.weight, 1);

  await appendRow({
    proposal: "B",
    workspaceId: "WS-founder",
    channelId: "CH-b",
    predicted,
    weight: predicted.weight,
    external_event: {
      price: 1,
      source: "stripe",
      authoritative: true,
    },
    observed: { settled_in_shiyan: false, ping_id: pingId },
    error,
    z: "external B observed, settlement not written",
    next_action: nextAction({
      external: true,
      settled: false,
      error,
    }),
    at: now,
  });

  return NextResponse.json({
    ok: true,
    phase: "EXTERNAL_EVENT",
    ping_id: pingId,
    observed: 1,
    names_b: false,
    level3: false,
    settlement_written: false,
  });
}