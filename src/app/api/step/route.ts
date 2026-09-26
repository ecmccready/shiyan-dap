import { NextResponse } from "next/server";
import { exploreThenAutonomous, step } from "@/lib/loop";
import { getPlant, resetPlant, setPlant } from "@/lib/store";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const op = body.op as string | undefined;

  if (op === "reset") {
    const plant = resetPlant(body.mode === "quality" ? "quality" : "scalar");
    return NextResponse.json({ plant });
  }

  if (op === "demo") {
    const { plant, ledger } = exploreThenAutonomous(12);
    setPlant(plant);
    return NextResponse.json({ plant, rec: ledger[ledger.length - 1], ledger });
  }

  if (op === "step") {
    const { plant, rec } = step(getPlant(), body.y);
    setPlant(plant);
    return NextResponse.json({ plant, rec });
  }

  return NextResponse.json({ plant: getPlant() });
}