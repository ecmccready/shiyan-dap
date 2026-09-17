import { NextResponse } from "next/server";
import { computeB, Self } from "@/lib/outcomes";
import { EVENT_EXPECT, scoreError } from "@/lib/validation";

const EVENTS = Object.keys(EVENT_EXPECT);

export async function GET() {
  const b = computeB();
  const self = Self();
  return NextResponse.json({
    ok: true,
    protocol: "slice_v9",
    sensor: true,
    names_b: false,
    level3: false,
    events: EVENTS,
    current_b: b.action,
    current_z: self.z,
    rule: "External reality measures the result. It does not determine B.",
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const external_event = String(body.external_event || "");
  const observed = String(body.observed || "");
  const asset_id = String(body.asset_id || "unspecified");

  if (!EVENTS.includes(external_event)) {
    return NextResponse.json({ ok: false, error: "unknown event" }, { status: 400 });
  }
  if (body.settled === true || body.write_settlement === true) {
    return NextResponse.json(
      { ok: false, error: "validation cannot write settlement" },
      { status: 409 }
    );
  }

  const expected = String(body.expected || EVENT_EXPECT[external_event as keyof typeof EVENT_EXPECT]);
  const before = computeB();
  const selfBefore = Self();
  const error = scoreError(expected, observed);
  const after = computeB();
  const selfAfter = Self();

  return NextResponse.json({
    ok: true,
    protocol: "slice_v9",
    record: {
      asset_id,
      action_id: before.action + ":" + external_event,
      b: before.action,
      expected,
      external_event,
      observed,
      error,
      z_before: selfBefore.z,
      z_after: selfAfter.z,
      next_b: after.action,
      source: "external-sensor",
      level3: false,
      settlement_written: false,
    },
    note: "Server names the comparison. Client /validation stores the trial. computeB still names B.",
  });
}