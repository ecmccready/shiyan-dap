import { NextResponse } from "next/server";

export async function GET() {
  const pack = {
    id: "pack_meta_1",
    hash: "c3d4e5f6a1b2",
    run_id: "run_20261106_metamorphic",
    predicted: 0.88,
    emergent: 0.847,
    phi: 0.1612,
    converged: true,
    created_at: new Date().toISOString(),
  };

  return NextResponse.json({ ok: true, pack });
}