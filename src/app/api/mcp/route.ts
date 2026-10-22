import { handleMcp } from "@/lib/mcp/handler";
import { adaptiveEpsBase } from "@/lib/level4/roe-adaptive";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || body.jsonrpc !== "2.0" || !body.method) {
    return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "invalid request" } }, { status: 400 });
  }
  // ROE slice 2 (opt-in): precompute the adaptive ε_base only when request_independent_check asks for it.
  const p = body.method === "tools/call" ? body.params : null;
  const a = p?.arguments;
  if (p?.name === "request_independent_check" && a && a.adaptive === true && (a.mode === "normalized" || a.mode === "rms")) {
    const adaptive = await adaptiveEpsBase(typeof a.run_id === "string" ? a.run_id : null);
    return Response.json(handleMcp(body, { adaptive }));
  }
  return Response.json(handleMcp(body));
}

export async function GET() {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      send("endpoint", { contract: "aethel.loop.v1", post: "/api/mcp" });
      send("scored", { resource: "aethel://diagnostic_cases", note: "recorded phi is not a live score" });
      const timer = setInterval(() => send("ping", { t: Date.now() }), 15000);
      const close = () => { clearInterval(timer); try { controller.close(); } catch { /* already closed */ } };
      setTimeout(close, 60000);
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}