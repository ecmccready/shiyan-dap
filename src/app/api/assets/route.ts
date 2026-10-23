import { NextResponse } from "next/server";
import { FOUNDER, SLEEP, type LedgerAsset } from "@/lib/ledger";
import { computeB, errorSignal, f, Self, yFromAsset } from "@/lib/outcomes";
import { toRecord } from "@/lib/protocol";

const OFFICIAL: LedgerAsset[] = [FOUNDER, SLEEP];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").toLowerCase();
  const state = searchParams.get("state");
  const domain = searchParams.get("domain") || "music";

  const self = Self([]);
  const b = computeB([]);

  const records = OFFICIAL.filter((a) => (state ? a.state === state : true))
    .filter((a) => !q || a.title.toLowerCase().includes(q) || a.id.includes(q))
    .map((a) => {
      const Y = yFromAsset(a.state);
      return toRecord(a, {
        Y,
        y: f(Y),
        e: errorSignal(Y),
        measurements: [],
        B: b,
        z: self.z,
        domain,
      });
    });

  return NextResponse.json({
    ok: true,
    protocol: "slice_v6",
    domain,
    count: records.length,
    z: self.z,
    assets: records,
  });
}

export async function POST(req: Request) {
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
  const title = typeof payload.title === "string" ? payload.title.trim() : "";
  const owner = payload.owner ?? "this session";
  const source = payload.source ?? "protocol register";
  if (
    !title ||
    title.length > 200 ||
    typeof owner !== "string" ||
    !owner.trim() ||
    owner.length > 200 ||
    typeof source !== "string" ||
    !source.trim() ||
    source.length > 500
  ) {
    return NextResponse.json(
      { ok: false, error: "Valid title, owner, and source are required" },
      { status: 400 }
    );
  }

  const asset: LedgerAsset = {
    id: "cl_" + Date.now(),
    title,
    creator: owner.trim(),
    owner: owner.trim(),
    buyer: "None yet",
    source: source.trim(),
    state: "unlisted",
  };

  return NextResponse.json({
    ok: true,
    protocol: "slice_v6",
    note: "Server issued the id. Client ledger must persist via writeExtra.",
    asset,
  });
}