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

// Process-local fallback when KV is not configured
const memory = new Map<string, PersistedRun>();
const memoryByClient = new Map<string, string[]>();

async function safeSave(run: PersistedRun): Promise<"kv" | "memory"> {
  try {
    await saveRun(run);
    return "kv";
  } catch {
    memory.set(run.id, run);
    const list = memoryByClient.get(run.client_id) ?? [];
    memoryByClient.set(run.client_id, [run.id, ...list].slice(0, 48));
    return "memory";
  }
}

async function safeList(client_id: string): Promise<PersistedRun[]> {
  try {
    const { listClientRuns } = await import("@/lib/run-store");
    return await listClientRuns(client_id);
  } catch {
    const ids = memoryByClient.get(client_id) ?? [];
    return ids.map((id) => memory.get(id)).filter(Boolean) as PersistedRun[];
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const which: "self" | "experience" = body.which === "self" ? "self" : "experience";
    const plant: LoopPlant = body.plant ?? freshPlant();

    const client_id = String(body.client_id || plant.case_id || "default-client");
    const workspace_id = String(body.workspace_id || "default-workspace");
    const workflow_version = String(body.workflow_version || "1.0");
    const model_version = String(body.model_version || "grok-bot");

    let y: YAction;
    let source: string;
    let justification: string | undefined;

    if (which === "self") {
      y = Self(plant);
      source = "self";
    } else {
      let approved: { y: string; source: string; justification?: string };
      try {
        approved = await SelfFromApproved(
          client_id,
          workflow_version,
          model_version,
          "observe"
        );
      } catch {
        const runs = await safeList(client_id);
        const eligible = runs.filter(
          (r) => r.approved && r.safety_passed && (r.phi ?? 0) > 0
        );
        if (eligible.length === 0) {
          approved = { y: "observe", source: "fallback" };
        } else {
          const best = eligible.reduce((a, b) =>
            (a.phi ?? 0) > (b.phi ?? 0) ? a : b
          );
          approved = { y: best.y, source: "approved", justification: best.id };
        }
      }
      y = approved.y as YAction;
      source = approved.source;
      justification = approved.justification;
    }

    const { plant: nextPlant, rec } = stepLoop(plant, {
      y,
      which: which === "self" ? "self" : "experience",
    });

    let persisted: { id: string; phi: number; store: string } | null = null;
    if (rec.reduced > 0) {
      const run: PersistedRun = {
        id: `run_${plant.case_id}_${nextPlant.t}_${Date.now()}`,
        workspace_id,
        client_id,
        input_reference: plant.case_id,
        workflow_version,
        model_version,
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
      const store = await safeSave(run);
      persisted = { id: run.id, phi: run.phi!, store };
    }

    return NextResponse.json({
      ok: true,
      source,
      justification,
      rec,
      plant: nextPlant,
      persisted,
      note: persisted
        ? `Persisted to ${persisted.store}`
        : "Not persisted (reduced ≤ 0)",
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}