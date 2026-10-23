import { NextResponse } from "next/server";
import { runGrokBot } from "@/lib/grok-bot";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Request body must be valid JSON" },
      { status: 400 }
    );
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json(
      { success: false, error: "Request body must be a JSON object" },
      { status: 400 }
    );
  }

  const payload = body as Record<string, unknown>;
  const message = payload.message === undefined ? "" : payload.message;
  const domain = payload.domain === undefined ? "music" : payload.domain;
  const clusterId = payload.clusterId;
  const mode = payload.mode === undefined ? "simulated" : payload.mode;
  if (
    typeof message !== "string" ||
    message.length > 4000 ||
    typeof domain !== "string" ||
    domain.length < 1 ||
    domain.length > 100 ||
    (clusterId !== undefined &&
      (typeof clusterId !== "string" ||
        clusterId.length < 1 ||
        clusterId.length > 120)) ||
    (mode !== "simulated" && mode !== "live")
  ) {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid message, domain, clusterId, or mode value",
      },
      { status: 400 }
    );
  }
  if (mode === "live") {
    return NextResponse.json(
      { success: false, error: "Live bot mode is not available on this endpoint" },
      { status: 503 }
    );
  }

  const bot = await runGrokBot(
    {
      message,
      domain,
      clusterId,
    },
    "simulated"
  );

  return NextResponse.json({
    ...bot,
    license: null,
  });
}
