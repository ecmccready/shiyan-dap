import { NextRequest, NextResponse } from "next/server";

function ndjsonLine(key: string, value: unknown) {
  return JSON.stringify({ key, value }) + "\n";
}

export async function POST(req: NextRequest) {
  const token = process.env.HF_TOKEN;
  const repo = process.env.HF_DATASET || "shiyan-dap/founder-z";

  if (!token) {
    return NextResponse.json({ ok: false, error: "HF_TOKEN missing" }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const kind = body.kind === "outcome" ? "outcome" : "event";
  const id = String(body.measurement_id || body.assetId || body.asset_id || "latest");

  const payload = {
    kind,
    assetId: body.asset_id || body.assetId || "",
    action: body.action || "",
    agent: body.agent || "",
    simulated: body.simulated === true,
    y_before: body.y_before || null,
    y_after: body.y_after || null,
    z: body.z || "",
    at: body.timestamp || new Date().toISOString(),
  };

  const file =
    kind === "outcome" ? "outcome-" + id + ".json" : "events/" + (payload.assetId || "latest") + ".json";

  const files = [
    { path: file, content: JSON.stringify(payload, null, 2) },
    {
      path: "latest-z.json",
      content: JSON.stringify(
        { z: payload.z, action: payload.action, agent: payload.agent, at: payload.at },
        null,
        2
      ),
    },
  ];

  let ndjson = ndjsonLine("header", { summary: payload.action + " " + id });
  for (const item of files) {
    ndjson += ndjsonLine("file", {
      path: item.path,
      encoding: "base64",
      content: Buffer.from(item.content, "utf8").toString("base64"),
    });
  }

  const res = await fetch("https://huggingface.co/api/datasets/" + repo + "/commit/main", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/x-ndjson",
    },
    body: ndjson,
  });

  const text = await res.text();
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: text }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    url: "https://huggingface.co/datasets/" + repo + "/blob/main/" + file,
    latest: "https://huggingface.co/datasets/" + repo + "/blob/main/latest-z.json",
    hub: text,
  });
}