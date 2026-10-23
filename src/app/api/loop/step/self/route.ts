import { NextResponse } from "next/server";
import { SelfFromApproved } from "@/lib/approved-experience";
import { saveRun, type PersistedRun } from "@/lib/run-store";
import {
  freshPlant,
  isLoopPlant,
  Y_ACTIONS,
  Self,
  stepLoop,
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
  } catch (error) {
    console.error("Self experience persistence failed; using process memory:", error);
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
  } catch (error) {
    console.error("Approved experience read failed; using process memory:", error);
    const ids = memoryByClient.get(client_id) ?? [];
    return ids
      .map((id) => memory.get(id))
      .filter((run): run is PersistedRun => run !== undefined);
  }
}

export async function POST(req: Request) {
  try {
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
    if (
      payload.which !== undefined &&
      payload.which !== "self" &&
      payload.which !== "experience"
    ) {
      return NextResponse.json(
        { ok: false, error: "which must be self or experience" },
        { status: 400 }
      );
    }
    if (payload.plant !== undefined && !isLoopPlant(payload.plant)) {
      return NextResponse.json({ ok: false, error: "Invalid plant state" }, { status: 400 });
    }
    const plant = isLoopPlant(payload.plant)
      ? payload.plant
      : freshPlant();
    const identifiers = [
      ["client_id", payload.client_id],
      ["workspace_id", payload.workspace_id],
      ["workflow_version", payload.workflow_version],
      ["model_version", payload.model_version],
    ] as const;
    for (const [field, value] of identifiers) {
      if (
        value !== undefined &&
        (typeof value !== "string" ||
          value.length < 1 ||
          value.length > 80 ||
          /[\u0000-\u001f]/.test(value) ||
          ((field === "client_id" || field === "workspace_id") &&
            !/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(value)))
      ) {
        return NextResponse.json(
          { ok: false, error: `${field} is invalid` },
          { status: 400 }
        );
      }
    }
    const client_id =
      typeof payload.client_id === "string" ? payload.client_id : plant.case_id;
    const workspace_id =
      typeof payload.workspace_id === "string" ? payload.workspace_id : "default-workspace";
    const workflow_version =
      typeof payload.workflow_version === "string" ? payload.workflow_version : "1.0";
    const model_version =
      typeof payload.model_version === "string" ? payload.model_version : "grok-bot";
    const which = payload.which === "self" ? "self" : "experience";

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
          (r) =>
            r.approved &&
            r.safety_passed &&
            (r.phi ?? 0) > 0 &&
            Y_ACTIONS.some((action) => action === r.y)
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
      const approvedY = Y_ACTIONS.find((action) => action === approved.y);
      if (!approvedY) {
        return NextResponse.json(
          { ok: false, error: "Approved experience contains an unsupported action" },
          { status: 502 }
        );
      }
      y = approvedY;
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
    console.error("Self experience step failed:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}