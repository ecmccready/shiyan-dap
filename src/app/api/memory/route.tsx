import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const token = process.env.HF_TOKEN;
  const repo = process.env.HF_DATASET || "shiyan-dap/founder-z";

  if (!token) {
    return NextResponse.json({ ok: false, error: "HF_TOKEN missing" }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const event = {
    assetId: body.assetId || "cl_shiyan_yishu_001",
    title: body.title || "Shiyan Yishu — First Single",
    action: body.action || "acquire",
    at: new Date().toISOString(),
    source: "shiyan-dap.vercel.app/nfts",
  };

  const path = "events/" + event.assetId + ".json";
  const res = await fetch("https://huggingface.co/api/datasets/" + repo + "/commit/main", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      summary: event.action + " " + event.assetId,
      operations: [{ operation: "addOrUpdate", path, text: JSON.stringify(event, null, 2) }],
    }),
  });

  const text = await res.text();
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: text }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    url: "https://huggingface.co/datasets/" + repo + "/blob/main/" + path,
  });
}