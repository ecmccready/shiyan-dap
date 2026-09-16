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
  const body = await req.json().catch(() => ({}));
  const title = String(body.title || "").trim();
  if (!title) {
    return NextResponse.json({ ok: false, error: "title required" }, { status: 400 });
  }

  const asset: LedgerAsset = {
    id: "cl_" + Date.now(),
    title,
    creator: String(body.owner || "this session"),
    owner: String(body.owner || "this session"),
    buyer: "None yet",
    source: String(body.source || "protocol register"),
    state: "unlisted",
  };

  return NextResponse.json({
    ok: true,
    protocol: "slice_v6",
    note: "Server issued the id. Client ledger must persist via writeExtra.",
    asset,
  });
}