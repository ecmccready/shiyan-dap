import { NextResponse } from "next/server";
import { exploreThenAutonomous, step } from "@/lib/loop";
import { getPlant, resetPlant, setPlant } from "@/lib/store";
import { ACTIONS_1D, QUALITY_ACTIONS } from "@/lib/types";
import { parseQualityY, parseScalarY } from "@/lib/self";

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
  const op = payload.op;

  if (op === "reset") {
    const mode = payload.mode ?? "scalar";
    if (mode !== "quality" && mode !== "scalar") {
      return NextResponse.json(
        { ok: false, error: "mode must be scalar or quality" },
        { status: 400 }
      );
    }
    const plant = resetPlant(mode);
    return NextResponse.json({ plant });
  }

  if (op === "demo") {
    if (payload.y !== undefined || payload.mode !== undefined) {
      return NextResponse.json(
        { ok: false, error: "demo does not accept y or mode" },
        { status: 400 }
      );
    }
    const { plant, ledger } = exploreThenAutonomous(12);
    setPlant(plant);
    return NextResponse.json({ plant, rec: ledger[ledger.length - 1], ledger });
  }

  if (op === "step") {
    const plant = getPlant();
    let y: string | undefined;
    if (payload.y !== undefined) {
      if (typeof payload.y !== "string" && typeof payload.y !== "number") {
        return NextResponse.json(
          { ok: false, error: "y must be a supported action" },
          { status: 400 }
        );
      }
      y = String(payload.y);
      const valid = plant.mode === "scalar"
        ? parseScalarY(y) !== null
        : parseQualityY(y) !== null;
      if (!valid) {
        return NextResponse.json(
          {
            ok: false,
            error: `y must be a valid ${plant.mode} action`,
            actions: plant.mode === "scalar" ? ACTIONS_1D : QUALITY_ACTIONS,
          },
          { status: 400 }
        );
      }
    }
    const { plant: nextPlant, rec } = step(plant, y);
    setPlant(nextPlant);
    return NextResponse.json({ plant: nextPlant, rec });
  }

  return NextResponse.json(
    { ok: false, error: "op must be reset, demo, or step" },
    { status: 400 }
  );
}