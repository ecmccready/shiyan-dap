import { NextResponse } from "next/server";
import { runGrokBot } from "@/lib/grok-bot";
import { licensePlaylist } from "@/lib/playlist";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const message = String(body.message || "");
  const domain = body.domain || "music";
  const mode = body.mode === "live" ? "live" : "simulated";

  const bot = await runGrokBot(
    {
      message,
      domain,
      clusterId: body.clusterId,
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