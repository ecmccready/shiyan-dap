/**
 * Workbench B as an MCP server.
 * Tools and resources only. No Controller A. No Self(). No ledger of prior Runs.
 */
import { W, measureZ, gateOf, type PlantB, type YAction } from "../closed-loop";
import { defaultError, safetySchema } from "../engine";
import {
  AETHEL_CONTRACT,
  MCP_PROTOCOL,
  MCP_RESOURCES,
  MCP_TOOLS,
  RECORDED_PACKS,
  SEALED_SEQUENCE,
  phiOf,
  isErrorWin,
  type LoopObservation,
  type YName,
} from "./schema";

type Rpc = { jsonrpc: "2.0"; id?: number | string; method: string; params?: Record<string, unknown> };

const plants = new Map<string, PlantB>();

function fresh(caseId: string): PlantB {
  return {
    case_id: caseId,
    completeness: 0.42,
    contradiction: 0.18,
    missing: 0.35,
    uncertainty: 0.22,
    independent_check: 0.1,
    useful: 0.4,
    boundary_ready: 0,
  };
}

function plant(caseId = "mcp-pack"): PlantB {
  const hit = plants.get(caseId);
  if (hit) return hit;
  const next = fresh(caseId);
  plants.set(caseId, next);
  return next;
}

function observe(B: PlantB, y: YName, coldFinal?: number): LoopObservation {
  const before = defaultError(B, safetySchema);
  const next = W(B, y as YAction);
  const meas = measureZ(next, y as YAction);
  const eNext = defaultError(next, safetySchema);
  plants.set(B.case_id, next);
  const phi = typeof coldFinal === "number" ? phiOf(coldFinal, eNext) : null;
  return {
    y,
    z: meas.z,
    z_value: meas.z_value,
    e: before,
    e_next: eNext,
    delta_e: Number((before - eNext).toFixed(3)),
    gate: gateOf(next),
    phi,
  };
}

function toolResult(data: unknown) {
  return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: data, isError: false };
}

export function handleMcp(msg: Rpc): unknown {
  const id = msg.id ?? null;
  const ok = (result: unknown) => ({ jsonrpc: "2.0", id, result });
  const fail = (code: number, message: string) => ({ jsonrpc: "2.0", id, error: { code, message } });

  if (msg.method === "initialize") {
    return ok({
      protocolVersion: MCP_PROTOCOL,
      capabilities: { tools: {}, resources: {} },
      serverInfo: { name: "aethel-workbench-b", version: AETHEL_CONTRACT },
      instructions: "Workbench B. Tools return z and e. Self() is not here. A tie on final e is not a win.",
    });
  }
  if (msg.method === "notifications/initialized" || msg.method === "initialized") return ok({});
  if (msg.method === "ping") return ok({});
  if (msg.method === "tools/list") return ok({ tools: MCP_TOOLS });
  if (msg.method === "resources/list") return ok({ resources: MCP_RESOURCES });

  if (msg.method === "resources/read") {
    const uri = String(msg.params?.uri || "");
    if (uri === "aethel://reference_truth") {
      return ok({
        contents: [{
          uri,
          mimeType: "application/json",
          text: JSON.stringify({
            uri,
            domain: safetySchema.domain,
            required_fields: safetySchema.required_fields,
            reference_gate: safetySchema.reference_gate,
            rule: "final e is the win. a shorter path is a note. a tie is not a win.",
          }),
        }],
      });
    }
    if (uri === "aethel://diagnostic_cases") {
      return ok({
        contents: [{
          uri,
          mimeType: "application/json",
          text: JSON.stringify({
            recorded_on: "2026-10-03",
            commit: "cbb3391e",
            packs: RECORDED_PACKS,
            live_plant: "not these numbers. live e comes from tools/call.",
          }),
        }],
      });
    }
    return fail(-32002, "resource not found");
  }

  if (msg.method === "tools/call") {
    const name = String(msg.params?.name || "");
    const args = (msg.params?.arguments || {}) as { case_id?: string; cold_final_e?: number };
    const caseId = args.case_id || "mcp-pack";
    if (name === "score_error") {
      const B = plant(caseId);
      return ok(toolResult({ case_id: caseId, e: defaultError(B, safetySchema), gate: gateOf(B) }));
    }
    if (name === "run_sealed_sequence") {
      if (typeof args.cold_final_e !== "number") return fail(-32602, "cold_final_e is required. the server does not read M.");
      plants.set(caseId, fresh(caseId));
      const steps = SEALED_SEQUENCE.map((y) => observe(plant(caseId), y, args.cold_final_e));
      const finalE = steps[steps.length - 1]?.e_next ?? null;
      const phi = typeof finalE === "number" ? phiOf(args.cold_final_e, finalE) : 0;
      return ok(toolResult({
        sequence: SEALED_SEQUENCE,
        outside_self: true,
        steps,
        final_e: finalE,
        phi,
        better: isErrorWin(phi),
        mark_changes_e: false,
        seal_is_the_drop: true,
      }));
    }
    if (SEALED_SEQUENCE.includes(name as YName) || name === "hold") {
      return ok(toolResult(observe(plant(caseId), name as YName, args.cold_final_e)));
    }
    return fail(-32601, "tool not found");
  }

  return fail(-32601, "method not found");
}

export function resetPlant(caseId = "mcp-pack") {
  plants.set(caseId, fresh(caseId));
}