/**
 * Controller A as an MCP host.
 * Talks JSON-RPC only. Does not import Workbench B.
 * Self() names one next y by asking B to score a prediction.
 * It does not read prior Runs. Reuse is a separate policy.
 */
import { SEALED_SEQUENCE, phiOf, isErrorWin, type YName, type LoopObservation } from "./schema";

export type RpcTransport = (method: string, params?: Record<string, unknown>) => Promise<unknown>;

export function httpTransport(url: string): RpcTransport {
  let id = 0;
  return async (method, params) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
    });
    const body = await res.json();
    if (body.error) throw new Error(body.error.message);
    return body.result;
  };
}

type ToolPayload = { structuredContent?: LoopObservation & { steps?: LoopObservation[]; phi?: number; better?: boolean; final_e?: number } };

export async function connectHost(rpc: RpcTransport) {
  await rpc("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "aethel-controller-a", version: "0.1.0" },
  });
  const tools = await rpc("tools/list");
  const resources = await rpc("resources/list");
  return { tools, resources };
}

/** One action. Not a memory read. */
export async function act(rpc: RpcTransport, y: YName, caseId = "mcp-pack", coldFinal?: number) {
  const result = await rpc("tools/call", { name: y, arguments: { case_id: caseId, cold_final_e: coldFinal } }) as ToolPayload;
  return result.structuredContent;
}

/**
 * Reuse policy, outside Self().
 * Cold final e is passed in. The host does not fetch it from M.
 */
export async function reuseOutsideSelf(rpc: RpcTransport, coldFinalE: number, caseId = "mcp-pack") {
  const result = await rpc("tools/call", {
    name: "run_sealed_sequence",
    arguments: { case_id: caseId, cold_final_e: coldFinalE },
  }) as ToolPayload;
  const body = result.structuredContent;
  const phi = typeof body?.phi === "number" ? body.phi : phiOf(coldFinalE, body?.final_e ?? coldFinalE);
  return { sequence: SEALED_SEQUENCE, ...body, phi, better: isErrorWin(phi) };
}