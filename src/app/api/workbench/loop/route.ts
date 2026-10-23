import { NextResponse } from "next/server";
import { ACTIONS, resetLoop, snapshot, step, type Action } from "@/lib/control-loop";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(snapshot());
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
  if (payload.reset !== undefined && typeof payload.reset !== "boolean") {
    return NextResponse.json(
      { ok: false, error: "reset must be a boolean" },
      { status: 400 }
    );
  }
  if (payload.reset === true) {
    resetLoop();
    return NextResponse.json({ reset: true, ...snapshot() });
  }
  let action: Action | undefined;
  if (payload.action !== undefined) {
    if (
      typeof payload.action !== "string" ||
      !ACTIONS.some((candidate) => candidate === payload.action)
    ) {
      return NextResponse.json(
        { ok: false, error: "action is not supported" },
        { status: 400 }
      );
    }
    action = payload.action as Action;
  }
  const result = step(action);
  if (!result.ok) {
    return NextResponse.json({ ...snapshot(), ...result }, { status: 409 });
  }
  return NextResponse.json({ ...snapshot(), row: result.row });
}