import { NextResponse } from "next/server";
import {
  LoopPlant,
  Namer,
  YAction,
  Y_ACTIONS,
  SAFETY_PACK,
  freshPlant,
  loadCase,
  stepLoop,
} from "@/lib/closed-loop";

export const runtime = "nodejs";

function isPlant(x: unknown): x is LoopPlant {
  if (typeof x !== "object" || x === null || Array.isArray(x)) return false;
  const p = x as Record<string, unknown>;
  if (
    !Number.isSafeInteger(p.t) ||
    (p.t as number) < 0 ||
    p.domain !== "safety" ||
    typeof p.case_id !== "string" ||
    !SAFETY_PACK.some((c) => c.id === p.case_id) ||
    typeof p.B !== "object" ||
    p.B === null ||
    Array.isArray(p.B) ||
    typeof p.M !== "object" ||
    p.M === null ||
    Array.isArray(p.M)
  ) {
    return false;
  }
  const b = p.B as Record<string, unknown>;
  const m = p.M as Record<string, unknown>;
  if (
    !["completeness", "contradiction", "missing", "uncertainty", "independent_check", "useful"]
      .every(
        (field) =>
          typeof b[field] === "number" &&
          Number.isFinite(b[field]) &&
          b[field] >= 0 &&
          b[field] <= 1
      ) ||
    (b.boundary_ready !== undefined &&
      (typeof b.boundary_ready !== "number" ||
        !Number.isFinite(b.boundary_ready) ||
        b.boundary_ready < 0 ||
        b.boundary_ready > 1)) ||
    !Array.isArray(m.ledger) ||
    m.ledger.length > 500 ||
    (m.last_z !== null && typeof m.last_z !== "string") ||
    typeof m.last_e !== "number" ||
    !Number.isFinite(m.last_e) ||
    (m.last_y !== null &&
      (typeof m.last_y !== "string" ||
        !Y_ACTIONS.some((action) => action === m.last_y))) ||
    (m.last_dominant !== null && typeof m.last_dominant !== "string")
  ) {
    return false;
  }
  return m.ledger.every((entry) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) return false;
    const row = entry as Record<string, unknown>;
    return (
      typeof row.t === "number" &&
      Number.isFinite(row.t) &&
      typeof row.reduced === "number" &&
      Number.isFinite(row.reduced) &&
      typeof row.dominant === "string" &&
      typeof row.y === "string" &&
      Y_ACTIONS.some((action) => action === row.y)
    );
  });
}

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
  if (payload.plant !== undefined && !isPlant(payload.plant)) {
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

  let plant = isPlant(payload.plant)
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
