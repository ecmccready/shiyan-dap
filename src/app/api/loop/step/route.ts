import { NextResponse } from "next/server";
import {
  Namer,
  YAction,
  Y_ACTIONS,
  SAFETY_PACK,
  freshPlant,
  isLoopPlant,
  loadCase,
  stepLoop,
} from "@/lib/closed-loop";

export const runtime = "nodejs";

export async function GET() {
  const plant = freshPlant();
  return NextResponse.json({
    ok: true,
    loop: "A acts · B transitions · z is measured",
    plant,
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
  const caseId = payload.case_id;
  if (
    caseId !== undefined &&
    (typeof caseId !== "string" || !SAFETY_PACK.some((c) => c.id === caseId))
  ) {
    return NextResponse.json({ ok: false, error: "Unknown case_id" }, { status: 400 });
  }
  if (payload.reset !== undefined && typeof payload.reset !== "boolean") {
    return NextResponse.json({ ok: false, error: "reset must be a boolean" }, { status: 400 });
  }
  if (payload.plant !== undefined && !isLoopPlant(payload.plant)) {
    return NextResponse.json({ ok: false, error: "Invalid plant state" }, { status: 400 });
  }
  if (
    payload.y !== undefined &&
    (typeof payload.y !== "string" || !Y_ACTIONS.some((action) => action === payload.y))
  ) {
    return NextResponse.json({ ok: false, error: "Unsupported y action" }, { status: 400 });
  }
  const namers: Namer[] = ["grok_fast", "hy4_deep", "grok_bot", "operator"];
  if (
    payload.namer !== undefined &&
    (typeof payload.namer !== "string" || !namers.some((namer) => namer === payload.namer))
  ) {
    return NextResponse.json({ ok: false, error: "Unsupported namer" }, { status: 400 });
  }

  let plant = isLoopPlant(payload.plant)
    ? payload.plant
    : freshPlant(typeof caseId === "string" ? caseId : undefined);
  if (payload.reset === true) {
    plant = freshPlant(typeof caseId === "string" ? caseId : plant.case_id);
  }
  if (typeof caseId === "string" && caseId !== plant.case_id) {
    plant = loadCase(plant, caseId);
  }

  const y = payload.y as YAction | undefined;
  const namer: Namer =
    typeof payload.namer === "string"
      ? (payload.namer as Namer)
      : y
        ? "operator"
        : "grok_bot";

  const out = stepLoop(plant, { y, namer });
  return NextResponse.json({
    ok: true,
    loop: "one",
    named_by: namer,
    intelligence: "measured reduction of e on B",
    rec: out.rec,
    plant: out.plant,
  });
}
