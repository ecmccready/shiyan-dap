import { NextResponse } from "next/server";
import { step } from "@/lib/self";
import {
  experiences,
  nextTask,
  skills,
  weakestTask,
  writeExperience,
} from "@/lib/experience";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    claimed_self_improving_ai: false,
    claimed_weight_training: false,
    skills: skills(),
    weakest: weakestTask(),
    experiences: experiences(),
  });
}

export async function POST() {
  const out = step();
  const rec = out.rec;
  const task = nextTask(rec.B_t.s, rec.z);
  const exp = writeExperience({
    state: rec.B_t.s,
    task,
    action: rec.y,
    predicted: rec.hatDelta,
    observed: rec.delta,
    error: rec.e,
    utility: -Math.abs(rec.e),
    value: rec.V,
    outcome: rec.z,
    successful: Math.abs(rec.e) < 0.02,
    next_state: rec.B_next.s,
    at: new Date().toISOString(),
  });
  return NextResponse.json({
    ok: true,
    claimed_self_improving_ai: false,
    next_task: nextTask(rec.B_next.s, rec.z),
    weakest: weakestTask(),
    rec,
    latest: exp[0],
    skills: skills(),
  });
}