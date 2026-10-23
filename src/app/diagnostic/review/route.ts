import { NextResponse } from "next/server";
import { DEFAULT_POLICY, shouldFreeze } from "@/workbench/safety/gatekeeper";

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
  const iterations = payload.iterations ?? 0;
  const delta_e = payload.delta_e ?? 0;
  const last_reduction = payload.last_reduction ?? 0;
  const gates = ["HOLD", "CLINICIAN_REVIEW", "ESCALATE"];
  if (
    typeof iterations !== "number" ||
    !Number.isSafeInteger(iterations) ||
    iterations < 0 ||
    iterations > 1_000_000 ||
    typeof delta_e !== "number" ||
    !Number.isFinite(delta_e) ||
    typeof last_reduction !== "number" ||
    !Number.isFinite(last_reduction) ||
    (payload.gate !== undefined &&
      (typeof payload.gate !== "string" || !gates.includes(payload.gate)))
  ) {
    return NextResponse.json(
      { ok: false, error: "Invalid iterations, delta_e, last_reduction, or gate" },
      { status: 400 }
    );
  }
  const decision = shouldFreeze({ iterations, delta_e, last_reduction, policy: DEFAULT_POLICY });
  return NextResponse.json({
    ok: true,
    handshake: decision.freeze ? "FROZEN" : payload.gate ?? "HOLD",
    ...decision,
    policy: DEFAULT_POLICY,
    limitation: "Evidence gate / audit freeze only. Not a diagnosis.",
  });
}