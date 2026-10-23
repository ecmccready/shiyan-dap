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

  const message = "message" in body ? body.message : "";
  const domain = "domain" in body ? body.domain : "music";
  const clusterId = "clusterId" in body ? body.clusterId : undefined;
  if (
    typeof message !== "string" ||
    typeof domain !== "string" ||
    (clusterId !== undefined && typeof clusterId !== "string")
  ) {
    return NextResponse.json(
      { success: false, error: "message, domain, and clusterId have invalid types" },
      { status: 400 }
    );
  }
  const mode = "mode" in body && body.mode === "live" ? "live" : "simulated";

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