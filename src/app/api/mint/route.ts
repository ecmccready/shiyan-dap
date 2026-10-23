import { NextRequest, NextResponse } from "next/server";
import { requireLevel4Write } from "@/lib/level4/write-auth";

export async function POST(req: NextRequest) {
  const denied = requireLevel4Write(req);
  if (denied) return denied;
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

  const payload = body as Record<string, unknown>;
  const assetId = payload.assetId ?? "cl_shiyan_yishu_001";
  const standard = payload.standard ?? "erc721";
  const title = payload.title ?? "Shiyan catalog";
  if (
    typeof assetId !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(assetId) ||
    typeof standard !== "string" ||
    !["erc721", "erc1155", "spl"].includes(standard) ||
    typeof title !== "string" ||
    !title.trim() ||
    title.length > 200
  ) {
    return NextResponse.json(
      { ok: false, error: "Invalid assetId, standard, or title" },
      { status: 400 }
    );
  }

  const record = {
    assetId,
    title,
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
    try {
      const response = await fetch(
        "https://huggingface.co/api/datasets/" + repo + "/commit/main",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer " + token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            summary: "queue " + standard + " " + assetId,
            operations: [
              {
                operation: "addOrUpdate",
                path,
                text: JSON.stringify(record, null, 2),
              },
            ],
          }),
        }
      );
      if (!response.ok) {
        console.error("Mint persistence failed with status:", response.status);
        return NextResponse.json(
          { ok: false, error: "Mint persistence failed" },
          { status: 502 }
        );
      }
    } catch (error) {
      console.error("Mint persistence request failed:", error);
      return NextResponse.json(
        { ok: false, error: "Mint persistence unavailable" },
        { status: 502 }
      );
    }
  }

  return NextResponse.json({ ok: true, record });
}