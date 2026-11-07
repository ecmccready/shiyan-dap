import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { HFMemory, writeExperience } from "@/core/hf-memory";
import type { ExperienceRecord } from "@/core/interfaces";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const r = value as Record<string, unknown>;
    return `{${Object.keys(r).filter((k) => r[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonical(r[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (typeof body !== "object" || body === null || typeof (body as Record<string, unknown>).converged !== "boolean") {
    return NextResponse.json({ error: "Expected a metamorphic result with boolean converged" }, { status: 400 });
  }
  const b = body as Record<string, any>;
  const hash = createHash("sha256").update(canonical(body)).digest("hex");
  const timestamp = new Date().toISOString();
  const experience_id = `telemetry-${Date.now()}-${hash.slice(0, 12)}`;
  const frame = b.frame ?? {};
  const emergent = b.emergentState ?? {};
  const predicted = num(frame.predictedValue ?? emergent.predictedValue, 0);
  const observed = num(frame.observedValue, num(emergent.observedValue, 0));
  const record: ExperienceRecord = {
    experience_id,
    repo: "shiyan-dap",
    commit_sha: process.env.VERCEL_GIT_COMMIT_SHA || "local",
    goal: "Live telemetry metamorphic check",
    baseline: `predicted=${predicted}`,
    action: "MetamorphicEngine.entangle",
    predicted_outcome: String(predicted),
    observed_outcome: String(num(emergent.observedValue, observed)),
    delta_e: Math.abs(predicted - observed),
    metrics: { phi: num(emergent.phi, 0), step: num(emergent.step, 0) },
    verification: { replay_verdict: "SKIP", verifier_version: "telemetry-proof-v1" },
    metamorphic: {
      seed: num(b.seed, 0),
      transformation: "stochastic-drift",
      expected_relation: "phi stable within 0.05",
      result: b.converged ? "converged" : "diverged",
      converged: b.converged,
    },
    provenance: { source: "api/v1/proof", run_id: hash, timestamp },
    reuse_eligibility: false,
    z_next_action: b.converged ? "continue" : "investigate drift",
    revision: 1,
  };
  try {
    const root = process.env.AETHEL_HF_MEMORY_ROOT || (process.env.VERCEL ? "/tmp/aethel-hf-memory" : undefined);
    const saved = writeExperience(record, new HFMemory(root));
    return NextResponse.json({ experience_id: saved.experience_id, hash });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function GET() {
  return Response.json({
    route: "/api/v1/proof",
    method: "POST",
    body: { result: "metamorphic result object" },
    description: "Hashes the telemetry result and stores it as an experience record. The proof is content-hashed and available for inspection."
  });
}
