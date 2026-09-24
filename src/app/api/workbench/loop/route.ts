import { NextResponse } from "next/server";
import { ACTIONS, resetLoop, snapshot, step, type Action } from "@/lib/control-loop";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(snapshot());
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (body.reset === true) {
    resetLoop();
    return NextResponse.json({ reset: true, ...snapshot() });
  }
  const action =
    typeof body.action === "string" && ACTIONS.includes(body.action as Action)
      ? (body.action as Action)
      : undefined;
  const result = step(action);
  if (!result.ok) {
    return NextResponse.json({ ...snapshot(), ...result }, { status: 409 });
  }
  return NextResponse.json({ ...snapshot(), row: result.row });
}