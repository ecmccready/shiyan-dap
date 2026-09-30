import { NextResponse } from "next/server";
import { DEFAULT_POLICY, shouldFreeze } from "@/workbench/safety/gatekeeper";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const iterations = Number(body.iterations ?? 0);
  const delta_e = Number(body.delta_e ?? 0);
  const last_reduction = Number(body.last_reduction ?? 0);
  const decision = shouldFreeze({ iterations, delta_e, last_reduction, policy: DEFAULT_POLICY });
  return NextResponse.json({
    ok: true,
    handshake: decision.freeze ? "FROZEN" : body.gate || "HOLD",
    ...decision,
    policy: DEFAULT_POLICY,
    limitation: "Evidence gate / audit freeze only. Not a diagnosis.",
  });
}