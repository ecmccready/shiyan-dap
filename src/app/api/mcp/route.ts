import { handleMcp } from "@/lib/mcp/handler";
import { adaptiveEpsBase } from "@/lib/level4/roe-adaptive";
import { parseJsonRpcRequest, parseToolCall } from "@/lib/mcp/route-request";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return rpcError(null, -32700, "Parse error", 400);
  }
  const request = parseJsonRpcRequest(body);
  if (!request) {
    return rpcError(null, -32600, "Invalid request", 400);
  }

  const normalizedRequest = {
    jsonrpc: "2.0" as const,
    id: request.id,
    method: request.method,
    params: request.params,
  };
  if (request.method === "tools/call") {
    const call = parseToolCall(request.params);
    if (!call) return rpcError(request.id, -32602, "Invalid tool arguments");
    const args = call.arguments;
    if (
      (args.holographic !== undefined && typeof args.holographic !== "boolean") ||
      (args.adaptive !== undefined && typeof args.adaptive !== "boolean") ||
      (args.mode !== undefined &&
        args.mode !== "normalized" &&
        args.mode !== "rms") ||
      ["baseEpsilon", "eps_base"].some(
        (field) =>
          args[field] !== undefined &&
          (typeof args[field] !== "number" ||
            !Number.isFinite(args[field]) ||
            args[field] < 0)
      ) ||
      (args.cold_final_e !== undefined &&
        (typeof args.cold_final_e !== "number" ||
          !Number.isFinite(args.cold_final_e) ||
          args.cold_final_e < 0)) ||
      (args.run_id !== undefined &&
        (typeof args.run_id !== "string" ||
          !/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(args.run_id)))
    ) {
      return rpcError(request.id, -32602, "Invalid tool arguments");
    }

    if (
      call.name === "request_independent_check" &&
      args.adaptive === true &&
      (args.mode === "normalized" || args.mode === "rms")
    ) {
      const adaptive = await adaptiveEpsBase(
        typeof args.run_id === "string" ? args.run_id : null
      );
      return Response.json(handleMcp(normalizedRequest, { adaptive }));
    }
  }
  return Response.json(handleMcp(normalizedRequest));
}

function rpcError(
  id: string | number | null,
  code: number,
  message: string,
  status = 200
) {
  return Response.json(
    { jsonrpc: "2.0", id, error: { code, message } },
    { status }
  );
}

export async function GET() {
  const encoder = new TextEncoder();
  let interval: ReturnType<typeof setInterval> | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let closed = false;

  const cleanup = () => {
    if (interval !== undefined) clearInterval(interval);
    if (timeout !== undefined) clearTimeout(timeout);
  };

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      const close = () => {
        if (closed) return;
        closed = true;
        cleanup();
        controller.close();
      };
      send("endpoint", { contract: "aethel.loop.v1", post: "/api/mcp" });
      send("scored", { resource: "aethel://diagnostic_cases", note: "recorded phi is not a live score" });
      interval = setInterval(() => send("ping", { t: Date.now() }), 15000);
      timeout = setTimeout(close, 60000);
    },
    cancel() {
      if (closed) return;
      closed = true;
      cleanup();
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}