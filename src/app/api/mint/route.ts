import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const assetId = body.assetId || "cl_shiyan_yishu_001";
  const standard = body.standard || "erc721";

  const record = {
    assetId,
    title: body.title || "Shiyan catalog",
    action: "mint_queued",
    standard,
    chain: "none",
    tx: null,
    from: "ECMcCready",
    to: "This session",
    state: "queued",
    paid: false,
    at: new Date().toISOString(),
    source: "shiyan-dap.vercel.app/tokens",
  };

  const token = process.env.HF_TOKEN;
  const repo = process.env.HF_DATASET || "shiyan-dap/founder-z";

  if (token) {
    const path = "mints/" + assetId + ".json";
    await fetch("https://huggingface.co/api/datasets/" + repo + "/commit/main", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: "queue " + standard + " " + assetId,
        operations: [{ operation: "addOrUpdate", path, text: JSON.stringify(record, null, 2) }],
      }),
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, record });
}