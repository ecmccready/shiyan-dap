import { MCP_RESOURCES, MCP_TOOLS } from "@/lib/mcp/schema";
import { OPERATIONS_B, coldOnOperationsB, sealedOnOperationsB } from "@/lib/mcp/operations-b";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(
    { ...OPERATIONS_B, transport: "POST /api/b2", controller: "unchanged" },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const id = body.id ?? 1;
  const method = String(body.method ?? "");
  const params = body.params ?? {};
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
    const name = String(params.name ?? "");
    const args = params.arguments ?? {};
    if (name === "run_sealed_sequence") {
      return rpc(id, { structuredContent: sealedOnOperationsB(Number(args.cold_final_e)) });
    }
    if (name === "score_error" || name === "observe") {
      return rpc(id, { structuredContent: coldOnOperationsB() });
    }
    const one = sealedOnOperationsB(0.48).steps.find((s) => s.y === name) ?? coldOnOperationsB();
    return rpc(id, { structuredContent: one });
  }
  return rpc(id, undefined, { code: -32601, message: `Unknown method ${method}` });
}

function rpc(id: number, result?: unknown, error?: { code: number; message: string }) {
  return Response.json(error ? { jsonrpc: "2.0", id, error } : { jsonrpc: "2.0", id, result }, {
    headers: { "Cache-Control": "no-store" },
  });
}