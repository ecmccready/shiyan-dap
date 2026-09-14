import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const token = process.env.HF_TOKEN;
  const repo = process.env.HF_DATASET || "shiyan-dap/founder-z";

  if (!token) {
    return NextResponse.json({ ok: false, error: "HF_TOKEN missing" }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const kind = body.kind === "outcome" ? "outcome" : "event";

  const event = {
    kind,
    assetId: body.asset_id || body.assetId || "cl_shiyan_yishu_001",
    title: body.title || "",
    action: body.action || "acquire",
    agent: body.agent || "",
    cluster: body.cluster || "",
    simulated: body.simulated === true,
    y_before: body.y_before || null,
    y_after: body.y_after || null,
    transition_class: body.transition_class || "",
    z: body.z || "",
    at: body.timestamp || new Date().toISOString(),
    source: "shiyan-dap.vercel.app",
  };

  const id = body.measurement_id || event.assetId;
  const path =
    kind === "outcome"
      ? "outcomes/" + id + ".json"
      : "events/" + event.assetId + ".json";

  const operations = [
    { operation: "addOrUpdate", path, text: JSON.stringify(event, null, 2) },
  ];

  if (kind === "outcome" && event.z) {
    operations.push({
      operation: "addOrUpdate",
      path: "outcomes/latest-z.json",
      text: JSON.stringify(
        { z: event.z, action: event.action, agent: event.agent, at: event.at },
        null,
        2
      ),
    });
  }

  const res = await fetch("https://huggingface.co/api/datasets/" + repo + "/commit/main", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      summary: event.action + " " + id,
      operations,
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