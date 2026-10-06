import { MCP_RESOURCES, MCP_TOOLS } from "@/lib/mcp/schema";
import { INDEPENDENT_B, coldOnIndependentB, sealedOnIndependentB } from "@/lib/mcp/independent-b";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(
    { ...INDEPENDENT_B, transport: "POST /api/b2", controller: "unchanged" },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const id = body.id ?? 1;
  const method = String(body.method ?? "");
  const params = body.params ?? {};
  if (method === "initialize") {
    return rpc(id, { protocolVersion: "2024-11-05", serverInfo: { name: "B2", version: "0.1.0" }, capabilities: { tools: {} } });
  }
  if (method === "tools/list") return rpc(id, { tools: MCP_TOOLS });
  if (method === "resources/list") return rpc(id, { resources: MCP_RESOURCES });
  if (method === "tools/call") {
    const name = String(params.name ?? "");
    const args = params.arguments ?? {};
    if (name === "run_sealed_sequence") return rpc(id, { structuredContent: sealedOnIndependentB(Number(args.cold_final_e)) });
    if (name === "score_error" || name === "observe") return rpc(id, { structuredContent: coldOnIndependentB() });
    const one = sealedOnIndependentB(0.42).steps.find((s) => s.y === name) ?? coldOnIndependentB();
    return rpc(id, { structuredContent: one });
  }
  return rpc(id, undefined, { code: -32601, message: `Unknown method ${method}` });
}

function rpc(id: number, result?: unknown, error?: { code: number; message: string }) {
  return Response.json(error ? { jsonrpc: "2.0", id, error } : { jsonrpc: "2.0", id, result }, {
    headers: { "Cache-Control": "no-store" },
  });
}