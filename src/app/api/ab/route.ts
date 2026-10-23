import { NextResponse } from "next/server";
import { computeB, isOutcomeTransition, Self } from "@/lib/outcomes";

const A_ACTIONS = ["PROPOSE", "LIST_INTENT", "REQUEST_RESPONSE"];
const B_ACTIONS = ["ACK", "DECLINE", "REQUEST", "RETURN"];

export async function GET() {
  return NextResponse.json({
    ok: true,
    protocol: "slice_v7",
    a: A_ACTIONS,
    b: B_ACTIONS,
    rule: "B cannot write settlement. Self() names z.",
    level3: false,
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
  const actor = payload.actor === "A" || payload.actor === "B" ? payload.actor : null;
  const action = payload.action;
  const outcomes = payload.outcomes === undefined ? [] : payload.outcomes;

  if (!actor) {
    return NextResponse.json({ ok: false, error: "actor A or B" }, { status: 400 });
  }
  if (typeof action !== "string") {
    return NextResponse.json({ ok: false, error: "action must be a string" }, { status: 400 });
  }
  if (actor === "A" && !A_ACTIONS.includes(action)) {
    return NextResponse.json({ ok: false, error: "A may only propose" }, { status: 400 });
  }
  if (actor === "B" && !B_ACTIONS.includes(action)) {
    return NextResponse.json({ ok: false, error: "B may only respond" }, { status: 400 });
  }
  if (payload.settled === true || action === "EXECUTE_SETTLEMENT") {
    return NextResponse.json(
      { ok: false, error: "A/B bench cannot write settlement" },
      { status: 409 }
    );
  }
  if (payload.settled !== undefined && typeof payload.settled !== "boolean") {
    return NextResponse.json(
      { ok: false, error: "settled must be a boolean" },
      { status: 400 }
    );
  }
  if (
    !Array.isArray(outcomes) ||
    outcomes.length > 500 ||
    !outcomes.every(isOutcomeTransition)
  ) {
    return NextResponse.json(
      { ok: false, error: "outcomes must contain valid transition records" },
      { status: 400 }
    );
  }

  const validOutcomes = outcomes.filter(isOutcomeTransition);
  const self = Self(validOutcomes);
  const b = computeB(validOutcomes);

  return NextResponse.json({
    ok: true,
    protocol: "slice_v7",
    actor,
    action,
    settlement_written: false,
    self,
    computed_b: b,
    z: self.z,
    note: "Server names the exchange. Client /ab writes the OutcomeTransition.",
    level3: false,
  });
}