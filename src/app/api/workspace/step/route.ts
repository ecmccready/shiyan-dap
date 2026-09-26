import { NextResponse } from "next/server";

export const runtime = "nodejs";

function snapshotSelf() {
  return {
    ok: true,
    settlement_written: false,
    claimed_global_convergence: false,
    z: "A ready. B is the workbench, not a customer.",
    ledger: [],
  };
}

function step() {
  return snapshotSelf();
}

export async function GET() {
  return NextResponse.json(snapshotSelf());
}

export async function POST() {
  const out = step();
  return NextResponse.json({
    ok: true,
    settlement_written: false,
    claimed_global_convergence: false,
    ...out,
  });
}