import { NextResponse } from "next/server";
import { safetyFlywheel } from "@/product/proof";
import { SAFETY_PACK } from "@/lib/closed-loop";

export async function GET() {
  const wheel = safetyFlywheel("grok_bot");
  const experience = wheel.reuse.map((arm, i) => ({
    id: arm.artifact.run_id,
    workbench: "Safety",
    case_id: arm.case_id,
    title: arm.title,
    y: arm.artifact.action_y,
    z: arm.artifact.result_z,
    e: arm.artifact.e,
    delta_e: arm.delta_e,
    cold_delta_e: wheel.cold[i].delta_e,
    used_prior: arm.used_prior,
    beats_cold: arm.delta_e > wheel.cold[i].delta_e,
    reference: arm.artifact.reference,
  }));
  return NextResponse.json({
    success: true,
    product: "Aethel Node Experience",
    workbench: "Safety",
    count: experience.length,
    beats_cold: experience.some((e) => e.beats_cold),
    experience,
    contract: {
      inputs: ["case_id", "reference pack"],
      actions: ["observe", "complete_field", "fill_missing", "resolve_contradiction", "request_independent_check", "hold", "escalate", "clinician_review"],
      measure: "z after y; e is distance to the reference gate; delta-e is e0 - e1",
    },
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (body.role === "developer") {
    const name = String(body.name || "").slice(0, 80);
    const reference = String(body.reference || "").slice(0, 180);
    if (!name || !reference) {
      return NextResponse.json({ error: "name and reference required" }, { status: 400 });
    }
    return NextResponse.json({
      accepted: true,
      executed: false,
      workbench: {
        id: `wb_${Date.now().toString(36)}`,
        name,
        reference,
        status: "registered_not_run",
      },
      note: "Registration is a contract. A new B runs only after a reference pack and a measurement exist.",
    });
  }
  const caseId = String(body.case_id || "case-incomplete-pack");
  const known = SAFETY_PACK.some((c) => c.id === caseId);
  if (!known) {
    return NextResponse.json({ error: "unknown Safety case" }, { status: 400 });
  }
  const wheel = safetyFlywheel("grok_bot");
  const arm = wheel.reuse.find((a) => a.case_id === caseId) ?? wheel.reuse[0];
  return NextResponse.json({
    job: arm.artifact,
    beats_cold: arm.delta_e > (wheel.cold.find((a) => a.case_id === caseId)?.delta_e ?? 0),
  });
}