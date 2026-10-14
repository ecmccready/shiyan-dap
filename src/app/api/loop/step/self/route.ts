import { NextResponse } from "next/server";
import { SelfFromApproved } from "@/lib/approved-experience";
import { saveRun, type PersistedRun } from "@/lib/run-store";
import {
  freshPlant,
  Self,
  stepLoop,
  type LoopPlant,
  type YAction,
} from "@/lib/closed-loop";

export const runtime = "nodejs";

const DEMO_CLIENT = "demo-client";
const DEMO_WORKFLOW = "1.0";
const DEMO_MODEL = "grok-bot";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const which: "self" | "experience" = body.which === "self" ? "self" : "experience";
  const plant: LoopPlant = body.plant ?? freshPlant();

  // Name y
  let y: YAction;
  let source: string;
  let justification: string | undefined;

  if (which === "self") {
    y = Self(plant);
    source = "self";
  } else {
    const approved = await SelfFromApproved(
      DEMO_CLIENT,
      DEMO_WORKFLOW,
      DEMO_MODEL,
      "observe"
    );
    y = approved.y as YAction;
    source = approved.source;
    justification = approved.justification;
  }

  // Execute one step
  const { plant: nextPlant, rec } = stepLoop(plant, { y, which: which === "self" ? "self" : "experience" });

  // Persist only when error falls (Φ > 0)
  let persisted: PersistedRun | null = null;
  if (rec.reduced > 0) {
    persisted = {
      id: `run_${plant.case_id}_${nextPlant.t}_${Date.now()}`,
      workspace_id: "demo-workspace",
      client_id: DEMO_CLIENT,
      input_reference: plant.case_id,
      workflow_version: DEMO_WORKFLOW,
      model_version: DEMO_MODEL,
      y: rec.y,
      z: rec.z,
      e: rec.e_next,
      e_baseline: rec.e,
      phi: rec.reduced,
      safety_passed: true,
      provenance: ["closed-loop", source],
      created_at: new Date().toISOString(),
      approved: true,
    };
    await saveRun(persisted);
  }

  return NextResponse.json({
    ok: true,
    source,
    justification,
    rec,
    plant: nextPlant,
    persisted: persisted ? { id: persisted.id, phi: persisted.phi } : null,
    note: "Only Runs with reduced > 0 are persisted and become eligible for future SelfFromApproved calls.",
  });
}