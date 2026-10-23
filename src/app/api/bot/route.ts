import { NextResponse } from "next/server";
import { runGrokBot } from "@/lib/grok-bot";
import { licensePlaylist } from "@/lib/playlist";

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

  const bot = await runGrokBot(
    {
      message,
      domain,
      clusterId,
    },
    mode
  );

  const lower = message.toLowerCase();
  let license = null;
  if (lower.includes("license") || lower.includes("sync") || lower.includes("game studio")) {
    const use = lower.includes("game") ? "game" : lower.includes("label") ? "label" : "sync";
    license = licensePlaylist("pl_label_001", use);
    bot.reply = `${bot.reply} License issued for ${use}. Attribution stays on the engine.`;
  }

  return NextResponse.json({
    ...bot,
    license: license?.playlist || null,
  });
}