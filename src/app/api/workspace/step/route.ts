import { NextResponse } from "next/server";
import { freshPlant } from "@/lib/closed-loop";

export const runtime = "nodejs";

function snapshotSelf() {
  const plant = freshPlant();
  return {
    ok: true,
    settlement_written: false,
    claimed_global_convergence: false,
    z: "A ready. B is the workbench, not a customer. z is measured after W(B,y).",
    last_z: plant.M.last_z,
    last_e: plant.M.last_e,
    ledger: plant.M.ledger,
  };
}

export async function GET() {
  return NextResponse.json(snapshotSelf());
}

export async function POST() {
  return NextResponse.json(snapshotSelf());
}
