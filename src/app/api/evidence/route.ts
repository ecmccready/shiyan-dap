import { NextResponse } from "next/server";

export async function GET() {
  const evidence = {
    id: "ev_demo_1",
    run_id: "run_20261105_001",
    hash: "a1b2c3d4e5f6",
    baseline: "Current measured e and Φ",
    measured_e: 0.12,
    measured_phi: 0.87,
    verified: true,
    reviewed: false,
    created_at: new Date().toISOString(),
  };

  return NextResponse.json({ ok: true, evidence });
}