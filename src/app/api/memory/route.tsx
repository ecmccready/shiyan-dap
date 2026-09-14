import { NextRequest, NextResponse } from "next/server";

async function upload(repo: string, token: string, path: string, body: unknown) {
  const res = await fetch(
    "https://huggingface.co/api/datasets/" + repo + "/upload/main/" + path,
    {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body, null, 2),
    }
  );
  const text = await res.text();
  return { ok: res.ok, status: res.status, text, path };
}

export async function POST(req: NextRequest) {
  const token = process.env.HF_TOKEN;
  const repo = process.env.HF_DATASET || "shiyan-dap/founder-z";

  if (!token) {
    return NextResponse.json({ ok: false, error: "HF_TOKEN missing" }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const kind = body.kind === "outcome" ? "outcome" : "event";
  const id = body.measurement_id || body.assetId || body.asset_id || "latest";

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

  const wrote = await upload(repo, token, file, payload);
  const latest = await upload(repo, token, "latest-z.json", {
    z: payload.z,
    action: payload.action,
    agent: payload.agent,
    at: payload.at,
  });

  if (!wrote.ok) {
    return NextResponse.json({ ok: false, error: wrote.text || wrote.status }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    url: "https://huggingface.co/datasets/" + repo + "/blob/main/" + file,
    latest: latest.ok
      ? "https://huggingface.co/datasets/" + repo + "/blob/main/latest-z.json"
      : latest.text,
  });
}