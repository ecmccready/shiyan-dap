import { NextRequest, NextResponse } from "next/server";
import { requireLevel4Write } from "@/lib/level4/write-auth";

function ndjsonLine(key: string, value: unknown) {
  return JSON.stringify({ key, value }) + "\n";
}

export async function GET() {
  const repo = process.env.HF_DATASET || "shiyan-dap/founder-z";
  const token = process.env.HF_TOKEN;
  try {
    const res = await fetch(
      "https://huggingface.co/datasets/" + repo + "/resolve/main/latest-z.json",
      {
        cache: "no-store",
        headers: token ? { Authorization: "Bearer " + token } : {},
      }
    );
    if (!res.ok) {
      console.error("Memory read failed with status:", res.status);
      return NextResponse.json(
        { ok: false, error: "Memory service unavailable" },
        { status: 502 }
      );
    }
    const data: unknown = await res.json();
    if (typeof data !== "object" || data === null || Array.isArray(data)) {
      console.error("Memory service returned an invalid record");
      return NextResponse.json(
        { ok: false, error: "Memory service returned invalid data" },
        { status: 502 }
      );
    }
    return NextResponse.json({ ok: true, ...data });
  } catch (error) {
    console.error("Memory read request failed:", error);
    return NextResponse.json(
      { ok: false, error: "Memory service unavailable" },
      { status: 502 }
    );
  }
}

export async function POST(req: NextRequest) {
  const denied = requireLevel4Write(req);
  if (denied) return denied;
  const token = process.env.HF_TOKEN;
  const repo = process.env.HF_DATASET || "shiyan-dap/founder-z";

  if (!token) {
    return NextResponse.json({ ok: false, error: "HF_TOKEN missing" }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Request body must be valid JSON" },
      { status: 400 }
    );
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json(
      { ok: false, error: "Request body must be a JSON object" },
      { status: 400 }
    );
  }

  const input = body as Record<string, unknown>;
  const kind = input.kind ?? "event";
  const rawId = input.measurement_id ?? input.assetId ?? input.asset_id ?? "latest";
  const assetId = input.asset_id ?? input.assetId ?? "";
  const action = input.action ?? "";
  const agent = input.agent ?? "";
  const z = input.z ?? "";
  const timestamp = input.timestamp ?? new Date().toISOString();
  if (
    (kind !== "event" && kind !== "outcome" && kind !== "validation") ||
    typeof rawId !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(rawId) ||
    typeof assetId !== "string" ||
    (assetId !== "" && !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(assetId)) ||
    typeof action !== "string" ||
    action.length > 200 ||
    typeof agent !== "string" ||
    agent.length > 200 ||
    typeof z !== "string" ||
    z.length > 2000 ||
    typeof timestamp !== "string" ||
    timestamp.length > 100 ||
    !Number.isFinite(Date.parse(timestamp)) ||
    (input.simulated !== undefined && typeof input.simulated !== "boolean") ||
    (input.y_before !== undefined &&
      (typeof input.y_before !== "object" ||
        input.y_before === null ||
        Array.isArray(input.y_before))) ||
    (input.y_after !== undefined &&
      (typeof input.y_after !== "object" ||
        input.y_after === null ||
        Array.isArray(input.y_after)))
  ) {
    return NextResponse.json(
      { ok: false, error: "Invalid memory record fields" },
      { status: 400 }
    );
  }

  const payload = {
    kind,
    assetId,
    action,
    agent,
    simulated: input.simulated === true,
    y_before: input.y_before ?? null,
    y_after: input.y_after ?? null,
    z,
    at: timestamp,
  };

  const file =
    kind === "outcome" || kind === "validation"
      ? "outcome-" + rawId + ".json"
      : "events/" + (payload.assetId || "latest") + ".json";

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

  let ndjson = ndjsonLine("header", { summary: payload.action + " " + rawId });
  for (const item of files) {
    ndjson += ndjsonLine("file", {
      path: item.path,
      encoding: "base64",
      content: Buffer.from(item.content, "utf8").toString("base64"),
    });
  }

  try {
    const res = await fetch("https://huggingface.co/api/datasets/" + repo + "/commit/main", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/x-ndjson",
      },
      body: ndjson,
    });
    if (!res.ok) {
      console.error("Memory write failed with status:", res.status);
      return NextResponse.json(
        { ok: false, error: "Memory persistence failed" },
        { status: 502 }
      );
    }
    const text = await res.text();

    return NextResponse.json({
      ok: true,
      url: "https://huggingface.co/datasets/" + repo + "/blob/main/" + file,
      latest: "https://huggingface.co/datasets/" + repo + "/blob/main/latest-z.json",
      hub: text,
    });
  } catch (error) {
    console.error("Memory write request failed:", error);
    return NextResponse.json(
      { ok: false, error: "Memory persistence unavailable" },
      { status: 502 }
    );
  }
}