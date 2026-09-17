import { NextResponse } from "next/server";
import { computeB, Self, type OutcomeTransition } from "@/lib/outcomes";

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
  const body = await req.json().catch(() => ({}));
  const actor = body.actor === "B" ? "B" : body.actor === "A" ? "A" : null;
  const action = String(body.action || "");
  const outcomes = (body.outcomes || []) as OutcomeTransition[];

  if (!actor) {
    return NextResponse.json({ ok: false, error: "actor A or B" }, { status: 400 });
  }
  if (actor === "A" && !A_ACTIONS.includes(action)) {
    return NextResponse.json({ ok: false, error: "A may only propose" }, { status: 400 });
  }
  if (actor === "B" && !B_ACTIONS.includes(action)) {
    return NextResponse.json({ ok: false, error: "B may only respond" }, { status: 400 });
  }
  if (body.settled === true || action === "EXECUTE_SETTLEMENT") {
    return NextResponse.json(
      { ok: false, error: "A/B bench cannot write settlement" },
      { status: 409 }
    );
  }

  const self = Self(outcomes);
  const b = computeB(outcomes);

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