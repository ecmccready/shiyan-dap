import { MCP_RESOURCES, MCP_TOOLS } from "@/lib/mcp/schema";
import { OPERATIONS_B, coldOnOperationsB, sealedOnOperationsB } from "@/lib/mcp/operations-b";
import { parseJsonRpcRequest, parseToolCall } from "@/lib/mcp/route-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(
    { ...OPERATIONS_B, transport: "POST /api/b2", controller: "unchanged" },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return rpc(null, undefined, { code: -32700, message: "Parse error" }, 400);
  }
  const request = parseJsonRpcRequest(body);
  if (!request) {
    return rpc(null, undefined, { code: -32600, message: "Invalid request" }, 400);
  }
  const { id, method, params } = request;
  if (method === "initialize") {
    return rpc(id, {
      protocolVersion: "2024-11-05",
      serverInfo: { name: "B2-operations", version: "0.2.0" },
      capabilities: { tools: {}, resources: {} },
    });
  }
  if (method === "tools/list") return rpc(id, { tools: MCP_TOOLS });
  if (method === "resources/list") return rpc(id, { resources: MCP_RESOURCES });
  if (method === "tools/call") {
    const call = parseToolCall(params);
    if (!call) return rpc(id, undefined, { code: -32602, message: "Invalid tool arguments" });
    const { name, arguments: args } = call;
    if (
      !MCP_TOOLS.some((tool) => tool.name === name) &&
      name !== "observe"
    ) {
      return rpc(id, undefined, { code: -32602, message: `Unknown tool ${name}` });
    }
    if (name === "run_sealed_sequence") {
      if (
        typeof args.cold_final_e !== "number" ||
        !Number.isFinite(args.cold_final_e) ||
        args.cold_final_e < 0
      ) {
        return rpc(id, undefined, {
          code: -32602,
          message: "cold_final_e must be a finite non-negative number",
        });
      }
      return rpc(id, { structuredContent: sealedOnOperationsB(args.cold_final_e) });
    }
    if (name === "score_error" || name === "observe") {
      return rpc(id, { structuredContent: coldOnOperationsB() });
    }
    const one = sealedOnOperationsB(0.48).steps.find((s) => s.y === name);
    if (!one && name !== "observe") {
      return rpc(id, undefined, { code: -32602, message: `Unsupported tool ${name}` });
    }
    return rpc(id, { structuredContent: one ?? coldOnOperationsB() });
  }
  return rpc(id, undefined, { code: -32601, message: `Unknown method ${method}` });
}

function rpc(
  id: string | number | null,
  result?: unknown,
  error?: { code: number; message: string },
  status = 200
) {
  return Response.json(
    error ? { jsonrpc: "2.0", id, error } : { jsonrpc: "2.0", id, result },
    {
      status,
      headers: { "Cache-Control": "no-store" },
    }
  );
}