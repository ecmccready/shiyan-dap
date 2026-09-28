import { NextResponse } from "next/server";
import {
  LoopPlant,
  Namer,
  YAction,
  Y_ACTIONS,
  freshPlant,
  loadCase,
  stepLoop,
} from "@/lib/closed-loop";

export const runtime = "nodejs";

function isPlant(x: unknown): x is LoopPlant {
  if (!x || typeof x !== "object") return false;
  const p = x as LoopPlant;
  return typeof p.t === "number" && !!p.B && !!p.M;
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
  const body = (await req.json().catch(() => ({}))) as {
    plant?: LoopPlant;
    y?: string;
    namer?: Namer;
    case_id?: string;
    reset?: boolean;
  };

  let plant = isPlant(body.plant) ? body.plant : freshPlant(body.case_id);
  if (body.reset) plant = freshPlant(body.case_id || plant.case_id);
  if (body.case_id && body.case_id !== plant.case_id) {
    plant = loadCase(plant, body.case_id);
  }

  const y = Y_ACTIONS.includes(body.y as YAction)
    ? (body.y as YAction)
    : undefined;
  const namer: Namer =
    body.namer === "grok_fast" ||
    body.namer === "hy4_deep" ||
    body.namer === "grok_bot" ||
    body.namer === "operator"
      ? body.namer
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
